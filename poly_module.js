// Polysaccharide (multiple sugar) synthesis module separated as its own file.
// This script expects the main HTML to define elements with ids:
// - poly-board: a container panel for the polysaccharide synthesis area
// - poly-svg: an SVG element for drawing glycosidic bonds
// - poly-pal: a palette container where sugar templates are placed
// - poly-water: a button that will spawn a free water droplet
// - poly-reset: a button that clears all sugars and bonds from the board
// It allows drag‑and‑drop monosaccharides, formation of glycosidic bonds with
// dehydration (hiding the participating port circles), spawning of water
// droplets for hydrolysis, and dynamic hydrolysis detection.  This version
// focuses on C1–C4 (left–right) linkages and does not implement branching.

(() => {
  const board = document.getElementById('poly-board');
  const svg   = document.getElementById('poly-svg');
  const pal   = document.getElementById('poly-pal');
  if(!board || !svg || !pal) return;

  const sugars = [];
  const bonds  = [];
  const CARD_W = 160;
  const CARD_H = 130;
  // List of monosaccharides (Chinese names) to include in the palette
  const NAMES = [
    '葡萄糖','果糖','半乳糖','甘露糖','岩藻糖','鼠李糖','N-乙酰葡萄糖胺','N-乙酰半乳糖胺'
  ];

  // Helper: draw a line on the module's SVG
  function mkLine(x1, y1, x2, y2, stroke = '#0ea5e9', w = 4) {
    const L = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    L.setAttribute('x1', x1);
    L.setAttribute('y1', y1);
    L.setAttribute('x2', x2);
    L.setAttribute('y2', y2);
    L.setAttribute('stroke', stroke);
    L.setAttribute('stroke-width', w);
    L.setAttribute('stroke-linecap', 'round');
    svg.appendChild(L);
    return L;
  }
  function mkRect(x, y, w, h, r, fill = '#fb923c') {
    const R = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    R.setAttribute('x', x);
    R.setAttribute('y', y);
    R.setAttribute('width', w);
    R.setAttribute('height', h);
    R.setAttribute('rx', r);
    R.setAttribute('fill', fill);
    svg.appendChild(R);
    return R;
  }
  function mkText(x, y, str, fill = '#fff') {
    const T = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    T.setAttribute('x', x);
    T.setAttribute('y', y);
    T.setAttribute('text-anchor', 'middle');
    T.setAttribute('font-size', '12');
    T.setAttribute('font-weight', '700');
    T.setAttribute('fill', fill);
    T.textContent = str;
    svg.appendChild(T);
    return T;
  }

  // Spawn a water droplet on the board; double-click to remove.  The caller
  // attaches pointerup events for hydrolysis detection.
  function spawnWater(x = 30, y = 200) {
    const el = document.createElement('div');
    el.className = 'water';
    el.textContent = 'H₂O';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    board.appendChild(el);
    let drag = null;
    el.addEventListener('pointerdown', e => {
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      const r = board.getBoundingClientRect();
      drag = {
        ox: e.clientX - r.left - parseFloat(el.style.left),
        oy: e.clientY - r.top  - parseFloat(el.style.top)
      };
    });
    el.addEventListener('pointermove', e => {
      if (!drag) return;
      const r = board.getBoundingClientRect();
      el.style.left = (e.clientX - r.left - drag.ox) + 'px';
      el.style.top  = (e.clientY - r.top  - drag.oy) + 'px';
    });
    el.addEventListener('pointerup', () => { drag = null; });
    el.addEventListener('dblclick', () => el.remove());
    return el;
  }

  // Compute the absolute position of a given port (left or right) on a sugar
  function portPos(it, which) {
    const el = it.el.querySelector(which === 'left' ? '.p-left' : '.p-right');
    const r  = el.getBoundingClientRect();
    const wr = board.getBoundingClientRect();
    return { x: r.left + 8 - wr.left, y: r.top + 8 - wr.top };
  }

  // Compute edge endpoints (for drawing bonds) connecting two ports
  function edge(a, b, ra = 8, rb = 8) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d  = Math.hypot(dx, dy) || 1;
    return {
      x1: a.x + dx / d * ra,
      y1: a.y + dy / d * ra,
      x2: b.x - dx / d * rb,
      y2: b.y - dy / d * rb
    };
  }

  // Create a monosaccharide template for the palette
  function makeSugar(name) {
    const el = document.createElement('div');
    el.className = 'mono';
    el.dataset.palette = '1';
    el.dataset.kind = name;
    el.style.position = 'relative';
    el.innerHTML = `
      <div class="hex"></div>
      <div class="port p-left" data-port="left"></div>
      <div class="port p-right" data-port="right"></div>
      <div class="name">${name}</div>
      <svg class="intra"></svg>
    `;
    return el;
  }

  // Draw internal lines for a sugar card (left to right center line)
  function layoutSugar(el) {
    const intra = el.querySelector('svg.intra');
    if (!intra) return;
    intra.setAttribute('viewBox', `0 0 ${CARD_W} ${CARD_H}`);
    while (intra.firstChild) intra.removeChild(intra.firstChild);
    // Draw a line from left port to right port across the hexagon (approx center)
    const left = el.querySelector('.p-left');
    const right = el.querySelector('.p-right');
    const lp = { x: left.offsetLeft + 8, y: left.offsetTop + 8 };
    const rp = { x: right.offsetLeft + 8, y: right.offsetTop + 8 };
    const midY = (lp.y + rp.y) / 2;
    mkLine(lp.x, midY, rp.x, midY, '#60a5fa', 2);
  }

  // Initialize palette
  NAMES.forEach(name => {
    const tpl = makeSugar(name);
    pal.appendChild(tpl);
    layoutSugar(tpl);
  });

  // Form a glycosidic bond between two sugars
  function formBond(L, R, portL, portR) {
    // Mark ports as used
    L.free[portL] = false;
    R.free[portR] = false;
    // Hide port circles to indicate dehydration
    const elL = L.el.querySelector(portL === 'left' ? '.p-left' : '.p-right');
    const elR = R.el.querySelector(portR === 'left' ? '.p-left' : '.p-right');
    const oldDisplayL = elL.style.display;
    const oldDisplayR = elR.style.display;
    elL.style.display = 'none';
    elR.style.display = 'none';
    // Draw bond line and label
    const A = portPos(L, portL);
    const B = portPos(R, portR);
    const e = edge(A, B);
    const line = mkLine(e.x1, e.y1, e.x2, e.y2, '#0284c7', 4);
    const rect = mkRect((e.x1 + e.x2) / 2 - 40, (e.y1 + e.y2) / 2 - 16, 80, 28, 8, '#7dd3fc');
    const txt  = mkText((e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2 + 6, '糖苷键');
    // Save bond info including hidden port references and their original display
    const bondRef = { lId: L.id, rId: R.id, portL, portR, line, rect, txt, elL, elR, oldDisplayL, oldDisplayR, w: null };
    bonds.push(bondRef);
    // Spawn water droplet for hydrolysis
    const w = spawnWater((e.x1 + e.x2) / 2 - 20, (e.y1 + e.y2) / 2 - 50);
    bondRef.w = w;
    w.addEventListener('pointerup', () => {
      // Recompute positions of the ports dynamically
      const Lc = sugars.find(s => s.id === bondRef.lId);
      const Rc = sugars.find(s => s.id === bondRef.rId);
      if (!Lc || !Rc) return;
      const A2 = portPos(Lc, bondRef.portL);
      const B2 = portPos(Rc, bondRef.portR);
      const e2 = edge(A2, B2);
      const mx = (e2.x1 + e2.x2) / 2;
      const my = (e2.y1 + e2.y2) / 2;
      const wx = parseFloat(w.style.left) + 20;
      const wy = parseFloat(w.style.top)  + 20;
      if (Math.hypot(wx - mx, wy - my) < 40) {
        // Remove bond visuals
        [bondRef.line, bondRef.rect, bondRef.txt].forEach(elm => elm.remove());
        // Restore port visibility
        bondRef.elL.style.display = bondRef.oldDisplayL;
        bondRef.elR.style.display = bondRef.oldDisplayR;
        // Restore free flags
        Lc.free[bondRef.portL] = true;
        Rc.free[bondRef.portR] = true;
        // Remove bond from list
        const idx = bonds.indexOf(bondRef);
        if (idx >= 0) bonds.splice(idx, 1);
        // Remove water droplet
        w.remove();
      }
    });
  }

  // Refresh bond line positions when sugars move
  function refresh() {
    bonds.forEach(b => {
      const L = sugars.find(s => s.id === b.lId);
      const R = sugars.find(s => s.id === b.rId);
      if (!L || !R) return;
      const A = portPos(L, b.portL);
      const B = portPos(R, b.portR);
      const e = edge(A, B);
      b.line.setAttribute('x1', e.x1);
      b.line.setAttribute('y1', e.y1);
      b.line.setAttribute('x2', e.x2);
      b.line.setAttribute('y2', e.y2);
      const mx = (e.x1 + e.x2) / 2;
      const my = (e.y1 + e.y2) / 2;
      b.rect.setAttribute('x', mx - 40);
      b.rect.setAttribute('y', my - 16);
      b.txt.setAttribute('x', mx);
      b.txt.setAttribute('y', my + 6);
    });
  }

  // Handle dragging and cloning sugars
  let drag = null;
  board.addEventListener('pointerdown', ev => {
    const card = ev.target.closest('#tab-poly .mono');
    if (!card) return;
    const rect = board.getBoundingClientRect();
    if (card.dataset.palette === '1') {
      // Clone template into board
      const x = ev.clientX - rect.left - CARD_W / 2;
      const y = ev.clientY - rect.top  - CARD_H / 2;
      const clone = card.cloneNode(true);
      clone.dataset.palette = '0';
      clone.style.position = 'absolute';
      clone.style.left = x + 'px';
      clone.style.top  = y + 'px';
      board.appendChild(clone);
      // Assign unique id and free status
      const id = 'm' + Math.random().toString(36).slice(2);
      clone.dataset.id = id;
      sugars.push({ id, el: clone, pos: { x, y }, free: { left: true, right: true } });
      layoutSugar(clone);
      clone.setPointerCapture(ev.pointerId);
      return;
    }
    // Move existing sugar
    const id = card.dataset.id;
    const it = sugars.find(s => s.id === id);
    if (!it) return;
    card.setPointerCapture(ev.pointerId);
    drag = { id, ox: ev.clientX - rect.left - it.pos.x, oy: ev.clientY - rect.top - it.pos.y };
    card.classList.add('dragging');
  });
  board.addEventListener('pointermove', ev => {
    if (!drag) return;
    const it = sugars.find(s => s.id === drag.id);
    const rect = board.getBoundingClientRect();
    it.pos.x = ev.clientX - rect.left - drag.ox;
    it.pos.y = ev.clientY - rect.top  - drag.oy;
    it.el.style.left = it.pos.x + 'px';
    it.el.style.top  = it.pos.y + 'px';
    refresh();
  });
  board.addEventListener('pointerup', () => {
    if (!drag) return;
    const A = sugars.find(s => s.id === drag.id);
    if (A && A.el) A.el.classList.remove('dragging');
    // Attempt to form bonds with other sugars
    for (const B of sugars) {
      if (B.id === A.id) continue;
      // A.right -> B.left
      if (A.free.right && B.free.left) {
        const aPos = portPos(A, 'right');
        const bPos = portPos(B, 'left');
        if (Math.hypot(aPos.x - bPos.x, aPos.y - bPos.y) < 26) {
          formBond(A, B, 'right', 'left');
          break;
        }
      }
      // B.right -> A.left
      if (B.free.right && A.free.left) {
        const aPos = portPos(A, 'left');
        const bPos = portPos(B, 'right');
        if (Math.hypot(aPos.x - bPos.x, aPos.y - bPos.y) < 26) {
          formBond(B, A, 'right', 'left');
          break;
        }
      }
    }
    drag = null;
  });

  // Control buttons: spawn water and reset board
  const waterBtn = document.getElementById('poly-water');
  const resetBtn = document.getElementById('poly-reset');
  if (waterBtn) {
    waterBtn.addEventListener('click', () => {
      spawnWater(40, 220);
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      sugars.forEach(s => s.el.remove());
      sugars.length = 0;
      bonds.length = 0;
    });
  }
})();