/**
 * 玩家控制：等距屏幕方向移动、矩形碰撞、自动走向点击目标、
 * 一次性的调查 / 开心动作以及久坐打瞌睡。
 */
import * as THREE from 'three';
import { CatCharacter } from '../entities/CatCharacter';
import { PLAYER, ROOM } from './constants';
import type { CatDir, Collider } from './types';

const WALL_MARGIN = 0.3;

function collides(x: number, z: number, colliders: Collider[], radius: number): boolean {
  for (const c of colliders) {
    if (
      x + radius > c.minX &&
      x - radius < c.maxX &&
      z + radius > c.minZ &&
      z - radius < c.maxZ
    ) {
      return true;
    }
  }
  return false;
}

export class Player {
  readonly cat: CatCharacter;
  locked = false;
  onAutoArrive?: () => void;

  private autoTarget: THREE.Vector2 | null = null;
  private actionTimer = 0;
  private idleTimer = 0;
  private stuckTimer = 0;
  private moving = false;

  constructor(scene: THREE.Scene, x: number, z: number) {
    this.cat = new CatCharacter(scene, x, z);
  }

  get position(): THREE.Vector3 {
    return this.cat.position;
  }

  get isMoving(): boolean {
    return this.moving;
  }

  get isBusy(): boolean {
    return this.actionTimer > 0;
  }

  get isAutoWalking(): boolean {
    return this.autoTarget !== null;
  }

  update(dt: number, inputX: number, inputZ: number, colliders: Collider[]): void {
    const cat = this.cat;

    if (this.actionTimer > 0) {
      this.actionTimer -= dt;
      cat.update(dt);
      if (this.actionTimer <= 0) cat.play('idle');
      return;
    }

    if (this.locked) {
      this.moving = false;
      if (cat.currentAnim !== 'idle') cat.play('idle');
      cat.update(dt);
      return;
    }

    let moveX = 0;
    let moveZ = 0;

    if (inputX !== 0 || inputZ !== 0) {
      this.autoTarget = null;
      const len = Math.hypot(inputX, inputZ) || 1;
      moveX = inputX / len;
      moveZ = inputZ / len;
      this.idleTimer = 0;
      if (cat.currentAnim === 'sleep') cat.play('idle');
    } else if (this.autoTarget) {
      const dx = this.autoTarget.x - cat.position.x;
      const dz = this.autoTarget.y - cat.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < PLAYER.arriveEpsilon) {
        this.autoTarget = null;
        const cb = this.onAutoArrive;
        this.onAutoArrive = undefined;
        cb?.();
      } else {
        moveX = dx / dist;
        moveZ = dz / dist;
      }
      this.idleTimer = 0;
    } else {
      this.idleTimer += dt;
    }

    if (moveX !== 0 || moveZ !== 0) {
      const step = PLAYER.walkSpeed * dt;
      const beforeX = cat.position.x;
      const beforeZ = cat.position.z;
      this.moveWithCollision(moveX * step, moveZ * step, colliders);
      const moved = Math.hypot(cat.position.x - beforeX, cat.position.z - beforeZ);
      if (this.autoTarget) {
        // 被家具卡住超过 0.9 秒就放弃自动寻路
        this.stuckTimer = moved < 0.0005 ? this.stuckTimer + dt : 0;
        if (this.stuckTimer > 0.9) {
          this.autoTarget = null;
          this.stuckTimer = 0;
          this.onAutoArrive = undefined;
        }
      }
      cat.setDirectionFromVector(moveX, moveZ);
      cat.play('walk');
      this.moving = true;
    } else {
      this.moving = false;
      if (this.idleTimer > PLAYER.idleSleepSeconds) {
        cat.play('sleep');
      } else if (cat.currentAnim !== 'idle') {
        cat.play('idle');
      }
    }

    cat.update(dt);
  }

  private moveWithCollision(dx: number, dz: number, colliders: Collider[]): void {
    const p = this.cat.position;
    const r = PLAYER.radius;
    const minX = -ROOM.width / 2 + WALL_MARGIN;
    const maxX = ROOM.width / 2 - WALL_MARGIN;
    const minZ = -ROOM.depth / 2 + WALL_MARGIN;
    const maxZ = ROOM.depth / 2 - WALL_MARGIN;

    const nextX = THREE.MathUtils.clamp(p.x + dx, minX, maxX);
    if (!collides(nextX, p.z, colliders, r)) {
      p.x = nextX;
    }
    const nextZ = THREE.MathUtils.clamp(p.z + dz, minZ, maxZ);
    if (!collides(p.x, nextZ, colliders, r)) {
      p.z = nextZ;
    }
  }

  /** 点击远处物件时自动走向目标点 */
  walkTo(x: number, z: number, onArrive: () => void): void {
    this.autoTarget = new THREE.Vector2(x, z);
    this.onAutoArrive = onArrive;
    this.stuckTimer = 0;
    this.idleTimer = 0;
  }

  stop(): void {
    this.autoTarget = null;
    this.onAutoArrive = undefined;
    this.moving = false;
  }

  playInteract(dir?: CatDir): void {
    if (dir) this.cat.faceDirection(dir);
    this.cat.play('interact', true);
    this.actionTimer = 0.55;
    this.autoTarget = null;
  }

  playHappy(duration = 2.2): void {
    this.cat.play('happy', true);
    this.actionTimer = duration;
    this.autoTarget = null;
  }

  faceTowards(point: THREE.Vector3): void {
    const dx = point.x - this.cat.position.x;
    const dz = point.z - this.cat.position.z;
    this.cat.setDirectionFromVector(dx, dz);
  }
}
