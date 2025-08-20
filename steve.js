// steve.js
// 控制页面右下角的 Steve 小人移动和跳跃功能。
// 依赖于页面中存在 id="steve" 的 <img> 元素。

(function(){
  const steve = document.getElementById('steve');
  if(!steve) return;
  // 初始化位置：距页面右侧 100px，底部 20px。
  let x = window.innerWidth - steve.offsetWidth - 20;
  let jumping = false;
  const step = 20; // 每次按键移动的水平距离
  const ground = 20; // 小人的初始底部高度
  // 更新位置的函数
  function updatePos(){ steve.style.left = x + 'px'; }
  updatePos();
  // 键盘事件：左右移动 + 跳跃
  document.addEventListener('keydown', (e) => {
    if(e.key === 'ArrowRight'){
      x = Math.max(0, x - step);
      // 向左时取消镜像（面朝左）
      steve.classList.remove('mirrored');
      updatePos();
    } else if(e.key === 'ArrowLeft'){
      x = Math.min(window.innerWidth - steve.offsetWidth, x + step);
      // 向右时镜像（面朝右）
      steve.classList.add('mirrored');
      updatePos();
    } else if((e.key === 'ArrowUp' || e.key === ' ') && !jumping){
      // 按上箭头或空格执行跳跃；同时只能一个跳跃
      jumping = true;
      let jumpHeight = 0;
      let ascending = true;
      const maxJump = 180; // 跳跃高度
      const interval = setInterval(() => {
        if(ascending){
          jumpHeight += 6;
          if(jumpHeight >= maxJump){ ascending = false; }
        } else {
          jumpHeight -= 6;
          if(jumpHeight <= 0){
            clearInterval(interval);
            jumpHeight = 0;
            jumping = false;
          }
        }
        steve.style.bottom = (ground + jumpHeight) + 'px';
      }, 16);
    }
  });
  // 窗口尺寸变化时校正位置
  window.addEventListener('resize', () => {
    x = Math.min(x, window.innerWidth - steve.offsetWidth);
    updatePos();
  });
})();
