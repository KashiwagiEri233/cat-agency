/**
 * 交互系统：鼠标悬停高亮、点击拾取、最近可交互物件判定。
 */
import * as THREE from 'three';
import { HIGHLIGHT, PLAYER } from './constants';
import type { Interactable } from './types';

interface OriginalEmissive {
  color: THREE.Color;
  intensity: number;
}

export class InteractionSystem {
  onRequestInteract?: (id: string) => void;
  onHoverChange?: (interactable: Interactable | null) => void;
  enabled = true;

  private readonly camera: THREE.Camera;
  private readonly interactables: Interactable[];
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly originals = new Map<THREE.MeshStandardMaterial, OriginalEmissive>();
  private hovered: Interactable | null = null;
  private highlighted: Interactable | null = null;
  private nearest: Interactable | null = null;
  private floor: THREE.Object3D | null = null;
  private pulse = 0;

  constructor(camera: THREE.Camera, interactables: Interactable[]) {
    this.camera = camera;
    this.interactables = interactables;
  }

  setFloor(floor: THREE.Object3D): void {
    this.floor = floor;
  }

  /** 鼠标点击地面，返回世界坐标（用于点击移动） */
  pickFloor(clientX: number, clientY: number, rect: DOMRect): THREE.Vector3 | null {
    if (!this.floor) return null;
    this.setupPointer(clientX, clientY, rect);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.floor, false);
    if (hits.length === 0) return null;
    return hits[0].point.clone();
  }

  private setupPointer(clientX: number, clientY: number, rect: DOMRect): void {
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  pick(clientX: number, clientY: number, rect: DOMRect): Interactable | null {
    this.setupPointer(clientX, clientY, rect);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const roots = this.interactables.filter((i) => i.enabled).map((i) => i.object);
    const hits = this.raycaster.intersectObjects(roots, true);
    if (hits.length === 0) return null;
    let node: THREE.Object3D | null = hits[0].object;
    while (node) {
      const found = this.interactables.find((i) => i.object === node);
      if (found) return found;
      node = node.parent;
    }
    return null;
  }

  hover(clientX: number, clientY: number, rect: DOMRect): void {
    if (!this.enabled) {
      this.setHovered(null);
      return;
    }
    const picked = this.pick(clientX, clientY, rect);
    this.setHovered(picked && picked.enabled ? picked : null);
  }

  clearHover(): void {
    this.setHovered(null);
  }

  private setHovered(target: Interactable | null): void {
    if (this.hovered === target) return;
    this.hovered = target;
    this.onHoverChange?.(target);
  }

  setHighlight(target: Interactable | null): void {
    if (this.highlighted === target) return;
    // 还原
    if (this.highlighted) {
      for (const mat of this.highlighted.highlightMaterials) {
        const orig = this.originals.get(mat);
        if (orig) {
          mat.emissive.copy(orig.color);
          mat.emissiveIntensity = orig.intensity;
        }
      }
    }
    this.highlighted = target;
    if (target) {
      for (const mat of target.highlightMaterials) {
        if (!this.originals.has(mat)) {
          this.originals.set(mat, {
            color: mat.emissive.clone(),
            intensity: mat.emissiveIntensity,
          });
        }
        mat.emissive.set(HIGHLIGHT.color);
        mat.emissiveIntensity = HIGHLIGHT.intensity;
      }
    }
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    this.pulse += dt;
    // 最近的交互物（按玩家距离）
    let best: Interactable | null = null;
    let bestDist = Infinity;
    for (const item of this.interactables) {
      if (!item.enabled) continue;
      const range = item.radius ?? PLAYER.interactRange;
      const dx = item.point.x - playerPos.x;
      const dz = item.point.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d <= range && d < bestDist) {
        best = item;
        bestDist = d;
      }
    }
    this.nearest = best;

    // 悬停高亮优先于距离高亮
    const target = this.hovered ?? best;
    this.setHighlight(this.enabled ? target : null);

    if (this.highlighted) {
      const k = 0.75 + Math.sin(this.pulse * 4.2) * 0.25;
      for (const mat of this.highlighted.highlightMaterials) {
        const orig = this.originals.get(mat);
        if (orig) mat.emissiveIntensity = orig.intensity + HIGHLIGHT.intensity * k;
      }
    }
  }

  getNearest(): Interactable | null {
    return this.nearest;
  }

  getHovered(): Interactable | null {
    return this.hovered;
  }

  click(clientX: number, clientY: number, rect: DOMRect): Interactable | null {
    if (!this.enabled) return null;
    const picked = this.pick(clientX, clientY, rect);
    if (picked && picked.enabled) {
      this.onRequestInteract?.(picked.id);
    }
    return picked;
  }
}
