/**
 * 程序化像素贴图库。
 * 全部使用 16px/单位 的密度、限定色板、最近邻放大，
 * 贴图在离屏 Canvas 上逐像素绘制后转为 THREE.CanvasTexture。
 */
import * as THREE from 'three';
import { PALETTE } from '../game/constants';

export type PainterCtx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: PainterCtx } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 2D 画布上下文');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

/** 确定性随机，保证每次刷新贴图完全一致 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fill(ctx: PainterCtx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

function pixel(ctx: PainterCtx, x: number, y: number, color: string): void {
  fill(ctx, x, y, 1, 1, color);
}

/** 两色混合（用于渐变的像素分层，避免平滑渐变） */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255;
  const ag = (pa >> 8) & 255;
  const ab = pa & 255;
  const br = (pb >> 16) & 255;
  const bg = (pb >> 8) & 255;
  const bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/* ------------------------------------------------------------------
   各类贴图绘制
   ------------------------------------------------------------------ */

function paintFloor(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(64, 64);
  const rnd = mulberry32(1337);
  const planks = ['#A87355', '#B9835F', '#9E6A4B', '#B0764F'];
  const PLANK_H = 16;
  for (let row = 0; row < 4; row++) {
    const y = row * PLANK_H;
    const base = planks[row % planks.length];
    fill(ctx, 0, y, 64, PLANK_H, base);
    // 缝隙与高光
    fill(ctx, 0, y, 64, 1, '#5E3B29');
    fill(ctx, 0, y + 1, 64, 1, '#C99B76');
    fill(ctx, 0, y + PLANK_H - 1, 64, 1, '#8A5B40');
    // 木纹
    for (let i = 0; i < 30; i++) {
      const gx = Math.floor(rnd() * 62);
      const gy = y + 3 + Math.floor(rnd() * 10);
      const gw = 2 + Math.floor(rnd() * 6);
      fill(ctx, gx, gy, gw, 1, rnd() > 0.5 ? '#96634500'.slice(0, 7) : '#8A5B40');
      fill(ctx, gx, gy + 1, Math.max(1, gw - 2), 1, '#C08C68');
    }
    // 拼接竖缝
    const jx = 10 + Math.floor(rnd() * 44);
    fill(ctx, jx, y + 1, 1, PLANK_H - 2, '#6E4632');
    fill(ctx, jx - 1, y + 1, 1, PLANK_H - 2, '#C08C68');
    // 钉子
    pixel(ctx, jx + 2, y + 3, '#6E4632');
    pixel(ctx, jx - 3, y + 12, '#6E4632');
  }
  return canvas;
}

function paintWall(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(64, 64);
  const rnd = mulberry32(4242);
  fill(ctx, 0, 0, 64, 64, PALETTE.cream);
  // 细微颗粒
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(rnd() * 64);
    const y = Math.floor(rnd() * 64);
    pixel(ctx, x, y, rnd() > 0.5 ? '#EAC99E' : '#F9E8CA');
  }
  // 轻微的墙面斑驳
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(rnd() * 60);
    const y = Math.floor(rnd() * 60);
    fill(ctx, x, y, 2 + Math.floor(rnd() * 3), 1, '#E7C498');
  }
  // 底部微暗，模拟环境遮挡
  fill(ctx, 0, 61, 64, 3, '#E2BE92');
  fill(ctx, 0, 63, 64, 1, '#D6B084');
  return canvas;
}

function paintWoodPanel(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(32, 32);
  const rnd = mulberry32(9091);
  fill(ctx, 0, 0, 32, 32, '#A87355');
  for (let x = 0; x < 32; x += 8) {
    fill(ctx, x, 0, 1, 32, '#6E4632');
    fill(ctx, x + 1, 0, 1, 32, '#C79A74');
    for (let i = 0; i < 8; i++) {
      const gy = Math.floor(rnd() * 32);
      fill(ctx, x + 2, gy, 5, 1, '#96634A');
    }
  }
  return canvas;
}

