/**
 * 事务所道具：地板、墙体、窗户、办公桌、公告板、档案柜、书架、
 * 沙发、纸箱、绿植等。全部使用低多边形 + 程序化像素贴图构建，
 * 每件家具都带有边框、倒角与小型装饰，避免“积木原型”感。
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ROOM } from '../game/constants';
import type { Collider, Interactable } from '../game/types';
import type { TextureLibrary } from '../art/PixelTextures';

interface MatOptions {
  repeat?: [number, number];
  color?: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  alphaTest?: number;
  side?: THREE.Side;
}

export interface BuildContext {
  textures: TextureLibrary;
  root: THREE.Group;
  colliders: Collider[];
  interactables: Interactable[];
  updates: Array<(dt: number, elapsed: number) => void>;
  floor?: THREE.Mesh;
}

export function makeMaterial(T: TextureLibrary, texName: string, opts: MatOptions = {}): THREE.MeshStandardMaterial {
  const texture = opts.repeat ? T.tiled(texName, opts.repeat[0], opts.repeat[1]) : T.get(texName);
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    color: new THREE.Color(opts.color ?? '#ffffff'),
    roughness: opts.roughness ?? 0.88,
    metalness: opts.metalness ?? 0,
    emissive: new THREE.Color(opts.emissive ?? '#000000'),
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    alphaTest: opts.alphaTest ?? 0,
    side: opts.side ?? THREE.FrontSide,
  });
  return mat;
}

export function rbox(w: number, h: number, d: number, radius = 0.025): THREE.BufferGeometry {
  const r = Math.min(radius, Math.min(w, h, d) / 2 - 0.001);
  return new RoundedBoxGeometry(w, h, d, 2, r);
}

interface AddOpts {
  cast?: boolean;
  receive?: boolean;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  name?: string;
}

export function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  opts: AddOpts = {},
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  if (opts.rotX !== undefined) mesh.rotation.x = opts.rotX;
  if (opts.rotY !== undefined) mesh.rotation.y = opts.rotY;
  if (opts.rotZ !== undefined) mesh.rotation.z = opts.rotZ;
  mesh.castShadow = opts.cast ?? true;
  mesh.receiveShadow = opts.receive ?? true;
  if (opts.name) mesh.name = opts.name;
  parent.add(mesh);
  return mesh;
}

function addCollider(ctx: BuildContext, minX: number, maxX: number, minZ: number, maxZ: number, tag: string): void {
  ctx.colliders.push({ minX, maxX, minZ, maxZ, tag });
}

function collectStandardMaterials(object: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const list: THREE.MeshStandardMaterial[] = [];
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const m = child.material;
      if (m instanceof THREE.MeshStandardMaterial) list.push(m);
      else if (Array.isArray(m)) {
        for (const mm of m) if (mm instanceof THREE.MeshStandardMaterial) list.push(mm);
      }
    }
  });
  return list;
}

function registerInteractable(
  ctx: BuildContext,
  id: string,
  label: string,
  group: THREE.Object3D,
  point: THREE.Vector3,
  radius?: number,
): void {
  ctx.interactables.push({
    id,
    label,
    point,
    radius,
    object: group,
    highlightMaterials: collectStandardMaterials(group),
    enabled: true,
  });
}

/* ------------------------------------------------------------------
   地板 / 墙体
   ------------------------------------------------------------------ */

