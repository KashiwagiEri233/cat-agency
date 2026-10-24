/**
 * 阿橘（像素橘猫）：Sprite Sheet 播放、四方向朝向、眨眼与地面阴影。
 * 精灵用 alphaTest 参与深度测试，因此能被家具正确遮挡。
 */
import * as THREE from 'three';
import { CAT_ANIM, createCatSheet, frameOffset, SHEET_COLS, SHEET_ROWS, type CatSkin } from '../art/SpriteGenerator';
import { PLAYER } from '../game/constants';
import type { CatAnim, CatDir } from '../game/types';

const FOOT_MARGIN = 2 / 40; // 精灵底部预留的像素行

export class CatCharacter {
  readonly group: THREE.Group;
  private readonly sprite: THREE.Mesh;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly texture: THREE.Texture;
  private anim: CatAnim = 'idle';
  private dir: CatDir = 'down';
  private animTime = 0;
  private blinkTimer = 2.5;
  private blinkLeft = 0;
  private blinkSeed = 0.7;

  constructor(scene: THREE.Scene, x: number, z: number, skin: CatSkin = 'orange') {
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);

    this.texture = createCatSheet(skin);
    this.texture.repeat.set(1 / SHEET_COLS, 1 / SHEET_ROWS);

    this.material = new THREE.MeshStandardMaterial({
      map: this.texture,
      alphaTest: 0.45,
      roughness: 1,
      metalness: 0,
      emissive: new THREE.Color(skin === 'calico' ? '#4a3a2c' : '#4a2a1c'),
      emissiveIntensity: 0.22,
    });

    const geo = new THREE.PlaneGeometry(PLAYER.spriteSize, PLAYER.spriteSize);
    this.sprite = new THREE.Mesh(geo, this.material);
    this.sprite.position.y = PLAYER.spriteSize / 2 - FOOT_MARGIN * PLAYER.spriteSize;
    this.sprite.rotation.y = Math.PI / 4; // 面向等距摄像机
    this.sprite.castShadow = true;
    this.group.add(this.sprite);

    // 软接触阴影
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.textureLibraryShadow(),
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    shadow.renderOrder = 1;
    this.group.add(shadow);

    scene.add(this.group);
    this.updateTexture();
  }

  private textureLibraryShadow(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grd = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      grd.addColorStop(0, 'rgba(24,16,26,0.55)');
      grd.addColorStop(0.6, 'rgba(24,16,26,0.28)');
      grd.addColorStop(1, 'rgba(24,16,26,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 64, 64);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  get direction(): CatDir {
    return this.dir;
  }

  setPosition(x: number, z: number): void {
    this.group.position.x = x;
    this.group.position.z = z;
  }

  faceDirection(dir: CatDir): void {
    this.dir = dir;
    this.updateTexture();
  }

  /** 根据世界移动方向推断屏幕四方向 */
  setDirectionFromVector(dx: number, dz: number): void {
    if (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4) return;
    const sx = (dx - dz) / Math.SQRT2;
    const sy = -(dx + dz) / Math.SQRT2;
    if (Math.abs(sx) > Math.abs(sy) * 1.05) {
      this.dir = sx > 0 ? 'right' : 'left';
    } else {
      this.dir = sy > 0 ? 'up' : 'down';
    }
  }

  play(anim: CatAnim, restart = false): void {
    if (this.anim === anim && !restart) return;
    this.anim = anim;
    this.animTime = 0;
    this.updateTexture();
  }

  get currentAnim(): CatAnim {
    return this.anim;
  }

  isOneShotDone(): boolean {
    const cfg = CAT_ANIM[this.anim];
    return !cfg.loop && this.animTime >= cfg.count / cfg.fps;
  }

  update(dt: number): void {
    this.animTime += dt;

    // 眨眼：只在待机时发生
    if (this.anim === 'idle') {
      if (this.blinkLeft > 0) {
        this.blinkLeft -= dt;
      } else {
        this.blinkTimer -= dt;
        if (this.blinkTimer <= 0) {
          this.blinkLeft = 0.14;
          this.blinkSeed = (this.blinkSeed * 9301 + 49297) % 233280 / 233280;
          this.blinkTimer = 2.2 + this.blinkSeed * 3.4;
        }
      }
    } else {
      this.blinkLeft = 0;
    }

    if (this.blinkLeft > 0 && this.anim === 'idle') {
      const off = frameOffset('blink', this.dir, 0);
      this.texture.offset.set(off.x, off.y);
      return;
    }

    const cfg = CAT_ANIM[this.anim];
    const frame = cfg.loop
      ? Math.floor(this.animTime * cfg.fps) % cfg.count
      : Math.min(cfg.count - 1, Math.floor(this.animTime * cfg.fps));
    const off = frameOffset(this.anim, this.dir, frame);
    this.texture.offset.set(off.x, off.y);
  }

  private updateTexture(): void {
    const off = frameOffset(this.anim, this.dir, 0);
    this.texture.offset.set(off.x, off.y);
  }
}
