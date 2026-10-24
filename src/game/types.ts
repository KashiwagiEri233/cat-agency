import type * as THREE from 'three';

/** 轴对齐的平面碰撞盒（XZ 平面） */
export interface Collider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** 可选标记，便于调试 */
  tag?: string;
}

/** 可交互物件 */
export interface Interactable {
  id: string;
  /** 交互提示中显示的名称 */
  label: string;
  /** 交互判定点（世界坐标） */
  point: THREE.Vector3;
  /** 额外判定半径（默认取 PLAYER.interactRange） */
  radius?: number;
  /** 用于鼠标拾取的根对象 */
  object: THREE.Object3D;
  /** 悬停时需要染色的材质 */
  highlightMaterials: THREE.MeshStandardMaterial[];
  /** 是否可交互（隐藏物品等） */
  enabled: boolean;
}

/** 世界构建结果 */
export interface WorldBuild {
  group: THREE.Group;
  colliders: Collider[];
  interactables: Interactable[];
  /** 每帧动画（云、灯、灰尘等） */
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

/** 任务步骤标识 */
export type QuestStepId = 'letter' | 'board' | 'cabinet' | 'box' | 'submit';

export interface QuestStep {
  id: QuestStepId;
  label: string;
  done: boolean;
  active: boolean;
}

export interface SaveData {
  coins: number;
  readLetter: boolean;
  readBoard: boolean;
  searchedCabinet: boolean;
  searchedBox: boolean;
  foundTuna: boolean;
  completed: boolean;
  unlockedTeaser: boolean;
  inventory: string[];
}

export interface Settings {
  bloom: boolean;
  dof: boolean;
  follow: boolean;
  sound: boolean;
  crispPixels: boolean;
}

export type CatAnim = 'idle' | 'walk' | 'interact' | 'happy' | 'sleep' | 'blink';

export type CatDir = 'down' | 'left' | 'right' | 'up';

export interface DialogueLine {
  speaker: string;
  /** 头像 key，缺省为阿橘 */
  portrait?: 'cat' | 'client' | 'narrator' | 'board';
  text: string;
}