function buildFloor(ctx: BuildContext): void {
  const floorMat = makeMaterial(ctx.textures, 'floor', { repeat: [2.5, 2], roughness: 0.92 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.depth), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.castShadow = false;
  floor.name = 'floor';
  ctx.floor = floor;
  ctx.root.add(floor);

  // 地板边缘压条
  const trimMat = makeMaterial(ctx.textures, 'wood', { color: '#8a5b40', repeat: [6, 1] });
  addMesh(ctx.root, rbox(ROOM.width, 0.06, 0.1, 0.01), trimMat, 0, 0.03, -ROOM.depth / 2 + 0.05);
  addMesh(ctx.root, rbox(0.1, 0.06, ROOM.depth, 0.01), trimMat, -ROOM.width / 2 + 0.05, 0.03, 0);
}

function buildWalls(ctx: BuildContext): void {
  const wallZ = -ROOM.depth / 2;
  const wallX = -ROOM.width / 2;
  const th = ROOM.wallThickness;
  const H = ROOM.wallHeight;

  const wallMat = (w: number, h: number) =>
    makeMaterial(ctx.textures, 'wall', { repeat: [Math.max(1, w / 4), Math.max(1, h / 4)] });

  // --- 北墙（带窗洞）---
  const winL = -4.15;
  const winR = -2.45;
  const winB = 1.05;
  const winT = 2.55;

  const segments: Array<[number, number, number, number]> = [
    [-5, winL, 0, H],
    [winR, 5, 0, H],
    [winL, winR, 0, winB],
    [winL, winR, winT, H],
  ];
  for (const [x0, x1, y0, y1] of segments) {
    const w = x1 - x0;
    const h = y1 - y0;
    addMesh(
      ctx.root,
      new THREE.BoxGeometry(w, h, th),
      wallMat(w, h),
      (x0 + x1) / 2,
      (y0 + y1) / 2,
      wallZ - th / 2,
      { cast: false },
    );
  }

  // --- 西墙（带门洞）---
  const doorZ0 = -0.24;
  const doorZ1 = 0.94;
  const doorH = 2.3;
  const westSegments: Array<[number, number, number, number]> = [
    [wallZ, doorZ0, 0, H],
    [doorZ1, ROOM.depth / 2, 0, H],
    [doorZ0, doorZ1, doorH, H],
  ];
  for (const [z0, z1, y0, y1] of westSegments) {
    const d = z1 - z0;
    const h = y1 - y0;
    addMesh(
      ctx.root,
      new THREE.BoxGeometry(th, h, d),
      wallMat(d, h),
      wallX - th / 2,
      (y0 + y1) / 2,
      (z0 + z1) / 2,
      { cast: false },
    );
  }

  // 护墙板（木质墙裙）
  const wainscotH = 0.92;
  const wainscotMat = makeMaterial(ctx.textures, 'wood', { color: '#c9a17f', repeat: [4, 1] });
  const railMat = makeMaterial(ctx.textures, 'wood', { color: '#8a5b40', repeat: [4, 1] });

  const makeWainscot = (w: number, x: number, z: number, rotY: number) => {
    const g = new THREE.Group();
    addMesh(g, rbox(w, wainscotH, 0.05, 0.01), wainscotMat, 0, wainscotH / 2, 0, { cast: false });
    addMesh(g, rbox(w, 0.07, 0.09, 0.012), railMat, 0, wainscotH, 0, { cast: false });
    addMesh(g, rbox(w, 0.1, 0.07, 0.01), railMat, 0, 0.05, 0, { cast: false });
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    ctx.root.add(g);
  };

  // 北墙墙裙（避开窗与柜子位置也完整铺开，窗下会与窗台重叠）
  makeWainscot(4.0, -2.0, wallZ + 0.035, 0);
  makeWainscot(4.6, 2.4, wallZ + 0.035, 0);
  // 西墙墙裙
  makeWainscot(3.5, wallX + 0.035, -2.0, Math.PI / 2);
  makeWainscot(2.9, wallX + 0.035, 2.5, Math.PI / 2);

  // 顶部压条
  const crownMat = makeMaterial(ctx.textures, 'wood', { color: '#8a5b40', repeat: [4, 1] });
  addMesh(ctx.root, rbox(ROOM.width, 0.1, 0.14, 0.012), crownMat, 0, H - 0.05, wallZ + 0.02, { cast: false });
  addMesh(ctx.root, rbox(0.14, 0.1, ROOM.depth, 0.012), crownMat, wallX + 0.02, H - 0.05, 0, { cast: false });

  // 踢脚线
  const baseMat = makeMaterial(ctx.textures, 'wood', { color: '#6e4632', repeat: [6, 1] });
  addMesh(ctx.root, rbox(ROOM.width, 0.14, 0.06, 0.01), baseMat, 0, 0.07, wallZ + 0.03, { cast: false });
  addMesh(ctx.root, rbox(0.06, 0.14, ROOM.depth, 0.01), baseMat, wallX + 0.03, 0.07, 0, { cast: false });
}

/* ------------------------------------------------------------------
   窗户与窗外
   ------------------------------------------------------------------ */

function buildWindow(ctx: BuildContext): void {
  const group = new THREE.Group();
  const wallZ = -ROOM.depth / 2;
  const cx = -3.3;
  const cy = 1.8;
  const w = 1.7;
  const h = 1.5;

  const frameMat = makeMaterial(ctx.textures, 'wood', { color: '#d8b48f', repeat: [2, 2] });
  const darkMat = makeMaterial(ctx.textures, 'wood', { color: '#8a5b40', repeat: [2, 2] });

  // 外框
  addMesh(group, rbox(w + 0.22, 0.1, 0.22, 0.015), frameMat, cx, cy + h / 2, wallZ + 0.02);
  addMesh(group, rbox(w + 0.22, 0.1, 0.22, 0.015), frameMat, cx, cy - h / 2, wallZ + 0.02);
  addMesh(group, rbox(0.1, h, 0.22, 0.015), frameMat, cx - w / 2, cy, wallZ + 0.02);
  addMesh(group, rbox(0.1, h, 0.22, 0.015), frameMat, cx + w / 2, cy, wallZ + 0.02);
  // 窗棂
  addMesh(group, rbox(0.06, h, 0.1, 0.01), darkMat, cx, cy, wallZ + 0.03);
  addMesh(group, rbox(w, 0.06, 0.1, 0.01), darkMat, cx, cy + 0.16, wallZ + 0.03);
  // 窗台
  addMesh(group, rbox(w + 0.34, 0.08, 0.32, 0.015), frameMat, cx, cy - h / 2 - 0.02, wallZ + 0.12);
  // 窗台上的小盆栽与信
  const potMat = makeMaterial(ctx.textures, 'wood', { color: '#c88361' });
  addMesh(group, new THREE.CylinderGeometry(0.09, 0.07, 0.12, 10), potMat, cx + 0.62, cy - h / 2 + 0.13, wallZ + 0.14);
  const leafMat = makeMaterial(ctx.textures, 'leaf', { alphaTest: 0.5, side: THREE.DoubleSide });
  const leaves = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), leafMat);
  leaves.position.set(cx + 0.62, cy - h / 2 + 0.3, wallZ + 0.14);
  leaves.castShadow = true;
  group.add(leaves);

  // 窗外天空（紧贴窗洞后方，避免露出平面边缘）
  const skyMat = new THREE.MeshBasicMaterial({ map: ctx.textures.get('sky') });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.25), skyMat);
  sky.position.set(cx, 1.78, wallZ - 0.36);
  group.add(sky);

  // 缓慢飘动的云
  const cloudMat = new THREE.MeshBasicMaterial({
    map: ctx.textures.get('cloud'),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const clouds: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const cloud = new THREE.Mesh(new THREE.PlaneGeometry(0.7 + i * 0.2, 0.32 + i * 0.06), cloudMat);
    cloud.position.set(cx - 0.8 + i * 0.6, 2.32 - i * 0.26, wallZ - 0.28 + i * 0.04);
    group.add(cloud);
    clouds.push(cloud);
  }

  // 窗帘
  const curtainMat = makeMaterial(ctx.textures, 'fabricBrick', {
    color: '#e8b79f',
    repeat: [1, 3],
    side: THREE.DoubleSide,
    roughness: 0.95,
  });
  const curtainGeo = new THREE.PlaneGeometry(0.52, 1.9, 3, 1);
  const curtains: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const curtain = new THREE.Mesh(curtainGeo, curtainMat);
    curtain.position.set(cx + side * (w / 2 + 0.22), cy - 0.12, wallZ + 0.16);
    curtain.rotation.y = side * 0.12;
    curtain.castShadow = false;
    group.add(curtain);
    curtains.push(curtain);
  }

  // 阳光光柱
  const beamMat = new THREE.MeshBasicMaterial({
    map: ctx.textures.get('beam'),
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 3.9), beamMat);
  beam.position.set(cx + 0.1, 1.25, -2.45);
  beam.rotation.x = -0.86;
  beam.rotation.z = -0.1;
  group.add(beam);

  ctx.root.add(group);

  registerInteractable(ctx, 'window', '窗户', group, new THREE.Vector3(-3.1, 0, -2.5), 1.6);

  ctx.updates.push((_dt, elapsed) => {
    clouds.forEach((cloud, i) => {
      cloud.position.x += 0.06 * (i + 1) * 0.016;
      if (cloud.position.x > cx + 1.15) cloud.position.x = cx - 1.35;
    });
    curtains.forEach((curtain, i) => {
      curtain.rotation.z = Math.sin(elapsed * 0.7 + i * 1.4) * 0.018;
    });
    beamMat.opacity = 0.42 + Math.sin(elapsed * 0.9) * 0.05;
  });
}

