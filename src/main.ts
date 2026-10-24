/**
 * 《猫咪事务所》入口。
 */
import { Game } from './game/Game';
import { createCatSheetCanvas, FRAME, SHEET_COLS, SHEET_ROWS } from './art/SpriteGenerator';

/** 开发用：?sprites 直接预览像素猫咪图集 */
function showSpriteSheet(): void {
  const src = createCatSheetCanvas();
  const scale = 3;
  const c = document.createElement('canvas');
  c.width = src.width * scale;
  c.height = src.height * scale;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < src.height; y += 4) {
    for (let x = 0; x < src.width; x += 4) {
      ctx.fillStyle = (x / 4 + y / 4) % 2 === 0 ? '#3a3448' : '#2c2838';
      ctx.fillRect(x * scale, y * scale, 4 * scale, 4 * scale);
    }
  }
  ctx.drawImage(src, 0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(255,194,122,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= SHEET_COLS; i++) {
    ctx.beginPath();
    ctx.moveTo(i * FRAME * scale, 0);
    ctx.lineTo(i * FRAME * scale, c.height);
    ctx.stroke();
  }
  for (let i = 0; i <= SHEET_ROWS; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * FRAME * scale);
    ctx.lineTo(c.width, i * FRAME * scale);
    ctx.stroke();
  }
  c.style.position = 'absolute';
  c.style.left = '0';
  c.style.top = '0';
  c.style.zIndex = '999';
  c.style.background = '#1a1622';
  document.body.style.overflow = 'auto';
  document.body.appendChild(c);
  const loading = document.getElementById('loading');
  if (loading) loading.hidden = true;
}

function boot(): void {
  if (new URLSearchParams(window.location.search).has('sprites')) {
    showSpriteSheet();
    return;
  }
  const canvas = document.getElementById('scene');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('找不到渲染画布');
  }
  const game = new Game(canvas);
  game.start();
}

try {
  boot();
} catch (error) {
  console.error(error);
  const loading = document.getElementById('loading');
  if (loading) {
    loading.innerHTML = `
      <div class="loading-inner">
        <div class="loading-logo">CAT AGENCY</div>
        <div class="loading-text">事务所今天没有开门……请使用支持 WebGL2 的现代浏览器。</div>
      </div>`;
  }
}
