/**
 * 程序化像素猫咪精灵（40×40 帧）。
 * 采用分区栅格 + 自动描边 + 左上方受光的明暗处理，
 * 保证四个方向与五种动画有一致、可辨识的猫咪剪影。
 */
import * as THREE from 'three';
import { makeCanvas, mulberry32, type PainterCtx } from './PixelTextures';
import type { CatAnim, CatDir } from '../game/types';

export const FRAME = 40;
export const SHEET_COLS = 13;
export const SHEET_ROWS = 4;

const DIR_ROW: Record<CatDir, number> = { down: 0, left: 1, right: 2, up: 3 };

export const CAT_ANIM: Record<CatAnim, { start: number; count: number; fps: number; loop: boolean }> = {
  idle: { start: 0, count: 2, fps: 2.2, loop: true },
  walk: { start: 2, count: 4, fps: 9, loop: true },
  interact: { start: 6, count: 2, fps: 5, loop: false },
  happy: { start: 8, count: 2, fps: 5, loop: false },
  sleep: { start: 10, count: 2, fps: 1.4, loop: true },
  blink: { start: 12, count: 1, fps: 4, loop: false },
};

/* ------------------------------------------------------------------
   调色板与分区栅格
   ------------------------------------------------------------------ */

const EMPTY = 0;
const FUR = 1;
const CREAM = 2;
const SCARF = 3;
const EYE = 4;
const NOSE = 5;
const WHITE = 6;
const STRIPE = 7;
const INK = 8;
const CALICO = 9;
const CREAM_SHADE = 10;
const BLUSH = 11;
const SCARF_DARK = 12;
const SCARF_LIGHT = 13;

interface IdDef {
  ramp?: string[];
  fixed?: number;
  flat?: string;
}

const RAMPS = {
  fur: ['#8A3A1E', '#B9542A', '#E07B3C', '#F2A35C', '#FFD39A'],
  furPale: ['#B39A78', '#D3B995', '#EFE2D0', '#FBF4E8', '#FFFDF6'],
  cream: ['#BFA47F', '#DCC09B', '#F8E7C9', '#FFF3DD', '#FFFBF2'],
  scarf: ['#3F6157', '#54786C', '#86A69A', '#ADD0C2', '#D6EDE4'],
  calico: ['#8A6A45', '#B08A5A', '#D9A25E', '#E8BC80', '#F6D3A0'],
  ink: ['#161010', '#1F1715', '#2B1C1A', '#3A2A24', '#4A352C'],
};

export type CatSkin = 'orange' | 'calico';

const ID_DEFS: Record<number, IdDef> = {
  [FUR]: { ramp: RAMPS.fur },
  [CREAM]: { ramp: RAMPS.cream },
  [SCARF]: { ramp: RAMPS.scarf },
  [CALICO]: { ramp: RAMPS.calico },
  [EYE]: { flat: '#241A17' },
  [NOSE]: { flat: '#D98A72' },
  [WHITE]: { flat: '#FFF6E8' },
  [STRIPE]: { flat: '#8A3A1E' },
  [INK]: { flat: '#2B1C1A' },
  [CREAM_SHADE]: { ramp: RAMPS.cream, fixed: 1 },
  [BLUSH]: { flat: '#E88A6A' },
  [SCARF_DARK]: { flat: '#54786C' },
  [SCARF_LIGHT]: { flat: '#ADD0C2' },
};

const OUTLINE = '#2B1C1A';