/* ------------------------------------------------------------------
   办公桌
   ------------------------------------------------------------------ */

function buildDesk(ctx: BuildContext): void {
  const group = new THREE.Group();
  const deskX = -1.35;
  const deskZ = -2.28;
  const topY = 0.98;

  const woodMat = makeMaterial(ctx.textures, 'wood', { color: '#b08363', repeat: [2, 1] });
  const woodDark = makeMaterial(ctx.textures, 'wood', { color: '#8a5b40', repeat: [2, 1] });
  const brass = makeMaterial(ctx.textures, 'metal', { color: '#e0b470', metalness: 0.55, roughness: 0.4 });

  // 台面
  addMesh(group, rbox(2.55, 0.09, 1.15, 0.02), woodMat, deskX, topY, deskZ);
  addMesh(group, rbox(2.45, 0.16, 1.02, 0.02), woodDark, deskX, topY - 0.13, deskZ);
  // 桌腿
  const legGeo = rbox(0.1, 0.88, 0.1, 0.015);
  for (const dx of [-1.14, 1.14]) {
    for (const dz of [-0.45, 0.45]) {
      addMesh(group, legGeo, woodDark, deskX + dx, 0.44, deskZ + dz);
    }
  }
  // 右侧抽屉柜
  addMesh(group, rbox(0.56, 0.62, 1.0, 0.02), woodMat, deskX + 0.86, 0.54, deskZ);
  for (let i = 0; i < 2; i++) {
    const dy = 0.72 - i * 0.28;
    addMesh(group, rbox(0.48, 0.22, 0.04, 0.012), woodDark, deskX + 0.86, dy, deskZ + 0.5);
    addMesh(group, rbox(0.16, 0.035, 0.05, 0.008), brass, deskX + 0.86, dy + 0.02, deskZ + 0.53);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.08),
      new THREE.MeshStandardMaterial({ map: ctx.textures.get('paper0'), roughness: 0.9 }),
    );
    label.position.set(deskX + 0.86, dy - 0.05, deskZ + 0.521);
    group.add(label);
  }

  // 显示器
  const monitor = new THREE.Group();
  const caseMat = makeMaterial(ctx.textures, 'metal', { color: '#d9cdb8', roughness: 0.7 });
  const caseDark = makeMaterial(ctx.textures, 'metal', { color: '#5c5866', roughness: 0.75 });
  addMesh(monitor, new THREE.CylinderGeometry(0.2, 0.22, 0.035, 14), caseDark, 0, 0.02, 0);
  addMesh(monitor, rbox(0.14, 0.2, 0.14, 0.02), caseDark, 0, 0.12, -0.03);
  addMesh(monitor, rbox(0.92, 0.66, 0.5, 0.05), caseMat, 0, 0.52, 0, { cast: true });
  // 屏幕凹槽
  addMesh(monitor, new THREE.BoxGeometry(0.76, 0.5, 0.02), caseDark, 0, 0.54, 0.251, { cast: false });
  const screenMat = new THREE.MeshBasicMaterial({ map: ctx.textures.get('screen') });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.46), screenMat);
  screen.position.set(0, 0.54, 0.262);
  monitor.add(screen);
  // 散热格栅
  for (let i = 0; i < 4; i++) {
    addMesh(monitor, new THREE.BoxGeometry(0.5, 0.012, 0.012), caseDark, 0, 0.2 + i * 0.03, 0.252, { cast: false });
  }
  monitor.position.set(deskX - 0.6, topY + 0.045, deskZ - 0.22);
  monitor.rotation.y = 0.14;
  group.add(monitor);

  // 键盘
  const kbMat = new THREE.MeshStandardMaterial({ map: ctx.textures.get('keyboard'), roughness: 0.8 });
  addMesh(group, rbox(0.68, 0.045, 0.24, 0.012), kbMat, deskX - 0.55, topY + 0.07, deskZ + 0.28, { rotY: 0.12 });

  // 纸张
  const paperMat = new THREE.MeshStandardMaterial({
    map: ctx.textures.get('paper0'),
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 3; i++) {
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.44), paperMat);
    paper.rotation.x = -Math.PI / 2;
    paper.rotation.z = 0.25 + i * 0.18;
    paper.position.set(deskX + 0.4 + i * 0.02, topY + 0.052 + i * 0.004, deskZ + 0.2 - i * 0.03);
    paper.receiveShadow = true;
    group.add(paper);
  }

  // 委托信（独立小物件，可点击）
  const letterGroup = new THREE.Group();
  const letterMat = new THREE.MeshStandardMaterial({
    map: ctx.textures.get('letter'),
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  const letter = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), letterMat);
  letter.rotation.x = -Math.PI / 2;
  letter.rotation.z = -0.16;
  letter.position.y = 0.004;
  letter.receiveShadow = true;
  letterGroup.add(letter);
  letterGroup.position.set(deskX + 0.18, topY + 0.056, deskZ + 0.24);
  group.add(letterGroup);

  // 台灯
  const lampGroup = new THREE.Group();
  const lampBaseMat = makeMaterial(ctx.textures, 'metal', { color: '#d6b070', metalness: 0.45, roughness: 0.5 });
  addMesh(lampGroup, new THREE.CylinderGeometry(0.14, 0.17, 0.05, 12), lampBaseMat, 0, 0.025, 0);
  addMesh(lampGroup, new THREE.CylinderGeometry(0.02, 0.02, 0.52, 8), lampBaseMat, 0, 0.28, 0);
  const arm = addMesh(lampGroup, rbox(0.26, 0.035, 0.035, 0.01), lampBaseMat, 0.12, 0.55, 0, { rotZ: -0.34 });
  arm.castShadow = true;
  const shadeMat = new THREE.MeshStandardMaterial({
    map: ctx.textures.get('metal'),
    color: new THREE.Color('#c9855a'),
    roughness: 0.6,
    metalness: 0.25,
    side: THREE.DoubleSide,
    emissive: new THREE.Color('#ffc27a'),
    emissiveIntensity: 0.35,
  });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.21, 0.2, 12, 1, true), shadeMat);
  shade.position.set(0.24, 0.52, 0);
  shade.rotation.z = 0.32;
  shade.castShadow = true;
  lampGroup.add(shade);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 10, 8),
    new THREE.MeshBasicMaterial({ color: '#ffdca8' }),
  );
  bulb.position.set(0.24, 0.46, 0);
  lampGroup.add(bulb);
  lampGroup.position.set(deskX - 1.12, topY + 0.04, deskZ - 0.28);
  group.add(lampGroup);

  // 马克杯（独立交互）
  const mugGroup = new THREE.Group();
  const mugMat = makeMaterial(ctx.textures, 'fabric', { color: '#e9c9a4', repeat: [1, 1], roughness: 0.7 });
  addMesh(mugGroup, new THREE.CylinderGeometry(0.09, 0.08, 0.15, 10), mugMat, 0, 0.075, 0);
  const coffee = new THREE.Mesh(
    new THREE.CircleGeometry(0.075, 10),
    new THREE.MeshStandardMaterial({ color: '#5a3a24', roughness: 0.4 }),
  );
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.152;
  mugGroup.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 10), mugMat);
  handle.rotation.y = Math.PI / 2;
  handle.position.set(0.095, 0.08, 0);
  mugGroup.add(handle);
  mugGroup.position.set(deskX + 0.62, topY + 0.045, deskZ + 0.1);
  group.add(mugGroup);

  // 笔筒
  const cupMat = makeMaterial(ctx.textures, 'wood', { color: '#86a69a' });
  addMesh(group, new THREE.CylinderGeometry(0.075, 0.065, 0.16, 10), cupMat, deskX + 0.9, topY + 0.13, deskZ - 0.3);
  const penMat = makeMaterial(ctx.textures, 'metal', { color: '#c88361' });
  for (let i = 0; i < 3; i++) {
    addMesh(
      group,
      new THREE.CylinderGeometry(0.008, 0.008, 0.24, 6),
      penMat,
      deskX + 0.88 + i * 0.025,
      topY + 0.24,
      deskZ - 0.3 + i * 0.02,
      { rotZ: 0.14 - i * 0.12 },
    );
  }

  // 小盆栽
  const potMat = makeMaterial(ctx.textures, 'wood', { color: '#c88361' });
  addMesh(group, new THREE.CylinderGeometry(0.08, 0.065, 0.11, 10), potMat, deskX + 0.95, topY + 0.1, deskZ + 0.35);
  const deskLeafMat = makeMaterial(ctx.textures, 'leaf', { alphaTest: 0.5, side: THREE.DoubleSide });
  const deskLeaves = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), deskLeafMat);
  deskLeaves.position.set(deskX + 0.95, topY + 0.26, deskZ + 0.35);
  deskLeaves.castShadow = true;
  group.add(deskLeaves);

  ctx.root.add(group);

  registerInteractable(ctx, 'desk', '办公桌', group, new THREE.Vector3(deskX + 0.1, 0, deskZ + 0.95), 1.2);
  registerInteractable(ctx, 'coffee', '咖啡杯', mugGroup, new THREE.Vector3(deskX + 0.62, 0, deskZ + 0.95), 0.9);

  addCollider(ctx, deskX - 1.3, deskX + 1.3, deskZ - 0.62, deskZ + 0.62, 'desk');

  ctx.updates.push((_dt, elapsed) => {
    // 台灯灯罩随灯丝微微呼吸
    shadeMat.emissiveIntensity = 0.3 + Math.sin(elapsed * 5.4) * 0.04;
    deskLeaves.rotation.y = Math.sin(elapsed * 0.6) * 0.05;
  });
}