function paintFabric(color: string = PALETTE.sage): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(32, 32);
  const rnd = mulberry32(777);
  fill(ctx, 0, 0, 32, 32, color);
  for (let y = 0; y < 32; y += 2) {
    for (let x = 0; x < 32; x += 2) {
      if ((x + y) % 4 === 0) pixel(ctx, x, y, '#93B1A6');
      else pixel(ctx, x + 1, y + 1, '#78978C');
    }
  }
  for (let i = 0; i < 24; i++) {
    pixel(ctx, Math.floor(rnd() * 32), Math.floor(rnd() * 32), '#6E8F84');
  }
  return canvas;
}

function paintRug(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(64, 64);
  const rnd = mulberry32(5150);
  fill(ctx, 0, 0, 64, 64, PALETTE.brick);
  fill(ctx, 2, 2, 60, 60, PALETTE.cream);
  fill(ctx, 4, 4, 56, 56, '#7C9A8F');
  fill(ctx, 5, 5, 54, 54, PALETTE.sage);
  // 编织颗粒
  for (let i = 0; i < 500; i++) {
    const x = 5 + Math.floor(rnd() * 54);
    const y = 5 + Math.floor(rnd() * 54);
    pixel(ctx, x, y, rnd() > 0.5 ? '#90B0A4' : '#7A9A8E');
  }
  // 菱形花纹
  const cx = 32;
  const cy = 32;
  for (let d = 0; d < 5; d++) {
    const r = 6 + d * 6;
    for (let t = -r; t <= r; t++) {
      const x = cx + t;
      const y = cy + (r - Math.abs(t));
      if (x >= 5 && x < 59) {
        pixel(ctx, x, y, d % 2 === 0 ? PALETTE.cream : PALETTE.brick);
        pixel(ctx, x, cy - (r - Math.abs(t)), d % 2 === 0 ? PALETTE.cream : PALETTE.brick);
      }
    }
  }
  // 边角装饰
  for (let i = 7; i < 58; i += 6) {
    pixel(ctx, i, 7, PALETTE.cream);
    pixel(ctx, i, 56, PALETTE.cream);
    pixel(ctx, 7, i, PALETTE.cream);
    pixel(ctx, 56, i, PALETTE.cream);
  }
  return canvas;
}

function paintCork(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(32, 32);
  const rnd = mulberry32(232);
  fill(ctx, 0, 0, 32, 32, '#B98B5E');
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(rnd() * 32);
    const y = Math.floor(rnd() * 32);
    const c = ['#A97C50', '#C69A6B', '#8E6642', '#D3AA7A'][Math.floor(rnd() * 4)];
    pixel(ctx, x, y, c);
  }
  return canvas;
}

function paintPaper(variant = 0): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(32, 32);
  const rnd = mulberry32(808 + variant * 31);
  fill(ctx, 0, 0, 32, 32, '#FBF0DC');
  fill(ctx, 0, 0, 32, 1, '#E3CFAF');
  fill(ctx, 0, 0, 1, 32, '#E3CFAF');
  const ink = ['#8A7E8C', '#9A8C93', '#7C7280'];
  let y = 7;
  for (let line = 0; line < 6; line++) {
    const x0 = 5 + (line === 0 ? 4 : 0);
    const w = 8 + Math.floor(rnd() * 16);
    fill(ctx, x0, y, w, 1, ink[line % 3]);
    if (rnd() > 0.55) fill(ctx, x0 + 2, y + 2, Math.floor(w / 2), 1, ink[(line + 1) % 3]);
    y += 4;
  }
  if (variant === 1) {
    // 红色印章
    fill(ctx, 21, 22, 7, 7, '#C8604C');
    fill(ctx, 22, 23, 5, 5, '#FBF0DC');
    fill(ctx, 23, 24, 3, 3, '#C8604C');
  }
  return canvas;
}

function paintCardboard(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(32, 32);
  const rnd = mulberry32(606);
  fill(ctx, 0, 0, 32, 32, '#C9A377');
  for (let x = 0; x < 32; x += 4) {
    fill(ctx, x, 0, 1, 32, '#B98F63');
    fill(ctx, x + 2, 0, 1, 32, '#D7B48B');
  }
  for (let i = 0; i < 40; i++) {
    pixel(ctx, Math.floor(rnd() * 32), Math.floor(rnd() * 32), '#B0855C');
  }
  // 胶带
  fill(ctx, 0, 13, 32, 5, '#E3CDA6');
  fill(ctx, 0, 13, 32, 1, '#CDB288');
  return canvas;
}

