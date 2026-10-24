/**
 * 任务状态机：《消失的金枪鱼罐头》。
 * 线索之间存在真实依赖：委托信 → 公告板 → 档案柜 → 纸箱 → 回桌提交。
 * 状态写入 localStorage，可在设置中重置。
 */
import { STORAGE_KEY } from './constants';
import type { QuestStep, SaveData } from './types';

export const REWARD_COINS = 100;

function defaultSave(): SaveData {
  return {
    coins: 0,
    readLetter: false,
    readBoard: false,
    searchedCabinet: false,
    searchedBox: false,
    foundTuna: false,
    completed: false,
    unlockedTeaser: false,
    inventory: [],
  };
}

export class QuestSystem {
  state: SaveData = defaultSave();
  onSave?: (state: SaveData) => void;

  constructor() {
    this.load();
  }

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      this.state = { ...defaultSave(), ...parsed };
      if (!Array.isArray(this.state.inventory)) this.state.inventory = [];
    } catch {
      this.state = defaultSave();
    }
  }

  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // 忽略隐私模式下的存储异常
    }
    this.onSave?.(this.state);
  }

  reset(): void {
    this.state = defaultSave();
    this.save();
  }

  get steps(): QuestStep[] {
    const s = this.state;
    const raw: Array<{ id: QuestStep['id']; label: string; done: boolean }> = [
      { id: 'letter', label: '阅读办公桌上的委托信', done: s.readLetter },
      { id: 'board', label: '调查公告板上的线索', done: s.readBoard },
      { id: 'cabinet', label: '翻查档案柜的登记簿', done: s.searchedCabinet },
      { id: 'box', label: '检查角落的可疑纸箱', done: s.foundTuna },
      { id: 'submit', label: '把罐头交还委托人', done: s.completed },
    ];
    const firstUndone = raw.findIndex((r) => !r.done);
    return raw.map((r, i) => ({
      id: r.id,
      label: r.label,
      done: r.done,
      active: i === firstUndone,
    }));
  }

  get progress(): { done: number; total: number } {
    const steps = this.steps;
    return { done: steps.filter((s) => s.done).length, total: steps.length };
  }

  addCoins(amount: number): void {
    this.state.coins += amount;
    this.save();
  }

  addItem(item: string): void {
    if (!this.state.inventory.includes(item)) {
      this.state.inventory.push(item);
      this.save();
    }
  }

  markLetter(): void {
    this.state.readLetter = true;
    this.addItem('letter');
    this.save();
  }

  markBoard(): void {
    this.state.readBoard = true;
    this.save();
  }

  markCabinet(): void {
    this.state.searchedCabinet = true;
    this.save();
  }

  markTunaFound(): void {
    this.state.foundTuna = true;
    this.addItem('tuna');
    this.save();
  }

  complete(): boolean {
    if (this.state.completed) return false;
    this.state.completed = true;
    this.state.unlockedTeaser = true;
    this.state.inventory = this.state.inventory.filter((i) => i !== 'tuna');
    this.state.inventory.push('note');
    this.state.coins += REWARD_COINS;
    this.save();
    return true;
  }
}
