/**
 * 灯光：柔和环境光 + 窗外暖阳 + 台灯与吊灯的局部暖光。
 * 只有一盏投影平行光，控制在阴影预算内。
 */
import * as THREE from 'three';
import { COLORS, ROOM } from '../game/constants';

export class Lighting {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly ambient: THREE.AmbientLight;
  readonly deskLamp: THREE.PointLight;
  readonly ceilingLamp: THREE.PointLight;
  private readonly baseDeskIntensity: number;
  private readonly baseCeilIntensity: number;

  constructor(scene: THREE.Scene) {
    this.hemi = new THREE.HemisphereLight(new THREE.Color(COLORS.fillSky), new THREE.Color(COLORS.fillGround), 1.05);
    scene.add(this.hemi);

    this.ambient = new THREE.AmbientLight(new THREE.Color('#C8B4D6'), 0.22);
    scene.add(this.ambient);

    // 阳光从左后方（窗户一侧）射入
    this.sun = new THREE.DirectionalLight(new THREE.Color(COLORS.sun), 2.55);
    this.sun.position.set(-7.5, 9.5, -9);
    this.sun.target.position.set(0.8, 0, 0.8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -8.5;
    this.sun.shadow.camera.right = 8.5;
    this.sun.shadow.camera.top = 8.5;
    this.sun.shadow.camera.bottom = -8.5;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 34;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.028;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.deskLamp = new THREE.PointLight(new THREE.Color(COLORS.lamp), 3.2, 4.6, 2);
    this.deskLamp.position.set(-2.55, 1.5, -2.2);
    scene.add(this.deskLamp);

    this.ceilingLamp = new THREE.PointLight(new THREE.Color('#FFD9A8'), 5.5, 8.5, 2);
    this.ceilingLamp.position.set(0.4, 2.35, 0.2);
    scene.add(this.ceilingLamp);

    this.baseDeskIntensity = this.deskLamp.intensity;
    this.baseCeilIntensity = this.ceilingLamp.intensity;
  }

  update(_dt: number, elapsed: number): void {
    // 灯丝轻微呼吸，避免死板的静态光
    const flicker = 1 + Math.sin(elapsed * 7.3) * 0.025 + Math.sin(elapsed * 17.1) * 0.012;
    this.deskLamp.intensity = this.baseDeskIntensity * flicker;
    this.ceilingLamp.intensity = this.baseCeilIntensity * (1 + Math.sin(elapsed * 2.1) * 0.02);
  }

  /** 相机缩放时微调光比，近景更暖一点 */
  setZoomHint(zoom: number): void {
    this.deskLamp.intensity = this.baseDeskIntensity * THREE.MathUtils.clamp(zoom, 0.9, 1.35);
  }

  /** 给窗外天空一个方向光提示（供场景构建时定位窗光） */
  static windowLightDirection(): THREE.Vector3 {
    return new THREE.Vector3(
      ROOM.width / 2 - 3.2,
      2,
      ROOM.depth / 2,
    ).normalize();
  }
}
