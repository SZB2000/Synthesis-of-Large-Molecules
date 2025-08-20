// Amino Acid (Protein) module separated as an independent JavaScript file.
// This script expects the following HTML structure inside the main page:
// <section id="tab-aa"> containing a .panel element with id="aa-svg" for the SVG layer
// and buttons #aa-water and #aa-reset for spawning water and resetting the canvas.
// It provides drag‑and‑drop amino acids, peptide bond formation with dehydration (hiding
// participating NH₂/COOH labels), water droplet for hydrolysis, and bond removal with
// restoration of labels.

(function(){
  const panel = document.querySelector('#tab-aa .panel');
  const svg   = document.getElementById('aa-svg');
  const CARD_W = 140, CARD_H = 86;
  const aminoList = [];
  const bonds     = [];

  // Complete list of 20 standard amino acids (names in Chinese).
  const NAMES = [
    "丙氨酸", "缬氨酸", "亮氨酸", "异亮氨酸", "苏氨酸",
    "色氨酸", "苯丙氨酸", "酪氨酸", "天冬氨酸", "天冬酰胺",
    "谷氨酸", "谷氨酰胺", "赖氨酸", "精氨酸", "组氨酸",
    "脯氨酸", "甘氨酸", "半胱氨酸", "蛋氨酸", "丝氨酸"
  ];

  // Random initial positions for palette elements.
  function randPos(i){ const m=24, c=4; return { x: m + (i % c) * (CARD_W + 60), y: m + Math.floor(i / c) * (CARD_H + 40) }; }

  // Basic SVG drawing helpers.
  function mkLine(svg,x1,y1,x2,y2,stroke,w){
    const L = document.createElementNS('http://www.w3.org/2000/svg','line');
    L.setAttribute('x1',x1); L.setAttribute('y1',y1);
    L.setAttribute('x2',x2); L.setAttribute('y2',y2);
    L.setAttribute('stroke',stroke); L.setAttribute('stroke-width',w);
    L.setAttribute('stroke-linecap','round');
    svg.appendChild(L); return L;
  }
  function mkRect(svg,x,y,w,h,r,fill){
    const R = document.createElementNS('http://www.w3.org/2000/svg','rect');
    R.setAttribute('x',x); R.setAttribute('y',y);
    R.setAttribute('width',w); R.setAttribute('height',h);
    R.setAttribute('rx',r);
    R.setAttribute('fill',fill);
    svg.appendChild(R); return R;
  }
  function mkText(svg,x,y,str,fill='#fff'){
    const T = document.createElementNS('http://www.w3.org/2000/svg','text');
    T.setAttribute('x',x); T.setAttribute('y',y);
    T.setAttribute('text-anchor','middle');
    T.setAttribute('font-size','12');
    T.setAttribute('font-weight','700');
    T.setAttribute('fill',fill);
    T.textContent=str;
    svg.appendChild(T); return T;
  }

  // Create a draggable water droplet. Returns the DOM element for attaching events.
  function spawnWater(panel,x=30,y=200){
    const el = document.createElement('div');
    el.className = 'water';
    el.textContent = 'H₂O';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    panel.appendChild(el);
    let drag = null;
    el.addEventListener('pointerdown', e => {
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      const r = panel.getBoundingClientRect();
      drag = { ox: e.clientX - r.left - parseFloat(el.style.left), oy: e.clientY - r.top - parseFloat(el.style.top) };
    });
    el.addEventListener('pointermove', e => {
      if(!drag) return;
      const r = panel.getBoundingClientRect();
      el.style.left = (e.clientX - r.left - drag.ox) + 'px';
      el.style.top  = (e.clientY - r.top  - drag.oy) + 'px';
    });
    el.addEventListener('pointerup', () => { drag = null; });
    // Double click removes the water drop
    el.addEventListener('dblclick', () => el.remove());
    return el;
  }

  // Add a new amino acid card to the panel and list
  function addAA(name,i){
    const id = 'aa' + i;
    const p  = randPos(i);
    const el = document.createElement('div');
    el.className = 'aa-card';
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';
    el.dataset.id = id;
    el.innerHTML = `
      <div class="aa-core"><span style="font-weight:900">C</span></div>
      <div class="aa-grp amino">NH₂</div>
      <div class="aa-grp carbox">COOH</div>
      <div class="side-h">H</div>
      <div class="side-r">${name}</div>
    `;
    panel.appendChild(el);
    aminoList.push({ id, el, pos:{...p}, leftFree:true, rightFree:true });
  }
  NAMES.forEach(addAA);

  // Update all bond line positions on drag
  function refresh(){
    bonds.forEach(b => {
      const L = aminoList.find(a => a.id === b.leftId);
      const R = aminoList.find(a => a.id === b.rightId);
      if(!L || !R) return;
      const x1 = L.pos.x + CARD_W;
      const y1 = L.pos.y + CARD_H/2;
      const x2 = R.pos.x;
      const y2 = R.pos.y + CARD_H/2;
      b.line.setAttribute('x1', x1);
      b.line.setAttribute('y1', y1);
      b.line.setAttribute('x2', x2);
      b.line.setAttribute('y2', y2);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      b.rect.setAttribute('x', mx - 42);
      b.rect.setAttribute('y', my - 16);
      b.txt.setAttribute('x', mx);
      b.txt.setAttribute('y', my + 6);
    });
  }

  // Form a peptide bond between two amino acids
  function bond(l,r){
    const L = aminoList.find(a => a.id === l);
    const R = aminoList.find(a => a.id === r);
    if(!L || !R || !L.rightFree || !R.leftFree) return;
    L.rightFree = false;
    R.leftFree  = false;
    const x1 = L.pos.x + CARD_W;
    const y1 = L.pos.y + CARD_H/2;
    const x2 = R.pos.x;
    const y2 = R.pos.y + CARD_H/2;
    // Hide reacting groups' text (carboxyl on L, amino on R)
    const lGrp = L.el.querySelector('.carbox');
    const rGrp = R.el.querySelector('.amino');
    const lOld = lGrp.textContent;
    const rOld = rGrp.textContent;
    lGrp.textContent = '';
    rGrp.textContent = '';
    // Draw bond line and label
    const line = mkLine(svg, x1, y1, x2, y2, '#16a34a', 6);
    const rect = mkRect(svg, (x1+x2)/2 - 42, (y1+y2)/2 - 16, 84, 28, 6, '#f59e0b');
    const txt  = mkText(svg, (x1+x2)/2, (y1+y2)/2 + 6, '-NH-CO-');
    // Save bond info including group references and original text
    bonds.push({ leftId: l, rightId: r, line, rect, txt, lGrp, rGrp, lOld, rOld });
    // Spawn a water droplet near the bond for hydrolysis
    const w = spawnWater(panel, ((x1 + x2)/2) - 20, ((y1 + y2)/2) - 50);
    w.addEventListener('pointerup', () => {
      // Recompute current positions (items might have moved)
      const Lc = aminoList.find(a => a.id === l);
      const Rc = aminoList.find(a => a.id === r);
      const cx1 = Lc.pos.x + CARD_W;
      const cy1 = Lc.pos.y + CARD_H/2;
      const cx2 = Rc.pos.x;
      const cy2 = Rc.pos.y + CARD_H/2;
      const mx  = (cx1 + cx2) / 2;
      const my  = (cy1 + cy2) / 2;
      const wx  = parseFloat(w.style.left) + 20;
      const wy  = parseFloat(w.style.top) + 20;
      if(Math.hypot(wx - mx, wy - my) < 40){
        // Remove bond lines and label
        [line, rect, txt].forEach(e => e.remove());
        Lc.rightFree = true;
        Rc.leftFree  = true;
        // Restore group labels
        const idx = bonds.findIndex(b => b.leftId === l && b.rightId === r);
        if(idx >= 0){
          const b = bonds[idx];
          b.lGrp.textContent = b.lOld;
          b.rGrp.textContent = b.rOld;
          bonds.splice(idx, 1);
        }
        // Remove water droplet
        w.remove();
      }
    });
  }

  // Handle dragging of amino acid cards
  let drag = null;
  panel.addEventListener('pointerdown', ev => {
    const card = ev.target.closest('.aa-card');
    if(!card) return;
    const id = card.dataset.id;
    const it = aminoList.find(a => a.id === id);
    card.setPointerCapture(ev.pointerId);
    const r = panel.getBoundingClientRect();
    drag = { id, ox: ev.clientX - r.left - it.pos.x, oy: ev.clientY - r.top - it.pos.y };
    card.classList.add('dragging');
  });
  panel.addEventListener('pointermove', ev => {
    if(!drag) return;
    const it = aminoList.find(a => a.id === drag.id);
    const r  = panel.getBoundingClientRect();
    it.pos.x = ev.clientX - r.left - drag.ox;
    it.pos.y = ev.clientY - r.top  - drag.oy;
    it.el.style.left = it.pos.x + 'px';
    it.el.style.top  = it.pos.y + 'px';
    refresh();
  });
  panel.addEventListener('pointerup', () => {
    if(!drag) return;
    const A = aminoList.find(a => a.id === drag.id);
    const el = A && A.el;
    if(el) el.classList.remove('dragging');
    // Check for proximity to form a bond with another amino acid
    for(const B of aminoList){
      if(B.id === A.id) continue;
      const dx = Math.abs((A.pos.x + CARD_W) - B.pos.x);
      const dy = Math.abs((A.pos.y + CARD_H/2) - (B.pos.y + CARD_H/2));
      if(dx < 36 && dy < 34){ bond(A.id, B.id); break; }
      const dx2 = Math.abs(A.pos.x - (B.pos.x + CARD_W));
      if(dx2 < 36 && dy < 34){ bond(B.id, A.id); break; }
    }
    drag = null;
  });

  // Control buttons: spawn water and reset
  document.getElementById('aa-water').addEventListener('click', () => {
    spawnWater(panel, 40, 220);
  });
  document.getElementById('aa-reset').addEventListener('click', () => {
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    aminoList.forEach(it => it.el.remove());
    aminoList.length = 0;
    bonds.length = 0;
    NAMES.forEach(addAA);
  });
})();