function paintMetal(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(32, 32);
  const rnd = mulberry32(4411);
  fill(ctx, 0, 0, 32, 32, '#7A7A86');
  for (let x = 0; x < 32; x += 2) {
    fill(ctx, x, 0, 1, 32, '#8B8B96');
  }
  for (let i = 0; i < 30; i++) {
    fill(ctx, Math.floor(rnd() * 32), Math.floor(rnd() * 32), 1, 2, '#6C6C78');
  }
  return canvas;
}

function paintScreen(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(64, 48);
  fill(ctx, 0, 0, 64, 48, '#15201F');
  // CRT 扫描线
  for (let y = 0; y < 48; y += 2) {
    fill(ctx, 0, y, 64, 1, '#1B2A28');
  }
  // 花纹边框
  fill(ctx, 2, 2, 60, 1, '#2C4A42');
  fill(ctx, 2, 45, 60, 1, '#2C4A42');
  fill(ctx, 2, 2, 1, 44, '#2C4A42');
  fill(ctx, 61, 2, 1, 44, '#2C4A42');
  // 绿色文本
  const green = '#8FE3A0';
  const dim = '#5FA877';
  fill(ctx, 8, 9, 20, 2, green);
  fill(ctx, 8, 15, 34, 1, dim);
  fill(ctx, 8, 19, 28, 1, dim);
  fill(ctx, 8, 23, 38, 1, dim);
  fill(ctx, 8, 30, 16, 2, green);
  fill(ctx, 8, 36, 26, 1, dim);
  // 光标
  fill(ctx, 8, 40, 3, 3, green);
  return canvas;
}

function paintKeyboard(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(32, 16);
  fill(ctx, 0, 0, 32, 16, '#4A4652');
  for (let y = 2; y < 15; y += 3) {
    for (let x = 2; x < 31; x += 3) {
      fill(ctx, x, y, 2, 2, '#C8BFAE');
    }
  }
  fill(ctx, 8, 13, 16, 2, '#C8BFAE');
  fill(ctx, 0, 0, 32, 1, '#5E5A66');
  return canvas;
}

function paintSky(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(128, 96);
  const top = '#86AEC8';
  const mid = '#BFD3D2';
  const low = '#F2D3AC';
  for (let y = 0; y < 96; y++) {
    let c: string;
    if (y < 46) c = mixHex(top, mid, y / 46);
    else c = mixHex(mid, low, (y - 46) / 50);
    fill(ctx, 0, y, 128, 1, c);
  }
  // 云（像素块状）
  const rnd = mulberry32(31415);
  for (let i = 0; i < 7; i++) {
    const cx = Math.floor(rnd() * 120) + 4;
    const cy = 10 + Math.floor(rnd() * 40);
    const w = 10 + Math.floor(rnd() * 18);
    fill(ctx, cx, cy, w, 4, '#F7E8D2');
    fill(ctx, cx + 2, cy - 3, w - 5, 3, '#FBF2E2');
    fill(ctx, cx + 1, cy + 4, w - 2, 2, '#E4D0B6');
  }
  // 远处建筑剪影
  const sil = '#8E8298';
  let x = 0;
  while (x < 128) {
    const w = 8 + Math.floor(rnd() * 14);
    const h = 14 + Math.floor(rnd() * 26);
    fill(ctx, x, 96 - h - 8, w, h + 8, sil);
    // 窗户
    for (let wy = 96 - h - 4; wy < 88; wy += 5) {
      for (let wx = x + 2; wx < x + w - 2; wx += 4) {
        if (rnd() > 0.55) pixel(ctx, wx, wy, '#FFC27A');
      }
    }
    x += w + 2;
  }
  // 屋顶轮廓
  fill(ctx, 0, 88, 128, 8, '#7C7189');
  return canvas;
}