/* ------------------------------------------------------------------
   公告板
   ------------------------------------------------------------------ */

function buildBulletinBoard(ctx: BuildContext): void {
  const group = new THREE.Group();
  const wallZ = -ROOM.depth / 2;
  const bx = 1.45;
  const by = 2.14;

  const frameMat = makeMaterial(ctx.textures, 'wood', { color: '#8a5b40', repeat: [1, 1] });
  const corkMat = makeMaterial(ctx.textures, 'cork', { repeat: [3, 2], roughness: 0.95 });

  addMesh(group, rbox(1.86, 1.24, 0.09, 0.02), frameMat, bx, by, wallZ + 0.05);
  addMesh(group, new THREE.BoxGeometry(1.62, 1.0, 0.02), corkMat, bx, by, wallZ + 0.1, { cast: false });

  const notes: Array<{ tex: string; x: number; y: number; r: number; w: number; h: number }> = [
    { tex: 'poster0', x: -0.42, y: 0.2, r: 0.06, w: 0.42, h: 0.5 },
    { tex: 'paper0', x: 0.22, y: 0.12, r: -0.05, w: 0.34, h: 0.34 },
    { tex: 'poster1', x: 0.52, y: -0.2, r: 0.08, w: 0.38, h: 0.46 },
    { tex: 'paper1', x: -0.2, y: -0.26, r: -0.04, w: 0.32, h: 0.32 },
  ];
  const pinMat = makeMaterial(ctx.textures, 'metal', { color: '#c8604c', metalness: 0.3 });
  for (const note of notes) {
    const mat = new THREE.MeshStandardMaterial({
      map: ctx.textures.get(note.tex),
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(note.w, note.h), mat);
    paper.position.set(bx + note.x, by + note.y, wallZ + 0.115);
    paper.rotation.z = note.r;
    paper.castShadow = false;
    group.add(paper);
    addMesh(
      group,
      new THREE.BoxGeometry(0.045, 0.045, 0.035),
      pinMat,
      bx + note.x,
      by + note.y + note.h / 2 - 0.03,
      wallZ + 0.13,
      { cast: false },
    );
  }

  ctx.root.add(group);
  registerInteractable(ctx, 'board', '公告板', group, new THREE.Vector3(bx, 0, wallZ + 1.0), 1.35);
}

/* ------------------------------------------------------------------
   档案柜
   ------------------------------------------------------------------ */

function buildCabinet(ctx: BuildContext): void {
  const group = new THREE.Group();
  const cx = 3.32;
  const cz = -3.4;

  const bodyMat = makeMaterial(ctx.textures, 'metal', { color: '#c3c8c2', roughness: 0.62 });
  const drawerMat = makeMaterial(ctx.textures, 'metal', { color: '#dde0d8', roughness: 0.58 });
  const brass = makeMaterial(ctx.textures, 'metal', { color: '#e0b470', metalness: 0.5, roughness: 0.42 });

  addMesh(group, rbox(1.0, 1.5, 0.62, 0.03), bodyMat, cx, 0.75, cz);
  for (let i = 0; i < 3; i++) {
    const y = 1.2 - i * 0.42;
    addMesh(group, rbox(0.88, 0.36, 0.05, 0.015), drawerMat, cx, y, cz + 0.31);
    addMesh(group, rbox(0.22, 0.05, 0.05, 0.012), brass, cx, y + 0.06, cz + 0.34);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.09),
      new THREE.MeshStandardMaterial({ map: ctx.textures.get('paper1'), roughness: 0.92 }),
    );
    label.position.set(cx, y - 0.06, cz + 0.338);
    group.add(label);
  }
  // 顶部文件与绿植
  const folderMat = makeMaterial(ctx.textures, 'wood', { color: '#d9b678' });
  for (let i = 0; i < 3; i++) {
    addMesh(
      group,
      rbox(0.5, 0.05, 0.36, 0.01),
      folderMat,
      cx - 0.2,
      1.53 + i * 0.05,
      cz,
      { rotY: 0.12 + i * 0.05 },
    );
  }
  const potMat = makeMaterial(ctx.textures, 'wood', { color: '#c88361' });
  addMesh(group, new THREE.CylinderGeometry(0.11, 0.09, 0.16, 10), potMat, cx + 0.3, 1.6, cz + 0.05);
  const leafMat = makeMaterial(ctx.textures, 'leaf', { alphaTest: 0.5, side: THREE.DoubleSide });
  const leaves = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), leafMat);
  leaves.position.set(cx + 0.3, 1.83, cz + 0.05);
  leaves.castShadow = true;
  group.add(leaves);

  ctx.root.add(group);
  registerInteractable(ctx, 'cabinet', '档案柜', group, new THREE.Vector3(cx, 0, cz + 0.85), 0.95);
  addCollider(ctx, cx - 0.5, cx + 0.5, cz - 0.31, cz + 0.31, 'cabinet');

  ctx.updates.push((_dt, elapsed) => {
    leaves.rotation.y = Math.sin(elapsed * 0.5) * 0.06;
  });
}

