// RNA synthesis module separated into its own file.
// This script expects the main HTML to define elements with ids:
// - rna-board: a container panel for the RNA synthesis area
// - rna-svg: an SVG element for drawing phosphodiester bonds and pairing lines
// - rna-pal: a palette container where nucleotide templates are placed
// - rna-water: a button that will spawn a free water droplet
// - rna-reset: a button that clears all items and bonds from the board
// It provides drag‑and‑drop nucleotides, dynamic phosphodiester bond formation
// with dehydration (hiding participating labels), spawning of water droplets,
// dynamic hydrolysis detection, and pairwise base pairing.  The RNA module
// differs from DNA in that it uses uracil (U) instead of thymine (T).

(() => {
  const module = 'rna';
  const board = document.getElementById(module + '-board');
  const svg   = document.getElementById(module + '-svg');
  const pal   = document.getElementById(module + '-pal');
  if(!board || !svg || !pal) return;

  const items = [];
  const bonds = [];
  const pairs = [];
  const CARD_W = 190;
  const CARD_H = 132;
  // Distance the base is offset from the sugar when cloned from palette (smaller brings bases closer)
  const BASE_OFFSET = 20;

  // Helper functions for drawing SVG primitives
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

  // Spawn a draggable water droplet on the board.  The caller may attach
  // additional pointerup listeners to detect hydrolysis.  Droplets can be
  // removed with double-click.
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

  // Utility: return the absolute position of the given port ("oh" or "p5") on an item
  function getPort(it, which) {
    const el = it.el.querySelector(which === 'oh' ? '.port.oh' : '.port.p5');
    const r  = el.getBoundingClientRect();
    const wr = board.getBoundingClientRect();
    return { x: r.left + 8 - wr.left, y: r.top + 8 - wr.top };
  }

  // Utility: compute base pairing anchor (outer edge of base)
  function baseAnchor(it) {
    const base = it.el.querySelector('.base');
    const br   = base.getBoundingClientRect();
    const wr   = board.getBoundingClientRect();
    const side = it.side || base.dataset.side;
    if (side === 'right') {
      return { x: br.right - wr.left, y: br.top + br.height / 2 - wr.top };
    } else {
      return { x: br.left - wr.left, y: br.top + br.height / 2 - wr.top };
    }
  }

  // Compute line endpoints that connect just outside two circles (used for bond)
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

  // Nucleotide variants for RNA: A, U, C, G; each has two orientations (R and L)
  function v(base, shape, sex) {
    return [
      { base, shape, sex, orient: 'R', side: 'right' },
      { base, shape, sex, orient: 'L', side: 'left' }
    ];
  }
  const variants = [
    ...v('A', 'circle', 'peg'),
    ...v('U', 'circle', 'socket'),
    ...v('C', 'tri',    'peg'),
    ...v('G', 'tri',    'socket')
  ];

  // Generate a nucleotide DOM element based on configuration
  function makeNuc(cfg) {
    const el = document.createElement('div');
    el.className = 'nuc orient-' + cfg.orient;
    el.dataset.base = cfg.base;
    el.dataset.shape = cfg.shape;
    el.dataset.sex = cfg.sex;
    el.dataset.side = cfg.side;
    el.innerHTML = `
      <div class="phos">P</div>
      <div class="port p5" data-port="p5" title="5'-P"></div>
      <div class="sugar rna" title="核糖"></div>
      <div class="port oh" data-port="oh" title="3'-OH"></div>
      <div class="lbl p">5'</div>
      <div class="lbl s">3'</div>
      <div class="base ${cfg.base}" data-shape="${cfg.shape}" data-sex="${cfg.sex}" data-side="${cfg.side}">${cfg.base}</div>
      <svg class="intra"></svg>
    `;
    return el;
  }

  // Place template nucleotides into palette
  variants.forEach(cfg => {
    const el = makeNuc(cfg);
    el.dataset.palette = '1';
    el.style.position = 'relative';
    pal.appendChild(el);
    layoutNuc(el);
  });

  // Internal layout of a nucleotide card
  function layoutNuc(el) {
    const orient = el.classList.contains('orient-L') ? 'L' : 'R';
    const sugar  = el.querySelector('.sugar');
    const phos   = el.querySelector('.phos');
    const oh     = el.querySelector('.port.oh');
    const p5     = el.querySelector('.port.p5');
    const base   = el.querySelector('.base');
    const intra  = el.querySelector('svg.intra');

    // Determine if this is a template (palette) or a cloned instance.  In the
    // palette we do not offset the base; on the board we offset by ±BASE_OFFSET
    const isPal = el.dataset.palette === '1';
    if (orient === 'R') {
      base.style.right = isPal ? '10px' : (-BASE_OFFSET) + 'px';
      base.style.left  = 'auto';
    } else {
      base.style.left  = isPal ? '10px' : (-BASE_OFFSET) + 'px';
      base.style.right = 'auto';
    }

    // Identify sugar key vertices for internal lines
    const sx = sugar.offsetLeft;
    const sy = sugar.offsetTop;
    const sw = sugar.offsetWidth;
    const sh = sugar.offsetHeight;
    // Top-left and top-right approximate C5' vertices; bottom-left approximate C3'
    const v_tl = { x: sx + 0.00 * sw, y: sy + 0.36 * sh };
    const v_tr = { x: sx + 1.00 * sw, y: sy + 0.36 * sh };
    const v_ll = { x: sx + 0.18 * sw, y: sy + 1.00 * sh };

    // Position 3'-OH port around the v_ll vertex
    oh.style.left = (v_ll.x - 7) + 'px';
    oh.style.top  = (v_ll.y - 7) + 'px';

    // Position 5'-P port at the top of the phosphate circle
    const phx = phos.offsetLeft + phos.offsetWidth / 2;
    const phy = phos.offsetTop;
    p5.style.left = (phx - 8) + 'px';
    p5.style.top  = (phy - 8) + 'px';

    // Draw internal lines: phosphate-sugar, sugar-OH, sugar-base
    intra.setAttribute('viewBox', `0 0 ${CARD_W} ${CARD_H}`);
    while (intra.firstChild) intra.removeChild(intra.firstChild);
    // P–S: from circle edge to sugar vertex; choose correct vertex based on orient
    const pcx = phos.offsetLeft + phos.offsetWidth / 2;
    const pcy = phos.offsetTop  + phos.offsetHeight / 2;
    const rc  = phos.offsetWidth / 2;
    const STop = orient === 'R' ? v_tl : v_tr;
    const dx1 = STop.x - pcx;
    const dy1 = STop.y - pcy;
    const len1 = Math.hypot(dx1, dy1) || 1;
    const px1  = pcx + dx1 / len1 * (rc - 2);
    const py1  = pcy + dy1 / len1 * (rc - 2);
    mkLine(intra, px1, py1, STop.x, STop.y, '#ef4444', 2);
    // S–OH: from sugar bottom-left to OH edge
    const ohc = { x: oh.offsetLeft + 8, y: oh.offsetTop + 8 };
    const dx2 = ohc.x - v_ll.x;
    const dy2 = ohc.y - v_ll.y;
    const len2 = Math.hypot(dx2, dy2) || 1;
    const ox2 = ohc.x - dx2 / len2 * 8;
    const oy2 = ohc.y - dy2 / len2 * 8;
    mkLine(intra, v_ll.x, v_ll.y, ox2, oy2, '#0ea5e9', 2);
    // S–Base: from top sugar vertex (orient based) to base edge mid point
    const br = base.getBoundingClientRect();
    const wr = el.getBoundingClientRect();
    const baseLeft  = br.left - wr.left;
    const baseRight = br.right - wr.left;
    const baseMidY  = br.top - wr.top + br.height / 2;
    const baseEdgeX = orient === 'R' ? baseLeft : baseRight;
    const sugarVertex = orient === 'R' ? v_tr : v_tl;
    mkLine(intra, sugarVertex.x, sugarVertex.y, baseEdgeX, baseMidY, '#64748b', 2);
  }

  // Create a clone of a template nucleotide and add to board
  function cloneTemplate(tpl, x, y) {
    const clone = tpl.cloneNode(true);
    clone.dataset.palette = '0';
    clone.style.position = 'absolute';
    clone.style.left = x + 'px';
    clone.style.top  = y + 'px';
    board.appendChild(clone);
    // Assign unique id and meta
    const id = 'n' + Math.random().toString(36).slice(2);
    clone.dataset.id = id;
    // Determine baseType, shape, sex, side, orient
    const baseType = clone.dataset.base;
    const shape    = clone.dataset.shape;
    const sex      = clone.dataset.sex;
    const side     = clone.dataset.side;
    const orient   = clone.classList.contains('orient-L') ? 'L' : 'R';
    items.push({ id, el: clone, pos: { x, y }, leftFree: true, rightFree: true, baseType, shape, sex, side, orient });
    // Layout this clone (offset base)
    layoutNuc(clone);
    return clone;
  }

  // Attempt to form phosphodiester bond between two items
  function formPhos(L, R) {
    L.rightFree = false;
    R.leftFree  = false;
    const A = getPort(L, 'oh');
    const P = getPort(R, 'p5');
    const e = edge(A, P, 10, 10);
    const line = mkLine(svg, e.x1, e.y1, e.x2, e.y2, '#0ea5e9', 5);
    const rect = mkRect(svg, (e.x1 + e.x2) / 2 - 70, (e.y1 + e.y2) / 2 - 16, 140, 28, 8, '#2563eb');
    const txt  = mkText(svg, (e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2 + 6, "磷酸二酯键 5'→3'");
    // Hide the group labels on participants: on L hide 3' label; on R hide 5' label and the 'P'
    const sLbl = L.el.querySelector('.lbl.s');
    const pLbl = R.el.querySelector('.lbl.p');
    const pEl  = R.el.querySelector('.phos');
    const sOld = sLbl ? sLbl.textContent : '';
    const pOldLbl = pLbl ? pLbl.textContent : '';
    const pOldTxt = pEl ? pEl.textContent : '';
    if (sLbl) sLbl.textContent = '';
    if (pLbl) pLbl.textContent = '';
    if (pEl)  pEl.textContent  = '';
    // Register bond
    const bondRef = { l: L.id, r: R.id, line, rect, txt, sLbl, pLbl, pEl, sOld, pOldLbl, pOldTxt, w: null };
    bonds.push(bondRef);
    // Spawn water droplet; attach dynamic hydrolysis detection
    const w = spawnWater((e.x1 + e.x2) / 2 - 20, (e.y1 + e.y2) / 2 - 50);
    bondRef.w = w;
    w.addEventListener('pointerup', () => {
      // Recompute bond mid point based on current port positions
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
        // Remove bond visuals
        [bondRef.line, bondRef.rect, bondRef.txt].forEach(elm => elm.remove());
        // Restore free flags
        Lc.rightFree = true;
        Rc.leftFree  = true;
        // Restore labels
        if (bondRef.sLbl) bondRef.sLbl.textContent = bondRef.sOld;
        if (bondRef.pLbl) bondRef.pLbl.textContent = bondRef.pOldLbl;
        if (bondRef.pEl)  bondRef.pEl.textContent  = bondRef.pOldTxt;
        // Remove bond from list
        const idx = bonds.indexOf(bondRef);
        if (idx >= 0) bonds.splice(idx, 1);
        // Remove water droplet
        w.remove();
      }
    });
  }

  // Attempt to pair complementary bases (A-U, U-A, C-G, G-C) when near
  function tryPair(a, b) {
    const shapeOK = a.shape === b.shape;
    const sexOK   = a.sex !== b.sex;
    const faceOK  = (a.side === 'right' && b.side === 'left') || (a.side === 'left' && b.side === 'right');
    const comp = (a.baseType === 'A' && b.baseType === 'U') ||
                 (a.baseType === 'U' && b.baseType === 'A') ||
                 (a.baseType === 'C' && b.baseType === 'G') ||
                 (a.baseType === 'G' && b.baseType === 'C');
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

  // Handle dragging of nucleotides
  let drag = null;
  board.addEventListener('pointerdown', ev => {
    const card = ev.target.closest('#tab-' + module + ' .nuc');
    if (!card) return;
    const id = card.dataset.id;
    if (card.dataset.palette === '1') {
      // Clone template
      const rect = board.getBoundingClientRect();
      const x = ev.clientX - rect.left - CARD_W / 2;
      const y = ev.clientY - rect.top  - CARD_H / 2;
      cloneTemplate(card, x, y).setPointerCapture(ev.pointerId);
      return;
    }
    // Move existing card
    const it = items.find(a => a.id === id);
    card.setPointerCapture(ev.pointerId);
    const r  = board.getBoundingClientRect();
    drag = { id, ox: ev.clientX - r.left - it.pos.x, oy: ev.clientY - r.top - it.pos.y };
    card.classList.add('dragging');
  });
  board.addEventListener('pointermove', ev => {
    if (!drag) return;
    const it = items.find(a => a.id === drag.id);
    const r  = board.getBoundingClientRect();
    it.pos.x = ev.clientX - r.left - drag.ox;
    it.pos.y = ev.clientY - r.top  - drag.oy;
    it.el.style.left = it.pos.x + 'px';
    it.el.style.top  = it.pos.y + 'px';
    // Update all phosphodiester bonds and base pair lines
    refresh();
  });
  board.addEventListener('pointerup', () => {
    if (!drag) return;
    const A = items.find(a => a.id === drag.id);
    const el = A && A.el;
    if (el) el.classList.remove('dragging');
    // Check for potential bond formation
    for (const B of items) {
      if (B.id === A.id) continue;
      // Try A.oh -> B.p5
      if (A.rightFree && B.leftFree) {
        const aPos = getPort(A, 'oh');
        const bPos = getPort(B, 'p5');
        if (Math.hypot(aPos.x - bPos.x, aPos.y - bPos.y) < 24) {
          formPhos(A, B);
          break;
        }
      }
      // Try B.oh -> A.p5
      if (B.rightFree && A.leftFree) {
        const aPos = getPort(A, 'p5');
        const bPos = getPort(B, 'oh');
        if (Math.hypot(aPos.x - bPos.x, aPos.y - bPos.y) < 24) {
          formPhos(B, A);
          break;
        }
      }
    }
    // Try base pairing for A and others
    for (const B of items) {
      if (B.id === A.id) continue;
      tryPair(A, B);
      tryPair(B, A);
    }
    drag = null;
  });

  // Refresh positions of all bonds and pairs
  function refresh() {
    bonds.forEach(b => {
      const L = items.find(a => a.id === b.l);
      const R = items.find(a => a.id === b.r);
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
      b.txt.setAttribute('x', mx);
      b.txt.setAttribute('y', my + 6);
    });
    pairs.forEach(p => {
      const A = baseAnchor(items.find(i => i.id === p.a));
      const B = baseAnchor(items.find(i => i.id === p.b));
      p.line.setAttribute('x1', A.x);
      p.line.setAttribute('y1', A.y);
      p.line.setAttribute('x2', B.x);
      p.line.setAttribute('y2', B.y);
    });
  }

  // Control buttons: spawn water and reset board
  const waterBtn = document.getElementById('rna-water');
  const resetBtn = document.getElementById('rna-reset');
  if (waterBtn) {
    waterBtn.addEventListener('click', () => {
      spawnWater(40, 220);
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      items.forEach(it => it.el.remove());
      items.length = 0;
      bonds.length = 0;
      pairs.forEach(p => p.line.remove());
      pairs.length = 0;
      // Recreate palette clones (the originals remain in the palette)
    });
  }
})();