class Raster {
  readonly w = FRAME;
  readonly h = FRAME;
  readonly data = new Uint8Array(FRAME * FRAME);

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return EMPTY;
    return this.data[y * this.w + x];
  }

  set(x: number, y: number, id: number): void {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return;
    this.data[yi * this.w + xi] = id;
  }

  rect(x: number, y: number, w: number, h: number, id: number): void {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) {
      for (let xx = Math.round(x); xx < Math.round(x + w); xx++) {
        this.set(xx, yy, id);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, id: number): void {
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, id);
      }
    }
  }

  rrect(x: number, y: number, w: number, h: number, radius: number, id: number): void {
    const r = Math.min(radius, w / 2, h / 2);
    this.rect(x + r, y, w - 2 * r, h, id);
    this.rect(x, y + r, w, h - 2 * r, id);
    this.ellipse(x + r, y + r, r, r, id);
    this.ellipse(x + w - r, y + r, r, r, id);
    this.ellipse(x + r, y + h - r, r, r, id);
    this.ellipse(x + w - r, y + h - r, r, r, id);
  }

  tri(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, id: number): void {
    const minX = Math.floor(Math.min(x1, x2, x3));
    const maxX = Math.ceil(Math.max(x1, x2, x3));
    const minY = Math.floor(Math.min(y1, y2, y3));
    const maxY = Math.ceil(Math.max(y1, y2, y3));
    const area = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
    if (Math.abs(area) < 1e-6) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const w1 = ((x2 - x) * (y3 - y) - (x3 - x) * (y2 - y)) / area;
        const w2 = ((x3 - x) * (y1 - y) - (x1 - x) * (y3 - y)) / area;
        const w3 = 1 - w1 - w2;
        if (w1 >= -0.05 && w2 >= -0.05 && w3 >= -0.05) this.set(x, y, id);
      }
    }
  }

  /** 粗线（用于尾巴），沿线段铺圆点 */
  stroke(x0: number, y0: number, x1: number, y1: number, thickness: number, id: number): void {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.ellipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, thickness / 2, thickness / 2, id);
    }
  }

  /** 曲线尾巴 */
  curve(
    x0: number,
    y0: number,
    cx: number,
    cy: number,
    x1: number,
    y1: number,
    thickness: number,
    id: number,
  ): void {
    const steps = 26;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const x = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
      const y = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
      this.ellipse(x, y, thickness / 2, thickness / 2, id);
    }
  }

  mirrored(): Raster {
    const out = new Raster();
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        out.data[y * this.w + (this.w - 1 - x)] = this.get(x, y);
      }
    }
    return out;
  }

  /** 描边 + 左上受光 / 右下阴影，然后写入 Canvas */
  render(ctx: PainterCtx, furRamp?: string[]): void {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const id = this.get(x, y);
        if (id === EMPTY) continue;
        const def = ID_DEFS[id];
        if (!def) continue;

        const boundary =
          this.get(x - 1, y) === EMPTY ||
          this.get(x + 1, y) === EMPTY ||
          this.get(x, y - 1) === EMPTY ||
          this.get(x, y + 1) === EMPTY;

        let color: string;
        if (def.flat) {
          color = boundary ? OUTLINE : def.flat;
        } else if (def.ramp) {
          const ramp = id === FUR && furRamp ? furRamp : def.ramp;
          if (boundary) {
            color = OUTLINE;
          } else if (def.fixed !== undefined) {
            color = ramp[def.fixed];
          } else {
            const lit =
              this.get(x - 1, y - 1) === EMPTY ||
              this.get(x - 2, y - 1) === EMPTY ||
              this.get(x - 1, y - 2) === EMPTY;
            const dark =
              this.get(x + 1, y + 1) === EMPTY ||
              this.get(x + 2, y + 1) === EMPTY ||
              this.get(x + 1, y + 2) === EMPTY;
            color = ramp[lit ? 3 : dark ? 1 : 2];
          }
        } else {
          color = OUTLINE;
        }
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

/* ------------------------------------------------------------------
   姿态
   ------------------------------------------------------------------ */

interface Pose {
  bob: number;
  legA: number;
  legB: number;
  tail: number;
  eyes: 'open' | 'closed' | 'happy' | 'wide';
  ears: 'normal' | 'perk' | 'flat';
  lift: number;
  lean: number;
  lying: boolean;
}

const BASE_POSE: Pose = {
  bob: 0,
  legA: 0,
  legB: 0,
  tail: 0,
  eyes: 'open',
  ears: 'normal',
  lift: 0,
  lean: 0,
  lying: false,
};

function poseFor(anim: CatAnim, i: number): Pose {
  const p: Pose = { ...BASE_POSE };
  switch (anim) {
    case 'idle':
      p.bob = i === 1 ? 1 : 0;
      p.tail = i === 1 ? 1 : -1;
      break;
    case 'blink':
      p.eyes = 'closed';
      break;
    case 'walk': {
      const legs = [
        [2, 0],
        [0, 0],
        [0, 2],
        [0, 0],
      ];
      p.legA = legs[i][0];
      p.legB = legs[i][1];
      p.bob = i % 2 === 1 ? 1 : 0;
      p.tail = i < 2 ? -1 : 1;
      break;
    }
    case 'interact':
      p.bob = i === 1 ? 1 : 0;
      p.ears = 'perk';
      p.eyes = 'wide';
      p.lean = i === 1 ? 1 : 0;
      p.tail = 1;
      break;
    case 'happy':
      p.lift = i === 1 ? 3 : 1;
      p.eyes = 'happy';
      p.ears = 'perk';
      p.tail = 2;
      break;
    case 'sleep':
      p.lying = true;
      break;
  }
  return p;
}

/* ------------------------------------------------------------------
   猫的五官与身体
   ------------------------------------------------------------------ */

function drawEars(r: Raster, hx: number, hy: number, ears: Pose['ears']): void {
  const drop = ears === 'flat' ? 3 : 0;
  const rise = ears === 'perk' ? 1 : 0;
  const tipY = 0 + drop - rise;
  const baseY = 14 + drop;
  // 左耳
  r.tri(hx + 2, baseY, hx + 11, baseY, hx + 6, tipY, FUR);
  // 右耳
  r.tri(hx + 13, baseY, hx + 22, baseY, hx + 18, tipY, FUR);
  // 内耳
  r.tri(hx + 4, baseY - 2, hx + 9, baseY - 2, hx + 6, tipY + 5, NOSE);
  r.tri(hx + 15, baseY - 2, hx + 20, baseY - 2, hx + 18, tipY + 5, NOSE);
  // 耳根阴影
  r.rect(hx + 2, baseY - 1, 10, 1, STRIPE);
  r.rect(hx + 13, baseY - 1, 10, 1, STRIPE);
  void hy;
}

function drawEyes(r: Raster, cx: number, cy: number, mode: Pose['eyes'], spacing: number): void {
  const leftX = cx - spacing;
  const rightX = cx + spacing;
  if (mode === 'closed') {
    r.rect(leftX - 2, cy, 5, 1, INK);
    r.rect(rightX - 2, cy, 5, 1, INK);
    return;
  }
  if (mode === 'happy') {
    // ∩ 形笑眼
    r.rect(leftX - 2, cy + 1, 5, 1, INK);
    r.rect(leftX - 2, cy, 1, 1, INK);
    r.rect(leftX + 2, cy, 1, 1, INK);
    r.rect(rightX - 2, cy + 1, 5, 1, INK);
    r.rect(rightX - 2, cy, 1, 1, INK);
    r.rect(rightX + 2, cy, 1, 1, INK);
    return;
  }
  const ry = mode === 'wide' ? 4 : 3.2;
  const rx = mode === 'wide' ? 2.6 : 2.2;
  r.ellipse(leftX, cy, rx, ry, EYE);
  r.ellipse(rightX, cy, rx, ry, EYE);
  // 高光
  r.rect(leftX - 1, cy - 2, 1, 2, WHITE);
  r.rect(rightX - 1, cy - 2, 1, 2, WHITE);
}

function drawFaceFront(r: Raster, cx: number, cy: number, mode: Pose['eyes'], calico: boolean): void {
  // 额头虎斑
  if (!calico) {
    r.rect(cx - 5, cy - 8, 2, 3, STRIPE);
    r.rect(cx + 3, cy - 8, 2, 3, STRIPE);
    r.rect(cx - 1, cy - 9, 2, 2, STRIPE);
  }
  // 口鼻
  r.ellipse(cx, cy + 5, 5.4, 3.4, CREAM);
  // 眼睛
  drawEyes(r, cx, cy, mode, 6);
  // 鼻头（倒三角）
  r.rect(cx - 1, cy + 3, 2, 1, NOSE);
  r.rect(cx - 1, cy + 4, 2, 1, NOSE);
  // 嘴
  r.rect(cx - 1, cy + 6, 1, 1, INK);
  r.rect(cx, cy + 6, 1, 1, INK);
  r.rect(cx - 3, cy + 7, 2, 1, INK);
  r.rect(cx + 2, cy + 7, 2, 1, INK);
  // 胡须
  r.rect(cx - 9, cy + 4, 3, 1, CREAM_SHADE);
  r.rect(cx - 9, cy + 6, 2, 1, CREAM_SHADE);
  r.rect(cx + 7, cy + 4, 3, 1, CREAM_SHADE);
  r.rect(cx + 8, cy + 6, 2, 1, CREAM_SHADE);
  // 腮红
  r.rect(cx - 7, cy + 3, 2, 1, BLUSH);
  r.rect(cx + 5, cy + 3, 2, 1, BLUSH);
}

function drawScarf(r: Raster, x: number, y: number, w: number, knotX: number, back = false): void {
  r.rect(x, y, w, 4, SCARF);
  r.rect(x, y + 3, w, 1, SCARF_DARK);
  if (back) {
    r.rect(knotX, y + 3, 4, 3, SCARF);
    r.rect(knotX + 1, y + 4, 2, 2, SCARF_DARK);
  } else {
    r.rect(knotX, y + 3, 5, 4, SCARF);
    r.rect(knotX + 1, y + 4, 3, 2, SCARF_LIGHT);
  }
}

/* ------------------------------------------------------------------
   正面 / 背面
   ------------------------------------------------------------------ */

function drawFront(r: Raster, p: Pose, calico: boolean): void {
  const bob = p.bob - p.lift;
  const hx = 8 + p.lean;
  const hy = 6 + bob;
  const cx = hx + 12;
  const bodyY = 24 + bob;

  // 尾巴（身体右后方，露在头部轮廓之外）
  const tailBaseX = 27;
  const tailBaseY = bodyY + 8;
  r.curve(tailBaseX, tailBaseY, 37 + p.tail, 28 - p.tail, 35 + p.tail, 16, 4, FUR);
  r.ellipse(35 + p.tail, 16, 2.2, 2.2, CREAM);

  // 后腿
  r.rrect(15, bodyY + 7, 4, 38 - (bodyY + 7), 2, FUR);
  r.rrect(23, bodyY + 7, 4, 38 - (bodyY + 7), 2, FUR);
  r.rect(15, 36, 4, 2, CREAM);
  r.rect(23, 36, 4, 2, CREAM);

  // 身体
  r.rrect(13, bodyY, 16, 11, 4, FUR);
  // 胸口
  r.ellipse(21, bodyY + 7, 4.5, 4, CREAM);
  if (calico) {
    r.ellipse(16, bodyY + 3, 3.5, 3, CALICO);
  }
  // 前腿
  const legTopA = bodyY + 7 - p.legA;
  const legTopB = bodyY + 7 - p.legB;
  r.rrect(15, legTopA, 4, 38 - legTopA, 2, FUR);
  r.rrect(23, legTopB, 4, 38 - legTopB, 2, FUR);
  r.rect(15, 36, 4, 2, CREAM);
  r.rect(23, 36, 2, 2, CREAM);

  // 头
  r.rrect(hx + 1, hy, 22, 17, 8, FUR);
  // 脸颊绒毛
  r.tri(hx - 3, hy + 10, hx + 3, hy + 12, hx + 2, hy + 17, FUR);
  r.tri(hx + 27, hy + 10, hx + 21, hy + 12, hx + 22, hy + 17, FUR);
  // 三花斑
  if (calico) {
    r.ellipse(hx + 7, hy + 4, 4, 3.5, CALICO);
    r.ellipse(hx + 19, hy + 9, 3, 3, STRIPE);
  }
  drawEars(r, hx, hy, p.ears);
  drawFaceFront(r, cx, hy + 8, p.eyes, calico);
  // 围巾
  drawScarf(r, hx + 2, hy + 16, 20, cx - 2);
  // 头身分界线
  r.rect(hx + 2, hy + 16, 20, 1, STRIPE);
}

function drawBack(r: Raster, p: Pose, calico: boolean): void {
  const bob = p.bob - p.lift;
  const hx = 8;
  const hy = 6 + bob;
  const cx = hx + 12;
  const bodyY = 24 + bob;

  // 尾巴
  r.curve(27, bodyY + 8, 37 + p.tail, 29 - p.tail, 35 + p.tail, 16, 4, FUR);
  r.ellipse(35 + p.tail, 16, 2.2, 2.2, CREAM);

  // 后腿
  r.rrect(15, bodyY + 7, 4, 38 - (bodyY + 7), 2, FUR);
  r.rrect(23, bodyY + 7, 4, 38 - (bodyY + 7), 2, FUR);
  r.rect(15, 36, 4, 2, CREAM);
  r.rect(23, 36, 4, 2, CREAM);

  r.rrect(13, bodyY, 16, 11, 4, FUR);
  if (calico) {
    r.ellipse(17, bodyY + 3, 3.5, 3, CALICO);
  }
  // 背脊纹
  r.rect(20, bodyY + 1, 2, 8, STRIPE);
  r.rect(16, bodyY + 2, 1, 5, STRIPE);
  r.rect(25, bodyY + 2, 1, 5, STRIPE);

  const legTopA = bodyY + 7 - p.legA;
  const legTopB = bodyY + 7 - p.legB;
  r.rrect(15, legTopA, 4, 38 - legTopA, 2, FUR);
  r.rrect(23, legTopB, 4, 38 - legTopB, 2, FUR);
  r.rect(15, 36, 4, 2, CREAM);
  r.rect(23, 36, 4, 2, CREAM);

  // 头（背面）
  r.rrect(hx + 1, hy, 22, 17, 8, FUR);
  r.tri(hx - 3, hy + 10, hx + 3, hy + 12, hx + 2, hy + 17, FUR);
  r.tri(hx + 27, hy + 10, hx + 21, hy + 12, hx + 22, hy + 17, FUR);
  if (calico) {
    r.ellipse(hx + 7, hy + 4, 4, 3.5, CALICO);
    r.ellipse(hx + 18, hy + 8, 3, 3, STRIPE);
  }
  drawEars(r, hx, hy, p.ears);
  // 后脑纹路
  r.rect(cx - 1, hy + 2, 2, 5, STRIPE);
  r.rect(cx - 6, hy + 3, 1, 3, STRIPE);
  r.rect(cx + 5, hy + 3, 1, 3, STRIPE);
  // 围巾（背面打结）
  drawScarf(r, hx + 2, hy + 16, 20, cx - 2, true);
  r.rect(hx + 2, hy + 16, 20, 1, STRIPE);
}

/* ------------------------------------------------------------------
   侧面（朝左绘制，右向镜像）
   ------------------------------------------------------------------ */

function drawSideRaw(r: Raster, p: Pose, calico: boolean): void {
  const bob = p.bob - p.lift;
  const hx = 8 + p.lean;
  const hy = 6 + bob;
  const bodyY = 24 + bob;

  // 尾巴（向右后方翘起）
  r.curve(26, bodyY + 8, 34, 26 - p.tail, 35, 16 - p.tail, 4, FUR);
  r.ellipse(35, 16 - p.tail, 2.2, 2.2, CREAM);

  // 远侧腿（偏暗）
  r.rrect(17, bodyY + 7 - p.legB, 4, 38 - (bodyY + 7 - p.legB), 2, STRIPE);
  r.rrect(24, bodyY + 7 - p.legA, 4, 38 - (bodyY + 7 - p.legA), 2, STRIPE);

  // 身体
  r.rrect(12, bodyY, 16, 11, 4, FUR);
  r.ellipse(15, bodyY + 7, 3.5, 3.5, CREAM);
  if (calico) r.ellipse(23, bodyY + 3, 3, 3, CALICO);

  // 近侧腿
  r.rrect(13, bodyY + 7 - p.legA, 4, 38 - (bodyY + 7 - p.legA), 2, FUR);
  r.rrect(22, bodyY + 7 - p.legB, 4, 38 - (bodyY + 7 - p.legB), 2, FUR);
  r.rect(13, 36, 4, 2, CREAM);
  r.rect(22, 36, 4, 2, CREAM);

  // 头（朝左，带口鼻突出）
  r.rrect(hx, hy, 19, 17, 7, FUR);
  r.ellipse(hx + 2, hy + 11, 4, 3.4, CREAM);
  // 耳朵（近耳 + 远耳）
  r.tri(hx + 4, 13 + bob, hx + 10, 13 + bob, hx + 7, 1 + bob, FUR);
  r.tri(hx + 6, 12 + bob, hx + 9, 12 + bob, hx + 7.5, 5 + bob, NOSE);
  r.tri(hx + 12, 12 + bob, hx + 17, 12 + bob, hx + 15, 3 + bob, STRIPE);
  if (calico) {
    r.ellipse(hx + 12, hy + 4, 3.5, 3, CALICO);
  }
  // 眼睛
  const eyeCx = hx + 5;
  const eyeCy = hy + 8;
  if (p.eyes === 'closed') {
    r.rect(eyeCx - 2, eyeCy, 5, 1, INK);
  } else if (p.eyes === 'happy') {
    r.rect(eyeCx - 2, eyeCy + 1, 5, 1, INK);
    r.rect(eyeCx - 2, eyeCy, 1, 1, INK);
    r.rect(eyeCx + 2, eyeCy, 1, 1, INK);
  } else {
    const ry = p.eyes === 'wide' ? 3.6 : 3;
    r.ellipse(eyeCx, eyeCy, 1.9, ry, EYE);
    r.rect(eyeCx - 1, eyeCy - 2, 1, 2, WHITE);
  }
  // 鼻子与嘴
  r.rect(hx + 1, hy + 10, 2, 1, NOSE);
  r.rect(hx + 1, hy + 12, 1, 1, INK);
  r.rect(hx + 3, hy + 12, 1, 1, INK);
  // 额头纹
  r.rect(hx + 12, hy + 1, 1, 3, STRIPE);
  r.rect(hx + 14, hy + 2, 1, 2, STRIPE);
  // 围巾
  drawScarf(r, hx + 3, hy + 16, 15, hx + 3);
  r.rect(hx + 3, hy + 16, 15, 1, STRIPE);
}

/* ------------------------------------------------------------------
   睡姿
   ------------------------------------------------------------------ */

function drawSleep(r: Raster, i: number, calico: boolean): void {
  const bob = i === 1 ? 1 : 0;
  // 身体蜷成团
  r.ellipse(24, 30, 9.5, 6.5, FUR);
  if (calico) r.ellipse(28, 29, 3.5, 3, CALICO);
  // 尾巴绕到身前
  r.curve(30, 33, 26, 37, 12, 35, 4, FUR);
  r.ellipse(12, 35, 2.2, 2.2, CREAM);
  // 头部趴在前爪上
  const hx = 7;
  const hy = 20 + bob;
  r.rrect(hx, hy, 20, 15, 6, FUR);
  // 耳朵
  r.tri(hx + 2, 25 + bob, hx + 8, 25 + bob, hx + 5, 16 + bob, FUR);
  r.tri(hx + 12, 25 + bob, hx + 18, 25 + bob, hx + 15, 16 + bob, FUR);
  r.tri(hx + 4, 24 + bob, hx + 7, 24 + bob, hx + 5.5, 19 + bob, NOSE);
  // 闭眼
  r.rect(hx + 3, hy + 8, 4, 1, INK);
  r.rect(hx + 11, hy + 8, 4, 1, INK);
  // 口鼻
  r.ellipse(hx + 10, hy + 10, 5, 3, CREAM);
  r.rect(hx + 9, hy + 9, 2, 1, NOSE);
  // 腮红
  r.rect(hx + 2, hy + 9, 2, 1, BLUSH);
  // 围巾一角
  r.rect(hx + 15, hy + 11, 5, 3, SCARF);
  r.rect(hx + 15, hy + 13, 5, 1, SCARF_DARK);
  // Zzz
  const zx = 31;
  const zy = 10 - (i === 1 ? 1 : 0);
  r.rect(zx, zy, 5, 1, CREAM);
  r.rect(zx + 3, zy + 1, 1, 1, CREAM);
  r.rect(zx + 2, zy + 2, 1, 1, CREAM);
  r.rect(zx, zy + 3, 5, 1, CREAM);
  r.rect(zx + 4, zy + 7, 4, 1, CREAM);
  r.rect(zx + 5, zy + 8, 1, 1, CREAM);
  r.rect(zx + 4, zy + 9, 1, 1, CREAM);
  r.rect(zx + 4, zy + 10, 4, 1, CREAM);
}

/* ------------------------------------------------------------------
   图集
   ------------------------------------------------------------------ */

function ctxAfterTranslate(ctx: PainterCtx, col: number, row: number): PainterCtx {
  ctx.save();
  ctx.translate(col * FRAME, row * FRAME);
  return ctx;
}

export function createCatSheetCanvas(skin: CatSkin = 'orange'): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(FRAME * SHEET_COLS, FRAME * SHEET_ROWS);
  const calico = skin === 'calico';
  const furRamp = calico ? RAMPS.furPale : undefined;
  const anims: Array<{ anim: CatAnim; count: number }> = [
    { anim: 'idle', count: 2 },
    { anim: 'walk', count: 4 },
    { anim: 'interact', count: 2 },
    { anim: 'happy', count: 2 },
    { anim: 'sleep', count: 2 },
    { anim: 'blink', count: 1 },
  ];
  let col = 0;
  for (const { anim, count } of anims) {
    for (let i = 0; i < count; i++) {
      for (const dir of ['down', 'left', 'right', 'up'] as CatDir[]) {
        const c = ctxAfterTranslate(ctx, col + i, DIR_ROW[dir]);
        const p = poseFor(anim, i);
        const r = new Raster();
        if (anim === 'sleep') {
          drawSleep(r, i, calico);
        } else if (DIR_ROW[dir] === DIR_ROW.down) {
          drawFront(r, p, calico);
        } else if (DIR_ROW[dir] === DIR_ROW.up) {
          drawBack(r, p, calico);
        } else {
          const side = new Raster();
          drawSideRaw(side, p, calico);
          const out = DIR_ROW[dir] === DIR_ROW.right ? side.mirrored() : side;
          out.render(c, furRamp);
          ctx.restore();
          continue;
        }
        r.render(c, furRamp);
        ctx.restore();
      }
    }
    col += count;
  }
  return canvas;
}

