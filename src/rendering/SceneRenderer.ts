/**
 * 渲染器：固定内部低分辨率 + 最近邻放大到全屏，形成稳定的像素颗粒。
 * 负责画布尺寸、相机比例、后处理管线与窗口自适应。
 */
import * as THREE from 'three';
import { RENDER } from '../game/constants';
import { CameraController } from './CameraController';
import { PostProcessing, type PostSettings } from './PostProcessing';

export class SceneRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly cameraController: CameraController;
  readonly post: PostProcessing;

  private crisp = true;
  private internalWidth = 0;
  private internalHeight = 0;
  private readonly onResizeBound: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#171320');

    this.cameraController = new CameraController();
    this.post = new PostProcessing(this.renderer, this.scene, this.cameraController.camera);

    this.onResizeBound = () => this.resize();
    window.addEventListener('resize', this.onResizeBound);
    this.resize();
  }

  setCrisp(value: boolean): void {
    this.crisp = value;
    this.resize();
  }

  setPostSettings(settings: PostSettings): void {
    this.post.setSettings(settings);
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / Math.max(1, h);

    let pixelHeight = this.crisp ? 400 : 288;
    let pixelWidth = Math.round(pixelHeight * aspect);
    if (pixelWidth > RENDER.maxPixelWidth) {
      pixelWidth = RENDER.maxPixelWidth;
      pixelHeight = Math.round(pixelWidth / aspect);
    }
    if (pixelWidth < RENDER.minPixelWidth) {
      pixelWidth = RENDER.minPixelWidth;
      pixelHeight = Math.round(pixelWidth / aspect);
    }

    this.internalWidth = pixelWidth;
    this.internalHeight = pixelHeight;

    this.renderer.setSize(pixelWidth, pixelHeight, false);
    this.post.setSize(pixelWidth, pixelHeight);
    this.cameraController.setAspect(aspect);
  }

  getInternalSize(): { width: number; height: number } {
    return { width: this.internalWidth, height: this.internalHeight };
  }

  render(dt: number): void {
    this.post.render(dt);
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResizeBound);
    this.post.dispose();
    this.renderer.dispose();
  }
}
