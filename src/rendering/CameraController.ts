/**
 * 正交等距摄像机。固定俯仰与朝向（不任意旋转），
 * 支持滚轮缩放、平滑跟随，并把焦点吸附到像素网格以减少抖动。
 */
import * as THREE from 'three';
import { CAMERA, PPU } from '../game/constants';

const DEG = Math.PI / 180;

export class CameraController {
  readonly camera: THREE.OrthographicCamera;
  follow = true;

  private aspect = 16 / 9;
  private zoom = 1;
  private zoomTarget = 1;
  private readonly focus = new THREE.Vector3(0, 1.25, 0);
  private readonly smooth = new THREE.Vector3(0, 1.25, 0);
  private readonly dirX: number;
  private readonly dirY: number;
  private readonly dirZ: number;

  constructor() {
    const pitch = CAMERA.pitchDeg * DEG;
    const yaw = CAMERA.yawDeg * DEG;
    this.dirX = Math.sin(yaw) * Math.cos(pitch);
    this.dirY = Math.sin(pitch);
    this.dirZ = Math.cos(yaw) * Math.cos(pitch);
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 120);
    this.applyFrustum();
    this.place();
  }

  setAspect(aspect: number): void {
    this.aspect = Math.max(0.4, aspect);
    this.applyFrustum();
    this.place();
  }

  setZoomTarget(zoom: number): void {
    this.zoomTarget = THREE.MathUtils.clamp(zoom, 0.82, 1.6);
  }

  getZoom(): number {
    return this.zoom;
  }

  zoomBy(deltaY: number): void {
    const factor = deltaY > 0 ? 0.92 : 1.08;
    this.setZoomTarget(this.zoomTarget * factor);
  }

  update(dt: number, playerX: number, playerZ: number): void {
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 9);
    this.applyFrustum();

    // 跟随：只移动 40%，让整个微缩房间始终留在画面里
    const followK = this.follow ? 0.4 : 0;
    const desiredX = playerX * followK;
    const desiredZ = playerZ * followK;
    const k = 1 - Math.exp(-CAMERA.followLambda * dt);
    this.smooth.x += (desiredX - this.smooth.x) * k;
    this.smooth.z += (desiredZ - this.smooth.z) * k;

    // 像素对齐：把焦点吸附到半像素网格
    const snap = 1 / (PPU * 2);
    this.focus.set(
      Math.round(this.smooth.x / snap) * snap,
      1.25,
      Math.round(this.smooth.z / snap) * snap,
    );
    this.place();
  }

  private applyFrustum(): void {
    const baseH = CAMERA.baseViewHeight / this.zoom;
    // 保证等距投影下的房间宽度始终在画面内（窄屏自动拉远）
    const roomProjectedWidth = (10 + 8) / Math.SQRT2 + 2.2;
    const h = Math.max(baseH, roomProjectedWidth / this.aspect);
    const w = h * this.aspect;
    const cam = this.camera;
    cam.left = -w / 2;
    cam.right = w / 2;
    cam.top = h / 2;
    cam.bottom = -h / 2;
    cam.updateProjectionMatrix();
  }

  private place(): void {
    const cam = this.camera;
    cam.position.set(
      this.focus.x + this.dirX * CAMERA.distance,
      this.focus.y + this.dirY * CAMERA.distance,
      this.focus.z + this.dirZ * CAMERA.distance,
    );
    cam.lookAt(this.focus);
    cam.updateMatrixWorld();
  }

  /** 世界坐标 → 屏幕像素（用于 UI 定位） */
  projectToScreen(pos: THREE.Vector3, width: number, height: number): { x: number; y: number } {
    const v = pos.clone().project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * width,
      y: (-v.y * 0.5 + 0.5) * height,
    };
  }
}
