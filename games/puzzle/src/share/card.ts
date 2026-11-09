import { type Run, formatTime, accentTextColor } from './index.ts';
import { levels } from '../logic/index.ts';
import { strings as t, shareStrings as s } from '../ui/i18n.ts';
export function drawCard(snapshot: HTMLCanvasElement, run: Run, runs: Run[], place: number | null, starCount: number, dark: boolean, accent: string, name: string, challengeLine: string) {
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
    const c = canvas.getContext('2d')!, ink = dark ? '#f5eddb' : '#304b43', muted = dark ? '#a9bab5' : '#73867d';
    const left = 72, right = 1008, width = right - left;
    c.fillStyle = dark ? '#233e43' : '#fffaf0'; c.fillRect(0, 0, 1080, 1350);
    const rounded = (x: number, y: number, w: number, h: number, radius: number) => { c.beginPath(); c.roundRect(x, y, w, h, radius); };
    const sky = c.createLinearGradient(0, 40, 0, 630); sky.addColorStop(0, dark ? '#172a46' : '#a8d0df'); sky.addColorStop(1, dark ? '#ba8b80' : '#eee3cc');
    c.save(); rounded(left, 40, width, 590, 30); c.clip();
    c.fillStyle = sky; c.fillRect(left, 40, width, 590);
    const scale = Math.max(width / snapshot.width, 590 / snapshot.height);
    c.drawImage(snapshot, left + (width - snapshot.width * scale) / 2, 40 + (590 - snapshot.height * scale) / 2, snapshot.width * scale, snapshot.height * scale); c.restore();
    rounded(left, 40, width, 590, 30); c.strokeStyle = dark ? '#ffffff26' : '#304b4326'; c.lineWidth = 2; c.stroke();
    const font = 'system-ui, "PingFang TC", "Noto Sans TC", sans-serif';
    const text = (value: string, x: number, y: number, size: number, color = ink, bold = false, maxWidth = width) => {
        c.font = `${bold ? 700 : 400} ${size}px ${font}`;
        const measured = c.measureText(value).width;
        if (measured > maxWidth) c.font = `${bold ? 700 : 400} ${size * maxWidth / measured}px ${font}`;
        c.fillStyle = color; c.fillText(value, x, y);
    };
    text(`${t.title} · ${t[run.level]}`, left, 687, 30);
    text(`${run.crossings} ${t.crossings} · ${formatTime(run.ms)}`, left, 825, 132, ink, true);
    const stars = '★'.repeat(starCount) + '☆'.repeat(3 - starCount);
    text(stars, left, 888, 38, dark ? '#f1c568' : '#b77a29');
    const starsWidth = c.measureText(stars).width;
    text(`${t.optimal} ${levels[run.level].optimal} ${t.crossings}${name ? ' · ' + name : ''}`, left + starsWidth + 24, 888, 29, ink, false, width - starsWidth - 24);
    if (challengeLine) {
        rounded(left, 911, width, 53, 26); c.fillStyle = dark ? '#ffffff12' : '#304b430c'; c.fill();
        text(challengeLine, left + 20, 946, 26, ink, false, width - 40);
    }
    const headingY = challengeLine ? 1007 : 970, rowStart = challengeLine ? 1054 : 1025, rowStep = challengeLine ? 45 : 50;
    text(s.leaderboard, left, headingY, 31, ink, true);
    for (let i = 0; i < 5; i++) {
        const r = runs[i], y = rowStart + i * rowStep, selected = !!r && place === i + 1;
        if (selected) { rounded(left, y - 32, width, 43, 12); c.fillStyle = accent; c.fill(); }
        const color = selected ? accentTextColor(accent) : r ? ink : muted;
        text(`#${i + 1}`, left + 16, y, 27, color);
        text(r ? `${r.crossings} ${t.crossings}` : '—', left + 116, y, 27, color);
        if (r) {
            const date = new Date(r.at), d = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
            c.textAlign = 'right'; text(formatTime(r.ms), 780, y, 27, color); text(d, right - 16, y, 27, color); c.textAlign = 'left';
        }
    }
    c.beginPath(); c.moveTo(left, 1260); c.lineTo(right, 1260); c.strokeStyle = dark ? '#ffffff26' : '#304b4326'; c.lineWidth = 1; c.stroke();
    text(`${s.cta}${t.crossings === '趟' ? '來挑戰 →' : ' Play →'}`, left, 1310, 36, ink, true, 710);
    c.textAlign = 'right'; text('appai.info', right, 1310, 34, dark ? ink : accent, true); c.textAlign = 'left';
    return canvas;
}