/* ------------------------------------------------------------------
   书架
   ------------------------------------------------------------------ */

function buildBookshelf(ctx: BuildContext): void {
  const group = new THREE.Group();
  const shelfW = 1.9;
  const shelfH = 2.05;
  const shelfD = 0.4;
  const woodMat = makeMaterial(ctx.textures, 'wood', { color: '#a87355', repeat: [2, 2] });
  const backMat = makeMaterial(ctx.textures, 'wood', { color: '#8a5b40', repeat: [2, 1] });

  // 局部坐标：宽沿 X，正面朝 +Z
  addMesh(group, rbox(shelfW, 0.08, shelfD, 0.015), woodMat, 0, shelfH - 0.04, 0);
  addMesh(group, rbox(shelfW, 0.08, shelfD, 0.015), woodMat, 0, 0.04, 0);
  addMesh(group, rbox(0.08, shelfH, shelfD, 0.015), woodMat, -shelfW / 2 + 0.04, shelfH / 2, 0);
  addMesh(group, rbox(0.08, shelfH, shelfD, 0.015), woodMat, shelfW / 2 - 0.04, shelfH / 2, 0);
  addMesh(group, new THREE.BoxGeometry(shelfW - 0.1, shelfH - 0.1, 0.03), backMat, 0, shelfH / 2, -shelfD / 2 + 0.02);

  const bookColors = ['bookRed', 'bookBlue', 'bookGreen', 'bookMustard', 'bookPurple', 'bookCream'];
  const bookGeo = new THREE.BoxGeometry(0.1, 1, 0.24);
  const rnd = (n: number) => {
    const x = Math.sin(n * 127.1) * 43758.5453;
    return x - Math.floor(x);
  };
  let seed = 3;
  for (let shelf = 0; shelf < 4; shelf++) {
    const y = 0.16 + shelf * 0.47;
    addMesh(group, rbox(shelfW - 0.12, 0.05, shelfD - 0.06, 0.01), woodMat, 0, y - 0.03, 0, { cast: false });
    let x = -shelfW / 2 + 0.14;
    while (x < shelfW / 2 - 0.2) {
      seed++;
      const idx = Math.floor(rnd(seed) * bookColors.length);
      const h = 0.24 + rnd(seed + 7) * 0.16;
      const mat = new THREE.MeshStandardMaterial({
        map: ctx.textures.get(bookColors[idx]),
        roughness: 0.9,
      });
      const book = new THREE.Mesh(bookGeo, mat);
      book.scale.y = h;
      book.position.set(x, y + h / 2, 0.02);
      if (rnd(seed + 3) > 0.86) book.rotation.z = 0.22;
      book.castShadow = true;
      book.receiveShadow = true;
      group.add(book);
      x += 0.11 + rnd(seed + 11) * 0.02;
    }
  }

  group.position.set(-ROOM.width / 2 + 0.22, 0, -2.2);
  group.rotation.y = Math.PI / 2;
  ctx.root.add(group);
  addCollider(ctx, -ROOM.width / 2, -ROOM.width / 2 + 0.46, -3.15, -1.25, 'bookshelf');
}

/* ------------------------------------------------------------------
   沙发 / 地毯 / 茶几
   ------------------------------------------------------------------ */

