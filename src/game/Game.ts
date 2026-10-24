/**
 * 游戏主循环：串起渲染、世界、玩家、交互、任务与 UI。
 */
import * as THREE from 'three';
import { SceneRenderer } from '../rendering/SceneRenderer';
import { Lighting } from '../rendering/Lighting';
import { TextureLibrary } from '../art/PixelTextures';
import { createPortrait } from '../art/SpriteGenerator';
import { World } from './World';
import { Player } from './Player';
import { InputManager } from './InputManager';
import { InteractionSystem } from './InteractionSystem';
import { QuestSystem, REWARD_COINS } from './QuestSystem';
import { AudioManager } from './AudioManager';
import { storyFor, introStory, type StoryEffect } from './Story';
import { Dialogue } from '../ui/Dialogue';
import { GameUI } from '../ui/GameUI';
import { CLOCK, PLAYER, SETTINGS_KEY, STORAGE_KEY } from './constants';
import type { Interactable, Settings } from './types';

interface Burst {
  points: THREE.Points;
  velocities: Float32Array;
  life: number;
  maxLife: number;
}

const DEFAULT_SETTINGS: Settings = {
  bloom: true,
  dof: true,
  follow: true,
  sound: true,
  crispPixels: true,
};

export class Game {
  private readonly renderer: SceneRenderer;
  private readonly lighting: Lighting;
  private readonly world: World;
  private readonly player: Player;
  private readonly interaction: InteractionSystem;
  private readonly dialogue: Dialogue;
  private readonly ui: GameUI;
  private readonly audio = new AudioManager();
  private readonly input: InputManager;
  private readonly quest = new QuestSystem();

  private readonly clock = new THREE.Clock();
  private elapsed = 0;
  private gameMinutes = CLOCK.startMinutes;
  private clockAccum = 0;
  private busy = false;
  private pointerCount = 0;
  private settings: Settings;
  private readonly bursts: Burst[] = [];
  private readonly startPosition = new THREE.Vector3(-1.0, 0, 2.45);
  private readonly portraits: Record<string, string>;

  constructor(canvas: HTMLCanvasElement) {
    this.settings = this.loadSettings();

    this.renderer = new SceneRenderer(canvas);
    this.lighting = new Lighting(this.renderer.scene);
    const textures = new TextureLibrary();
    this.world = new World(this.renderer.scene, textures);

    this.player = new Player(this.renderer.scene, this.startPosition.x, this.startPosition.z);
    this.player.cat.faceDirection('right');

    this.interaction = new InteractionSystem(this.renderer.cameraController.camera, this.world.interactables);
    this.interaction.setFloor(this.world.floor);

    this.portraits = {
      cat: createPortrait('cat'),
      client: createPortrait('client'),
      narrator: createPortrait('narrator'),
      board: createPortrait('board'),
    };
    this.dialogue = new Dialogue(this.portraits);

    this.ui = new GameUI(this.settings, {
      onSettingsChange: (key, value) => this.applySetting(key, value),
      onResetQuest: () => this.resetQuest(),
    });

    this.input = new InputManager(canvas);
    this.bindInput();
    this.applyAllSettings();

    this.refreshUI();
    this.world.showQuestMarker(!this.quest.state.completed);
    if (this.quest.state.foundTuna && !this.quest.state.completed) {
      this.world.revealTuna();
    }

    // 开发调试入口
    if (import.meta.env.DEV) {
      (window as unknown as { __cat: unknown }).__cat = {
        player: this.player,
        quest: this.quest,
        world: this.world,
        interaction: this.interaction,
        state: () => ({
          x: Number(this.player.position.x.toFixed(2)),
          z: Number(this.player.position.z.toFixed(2)),
          nearest: this.interaction.getNearest()?.id ?? null,
          quest: this.quest.state,
          modal: this.ui.settingsOpen,
          clicks: this.pointerCount,
        }),
      };
    }

    this.loop();
  }

