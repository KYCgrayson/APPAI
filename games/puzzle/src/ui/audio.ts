export class Audio {
    private context?: AudioContext;
    muted = false;
    unlock() { if (!this.context)
        this.context = new AudioContext(); if (this.context.state === 'suspended')
        void this.context.resume(); }
    play(kind: 'select' | 'sail' | 'fail' | 'win') { if (this.muted || !this.context)
        return; const ctx = this.context; const notes = { select: [520], sail: [220, 330], fail: [180, 130], win: [523, 659, 784, 1046] }[kind]; notes.forEach((freq, i) => { const oscillator = ctx.createOscillator(), gain = ctx.createGain(), t = ctx.currentTime + i * .12; oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(freq, t); gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.07, t + .015); gain.gain.exponentialRampToValueAtTime(.001, t + .22); oscillator.connect(gain).connect(ctx.destination); oscillator.start(t); oscillator.stop(t + .23); }); }
}
