// DNA synthesis module separated into its own file.
// This script assumes HTML elements with ids "dna-board", "dna-svg", and "dna-pal" exist,
// along with buttons #dna-water and #dna-reset. It provides drag-and-drop nucleotides,
// dynamic phosphodiester bond formation with dehydration (hiding participating labels),
// spawning of water droplets, dynamic hydrolysis detection, and pairwise base pairing.

(() => {
  const module = 'dna';
  const board = document.getElementById(module + '-board');
  const svg   = document.getElementById(module + '-svg');
  const pal   = document.getElementById(module + '-pal');
  if(!board || !svg || !pal) return;

  const items = [];
  const bonds = [];
  const pairs = [];
  const CARD_W = 190;
  const CARD_H = 132;
  // Distance the base is offset from the sugar when cloned from palette (smaller is closer)
  const BASE_OFFSET = 20;

  // Helper functions for drawing
  function mkLine(parent, x1, y1, x2, y2, stroke, w) {
    const L = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    L.setAttribute('x1', x1);
    L.setAttribute('y1', y1);
    L.setAttribute('x2', x2);
    L.setAttribute('y2', y2);
    L.setAttribute('stroke', stroke);
    L.setAttribute('stroke-width', w);
    L.setAttribute('stroke-linecap', 'round');
    parent.appendChild(L);
    return L;
  }
  function mkRect(parent, x, y, w, h, r, fill) {
    const R = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    R.setAttribute('x', x);
    R.setAttribute('y', y);
    R.setAttribute('width', w);
    R.setAttribute('height', h);
    R.setAttribute('rx', r);
    R.setAttribute('fill', fill);
    parent.appendChild(R);
    return R;
  }
  function mkText(parent, x, y, str, fill = '#fff') {
    const T = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    T.setAttribute('x', x);
    T.setAttribute('y', y);
    T.setAttribute('text-anchor', 'middle');
    T.setAttribute('font-size', '12');
    T.setAttribute('font-weight', '700');
    T.setAttribute('fill', fill);
    T.textContent = str;
    parent.appendChild(T);
    return T;
  }

  // Spawn a draggable water droplet; caller attaches pointerup for hydrolysis detection
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

  // Utility to get the absolute position of a port (3'-OH or 5'-P) relative to board
  function getPort(it, which) {
    const el = it.el.querySelector(which === 'oh' ? '.port.oh' : '.port.p5');
    const r = el.getBoundingClientRect();
    const wr = board.getBoundingClientRect();
    return { x: r.left + 8 - wr.left, y: r.top + 8 - wr.top };
  }

  // Get the anchor point for base pairing (outer edge of base)
  function baseAnchor(it) {
    const base = it.el.querySelector('.base');
    const br = base.getBoundingClientRect();
    const wr = board.getBoundingClientRect();
    const side = it.side || base.dataset.side;
    return side === 'right'
      ? { x: br.right - wr.left, y: br.top + br.height / 2 - wr.top }
      : { x: br.left - wr.left,  y: br.top + br.height / 2 - wr.top };
  }

  // Edge helper: compute line endpoints between two ports, offsetting by radii
  function edge(a, b, ra = 10, rb = 10) {
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

  // Simple proximity check for forming bonds and pairings
  function near(a, b, thresh = 22) {
    return Math.hypot(a.x - b.x, a.y - b.y) < thresh;
  }

  // Definitions for nucleotides (base name, interface shape, sex) and orientation
  function variants() {
    const v = (base, shape, sex) => [
      { base, shape, sex, orient: 'R', side: 'right' },
      { base, shape, sex, orient: 'L', side: 'left'  }
    ];
    // DNA uses T instead of U
    return [
      ...v('A', 'circle', 'peg'),
      ...v('T', 'circle', 'socket'),
      ...v('C', 'tri',    'peg'),
      ...v('G', 'tri',    'socket')
    ];
  }

  // Create a nucleotide DOM element
  function makeNuc(cfg) {
    const el = document.createElement('div');
    el.className = 'nuc orient-' + cfg.orient;
    el.dataset.base = cfg.base;
    el.innerHTML = `
      <div class="phos">P</div>
      <div class="port p5" data-port="p5" title="5'-P"></div>
      <div class="sugar dna" title="脱氧核糖"></div>
      <div class="port oh" data-port="oh" title="3'-OH"></div>
      <div class="lbl p">5'</div>
      <div class="lbl s">3'</div>
      <div class="base ${cfg.base}" data-shape="${cfg.shape}" data-sex="${cfg.sex}" data-side="${cfg.side}">${cfg.base}</div>
      <svg class="intra"></svg>`;
    return el;
  }

  // Lay out a nucleotide's internal parts and connecting lines
  function layoutNuc(el) {
    const orient = el.classList.contains('orient-L') ? 'L' : 'R';
    const sugar  = el.querySelector('.sugar');
    const phos   = el.querySelector('.phos');
    const ohPort = el.querySelector('.port.oh');
    const p5Port = el.querySelector('.port.p5');
    const base   = el.querySelector('.base');
    const intra  = el.querySelector('svg.intra');
    const pLbl   = el.querySelector('.lbl.p');
    const sLbl   = el.querySelector('.lbl.s');
    const isPalette = el.dataset.palette === '1';
    // Base offset: palette items have no offset; clones have negative offset to push base away
    if (orient === 'R') {
      base.style.right = isPalette ? '10px' : (-BASE_OFFSET) + 'px';
      base.style.left  = 'auto';
    } else {
      base.style.left  = isPalette ? '10px' : (-BASE_OFFSET) + 'px';
      base.style.right = 'auto';
    }
    // Determine sugar vertices for connecting lines
    const sx = sugar.offsetLeft;
    const sy = sugar.offsetTop;
    const sw = sugar.offsetWidth;
    const sh = sugar.offsetHeight;
    const v_tl = { x: sx + 0.00 * sw, y: sy + 0.36 * sh };
    const v_tr = { x: sx + 1.00 * sw, y: sy + 0.36 * sh };
    const v_ll = { x: sx + 0.18 * sw, y: sy + 1.00 * sh };
    const v_lr = { x: sx + 0.82 * sw, y: sy + 1.00 * sh };
    // Position 3'-OH port: R uses left lower vertex; L uses right lower vertex
    const ohPos = orient === 'R' ? v_ll : v_lr;
    ohPort.style.left = (ohPos.x - 7) + 'px';
    ohPort.style.top  = (ohPos.y - 7) + 'px';
    // Position 5'-P port: top of the phosphate circle
    const phx = phos.offsetLeft + phos.offsetWidth / 2;
    const phy = phos.offsetTop;
    p5Port.style.left = (phx - 8) + 'px';
    p5Port.style.top  = (phy - 8) + 'px';
    // Position labels near the sugar
    const fiveVertex = orient === 'R' ? v_tl : v_tr;
    pLbl.style.left = (fiveVertex.x - 8) + 'px';
    pLbl.style.top  = (fiveVertex.y - 18) + 'px';
    sLbl.style.left = (ohPos.x - 8) + 'px';
    sLbl.style.top  = (ohPos.y + 4) + 'px';
    // Draw internal lines on a fresh intra SVG
    intra.setAttribute('viewBox', `0 0 ${CARD_W} ${CARD_H}`);
    while (intra.firstChild) intra.removeChild(intra.firstChild);
    // Phosphate to sugar (to top vertex)
    const pcx = phos.offsetLeft + phos.offsetWidth / 2;
    const pcy = phos.offsetTop  + phos.offsetHeight / 2;
    const rc  = phos.offsetWidth / 2;
    const STop = orient === 'R' ? v_tl : v_tr;
    const dx1  = STop.x - pcx;
    const dy1  = STop.y - pcy;
    const len1 = Math.hypot(dx1, dy1) || 1;
    const px1  = pcx + dx1 / len1 * (rc - 2);
    const py1  = pcy + dy1 / len1 * (rc - 2);
    mkLine(intra, px1, py1, STop.x, STop.y, '#f97316', 2);
    // Sugar to OH port
    const ohc = { x: ohPort.offsetLeft + 8, y: ohPort.offsetTop + 8 };
    const dx2 = ohc.x - ohPos.x;
    const dy2 = ohc.y - ohPos.y;
    const len2 = Math.hypot(dx2, dy2) || 1;
    const ox2 = ohc.x - dx2 / len2 * 8;
    const oy2 = ohc.y - dy2 / len2 * 8;
    mkLine(intra, ohPos.x, ohPos.y, ox2, oy2, '#0284c7', 2);
    // Sugar to base edge
    const br = base.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const baseLeft  = br.left - er.left;
    const baseRight = br.right - er.left;
    const baseMidY  = br.top - er.top + br.height / 2;
    const baseEdgeX = orient === 'R' ? baseLeft : baseRight;
    const sugarV    = orient === 'R' ? v_tr : v_tl;
    mkLine(intra, sugarV.x, sugarV.y, baseEdgeX, baseMidY, '#475569', 2);
  }

  // Initialize the palette items
  variants().forEach(cfg => {
    const el = makeNuc(cfg);
    el.dataset.palette = '1';
    el.style.position = 'relative';
    pal.appendChild(el);
    layoutNuc(el);
  });

  // Refresh bond and pair positions
  function refresh() {
    bonds.forEach(b => {
      const L = items.find(x => x.id === b.l);
      const R = items.find(x => x.id === b.r);
      if (!L || !R) return;
      const A = getPort(L, 'oh');
      const P = getPort(R, 'p5');
      const e = edge(A, P, 10, 10);
      b.line.setAttribute('x1', e.x1);
      b.line.setAttribute('y1', e.y1);
      b.line.setAttribute('x2', e.x2);
      b.line.setAttribute('y2', e.y2);
      const mx = (e.x1 + e.x2) / 2;
      const my = (e.y1 + e.y2) / 2;
      b.rect.setAttribute('x', mx - 70);
      b.rect.setAttribute('y', my - 16);
      b.txt .setAttribute('x', mx);
      b.txt .setAttribute('y', my + 6);
    });
    pairs.forEach(p => {
      const A = baseAnchor(items.find(x => x.id === p.a));
      const B = baseAnchor(items.find(x => x.id === p.b));
      p.line.setAttribute('x1', A.x);
      p.line.setAttribute('y1', A.y);
      p.line.setAttribute('x2', B.x);
      p.line.setAttribute('y2', B.y);
    });
  }

  // Form a phosphodiester bond between two nucleotides
  function phos(L, R) {
    L.rightFree = false;
    R.leftFree  = false;
    const A = getPort(L, 'oh');
    const P = getPort(R, 'p5');
    const e = edge(A, P, 10, 10);
    const line = mkLine(svg, e.x1, e.y1, e.x2, e.y2, '#0ea5e9', 5);
    const rect = mkRect(svg, (e.x1 + e.x2) / 2 - 70, (e.y1 + e.y2) / 2 - 16, 140, 28, 8, '#2563eb');
    const txt  = mkText(svg, (e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2 + 6, "磷酸二酯键 5'→3'");
    // Hide the text on participating groups: on L hide 3' label; on R hide 5' label and the 'P' letter
    const sLbl = L.el.querySelector('.lbl.s');
    const pLbl = R.el.querySelector('.lbl.p');
    const pEl  = R.el.querySelector('.phos');
    const sOld = sLbl ? sLbl.textContent : '';
    const pOldLbl = pLbl ? pLbl.textContent : '';
    const pOldTxt = pEl ? pEl.textContent : '';
    if (sLbl) sLbl.textContent = '';
    if (pLbl) pLbl.textContent = '';
    if (pEl)  pEl.textContent  = '';
    bonds.push({
      l: L.id,
      r: R.id,
      line,
      rect,
      txt,
      sLbl,
      pLbl,
      pEl,
      sOld,
      pOldLbl,
      pOldTxt,
      w: null
    });
    // Spawn a water droplet; attach dynamic hydrolysis detection
    const w = spawnWater((e.x1 + e.x2) / 2 - 20, (e.y1 + e.y2) / 2 - 50);
    const bondRef = bonds[bonds.length - 1];
    bondRef.w = w;
    w.addEventListener('pointerup', () => {
      // Compute current mid-point of this bond
      const Lc = items.find(i => i.id === bondRef.l);
      const Rc = items.find(i => i.id === bondRef.r);
      if (!Lc || !Rc) return;
      const A2 = getPort(Lc, 'oh');
      const P2 = getPort(Rc, 'p5');
      const e2 = edge(A2, P2, 10, 10);
      const mx = (e2.x1 + e2.x2) / 2;
      const my = (e2.y1 + e2.y2) / 2;
      const wx = parseFloat(w.style.left) + 20;
      const wy = parseFloat(w.style.top)  + 20;
      if (Math.hypot(wx - mx, wy - my) < 40) {
        // Remove visuals
        [bondRef.line, bondRef.rect, bondRef.txt].forEach(elm => elm.remove());
        // Restore free flags
        Lc.rightFree = true;
        Rc.leftFree  = true;
        // Restore hidden labels
        if (bondRef.sLbl) bondRef.sLbl.textContent = bondRef.sOld;
        if (bondRef.pLbl) bondRef.pLbl.textContent = bondRef.pOldLbl;
        if (bondRef.pEl)  bondRef.pEl.textContent  = bondRef.pOldTxt;
        // Remove from bonds list
        const idx = bonds.indexOf(bondRef);
        if (idx >= 0) bonds.splice(idx, 1);
        // Remove water
        w.remove();
      }
    });
  }

  // Try to pair A/T and C/G across two bases
  function tryPair(a, b) {
    const shapeOK = a.shape === b.shape;
    const sexOK   = a.sex !== b.sex;
    const faceOK  = (a.side === 'right' && b.side === 'left') || (a.side === 'left' && b.side === 'right');
    const comp = (a.baseType === 'A' && b.baseType === 'T') || (a.baseType === 'T' && b.baseType === 'A') || (a.baseType === 'C' && b.baseType === 'G') || (a.baseType === 'G' && b.baseType === 'C');
    if (!(shapeOK && sexOK && faceOK && comp)) return;
    const A = baseAnchor(a);
    const B = baseAnchor(b);
    const dist = Math.hypot(A.x - B.x, A.y - B.y);
    if (dist < 30 && !pairs.find(p => (p.a === a.id && p.b === b.id) || (p.a === b.id && p.b === a.id))) {
      const line = mkLine(svg, A.x, A.y, B.x, B.y, '#94a3b8', 3);
      line.setAttribute('stroke-dasharray', '6 6');
      pairs.push({ a: a.id, b: b.id, line });
      line.addEventListener('dblclick', () => {
        const idx = pairs.findIndex(p => (p.a === a.id && p.b === b.id) || (p.a === b.id && p.b === a.id));
        if (idx >= 0) {
          pairs[idx].line.remove();
          pairs.splice(idx, 1);
        }
      });
    }
  }

  // Event handling for dragging and bonding
  let drag = null;
  board.addEventListener('pointerdown', ev => {
    const card = ev.target.closest('#tab-' + module + ' .nuc');
    if (!card) return;
    const rect = board.getBoundingClientRect();
    if (card.dataset.palette === '1') {
      // Clone from palette
      const clone = card.cloneNode(true);
      clone.dataset.palette = '0';
      clone.style.position = 'absolute';
      clone.style.left  = (ev.clientX - rect.left - CARD_W / 2) + 'px';
      clone.style.top   = (ev.clientY - rect.top  - CARD_H / 2) + 'px';
      board.appendChild(clone);
      layoutNuc(clone);
      const baseEl = clone.querySelector('.base');
      const meta = {
        baseType: clone.dataset.base || baseEl.textContent.trim(),
        shape: baseEl.dataset.shape,
        sex:   baseEl.dataset.sex,
        side:  baseEl.dataset.side,
        orient: clone.classList.contains('orient-L') ? 'L' : 'R'
      };
      const id = 'n' + Math.random().toString(36).slice(2);
      clone.dataset.id = id;
      items.push({ id, el: clone, pos: { x: parseFloat(clone.style.left), y: parseFloat(clone.style.top) }, leftFree: true, rightFree: true, ...meta });
      clone.setPointerCapture(ev.pointerId);
      drag = { id: clone.dataset.id, ox: CARD_W / 2, oy: CARD_H / 2 };
      clone.classList.add('dragging');
    } else {
      // Drag existing item
      const id = card.dataset.id;
      const it = items.find(a => a.id === id);
      card.setPointerCapture(ev.pointerId);
      drag = {
        id,
        ox: ev.clientX - rect.left - it.pos.x,
        oy: ev.clientY - rect.top  - it.pos.y
      };
      card.classList.add('dragging');
    }
  });
  board.addEventListener('pointermove', ev => {
    if (!drag) return;
    const it = items.find(a => a.id === drag.id);
    const r = board.getBoundingClientRect();
    it.pos.x = ev.clientX - r.left - drag.ox;
    it.pos.y = ev.clientY - r.top  - drag.oy;
    it.el.style.left = it.pos.x + 'px';
    it.el.style.top  = it.pos.y + 'px';
    refresh();
  });
  board.addEventListener('pointerup', () => {
    if (!drag) return;
    const A = items.find(a => a.id === drag.id);
    const el = A && A.el;
    if (el) el.classList.remove('dragging');
    // Form phosphodiester bonds if near
    for (const B of items) {
      if (B.id === A.id) continue;
      if (near(getPort(A, 'oh'), getPort(B, 'p5')) && A.rightFree && B.leftFree && !bonds.find(b => b.l === A.id && b.r === B.id)) {
        phos(A, B);
        break;
      }
      if (near(getPort(B, 'oh'), getPort(A, 'p5')) && B.rightFree && A.leftFree && !bonds.find(b => b.l === B.id && b.r === A.id)) {
        phos(B, A);
        break;
      }
    }
    // Try base pairing for all potential pairs
    for (const B of items) {
      if (B.id === A.id) continue;
      tryPair(A, B);
      tryPair(B, A);
    }
    drag = null;
  });

  // Water and reset controls
  document.getElementById(module + '-water').addEventListener('click', () => {
    spawnWater(40, 220);
  });
  document.getElementById(module + '-reset').addEventListener('click', () => {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    items.forEach(it => it.el.remove());
    items.length = 0;
    bonds.length = 0;
    pairs.forEach(p => p.line.remove());
    pairs.length = 0;
  });
})();