function paintLeaf(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(32, 32);
  // 透明底
  const leaves = [
    { x: 15, y: 24, len: 22, w: 7, rot: -0.1 },
    { x: 15, y: 25, len: 18, w: 6, rot: -0.65 },
    { x: 16, y: 25, len: 19, w: 6, rot: 0.55 },
    { x: 15, y: 26, len: 14, w: 5, rot: -1.1 },
    { x: 16, y: 26, len: 15, w: 5, rot: 1.0 },
  ];
  for (const lf of leaves) {
    for (let t = 0; t < lf.len; t++) {
      const px = lf.x + Math.sin(lf.rot) * t;
      const py = lf.y - Math.cos(lf.rot) * t;
      const half = Math.max(0, (lf.w / 2) * (1 - t / lf.len));
      for (let s = -half; s <= half; s++) {
        const ox = Math.cos(lf.rot) * s;
        const oy = Math.sin(lf.rot) * s;
        pixel(ctx, Math.round(px + ox), Math.round(py + oy), '#4F7368');
      }
    }
  }
  // 内层亮色
  for (const lf of leaves) {
    for (let t = 2; t < lf.len - 2; t++) {
      const px = lf.x + Math.sin(lf.rot) * t;
      const py = lf.y - Math.cos(lf.rot) * t;
      const half = Math.max(0, (lf.w / 2 - 1.4) * (1 - t / lf.len));
      for (let s = -half; s <= half; s++) {
        pixel(
          ctx,
          Math.round(px + Math.cos(lf.rot) * s),
          Math.round(py + Math.sin(lf.rot) * s),
          '#86A69A',
        );
      }
    }
  }
  // 叶脉
  for (const lf of leaves) {
    for (let t = 2; t < lf.len - 1; t++) {
      pixel(
        ctx,
        Math.round(lf.x + Math.sin(lf.rot) * t),
        Math.round(lf.y - Math.cos(lf.rot) * t),
        '#6E9384',
      );
    }
  }
  return canvas;
}

