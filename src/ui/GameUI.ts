/**
 * 游戏 HUD：时钟天气、猫爪币、任务日志、交互提示、Toast 与设置面板。
 */
import type { QuestStep, Settings } from '../game/types';
import { Inventory } from './Inventory';

interface UICallbacks {
  onSettingsChange: (key: keyof Settings, value: boolean) => void;
  onResetQuest: () => void;
}

const TOGGLE_KEYS: Record<string, keyof Settings> = {
  bloom: 'bloom',
  dof: 'dof',
  follow: 'follow',
  sound: 'sound',
  quality: 'crispPixels',
};

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export class GameUI {
  readonly inventory: Inventory;
  settings: Settings;

  private readonly coinsEl: HTMLElement;
  private readonly dateEl: HTMLElement;
  private readonly timeEl: HTMLElement;
  private readonly weatherEl: HTMLElement;
  private readonly questListEl: HTMLElement;
  private readonly questProgressEl: HTMLElement;
  private readonly questTeaserEl: HTMLElement;
  private readonly promptEl: HTMLElement;
  private readonly promptLabelEl: HTMLElement;
  private readonly toastLayer: HTMLElement;
  private readonly settingsModal: HTMLElement;
  private readonly loadingEl: HTMLElement;
  private readonly callbacks: UICallbacks;

  constructor(settings: Settings, callbacks: UICallbacks) {
    this.settings = settings;
    this.callbacks = callbacks;
    this.inventory = new Inventory();

    this.coinsEl = document.getElementById('hud-coins') as HTMLElement;
    this.dateEl = document.getElementById('hud-date') as HTMLElement;
    this.timeEl = document.getElementById('hud-time') as HTMLElement;
    this.weatherEl = document.getElementById('hud-weather') as HTMLElement;
    this.questListEl = document.getElementById('quest-list') as HTMLElement;
    this.questProgressEl = document.getElementById('quest-progress') as HTMLElement;
    this.questTeaserEl = document.getElementById('quest-teaser') as HTMLElement;
    this.promptEl = document.getElementById('interact-prompt') as HTMLElement;
    this.promptLabelEl = document.getElementById('interact-label') as HTMLElement;
    this.toastLayer = document.getElementById('toast-layer') as HTMLElement;
    this.settingsModal = document.getElementById('settings') as HTMLElement;
    this.loadingEl = document.getElementById('loading') as HTMLElement;

    this.bindEvents();
    this.syncToggles();
  }

  private bindEvents(): void {
    const panel = document.getElementById('quest-panel') as HTMLElement;
    const toggleBtn = document.getElementById('quest-toggle') as HTMLElement;
    toggleBtn.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
    });

    const settingsBtn = document.getElementById('btn-settings') as HTMLElement;
    settingsBtn.addEventListener('click', () => this.toggleSettings());

    const closeBtn = document.getElementById('btn-close-settings') as HTMLElement;
    closeBtn.addEventListener('click', () => this.showSettings(false));

    const resetBtn = document.getElementById('btn-reset-quest') as HTMLElement;
    resetBtn.addEventListener('click', () => {
      this.callbacks.onResetQuest();
      this.showSettings(false);
    });

    this.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.settingsModal) this.showSettings(false);
    });

    const toggles = this.settingsModal.querySelectorAll<HTMLButtonElement>('[data-toggle]');
    toggles.forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = TOGGLE_KEYS[btn.dataset.toggle ?? ''];
        if (!key) return;
        const current = this.settings[key];
        const next = !current;
        this.settings[key] = next;
        btn.classList.toggle('off', !next);
        this.callbacks.onSettingsChange(key, next);
        this.syncToggles();
      });
    });
  }

  private syncToggles(): void {
    const toggles = this.settingsModal.querySelectorAll<HTMLButtonElement>('[data-toggle]');
    toggles.forEach((btn) => {
      const key = TOGGLE_KEYS[btn.dataset.toggle ?? ''];
      if (!key) return;
      const on = this.settings[key];
      btn.classList.toggle('off', !on);
      if (key === 'crispPixels') {
        btn.textContent = on ? '精细' : '标准';
      } else {
        btn.textContent = on ? '开启' : '关闭';
      }
    });
  }

  setCoins(value: number): void {
    this.coinsEl.textContent = `${value}`;
  }

  setClock(date: Date): void {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    this.dateEl.textContent = `${month}月${day}日 ${WEEKDAYS[date.getDay()]}`;
    const hh = `${date.getHours()}`.padStart(2, '0');
    const mm = `${date.getMinutes()}`.padStart(2, '0');
    this.timeEl.textContent = `${hh}:${mm}`;
  }

  setWeather(text: string): void {
    this.weatherEl.textContent = text;
  }

  setQuest(steps: QuestStep[], progress: { done: number; total: number }, teaser: boolean): void {
    this.questListEl.innerHTML = '';
    for (const step of steps) {
      const li = document.createElement('li');
      if (step.done) li.classList.add('done');
      if (step.active && !step.done) li.classList.add('active');
      const box = document.createElement('span');
      box.className = 'box';
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = step.label;
      li.appendChild(box);
      li.appendChild(label);
      this.questListEl.appendChild(li);
    }
    this.questProgressEl.textContent = `${progress.done}/${progress.total}`;
    this.questTeaserEl.hidden = !teaser;
    if (teaser) {
      this.questTeaserEl.textContent =
        '新委托预告：「午夜之后，广播里会传来猫叫。」—— 琪琪留下的纸条';
    }
  }

  showPrompt(label: string): void {
    this.promptEl.hidden = false;
    this.promptLabelEl.textContent = `调查 · ${label}`;
  }

  hidePrompt(): void {
    this.promptEl.hidden = true;
  }

  toast(text: string, duration = 2600): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.toastLayer.appendChild(el);
    window.setTimeout(() => {
      el.classList.add('fade');
      window.setTimeout(() => el.remove(), 400);
    }, duration);
  }

  toggleSettings(): void {
    this.showSettings(this.settingsModal.hidden);
  }

  showSettings(show: boolean): void {
    this.settingsModal.hidden = !show;
  }

  get settingsOpen(): boolean {
    return !this.settingsModal.hidden;
  }

  hideLoading(): void {
    this.loadingEl.classList.add('hide');
    window.setTimeout(() => {
      this.loadingEl.hidden = true;
    }, 600);
  }
}