  private loadSettings(): Settings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // 使用默认设置
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // 忽略存储异常
    }
  }

  private applyAllSettings(): void {
    this.renderer.setPostSettings({ bloom: this.settings.bloom, dof: this.settings.dof });
    this.renderer.setCrisp(this.settings.crispPixels);
    this.renderer.cameraController.follow = this.settings.follow;
    this.audio.enabled = this.settings.sound;
  }

  private applySetting(key: keyof Settings, value: boolean): void {
    this.settings[key] = value;
    this.saveSettings();
    this.applyAllSettings();
    if (key === 'sound' && value) {
      this.audio.unlock();
      this.audio.click();
    }
  }

  private bindInput(): void {
    this.input.onInteract = () => {
      this.audio.unlock();
      if (this.ui.settingsOpen) return;
      if (this.dialogue.active) {
        this.dialogue.advance();
        return;
      }
      if (this.busy) return;
      const nearest = this.interaction.getNearest();
      if (nearest) this.requestInteract(nearest.id);
    };

    this.input.onEscape = () => {
      if (this.dialogue.active) {
        this.dialogue.advance();
        return;
      }
      this.ui.toggleSettings();
      this.interaction.clearHover();
      if (this.ui.settingsOpen) this.ui.hidePrompt();
    };

    this.input.onPointerMove = (clientX, clientY) => {
      this.audio.unlock();
      if (this.busy || this.ui.settingsOpen) {
        this.interaction.clearHover();
        return;
      }
      const rect = this.input.elementBounds;
      this.interaction.hover(clientX, clientY, rect);
      const el = this.renderer.renderer.domElement;
      el.style.cursor = this.interaction.getHovered() ? 'pointer' : 'default';
    };

    this.input.onPointerLeaveCanvas = () => {
      this.interaction.clearHover();
      this.renderer.renderer.domElement.style.cursor = 'default';
    };

    this.input.onPointerDown = (clientX, clientY, button) => {
      this.audio.unlock();
      this.pointerCount++;
      if (button !== 0) return;
      if (this.busy || this.ui.settingsOpen) return;
      const rect = this.input.elementBounds;
      const picked = this.interaction.click(clientX, clientY, rect);
      if (picked) return;
      // 点击空地板：走到那里
      const point = this.interaction.pickFloor(clientX, clientY, rect);
      if (point) this.moveTo(point.x, point.z);
    };

    this.input.onWheel = (deltaY) => {
      this.renderer.cameraController.zoomBy(deltaY);
    };

    this.interaction.onRequestInteract = (id) => this.requestInteract(id);
  }

  /** 点击地板移动 */
  private moveTo(x: number, z: number): void {
    const cx = THREE.MathUtils.clamp(x, -4.35, 4.35);
    const cz = THREE.MathUtils.clamp(z, -3.35, 3.35);
    if (this.world.isBlocked(cx, cz)) {
      this.audio.deny();
      return;
    }
    this.world.showMoveTarget(cx, cz);
    this.player.walkTo(cx, cz, () => this.world.clearMoveTarget());
  }

  /** 判断距离、必要时先走过去，再触发交互 */
  private requestInteract(id: string): void {
    const item = this.world.interactables.find((i) => i.id === id);
    if (!item) return;
    this.world.clearMoveTarget();
    const dist = this.distanceTo(item);
    const range = item.radius ?? PLAYER.interactRange;
    if (dist <= range) {
      this.performInteract(item);
      return;
    }
    const from = this.player.position;
    const dx = item.point.x - from.x;
    const dz = item.point.z - from.z;
    const len = Math.hypot(dx, dz) || 1;
    const targetX = item.point.x - (dx / len) * 0.85;
    const targetZ = item.point.z - (dz / len) * 0.85;
    this.player.walkTo(targetX, targetZ, () => {
      if (this.distanceTo(item) <= range) {
        this.performInteract(item);
      } else {
        this.ui.toast('再靠近一点试试。');
        this.audio.deny();
      }
    });
  }

  private distanceTo(item: Interactable): number {
    const p = this.player.position;
    return Math.hypot(item.point.x - p.x, item.point.z - p.z);
  }

  private performInteract(item: Interactable): void {
    if (this.busy) return;
    this.player.stop();
    this.world.clearMoveTarget();
    this.player.faceTowards(item.point);
    this.player.playInteract();
    this.audio.interact();

    const scene = storyFor(item.id, this.quest.state);
    if (scene.lines.length === 0) return;
    this.setBusy(true);
    this.dialogue.start(scene.lines, () => {
      this.setBusy(false);
      this.applyEffect(scene.effect);
    });
  }

  private setBusy(value: boolean): void {
    this.busy = value;
    this.player.locked = value;
    this.interaction.enabled = !value;
    if (value) {
      this.ui.hidePrompt();
      this.interaction.clearHover();
      this.renderer.post.setDofStrength(this.settings.dof ? 0.55 : 0);
    } else {
      this.renderer.post.setDofStrength(this.settings.dof ? 1 : 0);
    }
  }

  private applyEffect(effect: StoryEffect): void {
    if (!effect) return;
    switch (effect) {
      case 'readLetter':
        this.quest.markLetter();
        this.ui.toast('任务更新：去调查公告板');
        this.audio.coin();
        break;
      case 'readBoard':
        this.quest.markBoard();
        this.ui.toast('获得线索：登记簿在档案柜第三层');
        this.audio.coin();
        break;
      case 'searchCabinet':
        this.quest.markCabinet();
        this.ui.toast('获得线索：储藏室角落的纸箱');
        this.audio.coin();
        break;
      case 'findTuna':
        this.quest.markTunaFound();
        this.world.revealTuna();
        this.ui.toast('获得道具：金枪鱼罐头');
        this.audio.coin();
        break;
      case 'complete': {
        const first = this.quest.complete();
        if (first) {
          this.audio.success();
          this.player.playHappy(2.6);
          this.world.clientHappy();
          this.spawnCelebration();
          this.ui.toast(`任务完成！获得 ${REWARD_COINS} 枚猫爪币`, 3600);
          window.setTimeout(() => {
            this.ui.toast('新委托预告已解锁：午夜广播里的猫叫……', 4200);
          }, 1200);
        }
        break;
      }
    }
    this.refreshUI();
  }

  private refreshUI(): void {
    this.ui.setCoins(this.quest.state.coins);
    this.ui.setQuest(this.quest.steps, this.quest.progress, this.quest.state.unlockedTeaser);
    this.ui.inventory.setItems(this.quest.state.inventory);
  }

  private spawnCelebration(): void {
    const count = 46;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const p = this.player.position;
    for (let i = 0; i < count; i++) {
      positions[i * 3] = p.x + (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 1] = 0.8 + Math.random() * 0.4;
      positions[i * 3 + 2] = p.z + (Math.random() - 0.5) * 0.5;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.6 + Math.random() * 1.5;
      velocities[i * 3] = Math.cos(angle) * speed * 0.6;
      velocities[i * 3 + 1] = 1.2 + Math.random() * 1.8;
      velocities[i * 3 + 2] = Math.sin(angle) * speed * 0.6;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      map: this.world.getParticleTexture(),
      size: 0.11,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: new THREE.Color('#ffd47a'),
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    this.renderer.scene.add(points);
    this.bursts.push({ points, velocities, life: 0, maxLife: 2.0 });
  }

  private updateBursts(dt: number): void {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i];
      burst.life += dt;
      const pos = burst.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let j = 0; j < arr.length / 3; j++) {
        arr[j * 3] += burst.velocities[j * 3] * dt;
        arr[j * 3 + 1] += burst.velocities[j * 3 + 1] * dt;
        arr[j * 3 + 2] += burst.velocities[j * 3 + 2] * dt;
        burst.velocities[j * 3 + 1] -= 2.2 * dt;
      }
      pos.needsUpdate = true;
      const mat = burst.points.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, 1 - burst.life / burst.maxLife);
      if (burst.life >= burst.maxLife) {
        this.renderer.scene.remove(burst.points);
        burst.points.geometry.dispose();
        mat.dispose();
        this.bursts.splice(i, 1);
      }
    }
  }

  private resetQuest(): void {
    this.quest.reset();
    this.world.hideTuna();
    this.player.stop();
    this.player.cat.setPosition(this.startPosition.x, this.startPosition.z);
    this.player.cat.faceDirection('right');
    this.refreshUI();
    this.ui.toast('任务已重置，事务所重新开始营业。');
    this.audio.deny();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 忽略
    }
  }

  private updateClock(dt: number): void {
    this.gameMinutes = (this.gameMinutes + dt * CLOCK.minutesPerSecond) % (24 * 60);
    this.clockAccum += dt;
    if (this.clockAccum >= 1) {
      this.clockAccum = 0;
      this.ui.setClock(this.gameDate());
    }
  }

  private gameDate(): Date {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setMinutes(Math.floor(this.gameMinutes));
    return d;
  }

  private updatePrompt(): void {
    if (this.busy || this.ui.settingsOpen) {
      this.ui.hidePrompt();
      return;
    }
    const nearest = this.interaction.getNearest();
    if (nearest) this.ui.showPrompt(nearest.label);
    else this.ui.hidePrompt();
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;

    const move = this.busy ? { x: 0, z: 0 } : this.input.getMoveVector();
    if (move.x !== 0 || move.z !== 0) this.world.clearMoveTarget();

    this.player.update(dt, move.x, move.z, this.world.colliders);
    if (!this.player.isAutoWalking) this.world.clearMoveTarget();
    this.interaction.update(dt, this.player.position);
    this.lighting.update(dt, this.elapsed);
    this.world.update(dt, this.elapsed);
    this.renderer.cameraController.update(dt, this.player.position.x, this.player.position.z);
    this.dialogue.update(dt);
    this.updateBursts(dt);
    this.updateClock(dt);
    this.updatePrompt();

    this.renderer.render(dt);
  };

  /** 首帧后关闭载入层并播放开场剧情 */
  start(): void {
    this.ui.setClock(this.gameDate());
    this.ui.setWeather('晴');
    window.setTimeout(() => {
      this.ui.hideLoading();
      const intro = introStory(this.quest.state);
      if (intro.lines.length > 0) {
        window.setTimeout(() => {
          this.setBusy(true);
          this.dialogue.start(intro.lines, () => this.setBusy(false));
        }, 500);
      }
    }, 260);
  }
}
