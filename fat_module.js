// fat_module.js
// 脂肪合成模块：实现甘油与脂肪酸的脱水缩合、水解和皂化。需要在页面存在
// id="fat-board", id="fat-pal", id="fat-svg", 以及控制按钮 fat-water、fat-naoh、fat-reset。
// 样式与布局在本模块内部注入，避免污染其他模块。

(function(){
  const board = document.getElementById('fat-board');
  const pal   = document.getElementById('fat-pal');
  const svg   = document.getElementById('fat-svg');
  if(!board) return;
  // 注入模块专用样式
  const style = document.createElement('style');
  style.textContent = `
    /* 甘油卡片 */
    .fat-gly{ position:absolute; width:280px; height:160px; border:none; border-radius:12px; }
    .fat-gly .balls{ position:absolute; left:20px; top:30px; width:60px; height:100px; display:flex; flex-direction:column; justify-content:space-between; align-items:center; }
    .fat-gly .ball{ width:36px; height:36px; border-radius:50%; background:#fef3c7; border:2px solid #c084fc; display:flex; align-items:center; justify-content:center; font-weight:900; color:#7c3aed; }
    .fat-gly .oh{ position:absolute; left:100px; width:60px; height:20px; border-radius:8px; background:#fefce8; border:1px solid #f59e0b; color:#7c3aed; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:12px; }
    .fat-gly .oh1{ top:30px; }
    .fat-gly .oh2{ top:70px; }
    .fat-gly .oh3{ top:110px; }
    .fat-gly .label{ position:absolute; top:6px; left:10px; padding:2px 6px; border-radius:8px; background:#fde68a; border:1px solid #b45309; font-weight:900; font-size:12px; }
    /* 脂肪酸卡片 */
    .fat-fa{ position:absolute; width:280px; height:160px; border:none; border-radius:12px; }
    .fat-fa .head{ position:absolute; left:20px; top:70px; display:flex; align-items:center; }
    .fat-fa .cooh{ padding:2px 8px; border-radius:8px; background:#dcfce7; border:1px solid #16a34a; color:#065f46; font-weight:900; font-size:12px; }
    .fat-fa .tail{ position:absolute; left:100px; top:60px; width:350px; height:44px; border-radius:10px; background:#fef08a; border:1px solid #d97706; display:flex; align-items:center; justify-content:center; font-weight:900; color:#7c2d12; font-size:20px; white-space:nowrap; }
    .fat-fa .label{ position:absolute; top:6px; left:10px; padding:2px 6px; border-radius:8px; background:#fde68a; border:1px solid #b45309; font-weight:900; font-size:12px; }
    /* 在甘油和脂肪酸卡片内部绘制连接线 */
    /* 甘油：OH 与碳球的连线 */
    .fat-gly .oh::before{ content:''; position:absolute; left:-24px; top:50%; width:24px; height:2px; background:#475569; transform:translateY(-50%); }

    /* 甘油：三颗碳球之间的竖线 */
    .fat-gly .balls{ position:relative; }
    .fat-gly .balls::before{ content:''; position:absolute; left:50%; top:-8px; width:2px; height:calc(100% + 16px); background:#475569; transform:translateX(-50%); }
    /* 脂肪酸：HOOC 与尾部之间的连线 */
    .fat-fa .cooh{ position:relative; }
    .fat-fa .cooh::after{ content:''; position:absolute; left:100%; top:50%; width:80px; height:2px; background:#475569; transform:translateY(-50%); }
    /* 肥皂徽标 */
    .fat-soap{ position:absolute; left:auto; right:-180px; top:60px; padding:2px 6px; border-radius:8px; background:#e0f2fe; border:1px solid #38bdf8; color:#075985; font-weight:900; font-size:12px; white-space:nowrap; }
    /* 水滴和 NaOH */
    .fat-drop{ position:absolute; padding:6px 10px; border-radius:999px; font-weight:900; cursor:pointer; user-select:none; z-index:100; }
    .fat-water{ background:radial-gradient(45% 45% at 60% 35%, #c7e1ff 0%, #60a5fa 60%, #2563eb 100%); color:#e0f2fe; border:2px solid #1d4ed8; }
    .fat-naoh{  background:linear-gradient(180deg,#86efac,#10b981); color:#064e3b; border:2px solid #059669; }
  `;
  document.head.appendChild(style);
  // 数据结构
  const items=[]; // {id, el, type: 'gly'|'fa', used: [bool,bool,bool] or usedFa:bool}
  const bonds=[]; // {gly, gi, fa, line, rect, text, water, soap?}
  const drops=[]; // active water/naoh drops
  let idCounter=0;
  // 创建甘油卡片
  function createGly(){
    const el=document.createElement('div'); el.className='fat-gly'; el.innerHTML=`
      <div class="label">甘油</div>
      <div class="balls"><div class="ball">C</div><div class="ball">C</div><div class="ball">C</div></div>
      <div class="oh oh1">OH</div>
      <div class="oh oh2">OH</div>
      <div class="oh oh3">OH</div>
    `;
    return el;
  }
  // 创建脂肪酸卡片
  function createFa(kind){
    const formula = kind==='饱和' ? 'CH3CH2CH2CH2CH2CH3' : 'CH3CH2CH=CHCH2CH3';
    const el=document.createElement('div'); el.className='fat-fa'; el.dataset.kind=kind; el.innerHTML=`
      <div class="label">脂肪酸（${kind}）</div>
      <div class="head"><div class="cooh">HOOC</div></div>
      <div class="tail">${formula}</div>
    `;
    return el;
  }
  // 素材栏初始化
  [createGly(), createFa('饱和'), createFa('不饱和')].forEach(el=>{
    el.dataset.palette='1'; el.style.position='relative'; pal.appendChild(el);
  });
  // 计算甘油某个 OH 的连接点：左边缘中心
  function glyEdge(el, idx){
    const oh=el.querySelector('.oh'+idx); if(!oh) return null;
    const r=oh.getBoundingClientRect(); const wr=board.getBoundingClientRect();
    return {x:r.left - wr.left, y:r.top + r.height/2 - wr.top};
  }
  // 计算脂肪酸 HOOC 的连接点：右边缘中心
  function faEdge(el){
    const cooh=el.querySelector('.cooh'); if(!cooh) return null;
    const r=cooh.getBoundingClientRect(); const wr=board.getBoundingClientRect();
    return {x:r.right - wr.left, y:r.top + r.height/2 - wr.top};
  }
  // 创建水或 NaOH
  function spawnDrop(type, x, y){
    const el=document.createElement('div'); el.className='fat-drop ' + (type==='water'?'fat-water':'fat-naoh'); el.textContent= type==='water' ? 'H₂O' : 'NaOH';
    el.style.left=x+'px'; el.style.top=y+'px'; board.appendChild(el);
    drops.push({type, el});
    // 拖拽
    let drag=null;
    el.addEventListener('pointerdown', ev=>{
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
      // 释放拖拽
      drag = null;
      // 释放指针捕获，防止水滴跟随
      try{
        el.releasePointerCapture(ev.pointerId);
      }catch(e){}
      // 检测是否靠近某个键
      const wx=parseFloat(el.style.left)+el.offsetWidth/2;
      const wy=parseFloat(el.style.top)+el.offsetHeight/2;
      for(const b of bonds){
        // 计算当前键的中点
        const p1=glyEdge(b.gly.el, b.gi);
        const p2=faEdge(b.fa.el);
        if(!p1||!p2) continue;
        const cx=(p1.x+p2.x)/2; const cy=(p1.y+p2.y)/2;
        const d=Math.hypot(cx-wx, cy-wy);
        if(d < 40){
          if(el.textContent==='H₂O'){
            // 水解：移除键并恢复
            removeBond(b);
          }else{
            // 皂化：断开并替换 HOOC -> COO⁻Na⁺
            removeBond(b, true);
          }
          el.remove();
          const idx=drops.findIndex(dd=>dd.el===el); if(idx>=0) drops.splice(idx,1);
          return;
        }
      }
    });
    el.addEventListener('dblclick', ()=>{
      el.remove();
      const idx=drops.findIndex(dd=>dd.el===el); if(idx>=0) drops.splice(idx,1);
    });
    return el;
  }
  // 创建键
  function formEster(gly, gi, fa){
    // 隐藏 OH 和 HOOC 文本
    const oh= gly.el.querySelector('.oh'+gi);
    const cooh= fa.el.querySelector('.cooh');
    const ohText=oh.textContent; const coohText=cooh.textContent;
    oh.textContent=''; cooh.textContent='';
    // 绘制连线
    const p1=glyEdge(gly.el, gi); const p2=faEdge(fa.el);
    const e=edge(p1,p2,8,8);
    // 使用深色连线，避免在淡色背景上看不清
    const line=svgLine(e.x1,e.y1,e.x2,e.y2,'#475569',4);
    // 标签
    const mx=(e.x1+e.x2)/2, my=(e.y1+e.y2)/2;
    const rect=svgRect(mx-60,my-14,120,28,6,'#38bdf8');
    const text=svgText(mx,my+5,'酯键 -COO-', '#fff');
    // 生成水滴
    const drop=spawnDrop('water', mx-20, my-50);
    const bond={gly, gi, fa, line, rect, text, water:drop, ohText, coohText, soapLabel:null};
    bonds.push(bond);
    // 标记端口被占用
    gly.used[gi-1]=true; fa.used=true;
  }
  function removeBond(b, saponify=false){
    // 恢复文本或皂化
    const oh= b.gly.el.querySelector('.oh'+b.gi);
    const cooh= b.fa.el.querySelector('.cooh');
    if(saponify){
      // 将 HOOC 改为 COO⁻Na⁺，并添加肥皂徽标
      cooh.textContent='COO⁻Na⁺';
      cooh.style.background='#e0f2fe'; cooh.style.borderColor='#38bdf8'; cooh.style.color='#075985';
      if(!b.soapLabel){
        const soap=document.createElement('div'); soap.className='fat-soap'; soap.textContent='肥皂（RCOO⁻Na⁺）';
        // 放在脂肪酸尾巴右侧
        const tail=b.fa.el.querySelector('.tail');
        soap.style.left=(parseFloat(b.fa.el.style.left)+tail.offsetLeft+tail.offsetWidth+10)+'px';
        soap.style.top=(parseFloat(b.fa.el.style.top)+tail.offsetTop)+'px';
        b.fa.el.appendChild(soap);
        b.soapLabel=soap;
      }
    }else{
      // 普通水解：恢复原文
      oh.textContent=b.ohText; cooh.textContent=b.coohText;
    }
    // 清理线条和标签
    b.line.remove(); b.rect.remove(); b.text.remove();
    // 移除水滴
    if(b.water){ b.water.remove(); }
    // 端口释放
    b.gly.used[b.gi-1]=false; b.fa.used=false;
    // 移除 bond
    const i=bonds.indexOf(b); if(i>=0) bonds.splice(i,1);
  }
  // svg 辅助绘图
  function svgLine(x1,y1,x2,y2,stroke,w){ const L=document.createElementNS('http://www.w3.org/2000/svg','line'); L.setAttribute('x1',x1); L.setAttribute('y1',y1); L.setAttribute('x2',x2); L.setAttribute('y2',y2); L.setAttribute('stroke',stroke); L.setAttribute('stroke-width',w); L.setAttribute('stroke-linecap','round'); svg.appendChild(L); return L; }
  function svgRect(x,y,w,h,r,fill){ const R=document.createElementNS('http://www.w3.org/2000/svg','rect'); R.setAttribute('x',x); R.setAttribute('y',y); R.setAttribute('width',w); R.setAttribute('height',h); R.setAttribute('rx',r); R.setAttribute('fill',fill); svg.appendChild(R); return R; }
  function svgText(x,y,str,fill='#fff'){ const T=document.createElementNS('http://www.w3.org/2000/svg','text'); T.setAttribute('x',x); T.setAttribute('y',y); T.setAttribute('text-anchor','middle'); T.setAttribute('font-size','12'); T.setAttribute('font-weight','700'); T.setAttribute('fill',fill); T.textContent=str; svg.appendChild(T); return T; }
  function edge(a,b,ra=8,rb=8){ const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||1; return {x1:a.x+dx/d*ra, y1:a.y+dy/d*ra, x2:b.x-dx/d*rb, y2:b.y-dy/d*rb}; }
  // 拖拽克隆
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
      const itm={ id, el:clone, type: card.classList.contains('fat-gly')?'gly':'fa', used: card.classList.contains('fat-gly')?[false,false,false]:false };
      items.push(itm);
      drag={id, ox: ev.clientX-rect.left-parseFloat(clone.style.left), oy: ev.clientY-rect.top-parseFloat(clone.style.top)};
      clone.setPointerCapture(ev.pointerId);
    }else{
      // 拖动已存在
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
    // 更新连接线位置
    updateLines();
  });
  board.addEventListener('pointerup', () => { drag=null; });
  // 更新连线位置
  function updateLines(){
    bonds.forEach(b => {
      const p1=glyEdge(b.gly.el, b.gi);
      const p2=faEdge(b.fa.el);
      if(p1 && p2){
        const e=edge(p1,p2,8,8);
        b.line.setAttribute('x1',e.x1); b.line.setAttribute('y1',e.y1);
        b.line.setAttribute('x2',e.x2); b.line.setAttribute('y2',e.y2);
        const mx=(e.x1+e.x2)/2, my=(e.y1+e.y2)/2;
        b.rect.setAttribute('x', mx-60); b.rect.setAttribute('y', my-14);
        b.text.setAttribute('x', mx); b.text.setAttribute('y', my+5);
        // 更新水滴位置稍微跟随
        if(b.water){ b.water.style.left=(mx-20)+'px'; b.water.style.top=(my-50)+'px'; }
        // 更新肥皂徽标位置
        if(b.soapLabel){
          const tail=b.fa.el.querySelector('.tail');
          b.soapLabel.style.left=(parseFloat(b.fa.el.style.left)+tail.offsetLeft+tail.offsetWidth+10)+'px';
          b.soapLabel.style.top=(parseFloat(b.fa.el.style.top)+tail.offsetTop)+'px';
        }
      }
    });
  }
  // 尝试形成新键（在 pointermove 结束后调用）
  board.addEventListener('pointerup', ()=>{
    // 只有在没有正在拖动水滴/NaOH 时处理
    // 尝试 gly 与 fa 之间的靠近端口形成键
    for(const gly of items.filter(i=>i.type==='gly')){
      for(const fa of items.filter(i=>i.type==='fa')){
        if(fa.used) continue;
        for(let gi=1; gi<=3; gi++){
          if(!gly.used[gi-1]){
            const p1=glyEdge(gly.el, gi);
            const p2=faEdge(fa.el);
            if(!p1||!p2) continue;
            // 使用端口中心之间的距离判定是否可以脱水缩合，只要两端口靠近即可
            const ohEl = gly.el.querySelector('.oh'+gi);
            const coohEl = fa.el.querySelector('.cooh');
            if(ohEl && coohEl){
              const r1 = ohEl.getBoundingClientRect();
              const r2 = coohEl.getBoundingClientRect();
              const cx1 = (r1.left + r1.right) / 2;
              const cy1 = (r1.top  + r1.bottom) / 2;
              const cx2 = (r2.left + r2.right) / 2;
              const cy2 = (r2.top  + r2.bottom) / 2;
              // 如果中心距离小于 100px，则认为两官能团靠近，可以形成酯键
              if(Math.hypot(cx1 - cx2, cy1 - cy2) < 100){
                formEster(gly, gi, fa);
                return;
              }
            }
          }
        }
      }
    }
  });
  // 控件按钮
  document.getElementById('fat-water').addEventListener('click', () => {
    spawnDrop('water', 20, 200);
  });
  document.getElementById('fat-naoh').addEventListener('click', () => {
    spawnDrop('naoh', 20, 260);
  });
  document.getElementById('fat-reset').addEventListener('click', () => {
    // 清除所有卡片、线条、droplets
    items.forEach(itm => itm.el.remove()); items.length=0;
    bonds.forEach(b => { b.line.remove(); b.rect.remove(); b.text.remove(); if(b.water) b.water.remove(); if(b.soapLabel) b.soapLabel.remove(); }); bonds.length=0;
    drops.forEach(d => d.el.remove()); drops.length=0;
    svg.innerHTML='';
  });
})();