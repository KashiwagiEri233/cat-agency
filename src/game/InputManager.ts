/**
 * 输入管理：WASD / 方向键移动，E 交互，ESC 设置，鼠标拾取与滚轮缩放。
 * 把屏幕方向（上/右）转换成等距世界的 XZ 方向。
 */
const DIAG = 1 / Math.SQRT2;

export class InputManager {
  onInteract?: () => void;
  onEscape?: () => void;
  onPointerMove?: (clientX: number, clientY: number) => void;
  onPointerLeaveCanvas?: () => void;
  onPointerDown?: (clientX: number, clientY: number, button: number) => void;
  onWheel?: (deltaY: number) => void;

  private readonly keys = new Set<string>();
  private readonly element: HTMLElement;
  private readonly listeners: Array<[EventTarget, string, EventListener]> = [];
  private lastPointerDownAt = 0;

  constructor(element: HTMLElement) {
    this.element = element;
    this.bind(window, 'keydown', this.handleKeyDown as EventListener);
    this.bind(window, 'keyup', this.handleKeyUp as EventListener);
    // 指针事件绑到 window，避免画布上方覆盖层拦截事件
    this.bind(window, 'pointermove', this.handlePointerMove as EventListener);
    this.bind(window, 'pointerdown', this.handlePointerDown as EventListener);
    this.bind(window, 'click', this.handleClick as EventListener);
    this.bind(window, 'wheel', this.handleWheel as EventListener, { passive: false });
    this.bind(element, 'contextmenu', ((e: Event) => e.preventDefault()) as EventListener);
    this.bind(window, 'blur', (() => this.keys.clear()) as EventListener);
  }

  /** 判断事件是否发生在渲染画布上（而不是 UI 面板按钮上） */
  private isOnCanvas(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return el === this.element || el.tagName === 'CANVAS';
  }

  private bind(target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions): void {
    target.addEventListener(type, handler, options);
    this.listeners.push([target, type, handler]);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    // 兼容中文输入法/非 QWERTY 布局：优先 code，其次 key
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'Space'
    ) {
      e.preventDefault();
    }
    const isInteract = code === 'KeyE' || code === 'Enter' || key === 'e';
    if (isInteract) {
      if (!e.repeat) this.onInteract?.();
    }
    if (code === 'Escape' || key === 'Escape') {
      this.onEscape?.();
    }
    this.keys.add(code);
    if (key.length === 1) this.keys.add(key.toLowerCase());
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    if (e.key.length === 1) this.keys.delete(e.key.toLowerCase());
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.isOnCanvas(e.target)) {
      this.onPointerLeaveCanvas?.();
      return;
    }
    this.onPointerMove?.(e.clientX, e.clientY);
  };

  private handlePointerDown = (e: PointerEvent): void => {
    if (!this.isOnCanvas(e.target)) return;
    this.lastPointerDownAt = performance.now();
    this.onPointerDown?.(e.clientX, e.clientY, e.button);
  };

  /** 某些环境只派发 click（例如触控模拟），作为 pointerdown 的兜底 */
  private handleClick = (e: MouseEvent): void => {
    if (!this.isOnCanvas(e.target)) return;
    if (performance.now() - this.lastPointerDownAt < 600) return;
    this.onPointerDown?.(e.clientX, e.clientY, e.button);
  };

  private handleWheel = (e: WheelEvent): void => {
    if (!this.isOnCanvas(e.target)) return;
    e.preventDefault();
    this.onWheel?.(e.deltaY);
  };

  /** 返回等距世界坐标下的移动向量（已归一化前的屏幕分量） */
  getMoveVector(): { x: number; z: number } {
    let h = 0;
    let v = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft') || this.keys.has('a')) h -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight') || this.keys.has('d')) h += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp') || this.keys.has('w')) v += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown') || this.keys.has('s')) v -= 1;

    // 屏幕方向 → 世界方向（等距 45°）
    return {
      x: h * DIAG - v * DIAG,
      z: -h * DIAG - v * DIAG,
    };
  }

  get elementBounds(): DOMRect {
    return this.element.getBoundingClientRect();
  }

  destroy(): void {
    for (const [target, type, handler] of this.listeners) {
      target.removeEventListener(type, handler);
    }
    this.listeners.length = 0;
    this.keys.clear();
  }
}
