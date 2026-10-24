/**
 * 后处理链：场景 → 暖色 Bloom → 移轴景深 → ACES 输出 → 像素量化 / 色调 / 暗角 / 颗粒。
 * 全部在低分辨率缓冲上执行，既保证像素颗粒感，也保持 60FPS 的预算。
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uStrength: { value: 1 },
    uBand: { value: 0.3 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uStrength;
    uniform float uBand;
    varying vec2 vUv;

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      // 屏幕上下边缘渐强，中间保持锐利（移轴）
      float d = abs(vUv.y - 0.5) * 2.0;
      float mask = smoothstep(uBand, 0.98, d) * uStrength;
      if (mask < 0.01) {
        gl_FragColor = base;
        return;
      }
      vec2 px = 1.0 / uResolution;
      float radius = 1.0 + mask * 8.0;
      vec4 sum = base;
      float total = 1.0;
      for (int i = 0; i < 12; i++) {
        float a = float(i) * 0.5235988 + 0.4;
        float rr = 0.45 + 0.55 * fract(float(i) * 0.371);
        vec2 off = vec2(cos(a), sin(a)) * px * radius * rr;
        sum += texture2D(tDiffuse, vUv + off);
        total += 1.0;
      }
      gl_FragColor = sum / total;
    }
  `,
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uLevels: { value: 30 },
    uVignette: { value: 0.42 },
    uGrain: { value: 0.022 },
    uSaturation: { value: 1.08 },
    uContrast: { value: 1.05 },
    uWarmth: { value: 0.85 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uLevels;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uWarmth;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      vec2 dir = uv - 0.5;

      // 极轻微的色散，像素边缘仍然清晰
      float ca = 0.0009;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * ca).b;

      // 暖色调
      col.r *= 1.0 + 0.03 * uWarmth;
      col.g *= 1.0 + 0.006 * uWarmth;
      col.b *= 1.0 - 0.035 * uWarmth;

      // 对比 / 饱和
      col = (col - 0.5) * uContrast + 0.5;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSaturation);

      // 冷影暖光
      col += vec3(-0.018, 0.006, 0.030) * (1.0 - smoothstep(0.0, 0.5, l));
      col += vec3(0.026, 0.012, -0.006) * smoothstep(0.55, 1.0, l);

      // 像素化色阶量化
      col = floor(col * uLevels + 0.5) / uLevels;

      // 暗角
      float v = 1.0 - uVignette * smoothstep(0.36, 0.9, length(dir * vec2(1.0, 1.15)));
      col *= v;

      // 胶片颗粒（按像素稳定，不随时间闪烁）
      float n = hash(floor(uv * uResolution)) - 0.5;
      col += n * uGrain;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export interface PostSettings {
  bloom: boolean;
  dof: boolean;
}

export class PostProcessing {
  readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly tiltPass: ShaderPass;
  private readonly gradePass: ShaderPass;
  private time = 0;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(320, 320), 0.52, 0.62, 0.86);
    this.composer.addPass(this.bloomPass);

    this.tiltPass = new ShaderPass(TiltShiftShader);
    this.composer.addPass(this.tiltPass);

    this.composer.addPass(new OutputPass());

    this.gradePass = new ShaderPass(GradeShader);
    this.composer.addPass(this.gradePass);
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
    const tiltU = this.tiltPass.uniforms;
    tiltU.uResolution.value.set(width, height);
    const gradeU = this.gradePass.uniforms;
    gradeU.uResolution.value.set(width, height);
    // 低分辨率下颗粒要更轻，避免噪点糊住像素
    gradeU.uGrain.value = 0.018;
  }

  setSettings(settings: PostSettings): void {
    this.bloomPass.enabled = settings.bloom;
    this.tiltPass.uniforms.uStrength.value = settings.dof ? 1 : 0;
  }

  /** 动态调整景深强度（例如对话时更柔） */
  setDofStrength(strength: number): void {
    this.tiltPass.uniforms.uStrength.value = strength;
  }

  render(dt: number): void {
    this.time += dt;
    this.gradePass.uniforms.uTime.value = this.time;
    this.composer.render(dt);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