export function createCatSheet(skin: CatSkin = 'orange'): THREE.CanvasTexture {
  const canvas = createCatSheetCanvas(skin);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** 某帧在图集中的 UV 偏移（配合 1/13 × 1/4 的 repeat 使用） */
export function frameOffset(anim: CatAnim, dir: CatDir, frameIndex: number): { x: number; y: number } {
  const col = CAT_ANIM[anim].start + frameIndex;
  const row = DIR_ROW[dir];
  return {
    x: col / SHEET_COLS,
    y: 1 - (row + 1) / SHEET_ROWS,
  };
}

/* ------------------------------------------------------------------
   头像与道具图标（供 HTML UI 使用）
   ------------------------------------------------------------------ */

export function createPortrait(kind: 'cat' | 'client' | 'narrator' | 'board'): string {
  const size = 96;
  const { canvas, ctx } = makeCanvas(size, size);
  if (kind === 'cat' || kind === 'client') {
    const r = new Raster();
    const p = { ...BASE_POSE };
    const calico = kind === 'client';
    drawFront(r, p, calico);
    const src = makeCanvas(FRAME, FRAME);
    r.render(src.ctx, calico ? RAMPS.furPale : undefined);
    ctx.imageSmoothingEnabled = false;
    // 只取头部区域
    ctx.drawImage(src.canvas, 2, 0, 36, 26, 4, 8, 88, 78);
  } else if (kind === 'narrator') {
    ctx.fillStyle = '#3A3247';
    ctx.fillRect(22, 58, 52, 8);
    ctx.fillRect(26, 66, 44, 22);
    ctx.fillStyle = '#514D64';
    ctx.fillRect(28, 60, 40, 6);
    ctx.fillStyle = '#F4D9B2';
    for (let i = 0; i < 9; i++) {
      ctx.fillRect(40 + i * 3, 30 - i * 2, 3, 26 + i);
    }
    ctx.fillStyle = '#FFC27A';
    ctx.fillRect(34, 62, 8, 6);
  } else {
    ctx.fillStyle = '#6E4632';
    ctx.fillRect(14, 14, 68, 68);
    ctx.fillStyle = '#B98B5E';
    ctx.fillRect(19, 19, 58, 58);
    ctx.fillStyle = '#FBF0DC';
    ctx.fillRect(26, 26, 20, 24);
    ctx.fillRect(50, 30, 18, 20);
    ctx.fillStyle = '#C8604C';
    ctx.fillRect(34, 23, 6, 6);
    ctx.fillRect(56, 27, 6, 6);
    ctx.fillStyle = '#8A7E8C';
    ctx.fillRect(30, 36, 12, 2);
    ctx.fillRect(30, 41, 10, 2);
    ctx.fillRect(54, 38, 10, 2);
  }
  return canvas.toDataURL('image/png');
}

export function createItemIcon(kind: 'letter' | 'tuna' | 'folder' | 'coin' | 'note'): string {
  const size = 32;
  const { canvas, ctx } = makeCanvas(size, size);
  const rnd = mulberry32(31);
  if (kind === 'letter') {
    ctx.fillStyle = '#2B1C1A';
    ctx.fillRect(4, 7, 24, 18);
    ctx.fillStyle = '#FBEFD8';
    ctx.fillRect(5, 8, 22, 16);
    ctx.fillStyle = '#E3CFAF';
    ctx.fillRect(5, 8, 22, 2);
    ctx.fillStyle = '#B2433A';
    ctx.fillRect(13, 16, 7, 7);
    ctx.fillStyle = '#D96A54';
    ctx.fillRect(14, 17, 5, 5);
  } else if (kind === 'tuna') {
    ctx.fillStyle = '#2B1C1A';
    ctx.fillRect(7, 8, 18, 17);
    ctx.fillStyle = '#C9CDD4';
    ctx.fillRect(8, 9, 16, 15);
    ctx.fillStyle = '#F1E0BE';
    ctx.fillRect(8, 13, 16, 8);
    ctx.fillStyle = '#C8604C';
    ctx.fillRect(8, 13, 16, 2);
    ctx.fillRect(8, 19, 16, 2);
    ctx.fillStyle = '#5C93A0';
    ctx.fillRect(11, 15, 9, 3);
    ctx.fillRect(20, 14, 2, 5);
    ctx.fillStyle = '#9AA0AA';
    ctx.fillRect(9, 9, 14, 2);
    ctx.fillRect(9, 23, 14, 1);
  } else if (kind === 'folder') {
    ctx.fillStyle = '#2B1C1A';
    ctx.fillRect(5, 9, 22, 17);
    ctx.fillStyle = '#D9B678';
    ctx.fillRect(6, 11, 20, 14);
    ctx.fillStyle = '#C49D5F';
    ctx.fillRect(6, 11, 8, 3);
    ctx.fillStyle = '#FBF0DC';
    ctx.fillRect(8, 15, 16, 9);
    ctx.fillStyle = '#8A7E8C';
    ctx.fillRect(10, 17, 10, 1);
    ctx.fillRect(10, 20, 7, 1);
  } else if (kind === 'coin') {
    ctx.fillStyle = '#3A2410';
    ctx.fillRect(7, 7, 18, 18);
    ctx.fillStyle = '#D6A33A';
    ctx.fillRect(8, 8, 16, 16);
    ctx.fillStyle = '#F2D072';
    ctx.fillRect(9, 9, 14, 14);
    ctx.fillStyle = '#A5701F';
    ctx.fillRect(12, 12, 8, 6);
    ctx.fillRect(11, 17, 2, 2);
    ctx.fillRect(14, 19, 2, 2);
    ctx.fillRect(17, 19, 2, 2);
    ctx.fillRect(19, 17, 2, 2);
    ctx.fillStyle = '#FFF3C0';
    ctx.fillRect(10, 10, 4, 2);
  } else {
    ctx.fillStyle = '#2B1C1A';
    ctx.fillRect(5, 6, 22, 21);
    ctx.fillStyle = '#FBF0DC';
    ctx.fillRect(6, 7, 20, 19);
    ctx.fillStyle = '#8A7E8C';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(9, 11 + i * 3, 8 + Math.floor(rnd() * 8), 1);
    }
  }
  return canvas.toDataURL('image/png');
}
