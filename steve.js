// steve.js
// 控制页面右下角的 Steve 小人移动和跳跃功能。
// 依赖于页面中存在 id="steve" 的 <img> 元素。

//
// steve.js
// 控制页面右下角的 Steve 小人移动和跳跃功能。
//
// 更新逻辑：
// - 按左箭头时，小人保持原朝向并向左移动。
// - 按右箭头时，小人翻转（mirror）并向右移动。
// - 空格或上箭头触发跳跃，支持二段跳。跳跃时可同时按方向键进行前/后移动。
// - 跳跃采用简易物理模型（垂直速度与重力），重力较小，营造“月球漫步”感觉。

(function(){
  const steve = document.getElementById('steve');
  if(!steve) return;
  // 初始位置：距页面右侧 20px，底部 20px。
  let x = window.innerWidth - steve.offsetWidth - 20;
  let y = 20; // 距底部高度
  let vy = 0; // 垂直速度
  const ground = 20; // 地面高度（底边距离）
  // 调整水平移动和跳跃参数，使跳跃更加平滑、缓慢
  const step = 14; // 水平移动步长（像素）
  // 较高初始跳跃速度，配合较小重力实现抛物线跳跃（向前/后跳）
  const initialJumpSpeed = 16;
  // 重力加速度（负值，向下），数值越接近 0 重力越小，跳跃更缓慢，营造“月球漫步”感觉
  const gravity = -0.4;
  let jumping = false; // 是否处于跳跃或下落阶段
  let jumpCount = 0; // 已经执行的连续跳跃次数（最多二段跳）
  let movingLeft = false;
  let movingRight = false;
  // 更新 DOM 位置
  function updatePos(){
    steve.style.left = x + 'px';
    steve.style.bottom = y + 'px';
  }
  updatePos();
  // 触发跳跃
  function startJump(){
    if(jumpCount < 2){
      vy = initialJumpSpeed;
      jumping = true;
      jumpCount++;
    }
  }
  // 键盘按下事件：更新移动状态及跳跃触发
  document.addEventListener('keydown', (e) => {
    if(e.key === 'ArrowLeft'){
      movingLeft = true;
      // 向左移动时保持原图（不镜像）
      steve.classList.remove('mirrored');
    } else if(e.key === 'ArrowRight'){
      movingRight = true;
      // 向右移动时镜像（面朝右）
      steve.classList.add('mirrored');
    } else if(e.key === 'ArrowUp' || e.key === ' '){
      startJump();
    }
  });
  // 键盘抬起事件：停止水平移动
  document.addEventListener('keyup', (e) => {
    if(e.key === 'ArrowLeft'){
      movingLeft = false;
    } else if(e.key === 'ArrowRight'){
      movingRight = false;
    }
  });
  // 主循环：每帧更新位置、速度
  function tick(){
    // 水平移动
    if(movingLeft){
      x = Math.max(0, x - step);
    }
    if(movingRight){
      x = Math.min(window.innerWidth - steve.offsetWidth, x + step);
    }
    // 跳跃/下落逻辑
    if(jumping){
      y += vy;
      vy += gravity;
      // 落地检测
      if(y <= ground){
        y = ground;
        vy = 0;
        jumping = false;
        jumpCount = 0;
      }
    }
    updatePos();
    requestAnimationFrame(tick);
  }
  tick();
  // 窗口尺寸变化时校正水平位置
  window.addEventListener('resize', () => {
    x = Math.min(x, window.innerWidth - steve.offsetWidth);
    updatePos();
  });
})();