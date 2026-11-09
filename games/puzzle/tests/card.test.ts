import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.location = new URL('https://puzzle.test/?locale=en') as any;
const { drawCard } = await import('../src/share/card.ts');
test('bridge share sky uses scene night independently of the card palette', () => {
    const gradients: [number, string][] = [], backgrounds: string[] = [];
    const context = {
        fillStyle: '', strokeStyle: '', textAlign: '', font: '', lineWidth: 0,
        fillRect() { backgrounds.push(this.fillStyle); }, beginPath() {}, roundRect() {}, save() {}, clip() {}, drawImage() {}, restore() {}, stroke() {}, fill() {}, fillText() {}, moveTo() {}, lineTo() {},
        measureText: () => ({ width: 100 }), createLinearGradient: () => ({ addColorStop(offset: number, color: string) { gradients.push([offset, color]); } })
    };
    globalThis.document = { createElement: () => ({ getContext: () => context }) } as any;
    const run = { game: 'bridge' as const, level: 'easy' as const, score: 17, ms: 1000, at: 1 };
    drawCard({ width: 936, height: 590 } as HTMLCanvasElement, run, [], null, 3, false, true, '#426b58', '', '');
    assert.deepEqual(gradients, [[0, '#172a46'], [1, '#ba8b80']]);
    assert.equal(backgrounds[0], '#fffaf0', 'light card palette is independent of the night sky');
});
