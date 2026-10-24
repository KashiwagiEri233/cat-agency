/**
 * 底部物品栏：4 个像素格子，显示任务道具图标。
 */
import { createItemIcon } from '../art/SpriteGenerator';

const ICONS: Record<string, string> = {};
const LABELS: Record<string, string> = {
  letter: '委托信',
  tuna: '金枪鱼罐头',
  folder: '登记簿复印件',
  note: '琪琪的纸条',
};

const SLOT_COUNT = 4;

export class Inventory {
  private readonly slotsEl: HTMLElement;
  private items: string[] = [];

  constructor() {
    this.slotsEl = document.getElementById('inventory-slots') as HTMLElement;
    this.render();
  }

  private iconFor(id: string): string {
    if (!ICONS[id]) {
      const kind = (['letter', 'tuna', 'folder', 'note'] as const).includes(
        id as 'letter' | 'tuna' | 'folder' | 'note',
      )
        ? (id as 'letter' | 'tuna' | 'folder' | 'note')
        : 'note';
      ICONS[id] = createItemIcon(kind);
    }
    return ICONS[id];
  }

  setItems(items: string[]): void {
    this.items = items.slice(0, SLOT_COUNT);
    this.render();
  }

  private render(): void {
    this.slotsEl.innerHTML = '';
    for (let i = 0; i < SLOT_COUNT; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const id = this.items[i];
      if (id) {
        slot.classList.add('filled');
        slot.title = LABELS[id] ?? id;
        const img = document.createElement('img');
        img.src = this.iconFor(id);
        img.alt = LABELS[id] ?? id;
        slot.appendChild(img);
      }
      this.slotsEl.appendChild(slot);
    }
  }
}
