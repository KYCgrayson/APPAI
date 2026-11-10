export class Audio {
  enabled = true;
  private context: AudioContext | undefined;
  unlock() {
    if (!this.enabled) return;
    try {
      const Ctor = globalThis.AudioContext ?? (globalThis as any).webkitAudioContext;
      if (!Ctor) return;
      this.context ??= new Ctor();
      void this.context!.resume().catch(() => {});
    } catch {
      this.context = undefined;
    }
  }
  play(kind: 'key' | 'submit' | 'reply' | 'win', a = 0, b = 0) {
    if (!this.enabled || !this.context) return;
    const ctx = this.context;
    const tones =
      kind === 'key'
        ? [420]
        : kind === 'submit'
          ? [400, 600]
          : kind === 'win'
            ? [523, 659, 784, 1047]
            : [...Array(a).fill(780), ...Array(b).fill(520)];
    try {
      tones.forEach((f, i) => {
        const o = ctx.createOscillator(),
          g = ctx.createGain(),
          at = ctx.currentTime + i * 0.14;
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.08, at + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
        o.connect(g).connect(ctx.destination);
        o.start(at);
        o.stop(at + 0.2);
      });
    } catch {}
  }
}