function paintBlobShadow(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(64, 64);
  const grd = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(22,16,26,0.6)');
  grd.addColorStop(0.55, 'rgba(22,16,26,0.34)');
  grd.addColorStop(1, 'rgba(22,16,26,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 64);
  return canvas;
}

function paintDust(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(16, 16);
  const grd = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  grd.addColorStop(0, 'rgba(255,236,196,1)');
  grd.addColorStop(0.4, 'rgba(255,214,150,0.55)');
  grd.addColorStop(1, 'rgba(255,200,130,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 16, 16);
  return canvas;
}

function paintBeam(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(32, 64);
  for (let y = 0; y < 64; y++) {
    const t = y / 63;
    const alpha = Math.pow(1 - t, 1.5) * 0.5;
    ctx.fillStyle = `rgba(255,220,168,${alpha.toFixed(3)})`;
    ctx.fillRect(0, y, 32, 1);
  }
  // 横向柔和边缘
  const grd = ctx.createLinearGradient(0, 0, 32, 0);
  grd.addColorStop(0, 'rgba(0,0,0,0.5)');
  grd.addColorStop(0.5, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 32, 64);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

function paintCloud(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(64, 32);
  const puffs: Array<[number, number, number, number]> = [
    [8, 20, 16, 8],
    [18, 14, 20, 12],
    [36, 17, 18, 9],
    [48, 21, 12, 6],
  ];
  for (const [x, y, w, h] of puffs) {
    ctx.fillStyle = 'rgba(255,246,232,0.9)';
    ctx.fillRect(x + 2, y, w - 4, h);
    ctx.fillRect(x, y + 2, w, h - 4);
    ctx.fillStyle = 'rgba(232,214,190,0.55)';
    ctx.fillRect(x + 2, y + h - 2, w - 4, 2);
  }
  return canvas;
}

function paintExclaim(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(16, 24);
  fill(ctx, 5, 0, 6, 14, '#241D2E');
  fill(ctx, 6, 1, 4, 11, '#FFC27A');
  fill(ctx, 6, 9, 4, 2, '#E8A05A');
  fill(ctx, 5, 16, 6, 6, '#241D2E');
  fill(ctx, 6, 17, 4, 4, '#FFC27A');
  fill(ctx, 6, 20, 4, 1, '#E8A05A');
  return canvas;
}

function paintDoor(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(32, 64);
  fill(ctx, 0, 0, 32, 64, '#8E5A3B');
  fill(ctx, 1, 1, 30, 62, '#A87355');
  // 木纹
  const rnd = mulberry32(9090);
  for (let x = 2; x < 31; x += 4) {
    fill(ctx, x, 1, 1, 62, '#8E5A3B');
  }
  for (let i = 0; i < 26; i++) {
    fill(ctx, 2, 2 + Math.floor(rnd() * 60), 28, 1, '#96634A');
  }
  // 门板内凹
  fill(ctx, 5, 6, 22, 22, '#9A6443');
  fill(ctx, 6, 7, 20, 20, '#B27C56');
  fill(ctx, 5, 34, 22, 24, '#9A6443');
  fill(ctx, 6, 35, 20, 22, '#B27C56');
  // 铜把手
  fill(ctx, 23, 30, 4, 4, '#E8B45E');
  fill(ctx, 24, 31, 2, 2, '#FFE1A8');
  return canvas;
}

function paintPoster(variant: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(32, 40);
  fill(ctx, 0, 0, 32, 40, '#FBF0DC');
  fill(ctx, 0, 0, 32, 2, '#E3CFAF');
  fill(ctx, 0, 0, 2, 40, '#E3CFAF');
  fill(ctx, 30, 0, 2, 40, '#E3CFAF');
  fill(ctx, 0, 38, 32, 2, '#E3CFAF');
  if (variant === 0) {
    // 猫爪印
    fill(ctx, 11, 16, 10, 8, '#C88361');
    fill(ctx, 13, 19, 6, 4, '#FBF0DC');
    fill(ctx, 8, 11, 4, 4, '#C88361');
    fill(ctx, 13, 9, 4, 4, '#C88361');
    fill(ctx, 18, 9, 4, 4, '#C88361');
    fill(ctx, 22, 11, 4, 4, '#C88361');
    fill(ctx, 8, 28, 16, 2, '#8A7E8C');
    fill(ctx, 10, 32, 12, 2, '#8A7E8C');
  } else {
    // 简笔鱼
    fill(ctx, 9, 16, 12, 6, '#86A69A');
    fill(ctx, 21, 14, 4, 10, '#86A69A');
    fill(ctx, 21, 17, 4, 4, '#FBF0DC');
    pixel(ctx, 11, 17, '#2C2838');
    fill(ctx, 8, 30, 16, 2, '#8A7E8C');
    fill(ctx, 11, 34, 10, 2, '#8A7E8C');
  }
  return canvas;
}

function paintLetter(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(32, 32);
  fill(ctx, 0, 0, 32, 32, '#FBEFD8');
  fill(ctx, 0, 0, 32, 1, '#E3CFAF');
  fill(ctx, 0, 31, 32, 1, '#E3CFAF');
  const rnd = mulberry32(717);
  let y = 6;
  for (let i = 0; i < 5; i++) {
    fill(ctx, 5, y, 14 + Math.floor(rnd() * 9), 1, '#7C7280');
    y += 4;
  }
  // 蜡封印章
  fill(ctx, 12, 22, 9, 9, '#B2433A');
  fill(ctx, 13, 23, 7, 7, '#D96A54');
  fill(ctx, 15, 25, 3, 3, '#FBEFD8');
  return canvas;
}

function paintTunaLabel(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(32, 24);
  fill(ctx, 0, 0, 32, 24, '#F1E0BE');
  fill(ctx, 0, 3, 32, 2, '#C8604C');
  fill(ctx, 0, 19, 32, 2, '#C8604C');
  // 鱼形图案
  fill(ctx, 11, 9, 9, 5, '#5C93A0');
  fill(ctx, 20, 8, 3, 7, '#5C93A0');
  pixel(ctx, 13, 10, '#F1E0BE');
  // 文字条
  fill(ctx, 6, 15, 20, 1, '#8A7E8C');
  fill(ctx, 9, 6, 14, 1, '#8A7E8C');
  return canvas;
}

function paintClockFace(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(32, 32);
  fill(ctx, 0, 0, 32, 32, '#F3E2C4');
  // 圆形表盘
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const dx = x - 15.5;
      const dy = y - 15.5;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 14) fill(ctx, x, y, 1, 1, '#A87355');
      else if (d > 12.6) fill(ctx, x, y, 1, 1, '#5C3E2C');
    }
  }
  // 刻度
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = Math.round(15.5 + Math.sin(a) * 10);
    const y = Math.round(15.5 - Math.cos(a) * 10);
    fill(ctx, x, y, 1, 1, '#5C3E2C');
  }
  // 指针 16:40
  const hand = (angle: number, len: number, color: string) => {
    for (let t = 0; t < len; t++) {
      const x = Math.round(15.5 + Math.sin(angle) * t);
      const y = Math.round(15.5 - Math.cos(angle) * t);
      pixel(ctx, x, y, color);
    }
  };
  hand(((4 + 40 / 60) / 12) * Math.PI * 2, 6, '#3A3247');
  hand((40 / 60) * Math.PI * 2, 9, '#C8604C');
  fill(ctx, 15, 15, 2, 2, '#3A3247');
  return canvas;
}