function buildSofa(ctx: BuildContext): void {
  const group = new THREE.Group();
  const sx = 2.55;
  const sz = 2.45;

  const bodyMat = makeMaterial(ctx.textures, 'fabric', { color: '#9db9ac', repeat: [2, 1] });
  const cushionMat = makeMaterial(ctx.textures, 'fabric', { color: '#e8c39e', repeat: [1, 1] });
  const legMat = makeMaterial(ctx.textures, 'wood', { color: '#6e4632' });

  addMesh(group, rbox(2.0, 0.36, 0.85, 0.06), bodyMat, sx, 0.32, sz);
  addMesh(group, rbox(2.0, 0.68, 0.22, 0.06), bodyMat, sx, 0.7, sz - 0.34);
  addMesh(group, rbox(0.2, 0.52, 0.85, 0.05), bodyMat, sx - 0.92, 0.58, sz);
  addMesh(group, rbox(0.2, 0.52, 0.85, 0.05), bodyMat, sx + 0.92, 0.58, sz);
  // 坐垫
  addMesh(group, rbox(0.82, 0.17, 0.66, 0.05), cushionMat, sx - 0.44, 0.55, sz + 0.02);
  addMesh(group, rbox(0.82, 0.17, 0.66, 0.05), cushionMat, sx + 0.44, 0.55, sz + 0.02);
  // 靠垫
  const pillowMat = makeMaterial(ctx.textures, 'fabricBrick', { color: '#e8a58a', repeat: [1, 1] });
  addMesh(group, rbox(0.36, 0.36, 0.12, 0.05), pillowMat, sx - 0.62, 0.78, sz - 0.2, { rotZ: 0.18, rotY: 0.1 });
  addMesh(group, rbox(0.32, 0.32, 0.12, 0.05), pillowMat, sx + 0.2, 0.76, sz - 0.22, { rotZ: -0.24, rotY: -0.1 });
  // 沙发脚
  for (const dx of [-0.85, 0.85]) {
    for (const dz of [-0.32, 0.32]) {
      addMesh(group, new THREE.CylinderGeometry(0.035, 0.03, 0.14, 8), legMat, sx + dx, 0.07, sz + dz);
    }
  }
  // 搭毯
  const throwMat = makeMaterial(ctx.textures, 'fabric', { color: '#c88361', repeat: [1, 1] });
  addMesh(group, rbox(0.5, 0.05, 0.5, 0.02), throwMat, sx + 0.62, 0.66, sz + 0.18, { rotY: 0.3 });

  ctx.root.add(group);
  addCollider(ctx, sx - 1.03, sx + 1.03, sz - 0.45, sz + 0.45, 'sofa');

  ctx.updates.push(() => {
    // 静态家具无需更新
  });
}

function buildRug(ctx: BuildContext): void {
  const rugMat = new THREE.MeshStandardMaterial({
    map: ctx.textures.get('rug'),
    roughness: 1,
  });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.3), rugMat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.1, 0.012, 0.55);
  rug.receiveShadow = true;
  ctx.root.add(rug);
}

function buildCoffeeTable(ctx: BuildContext): void {
  const group = new THREE.Group();
  const tx = 0.15;
  const tz = 0.55;
  const woodMat = makeMaterial(ctx.textures, 'wood', { color: '#b08363', repeat: [1, 1] });
  const topY = 0.44;
  addMesh(group, new THREE.CylinderGeometry(0.56, 0.56, 0.07, 18), woodMat, tx, topY, tz);
  addMesh(group, new THREE.CylinderGeometry(0.08, 0.1, 0.36, 10), woodMat, tx, topY - 0.2, tz);
  addMesh(group, new THREE.CylinderGeometry(0.3, 0.3, 0.04, 14), woodMat, tx, 0.03, tz);

  // 桌上的书与杯
  const bookMat = new THREE.MeshStandardMaterial({ map: ctx.textures.get('bookBlue'), roughness: 0.9 });
  addMesh(group, rbox(0.3, 0.05, 0.22, 0.008), bookMat, tx - 0.16, topY + 0.06, tz + 0.05, { rotY: -0.2 });
  const cupMat = makeMaterial(ctx.textures, 'fabric', { color: '#e9c9a4' });
  addMesh(group, new THREE.CylinderGeometry(0.06, 0.05, 0.1, 10), cupMat, tx + 0.22, topY + 0.08, tz - 0.1);

  ctx.root.add(group);
  addCollider(ctx, tx - 0.5, tx + 0.5, tz - 0.5, tz + 0.5, 'table');
}

/* ------------------------------------------------------------------
   绿植 / 纸箱 / 门 / 吊灯 / 墙饰
   ------------------------------------------------------------------ */

function buildPlant(ctx: BuildContext, px: number, pz: number, scale = 1): void {
  const group = new THREE.Group();
  const potMat = makeMaterial(ctx.textures, 'wood', { color: '#c88361', repeat: [1, 1] });
  addMesh(group, new THREE.CylinderGeometry(0.26, 0.2, 0.4, 12), potMat, px, 0.2, pz);
  addMesh(group, new THREE.CylinderGeometry(0.24, 0.24, 0.04, 12), makeMaterial(ctx.textures, 'wood', { color: '#6e4632' }), px, 0.41, pz);
  const leafMat = makeMaterial(ctx.textures, 'leaf', { alphaTest: 0.5, side: THREE.DoubleSide });
  const leaves: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), leafMat);
    leaf.position.set(px, 0.95, pz);
    leaf.rotation.y = (i / 4) * Math.PI;
    leaf.rotation.x = 0.14 * (i % 2 === 0 ? 1 : -1);
    leaf.scale.setScalar(scale);
    leaf.castShadow = true;
    group.add(leaf);
    leaves.push(leaf);
  }
  ctx.root.add(group);
  addCollider(ctx, px - 0.3, px + 0.3, pz - 0.3, pz + 0.3, 'plant');
  ctx.updates.push((_dt, elapsed) => {
    leaves.forEach((leaf, i) => {
      leaf.rotation.z = Math.sin(elapsed * 0.55 + i * 1.3) * 0.03;
    });
  });
}

function buildCardboardBox(ctx: BuildContext): THREE.Group {
  const group = new THREE.Group();
  const bx = 4.2;
  const bz = -2.35;
  const boxMat = makeMaterial(ctx.textures, 'cardboard', { repeat: [1, 1], roughness: 1 });
  const innerMat = makeMaterial(ctx.textures, 'cardboard', { color: '#a9865f', repeat: [1, 1] });

  addMesh(group, rbox(0.72, 0.66, 0.72, 0.02), boxMat, bx, 0.33, bz);
  // 打开的纸箱盖
  const flapGeo = new THREE.BoxGeometry(0.7, 0.02, 0.34);
  addMesh(group, flapGeo, innerMat, bx - 0.33, 0.72, bz, { rotZ: 0.5, rotY: 1.57 });
  addMesh(group, flapGeo, innerMat, bx + 0.33, 0.72, bz, { rotZ: -0.5, rotY: 1.57 });
  addMesh(group, flapGeo, innerMat, bx, 0.68, bz + 0.33, { rotX: -0.55 });
  // 里面的报纸
  const paperMat = new THREE.MeshStandardMaterial({ map: ctx.textures.get('paper0'), roughness: 1 });
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), paperMat);
  paper.rotation.x = -Math.PI / 2;
  paper.position.set(bx, 0.62, bz);
  group.add(paper);

  // 标签
  const tagMat = new THREE.MeshStandardMaterial({ map: ctx.textures.get('paper1'), roughness: 0.95 });
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.16), tagMat);
  tag.position.set(bx, 0.34, bz + 0.365);
  group.add(tag);

  ctx.root.add(group);
  addCollider(ctx, bx - 0.36, bx + 0.36, bz - 0.36, bz + 0.36, 'box');
  registerInteractable(ctx, 'box', '可疑纸箱', group, new THREE.Vector3(bx, 0, bz + 0.85), 0.9);
  return group;
}

