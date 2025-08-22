/* fat_module.js — 脂肪模块（Palette + 拖拽 + 连线跟随 + 脱水缩合/水解/皂化）
 * 变更要点：
 * 1) P 球更小（半径 22px），字体更大；甘油 3 个 C 球更大（半径 28px），字体更粗；
 * 2) 所有装饰线与反应键跟随拖拽；Z 轴：C 球覆盖脊柱线；
 * 3) 水滴创建时放在键附近，但之后**绝不自动追随**（完全由用户拖动）；
 * 4) 脱水缩合的判定：对 HOOC 采用**左侧边缘**作为判定点；
 * 5) 磷酸 P 与甘油第一碳之间保留连线，并在中点放一个小框“COO”（表示酯键）。
 */
(function(){
  const board = document.getElementById('fat-board');
  const pal   = document.getElementById('fat-pal');
  const svg   = document.getElementById('fat-svg');
  if(!board||!pal||!svg) return;

  /* ---------- 样式注入（palette 卡片 & 画布卡片通用） ---------- */
  const style = document.createElement('style');
  style.textContent = `
    .draggable{cursor:grab; user-select:none; touch-action:none}
    .dragging{transform:scale(1.02); cursor:grabbing}

    /* 甘油 */
    .fat-gly{ position:absolute; width:280px; height:170px; border:none; border-radius:12px; }
    .fat-gly .label{ position:absolute; top:6px; left:10px; padding:2px 6px; border-radius:8px; background:#fde68a; border:1px solid #b45309; font-weight:900; font-size:12px; }
    .fat-gly .spine{ position:absolute; left:42px; top:42px; width:6px; height:110px; background:#111827; z-index:0; }
    .fat-gly .balls{ position:absolute; left:28px; top:36px; width:60px; height:118px; display:flex; flex-direction:column; justify-content:space-between; align-items:center; }
    .fat-gly .ball{ width:56px; height:56px; border-radius:50%; background:#fef3c7; border:2px solid #c084fc; display:flex; align-items:center; justify-content:center; color:#7c3aed; font-weight:900; font-size:20px; z-index:1; }
    .fat-gly .oh{ position:absolute; left:130px; width:82px; height:28px; border-radius:10px; background:#fff8e1; border:2px solid #f59e0b; color:#7c3aed; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:16px; }
    .fat-gly .oh1{ top:40px; } .fat-gly .oh2{ top:82px; } .fat-gly .oh3{ top:124px; }
    .fat-gly .link{ position:absolute; left:90px; width:36px; height:2px; background:#111827; } /* C→OH 短连线，实际位置由 JS 定 */

    /* 磷脂甘油（带 P 和胆碱） */
    .fat-pgly{ position:absolute; width:300px; height:200px; border:none; border-radius:12px; }
    .fat-pgly .label{ position:absolute; top:6px; left:10px; padding:2px 6px; border-radius:8px; background:#fde68a; border:1px solid #b45309; font-weight:900; font-size:12px; }
    .fat-pgly .p{ position:absolute; left:20px; top:22px; width:44px; height:44px; border-radius:50%; background:#fee2e2; border:2px solid #f87171; color:#b91c1c; font-weight:900; font-size:20px; display:flex; align-items:center; justify-content:center; }
    .fat-pgly .chol{ position:absolute; left:-90px; top:28px; padding:4px 8px; border-radius:10px; background:#bbf7d0; border:2px solid #22c55e; color:#064e3b; font-weight:900; font-size:18px; }
    .fat-pgly .spine{ position:absolute; left:78px; top:70px; width:6px; height:110px; background:#111827; z-index:0; }
    .fat-pgly .balls{ position:absolute; left:64px; top:64px; width:60px; height:118px; display:flex; flex-direction:column; justify-content:space-between; align-items:center; }
    .fat-pgly .ball{ width:56px; height:56px; border-radius:50%; background:#fef3c7; border:2px solid #c084fc; display:flex; align-items:center; justify-content:center; color:#7c3aed; font-weight:900; font-size:20px; z-index:1; }
    .fat-pgly .oh{ position:absolute; left:164px; width:82px; height:28px; border-radius:10px; background:#fff8e1; border:2px solid #f59e0b; color:#7c3aed; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:16px; }
    .fat-pgly .oh1{ top:88px; } .fat-pgly .oh2{ top:130px; }

    /* 脂肪酸 */
    .fat-fa{ position:absolute; width:760px; height:120px; border:none; border-radius:12px; }
    .fat-fa .label{ position:absolute; top:6px; left:10px; padding:2px 6px; border-radius:8px; background:#fde68a; border:1px solid #b45309; font-weight:900; font-size:12px; }
    .fat-fa .cooh{ position:absolute; left:20px; top:34px; width:100px; height:48px; border-radius:10px; background:#dcfce7; border:2px solid #16a34a; color:#065f46; font-weight:900; font-size:18px; display:flex; align-items:center; justify-content:center; }
    .fat-fa .tail{ position:absolute; left:140px; top:30px; width:580px; height:56px; border-radius:10px; background:#fef08a; border:2px solid #d97706; color:#7c2d12; font-weight:900; font-size:20px; display:flex; align-items:center; justify-content:center; white-space:nowrap; }
    .fat-fa .bridge{ position:absolute; left:120px; top:54px; width:20px; height:2px; background:#111827; } /* HOOC→尾部装饰线 */

    /* 水滴/碱性粒子 */
    .fat-drop{ position:absolute; padding:6px 10px; border-radius:999px; font-weight:900; cursor:pointer; user-select:none; z-index:50; }
    .fat-water{ background:radial-gradient(45% 45% at 60% 35%, #c7e1ff 0%, #60a5fa 60%, #2563eb 100%); color:#e0f2fe; border:2px solid #1d4ed8; box-shadow:0 4px 10px rgba(37,99,235,.25); }
    .fat-naoh{  background:linear-gradient(180deg,#86efac,#10b981); color:#064e3b; border:2px solid #059669; }

    /* 键标签（SVG 小胶囊）在 JS 里生成 */
  `;
  document.head.appendChild(style);

  /* ---------- 数据结构 ---------- */
  const items=[];   // 画布上的卡片实例：{id,type,root,parts:{...}, used:[...]...}
  const bonds=[];   // 酯键：{gi, glyId, faId, line, capRect, capText, waterDropId, ohEl, coohEl, ohText, coohText}
  const drops=[];   // 水滴/NaOH：{id, el, type}

  let idCounter=0;

  /* ---------- 工具：SVG ---------- */
  function svgEl(name){ return document.createElementNS('http://www.w3.org/2000/svg', name); }
  function svgLine(x1,y1,x2,y2,stroke='#000',w=3){ const L=svgEl('line'); L.setAttribute('x1',x1); L.setAttribute('y1',y1); L.setAttribute('x2',x2); L.setAttribute('y2',y2); L.setAttribute('stroke',stroke); L.setAttribute('stroke-width',w); L.setAttribute('stroke-linecap','round'); svg.appendChild(L); return L; }
  function svgRect(x,y,w,h,r,fill='#38bdf8'){ const R=svgEl('rect'); R.setAttribute('x',x); R.setAttribute('y',y); R.setAttribute('width',w); R.setAttribute('height',h); R.setAttribute('rx',r); R.setAttribute('fill',fill); svg.appendChild(R); return R; }
  function svgText(x,y,str,fill='#fff'){ const T=svgEl('text'); T.setAttribute('x',x); T.setAttribute('y',y); T.setAttribute('text-anchor','middle'); T.setAttribute('font-size','12'); T.setAttribute('font-weight','700'); T.setAttribute('fill',fill); T.textContent=str; svg.appendChild(T); return T; }

  function absRect(el){ const r=el.getBoundingClientRect(), b=board.getBoundingClientRect(); return {left:r.left-b.left, top:r.top-b.top, width:r.width, height:r.height}; }
  function centerOf(el){ const r=absRect(el); return {x:r.left+r.width/2, y:r.top+r.height/2}; }

  // 边到边命中（矩形）
  function rectEdgeTo(el, toward){ const r=absRect(el); const cx=r.left+r.width/2, cy=r.top+r.height/2; const dx=toward.x-cx, dy=toward.y-cy; const hw=r.width/2, hh=r.height/2; if(Math.abs(dx)<1e-6&&Math.abs(dy)<1e-6) return {x:cx,y:cy}; const tx=Math.abs(hw/(dx||1e-6)), ty=Math.abs(hh/(dy||1e-6)); const t=Math.min(tx,ty); return {x:cx+dx*t, y:cy+dy*t}; }
  function edgeBetween(a,b,ra=8,rb=8){ const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||1; return {x1:a.x+dx/d*ra, y1:a.y+dy/d*ra, x2:b.x-dx/d*rb, y2:b.y-dy/d*rb}; }

  /* ---------- Palette 卡片 ---------- */
  function paletteCard(el){ el.dataset.palette='1'; el.style.position='relative'; pal.appendChild(el); }

  function createGlyCard(){
    const el=document.createElement('div'); el.className='fat-gly';
    el.innerHTML=`
      <div class="label">甘油</div>
      <div class="spine"></div>
      <div class="balls">
        <div class="ball">C</div>
        <div class="ball">C</div>
        <div class="ball">C</div>
      </div>
      <div class="oh oh1"></div>
      <div class="oh oh2">OH</div>
      <div class="oh oh3">OH</div>
      <div class="link" data-for="oh2"></div>
      <div class="link" data-for="oh3"></div>
    `;
    return el;
  }

  function createPGlyCard(){
    const el=document.createElement('div'); el.className='fat-pgly';
    el.innerHTML=`
      <div class="label">磷脂甘油</div>
      <div class="p">P</div>
      <div class="chol">胆碱</div>
      <div class="spine"></div>
      <div class="balls">
        <div class="ball">C</div>
        <div class="ball">C</div>
        <div class="ball">C</div>
      </div>
      <div class="oh oh1">OH</div>
      <div class="oh oh2">OH</div>
    `;
    return el;
  }

  function createFaCard(kind){
    const el=document.createElement('div'); el.className='fat-fa'; el.dataset.kind=kind;
    const formula = (kind==='饱和') ? 'CH3–(CH2)6–CH3' : 'CH3–CH2–CH=CH–(CH2)3–CH3';
    el.innerHTML=`
      <div class="label">脂肪酸（${kind}）</div>
      <div class="cooh">HOOC</div>
      <div class="tail">${formula}</div>
      <div class="bridge"></div>
    `;
    return el;
  }

  [createGlyCard(), createPGlyCard(), createFaCard('饱和'), createFaCard('不饱和')].forEach(paletteCard);

  /* ---------- 拖拽克隆 & 移动 ---------- */
  let dragging=null;

  board.addEventListener('pointerdown', (ev)=>{
    const card=ev.target.closest('.fat-gly,.fat-pgly,.fat-fa'); if(!card) return;
    const rect=board.getBoundingClientRect();

    // palette → 复制
    if(card.dataset.palette==='1'){
      const clone=card.cloneNode(true);
      clone.dataset.palette='0'; clone.classList.add('draggable');
      clone.style.position='absolute';
      clone.style.left=(ev.clientX-rect.left-140)+'px';
      clone.style.top =(ev.clientY-rect.top - 80)+'px';
      board.appendChild(clone);

      const id='f'+(++idCounter);
      clone.dataset.id=id;

      const type = clone.classList.contains('fat-pgly') ? 'pgly' : (clone.classList.contains('fat-gly') ? 'gly' : 'fa');
      const itm={ id, type, root:clone, used:[false,false,false] };
      collectParts(itm);    // 采集子节点
      items.push(itm);

      // 初始装饰线布局
      layoutDecor(itm);

      // P→C1 连线与 "COO"
      if(type==='pgly'){ ensurePtoC1(itm); }

      clone.setPointerCapture(ev.pointerId);
      dragging={ id, ox:ev.clientX-rect.left-parseFloat(clone.style.left), oy:ev.clientY-rect.top-parseFloat(clone.style.top) };
      clone.classList.add('dragging');
    }else{
      // 画布上拖动
      const id=card.dataset.id; const itm=items.find(i=>i.id===id); if(!itm) return;
      card.setPointerCapture(ev.pointerId);
      dragging={ id, ox:ev.clientX-rect.left-parseFloat(card.style.left), oy:ev.clientY-rect.top-parseFloat(card.style.top) };
      card.classList.add('dragging');
    }
  });

  board.addEventListener('pointermove', (ev)=>{
    if(!dragging) return;
    const rect=board.getBoundingClientRect();
    const itm=items.find(i=>i.id===dragging.id); if(!itm) return;
    itm.root.style.left = (ev.clientX-rect.left-dragging.ox)+'px';
    itm.root.style.top  = (ev.clientY-rect.top -dragging.oy)+'px';
    layoutDecor(itm);  // 装饰线随动
    if(itm.type==='pgly'){ ensurePtoC1(itm); }
    refreshBonds();    // 反应键随动
  });

  const endDrag = ()=>{
    if(!dragging) return;
    const itm=items.find(i=>i.id===dragging.id); if(itm) itm.root.classList.remove('dragging');
    dragging=null;
    // 拖放后尝试脱水缩合
    tryCondenseAll();
  };
  board.addEventListener('pointerup', endDrag);
  board.addEventListener('pointercancel', endDrag);
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);

  /* ---------- 子节点采集与装饰线布局 ---------- */
  function collectParts(itm){
    const r=itm.root;
    if(itm.type==='gly'){
      itm.parts={
        balls:[...r.querySelectorAll('.ball')],
        ohs:[r.querySelector('.oh1'), r.querySelector('.oh2'), r.querySelector('.oh3')],
        links:[...r.querySelectorAll('.link')]
      };
    }else if(itm.type==='pgly'){
      itm.parts={
        p: r.querySelector('.p'),
        chol: r.querySelector('.chol'),
        balls:[...r.querySelectorAll('.ball')],
        ohs:[r.querySelector('.oh1'), r.querySelector('.oh2')]
      };
    }else if(itm.type==='fa'){
      itm.parts={ head:r.querySelector('.cooh'), tail:r.querySelector('.tail'), bridge:r.querySelector('.bridge') };
    }
  }

  // C→OH 的短连线、HOOC→尾部的装饰线等
  function layoutDecor(itm){
    if(itm.type==='gly'){
      // 让 C 球覆盖脊柱
      itm.root.querySelectorAll('.ball').forEach(b=>b.style.zIndex='1');
      // C2/C3 → OH2/OH3
      const c2=itm.parts.balls[1], c3=itm.parts.balls[2], oh2=itm.parts.ohs[1], oh3=itm.parts.ohs[2];
      const l2=itm.root.querySelector('.link[data-for="oh2"]');
      const l3=itm.root.querySelector('.link[data-for="oh3"]');
      if(c2&&oh2&&l2){ placeShortLink(c2, oh2, l2); }
      if(c3&&oh3&&l3){ placeShortLink(c3, oh3, l3); }
    }
    if(itm.type==='pgly'){
      // C 球覆盖脊柱
      itm.root.querySelectorAll('.ball').forEach(b=>b.style.zIndex='1');
      // P→C1 的主连线与 “COO” 由 ensurePtoC1 负责
    }
    if(itm.type==='fa'){
      // HOOC→tail 的短线保持水平
      const br=absRect(itm.parts.tail), hr=absRect(itm.parts.head);
      itm.parts.bridge.style.left= (hr.left + hr.width - 20) + 'px';
      itm.parts.bridge.style.top = (hr.top + hr.height/2 - 1) + 'px';
    }
  }
  function placeShortLink(cEl, ohEl, shortBar){
    const c=centerOf(cEl), o=centerOf(ohEl);
    // 取到边缘
    const from = rectEdgeTo(cEl, o);
    const to   = rectEdgeTo(ohEl, c);
    // 用绝对定位的短矩形充当线段
    const x1=from.x, y1=from.y, x2=to.x, y2=to.y;
    const len=Math.hypot(x2-x1,y2-y1); const ang=Math.atan2(y2-y1,x2-x1);
    shortBar.style.left=(x1)+'px';
    shortBar.style.top =(y1-1)+'px';
    shortBar.style.width=len+'px';
    shortBar.style.transform=`rotate(${ang}rad)`;
  }

  /* ---------- P→C1 主连线 + COO 胶囊 ---------- */
  let pLine=null, pCapRect=null, pCapTxt=null;
  function ensurePtoC1(itm){
    const pEl=itm.parts.p, c1=itm.parts.balls[0];
    if(!pEl||!c1) return;
    const from = rectEdgeTo(pEl, centerOf(c1));
    const to   = rectEdgeTo(c1, centerOf(pEl));
    const e=edgeBetween(from,to, 6,6);

    if(!pLine){ pLine = svgLine(e.x1,e.y1,e.x2,e.y2,'#ef4444',4); }
    else{ pLine.setAttribute('x1',e.x1); pLine.setAttribute('y1',e.y1); pLine.setAttribute('x2',e.x2); pLine.setAttribute('y2',e.y2); }

    const mx=(e.x1+e.x2)/2, my=(e.y1+e.y2)/2;
    if(!pCapRect){ pCapRect=svgRect(mx-14,my-10,28,18,4,'#fcd34d'); pCapTxt=svgText(mx,my+6,'COO','#7c2d12'); }
    else{ pCapRect.setAttribute('x',mx-14); pCapRect.setAttribute('y',my-10); pCapTxt.setAttribute('x',mx); pCapTxt.setAttribute('y',my+6); }
  }

  /* ---------- 生成水滴/NaOH（仅拖动，不自动回位） ---------- */
  function spawnDrop(type, x, y){
    const el=document.createElement('div'); el.className='fat-drop ' + (type==='water'?'fat-water':'fat-naoh'); el.textContent= type==='water' ? 'H₂O' : 'NaOH';
    el.style.left=x+'px'; el.style.top=y+'px'; board.appendChild(el);
    const id='d'+(++idCounter); drops.push({id, el, type});
    let drag=null;
    el.addEventListener('pointerdown',(ev)=>{ ev.stopPropagation(); el.setPointerCapture(ev.pointerId); const r=board.getBoundingClientRect(); drag={ox:ev.clientX-r.left-parseFloat(el.style.left), oy:ev.clientY-r.top-parseFloat(el.style.top)}; });
    board.addEventListener('pointermove',(ev)=>{ if(!drag) return; const r=board.getBoundingClientRect(); el.style.left=(ev.clientX-r.left-drag.ox)+'px'; el.style.top=(ev.clientY-r.top-drag.oy)+'px'; });
    el.addEventListener('pointerup',()=>{ drag=null; tryHydrolyzeNear(el); });
    el.addEventListener('dblclick',()=>{ el.remove(); const i=drops.findIndex(d=>d.id===id); if(i>=0) drops.splice(i,1); });
    return el;
  }

  /* ---------- 反应：脱水缩合 / 水解 ---------- */
  const CONDENSE_DIST=120;  // OH 与 HOOC 左侧边缘距离阈值
  const HYDRO_DIST=40;      // 水滴中心与键中心距离阈值

  function tryCondenseAll(){
    // 每个甘油/磷脂甘油的可用 OH × 每个脂肪酸的 HOOC
    for(const g of items.filter(i=>i.type==='gly'||i.type==='pgly')){
      const ohs=(g.parts.ohs||[]).filter(Boolean);
      for(let k=0;k<ohs.length;k++){
        const ohEl=ohs[k];
        if(!ohEl || ohEl.textContent.trim()==='') continue; // 已被占用
        for(const fa of items.filter(i=>i.type==='fa')){
          const head=fa.parts.head;
          if(!head || head.textContent.trim()==='') continue; // 已被占用
          // 判定点：HOOC 左侧边缘中心
          const hr=absRect(head); const hoocLeft={ x:hr.left, y:hr.top+hr.height/2 };
          const c1 = centerOf(ohEl);
          const d = Math.hypot(c1.x - hoocLeft.x, c1.y - hoocLeft.y);
          if(d < CONDENSE_DIST){ formEster(g, k+1, fa); return; }
        }
      }
    }
  }

  function formEster(gly, gi, fa){
    const oh = (gly.parts.ohs||[])[gi-1];
    const cooh = fa.parts.head; if(!oh||!cooh) return;

    const ohText=oh.textContent; const coohText=cooh.textContent;
    oh.textContent=''; cooh.textContent='';

    // 边到边连线
    const p1=rectEdgeTo(oh, centerOf(cooh));
    // 终点：取 HOOC 左侧边缘中心（更符合你的设定）
    const hr=absRect(cooh); const hoocLeft={ x:hr.left, y:hr.top+hr.height/2 };
    const e=edgeBetween(p1, hoocLeft, 8, 8);

    const line=svgLine(e.x1,e.y1,e.x2,e.y2,'#111827',4);
    const mx=(e.x1+e.x2)/2, my=(e.y1+e.y2)/2;
    const capRect=svgRect(mx-20,my-12,40,24,6,'#38bdf8');
    const capText=svgText(mx,my+6,'COO','#fff');

    // 生成水滴（仅在此刻放置；之后**不再**自动随动）
    const water = spawnDrop('water', mx-16, my-46);

    bonds.push({ gi, glyId:gly.id, faId:fa.id, line, capRect, capText, waterDropId:water?drops.at(-1).id:null, ohEl:oh, coohEl:cooh, ohText, coohText });
  }

  function tryHydrolyzeNear(waterEl){
    // 用水滴中心到所有键中点的距离，满足阈值即水解该键（可水解**任意**键）
    const wr=absRect(waterEl); const wx=wr.left+wr.width/2, wy=wr.top+wr.height/2;
    for(const b of [...bonds]){
      const x1=parseFloat(b.line.getAttribute('x1')), y1=parseFloat(b.line.getAttribute('y1'));
      const x2=parseFloat(b.line.getAttribute('x2')), y2=parseFloat(b.line.getAttribute('y2'));
      const mx=(x1+x2)/2, my=(y1+y2)/2;
      const d=Math.hypot(wx-mx, wy-my);
      if(d < HYDRO_DIST){
        // 复原文本，删除图形
        if(b.ohEl)  b.ohEl.textContent  = b.ohText;
        if(b.coohEl) b.coohEl.textContent = b.coohText;
        [b.line,b.capRect,b.capText].forEach(n=>n&&n.remove());
        const i=bonds.indexOf(b); if(i>=0) bonds.splice(i,1);
        break; // 一次只水解一个最近的键
      }
    }
  }

  function refreshBonds(){
    // 仅更新线与胶囊位置；**不移动水滴**
    bonds.forEach(b=>{
      const oh=b.ohEl, cooh=b.coohEl; if(!oh||!cooh) return;
      const p1=rectEdgeTo(oh, centerOf(cooh));
      const hr=absRect(cooh); const hoocLeft={ x:hr.left, y:hr.top+hr.height/2 };
      const e=edgeBetween(p1, hoocLeft, 8, 8);
      b.line.setAttribute('x1',e.x1); b.line.setAttribute('y1',e.y1);
      b.line.setAttribute('x2',e.x2); b.line.setAttribute('y2',e.y2);
      const mx=(e.x1+e.x2)/2, my=(e.y1+e.y2)/2;
      b.capRect.setAttribute('x',mx-20); b.capRect.setAttribute('y',my-12);
      b.capText.setAttribute('x',mx);    b.capText.setAttribute('y',my+6);
    });
  }

  /* ---------- 工具栏 ---------- */
  document.getElementById('fat-water')?.addEventListener('click', ()=> spawnDrop('water', 20, 220));
  document.getElementById('fat-naoh')?.addEventListener('click', ()=> spawnDrop('naoh', 20, 260));
  document.getElementById('fat-reset')?.addEventListener('click', ()=>{
    // 清空一切
    items.splice(0).forEach(it=>it.root.remove());
    bonds.splice(0).forEach(b=>{ [b.line,b.capRect,b.capText].forEach(n=>n&&n.remove()); });
    drops.splice(0).forEach(d=>d.el.remove());
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    // 也清掉 P→C1 的装饰
    if(pLine){ pLine.remove(); pLine=null; }
    if(pCapRect){ pCapRect.remove(); pCapRect=null; }
    if(pCapTxt){ pCapTxt.remove(); pCapTxt=null; }
  });

})();
