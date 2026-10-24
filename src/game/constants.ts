/**
 * 全局常量：色板、世界尺度、玩家与镜头参数。
 * 所有魔法数字集中在此，方便统一调整美术与手感。
 */

/** 限定色板：低饱和、暖光冷影 */
export const PALETTE = {
  cream: '#F4D9B2',
  creamLight: '#FBEFD8',
  creamShade: '#E1BE92',
  wood: '#A87355',
  woodDark: '#6E4632',
  woodLight: '#C79A74',
  brick: '#C88361',
  brickDark: '#8E5238',
  sage: '#86A69A',
  sageDark: '#54786C',
  purple: '#514D64',
  purpleDeep: '#2C2838',
  ink: '#241D2E',
  inkSoft: '#3A3247',
  gold: '#FFC27A',
  goldDeep: '#D98B44',
  white: '#FFF6E8',
} as const;

/** 世界贴图每单位像素数 */
export const PPU = 16;

/** 房间尺寸（世界单位） */
export const ROOM = {
  width: 10,
  depth: 8,
  wallHeight: 3.2,
  wallThickness: 0.18,
} as const;

/** 玩家参数 */
export const PLAYER = {
  radius: 0.24,
  walkSpeed: 2.35,
  runSpeed: 3.9,
  interactRange: 1.95,
  arriveEpsilon: 0.12,
  spriteSize: 1.35,
  idleSleepSeconds: 42,
} as const;

/** 摄像机（正交等距） */
export const CAMERA = {
  pitchDeg: 35.264,
  yawDeg: 45,
  distance: 26,
  baseViewHeight: 13.2,
  minViewHeight: 6.2,
  maxViewHeight: 15.5,
  followLambda: 3.2,
  snapTexels: 4,
} as const;

/** 内部渲染分辨率（像素化程度） */
export const RENDER = {
  basePixelHeight: 320,
  maxPixelWidth: 760,
  minPixelWidth: 320,
} as const;

/** 交互高亮 */
export const HIGHLIGHT = {
  color: '#FFC27A',
  intensity: 0.55,
} as const;

/** 存档 */
export const STORAGE_KEY = 'cat-agency.save.v1';
export const SETTINGS_KEY = 'cat-agency.settings.v1';

/** 游戏内时间 */
export const CLOCK = {
  startMinutes: 16 * 60 + 40,
  minutesPerSecond: 0.35,
} as const;

export const COLORS = {
  sun: '#FFD8A6',
  fillSky: '#FFE7C6',
  fillGround: '#4A3B52',
  lamp: '#FFC27A',
  moonlight: '#9FB4E8',
} as const;
