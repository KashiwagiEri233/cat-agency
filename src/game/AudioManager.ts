/**
 * 极简合成音效：全部由 WebAudio 振荡器生成，不依赖任何外部音频文件。
 * 浏览器要求首次用户交互后才能启动 AudioContext。
 */
export class AudioManager {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.32;
    this.master.connect(this.ctx.destination);
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'square',
    gain = 0.2,
    slideTo?: number,
  ): void {
    if (!this.enabled) return;
    this.unlock();
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  click(): void {
    this.tone(660, 0.06, 'square', 0.16, 520);
  }

  step(): void {
    this.tone(150, 0.05, 'triangle', 0.05, 110);
  }

  interact(): void {
    this.tone(520, 0.09, 'square', 0.14, 780);
    window.setTimeout(() => this.tone(780, 0.1, 'square', 0.12), 90);
  }

  success(): void {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => window.setTimeout(() => this.tone(n, 0.18, 'square', 0.16), i * 110));
  }

  coin(): void {
    this.tone(1046, 0.08, 'square', 0.12);
    window.setTimeout(() => this.tone(1318, 0.16, 'square', 0.1), 70);
  }

  deny(): void {
    this.tone(220, 0.12, 'sawtooth', 0.07, 160);
  }

  dialogue(): void {
    this.tone(880, 0.03, 'square', 0.04);
  }
}
