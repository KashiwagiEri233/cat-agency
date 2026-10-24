# 猫咪事务所 · Cat Agency

> 一个可游玩的 Web 2.5D 像素风探索解谜 Demo。橘猫所长「阿橘」在暖光笼罩的小事务所里，替委托人找回失踪的金枪鱼罐头。

[![在线试玩](https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E8%AF%95%E7%8E%A9-GitHub%20Pages-FFC27A)](https://kashiwagieri233.github.io/cat-agency/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-86A69A.svg)](./LICENSE)
[![Three.js](https://img.shields.io/badge/Three.js-r180-514D64)](https://threejs.org/)

**在线试玩：<https://kashiwagieri233.github.io/cat-agency/>**

---

## 这是什么

一个用 **Vite + TypeScript + Three.js** 从零构建的微缩等距像素场景：2D 像素角色站在有真实灯光、阴影与景深的 3D 办公室里。所有贴图、精灵、图标与音效都在运行时程序化生成，不依赖任何外部美术资源。

- 正交等距摄像机，固定视角 + 平滑跟随，焦点吸附像素网格以抑制抖动
- 固定低分辨率内部缓冲 + 最近邻放大，保证锐利像素颗粒
- 暖色 Bloom / 移轴景深 / 色阶量化 / 暗角与颗粒，均可开关
- 程序化像素猫咪：四方向精灵，待机呼吸、行走、调查、开心、睡觉与眨眼
- 真实任务状态机与线索依赖，而非「点一下即通关」
- 全部 UI 为复古像素 HUD，非现代 Dashboard 风格

## 玩法

走进事务所，桌上压着一封带着鱼腥味的委托信。

| 步骤 | 线索 |
| --- | --- |
| 1 | 阅读办公桌上的委托信 |
| 2 | 调查墙上的公告板 |
| 3 | 翻查档案柜第三层的登记簿 |
| 4 | 检查储物角的可疑纸箱 |
| 5 | 回到办公桌提交委托 |

完成后：阿橘播放开心动画、像素粒子迸发、获得 **100 枚猫爪币**，任务日志更新并解锁下一条委托预告。进度自动保存到 `localStorage`，可在设置面板一键重置。

## 操作

| 操作 | 说明 |
| --- | --- |
| 点击地面 | 阿橘自动走到该位置（目标点会显示像素光环） |
| `WASD` / 方向键 | 直接移动 |
| 鼠标左键点击物件 | 自动走近并调查 |
| `E` / `Enter` | 调查附近物件 / 推进对话 |
| 鼠标滚轮 | 镜头缩放 |
| `ESC` | 打开或关闭设置面板 |

靠近可交互物件时会显示 `[E] 调查 · 物件名`，悬停时物件会泛起暖色描边。

## 快速开始

```bash
npm install
npm run dev      # http://127.0.0.1:5173/
```

其他命令：

```bash
npm run typecheck   # TypeScript 严格模式检查
npm run build       # 类型检查 + 生产构建，输出到 dist/
npm run preview     # 预览构建产物
```

> 开发小工具：访问 `/?sprites` 可直接预览猫咪的 13 × 4 像素精灵图集。

## 技术栈

- **Vite 6** + **TypeScript 5**（`strict` / `noUnusedLocals` / `noImplicitOverride`）
- **Three.js r180**：正交等距相机、PCFSoft 阴影、ACES 色调映射
- 后处理：`EffectComposer` + `UnrealBloomPass` + 自定义移轴景深与调色/量化 Shader
- 程序化美术：Canvas 2D 逐像素绘制 → `CanvasTexture`，最近邻过滤
- WebAudio 振荡器合成的点击 / 调查 / 完成音效，无音频文件

## 项目结构

```text
src/
  main.ts                    入口
  game/
    Game.ts                  主循环与系统编排
    World.ts                 场景装配、尘埃、委托人 NPC
    Player.ts                移动、碰撞、自动寻路
    InputManager.ts          键鼠输入
    InteractionSystem.ts     拾取、悬停高亮、距离判定
    QuestSystem.ts           任务状态机与 localStorage 存档
    Story.ts                 分支剧情文本
    AudioManager.ts          合成音效
    constants.ts             色板、世界尺度、参数
    types.ts                 共享类型
  rendering/
    SceneRenderer.ts         渲染器与内部像素分辨率
    CameraController.ts      正交等距相机
    Lighting.ts              暖阳 / 台灯 / 吊灯
    PostProcessing.ts        Bloom、移轴景深、调色链
  entities/
    OfficeProps.ts           办公桌、档案柜、书架、窗户等家具
    CatCharacter.ts          猫咪精灵与动画状态
  art/
    PixelTextures.ts         程序化像素贴图库
    SpriteGenerator.ts       像素猫咪图集、头像与道具图标
  ui/
    GameUI.ts                HUD、任务日志、设置
    Dialogue.ts              打字机对话框
    Inventory.ts             物品栏
  styles/main.css            像素 UI 样式
```

## 部署

仓库已配置 [GitHub Actions](./.github/workflows/deploy.yml)：推送到 `main` 后自动构建并发布到 GitHub Pages。

构建时通过环境变量切换资源前缀，本地开发仍使用根路径：

```ts
base: process.env.GITHUB_ACTIONS ? '/cat-agency/' : '/'
```

如需手动发布，在仓库 `Settings → Pages` 中将 Source 设为 **GitHub Actions**。

## 视觉参考

美术方向参考了 [Luminati / Lumina 2.5D Pixel Art Engine](https://gitlab.com/stubborn-hug/lumina)（MIT）的像素密度、色板分层与电影化后处理思路；本项目为独立的室内事务所场景实现，未复制其代码或素材。

调色板：奶油米 `#F4D9B2`、暖木棕 `#A87355`、砖红 `#C88361`、鼠尾草绿 `#86A69A`、深灰紫 `#514D64`、暖黄灯光 `#FFC27A`。有限色板、冷影暖光、无纯黑轮廓。

## 许可协议

本项目以 **GNU General Public License v3.0** 发布，详见 [LICENSE](./LICENSE)。