function buildTuna(ctx: BuildContext): THREE.Group {
  const group = new THREE.Group();
  const canMat = makeMaterial(ctx.textures, 'metal', { color: '#cfd3d8', metalness: 0.4, roughness: 0.45 });
  const labelMat = new THREE.MeshStandardMaterial({
    map: ctx.textures.get('tuna'),
    roughness: 0.8,
    emissive: new THREE.Color('#ffc27a'),
    emissiveIntensity: 0.18,
  });
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.19, 14), canMat);
  can.castShadow = true;
  group.add(can);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.132, 0.12, 14, 1, true), labelMat);
  group.add(label);
  const lid = new THREE.Mesh(new THREE.CircleGeometry(0.125, 14), canMat);
  lid.rotation.x = -Math.PI / 2;
  lid.position.y = 0.096;
  group.add(lid);

  group.position.set(4.2, 0.9, -2.35);
  group.visible = false;
  ctx.root.add(group);

  // 找到时的小光环
  const ringMat = new THREE.MeshBasicMaterial({
    color: '#ffc27a',
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.24, 18), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(4.2, 0.05, -2.35);
  ring.visible = false;
  ctx.root.add(ring);

  ctx.updates.push((_dt, elapsed) => {
    if (!group.visible) return;
    group.rotation.y = elapsed * 0.9;
    group.position.y = 0.95 + Math.sin(elapsed * 2.2) * 0.07;
    ring.visible = true;
    ringMat.opacity = 0.4 + Math.sin(elapsed * 3) * 0.15;
  });

  return group;
}

function buildDoor(ctx: BuildContext): void {
  const group = new THREE.Group();
  const wallX = -ROOM.width / 2;
  const dz = 0.35;
  const doorMat = new THREE.MeshStandardMaterial({ map: ctx.textures.get('door'), roughness: 0.9 });
  const frameMat = makeMaterial(ctx.textures, 'wood', { color: '#d8b48f', repeat: [1, 2] });

  // 门框
  addMesh(group, rbox(0.1, 2.42, 0.14, 0.012), frameMat, wallX + 0.03, 1.21, dz - 0.62);
  addMesh(group, rbox(0.1, 2.42, 0.14, 0.012), frameMat, wallX + 0.03, 1.21, dz + 0.62);
  addMesh(group, rbox(0.1, 0.12, 1.32, 0.012), frameMat, wallX + 0.03, 2.38, dz);
  // 门板
  addMesh(group, new THREE.BoxGeometry(0.07, 2.22, 1.1), doorMat, wallX + 0.05, 1.12, dz, { cast: false });
  // 门把手
  const brass = makeMaterial(ctx.textures, 'metal', { color: '#e0b470', metalness: 0.5, roughness: 0.4 });
  addMesh(group, new THREE.SphereGeometry(0.05, 8, 6), brass, wallX + 0.13, 1.06, dz + 0.38);
  // 地垫
  const matMat = new THREE.MeshStandardMaterial({ map: ctx.textures.get('rug'), roughness: 1 });
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.6), matMat);
  mat.rotation.x = -Math.PI / 2;
  mat.position.set(wallX + 0.6, 0.015, dz);
  mat.receiveShadow = true;
  group.add(mat);
  // 门铃
  const bellMat = makeMaterial(ctx.textures, 'metal', { color: '#e0b470', metalness: 0.55, roughness: 0.35 });
  addMesh(group, new THREE.ConeGeometry(0.07, 0.1, 8), bellMat, wallX + 0.14, 2.18, dz + 0.42);

  ctx.root.add(group);
  registerInteractable(ctx, 'door', '事务所入口', group, new THREE.Vector3(wallX + 0.9, 0, dz), 1.3);
}

/* ------------------------------------------------------------------
   小型生活道具：猫窝 / 纸箱堆 / 废纸篓
   ------------------------------------------------------------------ */

function buildCatBed(ctx: BuildContext): void {
  const group = new THREE.Group();
  const bx = -2.35;
  const bz = 3.05;
  const rimMat = makeMaterial(ctx.textures, 'fabric', { color: '#b98f7a', repeat: [1, 1], roughness: 0.95 });
  const cushionMat = makeMaterial(ctx.textures, 'fabric', { color: '#f0dcc0', repeat: [1, 1], roughness: 1 });
  addMesh(group, new THREE.CylinderGeometry(0.46, 0.42, 0.14, 16), rimMat, bx, 0.08, bz);
  addMesh(group, new THREE.CylinderGeometry(0.38, 0.38, 0.1, 16), cushionMat, bx, 0.17, bz);
  // 搭在边上的小毯子
  const blanketMat = makeMaterial(ctx.textures, 'fabricBrick', { color: '#d98f72', repeat: [1, 1] });
  addMesh(group, rbox(0.42, 0.05, 0.34, 0.02), blanketMat, bx + 0.18, 0.23, bz - 0.12, { rotY: 0.4 });
  ctx.root.add(group);
  addCollider(ctx, bx - 0.44, bx + 0.44, bz - 0.44, bz + 0.44, 'catbed');
}

