// fat_module.js  —— 脂肪合成模块（尺寸/判定/水滴修复 + P/胆碱装饰线 + “COO” 标签）
// 需要页面存在：#fat-board、#fat-pal、#fat-svg，以及按钮 #fat-water #fat-naoh #fat-reset

(function(){
  const board = document.getElementById('fat-board');
  const pal   = document.getElementById('fat-pal');
  const svg   = document.getElementById('fat-svg');
  if(!board) return;

  // ========= 样式（尺寸/颜色统一缩放，C 球更大；P 圆更小但字更大） =========
  const style = document.createElement('style');
  style.textContent = `
    /* 甘油卡片 */
    .fat-gly{ position:absolute; width:300px; height:180px; border:none; border-radius:12px; }
    .fat-gly .label{ position:absolute; top:6px; left:10px; padding:2px 6px; border-radius:8px; background:#fde68a; border:1px solid #b45309; font-weight:900; font-size:12px; }

    /* 3 个 C 球（更大、更粗） */
    .fat-gly .balls{ position:absolute; left:20px; top:28px; width:64px; height:124px; display:flex; flex-direction:column; justify-content:space-between; align-items:center; }
    .fat-gly .ball{ width:44px; height:44px; border-radius:50%; background:#fef3c7; border:2px solid #c084fc;
                    display:flex; align-items:center; justify-content:center; font-weight:900; font-size:18px; color:#7c3aed; }

    /* 竖直脊柱（放在 DOM 更早位置，保证被后续 C 球“盖住”） */
    .fat-gly .spine{ position:absolute; left:38px; top:36px; width:6px; height:120px; background:#000; }

    /* 甘油右侧 3 个 OH（可被反应清空文本） */
    .fat-gly .oh{ position:absolute; left:120px; width:80px; height:28px; border-radius:10px; background:#fefce8;
                  border:2px solid #d97706; color:#7c3aed; display:flex; align-items:center; justify-content:center;
                  font-weight:900; font-size:16px; }
    .fat-gly .oh1{ top:40px; } .fat-gly .oh2{ top:86px; } .fat-gly .oh3{ top:132px; }

    /* —— P 圆 + 胆碱（贴在甘油卡片内部，跟随甘油一起移动） —— */
    .fat-gly .phead{ position:absolute; left:-84px; top:18px; display:flex; align-items:center; }
    .fat-gly .p{ width:36px; height:36px; border-radius:50%; background:#fee2e2; border:2px solid #f87171;
                 display:flex; align-items:center; justify-content:center; font-weight:900; font-size:18px; color:#b91c1c; }
    .fat-gly .choline{ margin-left:6px; padding:2px 6px; border-radius:10px; background:#bbf7d0; border:2px solid #22c55e;
                       color:#064e3b; font-weight:900; font-size:14px; }

    /* 脂肪酸卡片（HOOC + 烃链） */
    .fat-fa{ position:absolute; width:560px; height:120px; border:none; border-radius:12px; }
    .fat-fa .label{ position:absolute; top:6px; left:10px; padding:2px 6px; border-radius:8px; background:#fde68a; border:1px solid #b45309; font-weight:900; font-size:12px; }
    .fat-fa .head{ position:absolute; left:0; top:28px; width:100px; height:64px; display:flex; align-items:center; justify-content:center; }
    .fat-fa .cooh{ width:96px; height:56px; border-radius:10px; background:#dcfce7; border:2px solid #16a34a;
                   color:#065f46; font-weight:900; font-size:18px; display:flex; align-items:center; justify-content:center; }
    .fat-fa .tail{ position:absolute; left:116px; top:34px; width:420px; height:48px; border-radius:12px; background:#fef08a; border:2px solid #d97706;
                   display:flex; align-items:center; justify-content:center; font-weight:900; color:#7c2d12; font-size:18px; white-space:nowrap; }

    /* 肥皂徽标 */
    .fat-soap{ position:absolute; left:auto; right:-180px; top:28px; padding:2px 6px; border-radius:8px; background:#e0f2fe; border:1px solid #38bdf8; color:#075985; font-weight:900; font-size:12px; white-space:nowrap; }

    /* 水滴 & NaOH（仅手动拖动才移动；不会自动重置） */
    .fat-drop{ position:absolute; padding:6px 10px; border-radius:999px; font-weight:900; cursor:pointer; user-select:none; z-index:100; }
    .fat-water{ background:radial-gradient(45% 45% at 60% 35%, #c7e1ff 0%, #60a5fa 60%, #2563eb 100%); color:#e0f2fe; border:2px solid #1d4ed8; }
    .fat-naoh{  background:linear-gradient(180deg,#86efac,#10b981); color:#064e3b; border:2px solid #059669; }
  `;
  document.head.appendChild(style);

  // ========= 工具 =========
  const items = [];   // { id, el, type:'gly'|'fa', used:[bool,bool,bool] 或 used:false, decor? }
  const bonds = [];   // {gly, gi, fa, line, rect, text, water, ohText, coohText, soapLabel}
  const drops = [];   // {type, el}
  let idCounter = 0;

  const svgLine = (x1,y1,x2,y2,stroke,w)=>{ const L=document.createElementNS('http://www.w3.org/2000/svg','line'); L.setAttribute('x1',x1); L.setAttribute('y1',y1); L.setAttribute('x2',x2); L.setAttribute('y2',y2); L.setAttribute('stroke',stroke); L.setAttribute('stroke-width',w); L.setAttribute('stroke-linecap','round'); svg.appendChild(L); return L; };
  const svgRect = (x,y,w,h,r,fill)=>{ const R=document.createElementNS('http://www.w3.org/2000/svg','rect'); R.setAttribute('x',x); R.setAttribute('y',y); R.setAttribute('width',w); R.setAttribute('height',h); R.setAttribute('rx',r); R.setAttribute('fill',fill); svg.appendChild(R); return R; };
  const svgText = (x,y,str,fill='#fff',size=12)=>{ const T=document.createElementNS('http://www.w3.org/2000/svg','text'); T.setAttribute('x',x); T.setAttribute('y',y); T.setAttribute('text-anchor','middle'); T.setAttribute('font-size',size); T.setAttribute('font-weight','700'); T.setAttribute('fill',fill); T.textContent=str; svg.appendChild(T); return T; };

  const absRect = (el)=>{ const r=el.getBoundingClientRect(), b=board.getBoundingClientRect(); return {left:r.left-b.left, top:r.top-b.top, width:r.width, height:r.height}; };
  const center  = (el)=>{ const r=absRect(el); return {x:r.left+r.width/2, y:r.top+r.height/2}; };
  const edgeBetween = (a,b,ra=8,rb=8)=>{ const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||1; return {x1:a.x+dx/d*ra, y1:a.y+dy/d*ra, x2:b.x-dx/d*rb, y2:b.y-dy/d*rb}; };
  const circleEdgeTo = (rect,toward)=>{ const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2, r=rect.width/2; const dx=toward.x-cx, dy=toward.y-cy, d=Math.hypot(dx,dy)||1; return {x:cx+dx/d*r, y:cy+dy/d*r}; };

  // ========= 组件 =========
  function createGly(){
    const el = document.createElement('div');
    el.className = 'fat-gly';
    el.innerHTML = `
      <div class="label">甘油</div>
      <div class="spine"></div>
      <div class="balls">
        <div class="ball">C</div>
        <div class="ball">C</div>
        <div class="ball">C</div>
      </div>
      <div class="oh oh1">OH</div>
      <div class="oh oh2">OH</div>
      <div class="oh oh3">OH</div>

      <div class="phead">
        <div class="p">P</div>
        <div class="choline">胆碱</div>
      </div>
    `;
    return el;
  }

  function createFa(kind){
    const formula = kind==='饱和' ? 'CH3–CH2–CH2–CH2–CH2–CH3' : 'CH3–CH2–CH=CH–CH2–CH3';
    const el = document.createElement('div'); el.className='fat-fa'; el.dataset.kind=kind;
    el.innerHTML = `
      <div class="label">脂肪酸（${kind}）</div>
      <div class="head"><div class="cooh">HOOC</div></div>
      <div class="tail">${formula}</div>
    `;
    return el;
  }

  // palette
  [createGly(), createFa('饱和'), createFa('不饱和')].forEach(el=>{ el.dataset.palette='1'; el.style.position='relative'; pal.appendChild(el); });

  // —— 锚点（改成：OH 右边缘；HOOC 左边缘）——
  function glyEdge(el, idx){
    const oh=el.querySelector('.oh'+idx); if(!oh) return null;
    const r=oh.getBoundingClientRect(), wr=board.getBoundingClientRect();
    return { x:r.right - wr.left, y:r.top + r.height/2 - wr.top };
  }
  function faEdge(el){
    const cooh=el.querySelector('.cooh'); if(!cooh) return null;
    const r=cooh.getBoundingClientRect(), wr=board.getBoundingClientRect();
    return { x:r.left - wr.left, y:r.top + r.height/2 - wr.top };
  }

  // —— 甘油装饰线（P→第一颗 C，并加 “COO” 小框）——
  function ensureGlyDecor(itm){
    const p   = itm.el.querySelector('.p');
    const c1  = itm.el.querySelector('.balls .ball:nth-child(1)');
    if(!p || !c1) return;

    const pr = absRect(p), cr = absRect(c1);
    const hitP = circleEdgeTo(pr, {x:cr.left+cr.width/2, y:cr.top+cr.height/2});
    const hitC = circleEdgeTo(cr, {x:pr.left+pr.width/2, y:pr.top+pr.height/2});
    const e = edgeBetween(hitP, hitC, 0, 0);
    if(!itm.decor){
      itm.decor = {
        pLine: svgLine(e.x1,e.y1,e.x2,e.y2,'#000',5),
        deco : null,
        r: svgRect((e.x1+e.x2)/2-16, (e.y1+e.y2)/2-10, 32, 18, 4, '#fcd34d'),
        t: svgText((e.x1+e.x2)/2, (e.y1+e.y2)/2+5, 'COO', '#7c2d12', 11)
      };
    }else{
      itm.decor.pLine.setAttribute('x1',e.x1); itm.decor.pLine.setAttribute('y1',e.y1);
      itm.decor.pLine.setAttribute('x2',e.x2); itm.decor.pLine.setAttribute('y2',e.y2);
      const mx=(e.x1+e.x2)/2, my=(e.y1+e.y2)/2;
      itm.decor.r.setAttribute('x',mx-16); itm.decor.r.setAttribute('y',my-10);
      itm.decor.t.setAttribute('x',mx);    itm.decor.t.setAttribute('y',my+5);
    }
  }

  // —— 生成水/NaOH（不自动跟随，只有手动拖动）——
  function spawnDrop(type, x, y){
    const el=document.createElement('div'); el.className='fat-drop ' + (type==='water'?'fat-water':'fat-naoh'); el.textContent= type==='water' ? 'H₂O' : 'NaOH';
    el.style.left=x+'px'; el.style.top=y+'px'; board.appendChild(el);
    drops.push({type, el});

    let drag=null;
    el.addEventListener('pointerdown', ev=>{
      ev.stopPropagation();
      el.setPointerCapture(ev.pointerId);
      const rect=board.getBoundingClientRect();
      drag={ox:ev.clientX-rect.left-parseFloat(el.style.left), oy:ev.clientY-rect.top-parseFloat(el.style.top)};
    });
    board.addEventListener('pointermove', ev=>{
      if(!drag) return;
      const rect=board.getBoundingClientRect();
      el.style.left=(ev.clientX-rect.left-drag.ox)+'px';
      el.style.top =(ev.clientY-rect.top -drag.oy)+'px';
    });
    el.addEventListener('pointerup', (ev)=>{
      drag=null;
      tryHydrolyze(el);
    });
    el.addEventListener('dblclick', ()=>{ el.remove(); const i=drops.findIndex(d=>d.el===el); if(i>=0) drops.splice(i,1); });
    return el;
  }

  function tryHydrolyze(dropEl){
    // 水或 NaOH 释放后：遍历所有已成键，若接近其中心则水解（或皂化）
    const wr=absRect(dropEl), wx=wr.left+wr.width/2, wy=wr.top+wr.height/2;
    for(const b of bonds){
      // 计算当前键的中点（用实时端点）
      const p1=glyEdge(b.gly.el, b.gi), p2=faEdge(b.fa.el); if(!p1||!p2) continue;
      const mx=(p1.x+p2.x)/2, my=(p1.y+p2.y)/2;
      const d=Math.hypot(wx-mx, wy-my);
      if(d<40){
        const isWater = dropEl.textContent==='H₂O';
        removeBond(b, !isWater); // 水：水解；NaOH：皂化
        dropEl.remove();
        const i=drops.findIndex(dd=>dd.el===dropEl); if(i>=0) drops.splice(i,1);
        return;
      }
    }
  }

  // —— 生成酯键（连线颜色改为黑）——
  function formEster(gly, gi, fa){
    const oh   = gly.el.querySelector('.oh'+gi);
    const cooh = fa.el.querySelector('.cooh');
    if(!oh || !cooh) return;

    const ohText=oh.textContent, coohText=cooh.textContent;
    oh.textContent=''; cooh.textContent='';

    const p1=glyEdge(gly.el, gi), p2=faEdge(fa.el);
    const e=edgeBetween(p1,p2,8,8);

    const line=svgLine(e.x1,e.y1,e.x2,e.y2,'#000',4);  // ← 深色黑线
    const mx=(e.x1+e.x2)/2, my=(e.y1+e.y2)/2;
    const rect=svgRect(mx-60,my-14,120,28,6,'#38bdf8');
    const text=svgText(mx,my+5,'—COO—', '#fff');

    // 只在此刻生成水滴；不在拖动时重置/跟随
    const drop=spawnDrop('water', mx-20, my-50);

    const bond={gly, gi, fa, line, rect, text, water:drop, ohText, coohText, soapLabel:null};
    bonds.push(bond);

    gly.used[gi-1]=true; fa.used=true;
  }

  function removeBond(b, saponify=false){
    const oh= b.gly.el.querySelector('.oh'+b.gi);
    const cooh= b.fa.el.querySelector('.cooh');
    if(saponify){
      cooh.textContent='COO⁻Na⁺';
      cooh.style.background='#e0f2fe'; cooh.style.borderColor='#38bdf8'; cooh.style.color='#075985';
      if(!b.soapLabel){
        const soap=document.createElement('div'); soap.className='fat-soap'; soap.textContent='肥皂（RCOO⁻Na⁺）';
        const tail=b.fa.el.querySelector('.tail');
        soap.style.left=(parseFloat(b.fa.el.style.left)+tail.offsetLeft+tail.offsetWidth+10)+'px';
        soap.style.top =(parseFloat(b.fa.el.style.top)+tail.offsetTop)+'px';
        b.fa.el.appendChild(soap);
        b.soapLabel=soap;
      }
    }else{
      oh.textContent=b.ohText; cooh.textContent=b.coohText;
    }
    b.line.remove(); b.rect.remove(); b.text.remove();
    if(b.water){ b.water.remove(); }
    b.gly.used[b.gi-1]=false; b.fa.used=false;
    const i=bonds.indexOf(b); if(i>=0) bonds.splice(i,1);
  }

  // ========= 拖拽（palette 克隆 + 画布移动） =========
  let drag=null;
  board.addEventListener('pointerdown', ev=>{
    const card=ev.target.closest('.fat-gly, .fat-fa'); if(!card) return;
    const rect=board.getBoundingClientRect();
    if(card.dataset.palette==='1'){
      // 克隆
      const clone=card.cloneNode(true);
      clone.dataset.palette='0'; clone.style.position='absolute';
      clone.style.left=(ev.clientX-rect.left - 140)+'px';
      clone.style.top =(ev.clientY-rect.top  - 80)+'px';
      board.appendChild(clone);
      const id='f'+(++idCounter);
      clone.dataset.id=id;
      const type = card.classList.contains('fat-gly') ? 'gly' : 'fa';
      const itm  = { id, el:clone, type, used: type==='gly'?[false,false,false]:false, decor:null };
      items.push(itm);
      // 初次绘制甘油的 P→C1 装饰线
      if(type==='gly') ensureGlyDecor(itm);

      drag={id, ox: ev.clientX-rect.left-parseFloat(clone.style.left), oy: ev.clientY-rect.top-parseFloat(clone.style.top)};
      clone.setPointerCapture(ev.pointerId);
    }else{
      const id=card.dataset.id; drag={ id, ox:ev.clientX-rect.left-parseFloat(card.style.left), oy:ev.clientY-rect.top-parseFloat(card.style.top) };
      card.setPointerCapture(ev.pointerId);
    }
  });

  board.addEventListener('pointermove', ev=>{
    if(!drag) return;
    const itm=items.find(i=>i.id===drag.id); if(!itm) return;
    const rect=board.getBoundingClientRect();
    itm.el.style.left=(ev.clientX-rect.left-drag.ox)+'px';
    itm.el.style.top =(ev.clientY-rect.top -drag.oy)+'px';
    updateLines();
  });

  board.addEventListener('pointerup', ()=>{
    if(!drag) return; drag=null;
    // 尝试形成新键（OH↔HOOC 左右边缘距离阈值）
    for(const gly of items.filter(i=>i.type==='gly')){
      for(const fa of items.filter(i=>i.type==='fa')){
        if(fa.used) continue;
        for(let gi=1; gi<=3; gi++){
          if(!gly.used[gi-1]){
            const p1=glyEdge(gly.el, gi);
            const p2=faEdge(fa.el);
            if(!p1||!p2) continue;
            if(Math.hypot(p1.x-p2.x, p1.y-p2.y) < 44){
              formEster(gly, gi, fa);
              return;
            }
          }
        }
      }
    }
  });

  // ========= 连线刷新（拖动时重算） =========
  function updateLines(){
    // 已成键
    bonds.forEach(b => {
      const p1=glyEdge(b.gly.el, b.gi), p2=faEdge(b.fa.el);
      if(p1 && p2){
        const e=edgeBetween(p1,p2,8,8);
        b.line.setAttribute('x1',e.x1); b.line.setAttribute('y1',e.y1);
        b.line.setAttribute('x2',e.x2); b.line.setAttribute('y2',e.y2);
        const mx=(e.x1+e.x2)/2, my=(e.y1+e.y2)/2;
        b.rect.setAttribute('x', mx-60); b.rect.setAttribute('y', my-14);
        b.text.setAttribute('x', mx);     b.text.setAttribute('y', my+5);
        // 注意：不再自动移动水滴（修复“水会自己回到键上方”的问题）
      }
    });
    // 甘油装饰线
    items.filter(i=>i.type==='gly').forEach(ensureGlyDecor);
  }

  // ========= 按钮 =========
  document.getElementById('fat-water').addEventListener('click', () => { spawnDrop('water', 20, 200); });
  document.getElementById('fat-naoh').addEventListener('click', () => { spawnDrop('naoh', 20, 260); });
  document.getElementById('fat-reset').addEventListener('click', () => {
    items.forEach(itm => itm.el.remove()); items.length=0;
    bonds.forEach(b => { b.line.remove(); b.rect.remove(); b.text.remove(); if(b.water) b.water.remove(); if(b.soapLabel) b.soapLabel.remove(); }); bonds.length=0;
    drops.forEach(d => d.el.remove()); drops.length=0;
    svg.innerHTML='';
  });
})();
