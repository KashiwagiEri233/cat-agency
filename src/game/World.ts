/**
 * 游戏世界：装配事务所、漂浮尘埃，并持有碰撞体与可交互物件清单。
 */
import * as THREE from 'three';
import { OfficeProps } from '../entities/OfficeProps';
import { CatCharacter } from '../entities/CatCharacter';
import { TextureLibrary } from '../art/PixelTextures';
import type { Collider, Interactable } from './types';
import { ROOM } from './constants';

const DUST_COUNT = 90;
const CLIENT_POS = { x: 0.78, z: 1.35 };

export class World {
  readonly group: THREE.Group;
  readonly colliders: Collider[];
  readonly interactables: Interactable[];
  readonly floor: THREE.Mesh;

  private readonly updates: Array<(dt: number, elapsed: number) => void>;
  private readonly tuna: THREE.Group;
  private readonly textures: TextureLibrary;
  private readonly dust: THREE.Points;
  private readonly dustPositions: Float32Array;
  private readonly dustPhase: Float32Array;
  private readonly dustGeometry: THREE.BufferGeometry;
  private readonly dustMaterial: THREE.PointsMaterial;
  private readonly moveMarker: THREE.Mesh;
  private readonly moveMarkerMat: THREE.MeshBasicMaterial;
  private readonly client: CatCharacter;
  private readonly questMarker: THREE.Mesh;
  private clientHappyTimer = 0;

  constructor(scene: THREE.Scene, textures: TextureLibrary) {
    this.textures = textures;
    const props = new OfficeProps(textures).build();
    this.group = props.group;
    this.colliders = props.colliders;
    this.interactables = props.interactables;
    this.updates = props.updates;
    this.tuna = props.tuna;
    this.floor = props.floor;
    scene.add(this.group);

    // 漂浮尘埃
    this.dustGeometry = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(DUST_COUNT * 3);
    this.dustPhase = new Float32Array(DUST_COUNT);
    for (let i = 0; i < DUST_COUNT; i++) {
      this.dustPositions[i * 3] = (Math.random() - 0.5) * (ROOM.width - 1);
      this.dustPositions[i * 3 + 1] = 0.25 + Math.random() * 2.6;
      this.dustPositions[i * 3 + 2] = (Math.random() - 0.5) * (ROOM.depth - 1);
      this.dustPhase[i] = Math.random() * Math.PI * 2;
    }
    this.dustGeometry.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));
    this.dustMaterial = new THREE.PointsMaterial({
      map: textures.get('dust'),
      size: 0.075,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      color: new THREE.Color('#ffd9a0'),
    });
    this.dust = new THREE.Points(this.dustGeometry, this.dustMaterial);
    this.dust.frustumCulled = false;
    scene.add(this.dust);

    // 鼠标点击的移动目标标记
    this.moveMarkerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffc27a'),
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.moveMarker = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.24, 20), this.moveMarkerMat);
    this.moveMarker.rotation.x = -Math.PI / 2;
    this.moveMarker.position.y = 0.03;
    this.moveMarker.visible = false;
    this.moveMarker.renderOrder = 2;
    scene.add(this.moveMarker);

    // 委托人琪琪：坐在事务所地毯上等待的三花猫
    this.client = new CatCharacter(scene, CLIENT_POS.x, CLIENT_POS.z, 'calico');
    this.client.faceDirection('down');
    this.interactables.push({
      id: 'client',
      label: '委托人 琪琪',
      point: new THREE.Vector3(CLIENT_POS.x, 0, CLIENT_POS.z),
      radius: 1.2,
      object: this.client.group,
      highlightMaterials: [],
      enabled: true,
    });

    // 未完成任务时头顶的「!」提示
    const questMarkerMat = new THREE.MeshBasicMaterial({
      map: textures.get('exclaim'),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      color: new THREE.Color('#ffffff'),
    });
    this.questMarker = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.39), questMarkerMat);
    this.questMarker.position.set(CLIENT_POS.x, 1.62, CLIENT_POS.z);
    this.questMarker.rotation.y = Math.PI / 4;
    scene.add(this.questMarker);

    // 委托人占位，避免玩家从她身上穿过去
    this.colliders.push({
      minX: CLIENT_POS.x - 0.22,
      maxX: CLIENT_POS.x + 0.22,
      minZ: CLIENT_POS.z - 0.18,
      maxZ: CLIENT_POS.z + 0.18,
      tag: 'client',
    });
  }

  showQuestMarker(visible: boolean): void {
    this.questMarker.visible = visible;
  }

  clientHappy(): void {
    this.client.play('happy', true);
    this.clientHappyTimer = 2.4;
    this.questMarker.visible = false;
  }

  showMoveTarget(x: number, z: number): void {
    this.moveMarker.position.set(x, 0.03, z);
    this.moveMarker.visible = true;
  }

  clearMoveTarget(): void {
    this.moveMarker.visible = false;
  }

  /** 目标点是否落在家具/墙体碰撞盒内 */
  isBlocked(x: number, z: number): boolean {
    for (const c of this.colliders) {
      if (x > c.minX - 0.2 && x < c.maxX + 0.2 && z > c.minZ - 0.2 && z < c.maxZ + 0.2) {
        return true;
      }
    }
    return false;
  }

  revealTuna(): void {
    this.tuna.visible = true;
  }

  getParticleTexture(): THREE.Texture {
    return this.dustMaterial.map as THREE.Texture;
  }

  hideTuna(): void {
    this.tuna.visible = false;
  }

  update(dt: number, elapsed: number): void {
    for (const fn of this.updates) fn(dt, elapsed);

    const pos = this.dustPositions;
    for (let i = 0; i < DUST_COUNT; i++) {
      const i3 = i * 3;
      pos[i3 + 1] += dt * 0.035;
      pos[i3] += Math.sin(elapsed * 0.35 + this.dustPhase[i]) * dt * 0.02;
      if (pos[i3 + 1] > 3.0) {
        pos[i3 + 1] = 0.15;
      }
    }
    (this.dustGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.dustMaterial.opacity = 0.55 + Math.sin(elapsed * 0.8) * 0.12;

    if (this.moveMarker.visible) {
      const pulse = 0.55 + Math.sin(elapsed * 6) * 0.3;
      this.moveMarkerMat.opacity = pulse;
      this.moveMarker.scale.setScalar(1 + Math.sin(elapsed * 6) * 0.08);
    }

    // 委托人待机与头顶提示
    this.client.update(dt);
    if (this.clientHappyTimer > 0) {
      this.clientHappyTimer -= dt;
      if (this.clientHappyTimer <= 0) this.client.play('idle');
    }
    if (this.questMarker.visible) {
      this.questMarker.position.y = 1.62 + Math.sin(elapsed * 3.2) * 0.05;
    }
  }

  dispose(): void {
    this.dustGeometry.dispose();
    this.dustMaterial.dispose();
    this.moveMarker.geometry.dispose();
    this.moveMarkerMat.dispose();
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const m = obj.material;
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
        else m.dispose();
      }
    });
    this.textures.dispose();
  }
}