function paintBook(color: string): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(8, 16);
  fill(ctx, 0, 0, 8, 16, color);
  fill(ctx, 0, 0, 1, 16, '#2C2838');
  fill(ctx, 1, 1, 1, 14, mixHex(color, '#FFFFFF', 0.25));
  fill(ctx, 3, 5, 4, 1, mixHex(color, '#FFFFFF', 0.55));
  fill(ctx, 3, 8, 3, 1, mixHex(color, '#FFFFFF', 0.4));
  fill(ctx, 0, 15, 8, 1, '#2C2838');
  return canvas;
}

function paintVendingSign(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(64, 24);
  fill(ctx, 0, 0, 64, 24, '#3A3247');
  fill(ctx, 2, 2, 60, 20, '#514D64');
  // 像素猫耳 + 文字条
  fill(ctx, 10, 6, 10, 10, '#F4D9B2');
  fill(ctx, 8, 4, 4, 5, '#F4D9B2');
  fill(ctx, 18, 4, 4, 5, '#F4D9B2');
  pixel(ctx, 12, 10, '#241D2E');
  pixel(ctx, 17, 10, '#241D2E');
  fill(ctx, 24, 8, 30, 3, '#FFC27A');
  fill(ctx, 24, 14, 22, 2, '#C9BFA8');
  return canvas;
}

/* ------------------------------------------------------------------
   贴图库（带缓存）
   ------------------------------------------------------------------ */

type TextureFactory = () => HTMLCanvasElement;

export class TextureLibrary {
  private cache = new Map<string, THREE.Texture>();
  private factories: Record<string, TextureFactory>;

  constructor() {
    this.factories = {
      floor: paintFloor,
      wall: paintWall,
      wood: paintWoodPanel,
      fabric: () => paintFabric(PALETTE.sage),
      fabricBrick: () => paintFabric('#C88361'),
      rug: paintRug,
      cork: paintCork,
      paper0: () => paintPaper(0),
      paper1: () => paintPaper(1),
      cardboard: paintCardboard,
      metal: paintMetal,
      screen: paintScreen,
      keyboard: paintKeyboard,
      sky: paintSky,
      cloud: paintCloud,
      leaf: paintLeaf,
      blobShadow: paintBlobShadow,
      dust: paintDust,
      exclaim: paintExclaim,
      beam: paintBeam,
      door: paintDoor,
      poster0: () => paintPoster(0),
      poster1: () => paintPoster(1),
      letter: paintLetter,
      tuna: paintTunaLabel,
      clock: paintClockFace,
      bookRed: () => paintBook('#B2544E'),
      bookBlue: () => paintBook('#5A7EA8'),
      bookGreen: () => paintBook('#6E8F6A'),
      bookMustard: () => paintBook('#C9A04B'),
      bookPurple: () => paintBook('#7D6A99'),
      bookCream: () => paintBook('#D8C6A4'),
      sign: paintVendingSign,
    };
  }

  /** 取得基础贴图（最近邻放大） */
  get(name: keyof TextureLibrary['factories'] | string): THREE.Texture {
    const cached = this.cache.get(name);
    if (cached) return cached;
    const factory = this.factories[name];
    if (!factory) throw new Error(`未知贴图: ${name}`);
    const tex = new THREE.CanvasTexture(factory());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 4;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    this.cache.set(name, tex);
    return tex;
  }

  /** 取得带平铺设置的贴图副本（共享图像数据） */
  tiled(name: string, repeatX: number, repeatY: number): THREE.Texture {
    const base = this.get(name);
    const tex = base.clone();
    tex.needsUpdate = true;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    this.cache.set(`${name}@${repeatX}x${repeatY}`, tex);
    return tex;
  }

  dispose(): void {
    for (const tex of this.cache.values()) tex.dispose();
    this.cache.clear();
  }
}
