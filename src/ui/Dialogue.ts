/**
 * 像素对话框：头像、名字牌、打字机文字效果、点击继续。
 */
import type { DialogueLine } from '../game/types';

const CHARS_PER_SECOND = 34;
const PAUSE_CHARS = '，。！？…、；';

export class Dialogue {
  active = false;
  onFinish?: () => void;
  onAdvanceLine?: () => void;

  private readonly root: HTMLElement;
  private readonly nameEl: HTMLElement;
  private readonly textEl: HTMLElement;
  private readonly nextEl: HTMLElement;
  private readonly portraitEl: HTMLElement;

  private lines: DialogueLine[] = [];
  private index = 0;
  private charIndex = 0;
  private acc = 0;
  private pause = 0;
  private typing = false;
  private fullText = '';
  private readonly portraits: Record<string, string>;

  constructor(portraits: Record<string, string>) {
    this.root = document.getElementById('dialogue') as HTMLElement;
    this.nameEl = document.getElementById('dialogue-name') as HTMLElement;
    this.textEl = document.getElementById('dialogue-text') as HTMLElement;
    this.nextEl = document.getElementById('dialogue-next') as HTMLElement;
    this.portraitEl = document.getElementById('dialogue-portrait-img') as HTMLElement;
    this.portraits = portraits;

    this.root.addEventListener('click', () => this.advance());
  }

  start(lines: DialogueLine[], onFinish?: () => void): void {
    if (lines.length === 0) {
      onFinish?.();
      return;
    }
    this.lines = lines;
    this.index = 0;
    this.active = true;
    this.onFinish = onFinish;
    this.root.hidden = false;
    this.showLine(0);
  }

  private showLine(i: number): void {
    const line = this.lines[i];
    this.nameEl.textContent = line.speaker;
    const key = line.portrait ?? 'narrator';
    const src = this.portraits[key] ?? this.portraits.cat;
    this.portraitEl.innerHTML = src ? `<img src="${src}" alt="${line.speaker}" />` : '';
    this.fullText = line.text;
    this.textEl.textContent = '';
    this.charIndex = 0;
    this.acc = 0;
    this.pause = 0;
    this.typing = true;
    this.nextEl.classList.remove('show');
    this.onAdvanceLine?.();
  }

  advance(): void {
    if (!this.active) return;
    if (this.typing) {
      this.charIndex = this.fullText.length;
      this.textEl.textContent = this.fullText;
      this.typing = false;
      this.nextEl.classList.add('show');
      return;
    }
    if (this.index < this.lines.length - 1) {
      this.index++;
      this.showLine(this.index);
      return;
    }
    this.finish();
  }

  private finish(): void {
    this.active = false;
    this.root.hidden = true;
    const cb = this.onFinish;
    this.onFinish = undefined;
    cb?.();
  }

  update(dt: number): void {
    if (!this.active || !this.typing) return;
    if (this.pause > 0) {
      this.pause -= dt;
      return;
    }
    this.acc += dt * CHARS_PER_SECOND;
    let changed = false;
    while (this.acc >= 1 && this.charIndex < this.fullText.length) {
      this.acc -= 1;
      const ch = this.fullText[this.charIndex];
      this.charIndex++;
      changed = true;
      if (PAUSE_CHARS.includes(ch)) {
        this.pause = 0.12;
        break;
      }
    }
    if (changed) {
      this.textEl.textContent = this.fullText.slice(0, this.charIndex);
    }
    if (this.charIndex >= this.fullText.length) {
      this.typing = false;
      this.nextEl.classList.add('show');
    }
  }
}