function buildBoxStack(ctx: BuildContext): void {
  const group = new THREE.Group();
  const bx = 3.85;
  const bz = 3.05;
  const boxMat = makeMaterial(ctx.textures, 'cardboard', { repeat: [1, 1], roughness: 1 });
  addMesh(group, rbox(0.62, 0.5, 0.55, 0.02), boxMat, bx, 0.25, bz, { rotY: 0.12 });
  addMesh(group, rbox(0.46, 0.4, 0.42, 0.02), boxMat, bx - 0.06, 0.72, bz + 0.02, { rotY: -0.22 });
  // 上面压着一叠文件
  const paperMat = new THREE.MeshStandardMaterial({ map: ctx.textures.get('paper0'), roughness: 1 });
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.4), paperMat);
  paper.rotation.x = -Math.PI / 2;
  paper.rotation.z = 0.2;
  paper.position.set(bx - 0.06, 0.93, bz + 0.02);
  group.add(paper);
  ctx.root.add(group);
  addCollider(ctx, bx - 0.35, bx + 0.35, bz - 0.32, bz + 0.32, 'boxstack');
}

function buildBin(ctx: BuildContext): void {
  const group = new THREE.Group();
  const bx = 0.42;
  const bz = -1.72;
  const binMat = makeMaterial(ctx.textures, 'metal', { color: '#8f8a95', metalness: 0.2, roughness: 0.6 });
  addMesh(group, new THREE.CylinderGeometry(0.17, 0.14, 0.32, 12, 1, true), binMat, bx, 0.16, bz, { cast: true });
  const paperMat = new THREE.MeshStandardMaterial({ map: ctx.textures.get('paper1'), roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.18), paperMat);
    paper.position.set(bx + (i - 1) * 0.05, 0.33 + i * 0.02, bz + (i % 2) * 0.05);
    paper.rotation.set(-1.2 + i * 0.2, i * 0.7, 0.2);
    group.add(paper);
  }
  ctx.root.add(group);
  addCollider(ctx, bx - 0.18, bx + 0.18, bz - 0.18, bz + 0.18, 'bin');
}

function buildPendant(ctx: BuildContext): void {  const group = new THREE.Group();
  const cordMat = makeMaterial(ctx.textures, 'metal', { color: '#3a3247' });
  addMesh(group, new THREE.CylinderGeometry(0.012, 0.012, 0.55, 6), cordMat, 0.4, 2.95, 0.2);
  const shadeMat = new THREE.MeshStandardMaterial({
    map: ctx.textures.get('metal'),
    color: new THREE.Color('#86a69a'),
    roughness: 0.7,
    metalness: 0.2,
    side: THREE.DoubleSide,
    emissive: new THREE.Color('#ffc27a'),
    emissiveIntensity: 0.22,
  });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 0.26, 14, 1, true), shadeMat);
  shade.position.set(0.4, 2.6, 0.2);
  shade.castShadow = true;
  group.add(shade);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    new THREE.MeshBasicMaterial({ color: '#ffe0b0' }),
  );
  bulb.position.set(0.4, 2.52, 0.2);
  group.add(bulb);

  ctx.root.add(group);
  ctx.updates.push((_dt, elapsed) => {
    group.rotation.z = Math.sin(elapsed * 0.6) * 0.012;
  });
}

function buildWallDecor(ctx: BuildContext): void {
  const wallZ = -ROOM.depth / 2;
  const wallX = -ROOM.width / 2;

  // 挂钟
  const clockGroup = new THREE.Group();
  const frameMat = makeMaterial(ctx.textures, 'wood', { color: '#8a5b40' });
  addMesh(clockGroup, new THREE.CylinderGeometry(0.34, 0.34, 0.08, 16), frameMat, 0, 0, 0, { rotX: Math.PI / 2 });
  const faceMat = new THREE.MeshStandardMaterial({ map: ctx.textures.get('clock'), roughness: 0.85 });
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.29, 16), faceMat);
  face.position.z = 0.045;
  clockGroup.add(face);
  clockGroup.position.set(4.35, 2.62, wallZ + 0.06);
  ctx.root.add(clockGroup);

  // 西墙海报（门与书架之间）
  const posterMat = new THREE.MeshStandardMaterial({
    map: ctx.textures.get('poster1'),
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  const westPoster = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.7), posterMat);
  westPoster.position.set(wallX + 0.06, 1.95, -0.85);
  westPoster.rotation.y = Math.PI / 2;
  westPoster.rotation.z = 0.03;
  ctx.root.add(westPoster);

  // 北墙海报（办公桌上方）
  const posterMat2 = new THREE.MeshStandardMaterial({
    map: ctx.textures.get('poster0'),
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  const northPoster = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.7), posterMat2);
  northPoster.position.set(-1.25, 2.55, wallZ + 0.06);
  northPoster.rotation.z = -0.04;
  ctx.root.add(northPoster);

  // 事务所铜牌
  const signMat = new THREE.MeshStandardMaterial({
    map: ctx.textures.get('sign'),
    roughness: 0.55,
    metalness: 0.15,
    emissive: new THREE.Color('#ffc27a'),
    emissiveIntensity: 0.06,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.36), signMat);
  sign.position.set(wallX + 0.06, 2.62, 0.35);
  sign.rotation.y = Math.PI / 2;
  ctx.root.add(sign);
}

/* ------------------------------------------------------------------
   总装
   ------------------------------------------------------------------ */

export class OfficeProps {
  private readonly textures: TextureLibrary;

  constructor(textures: TextureLibrary) {
    this.textures = textures;
  }

  build(): {
    group: THREE.Group;
    colliders: Collider[];
    interactables: Interactable[];
    updates: Array<(dt: number, elapsed: number) => void>;
    tuna: THREE.Group;
    floor: THREE.Mesh;
  } {
    const ctx: BuildContext = {
      textures: this.textures,
      root: new THREE.Group(),
      colliders: [],
      interactables: [],
      updates: [],
    };

    buildFloor(ctx);
    buildWalls(ctx);
    buildWindow(ctx);
    buildDesk(ctx);
    buildBulletinBoard(ctx);
    buildCabinet(ctx);
    buildBookshelf(ctx);
    buildSofa(ctx);
    buildRug(ctx);
    buildCoffeeTable(ctx);
    buildPlant(ctx, -4.15, 3.1, 1.05);
    buildPlant(ctx, -3.65, 3.35, 0.7);
    buildCardboardBox(ctx);
    const tuna = buildTuna(ctx);
    buildDoor(ctx);
    buildPendant(ctx);
    buildWallDecor(ctx);
    buildCatBed(ctx);
    buildBoxStack(ctx);
    buildBin(ctx);

    return {
      group: ctx.root,
      colliders: ctx.colliders,
      interactables: ctx.interactables,
      updates: ctx.updates,
      tuna,
      floor: ctx.floor as THREE.Mesh,
    };
  }
}
