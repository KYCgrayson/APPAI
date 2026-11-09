import qr from 'qrcode-generator';
import { candidates, other, type Seat } from '../logic/game.ts';
import { encode } from '../relay/codec.ts';
import { readScores } from './storage.ts';
import { button, esc } from './html.ts';
import { rulesScreen, handoverScreen } from './screens.ts';
import {
  lang,
  t,
  mode,
  screen,
  game,
  seat,
  privateData,
  input,
  message,
  hint,
  showOpponent,
  thinking,
  verified,
  session,
  n,
  names,
  difficulty,
  audio,
  scoreKey,
  labelName,
  countdown,
  storage,
} from './app.ts';
type Mode = 'same' | 'ai' | 'relay' | 'online';
function scoreboard() {
  const rows = readScores(storage);
  const pairs: {
    key: string;
    names: string[];
  }[] = game
    ? [{ key: scoreKey(), names: game.names }]
    : [
        { key: JSON.stringify(['duel', ...names]), names },
        {
          key: JSON.stringify(['ai', names[0], lang === 'en' ? 'Computer' : '電腦']),
          names: [names[0], lang === 'en' ? 'Computer' : '電腦'],
        },
      ];
  return `<section class="scoreboard">
  <h3>${t.scores}</h3>${pairs
    .map((p) => {
      const r = rows[p.key] ?? { wins: [0, 0], draws: 0 };
      return `<p>◆ ${esc(p.names[0])} <strong>${r.wins[0]}</strong> <span>· ${lang === 'en' ? 'Draws' : '平手'} ${r.draws} ·</span> ● ${esc(p.names[1])} <strong>${r.wins[1]}</strong>
  </p>`;
    })
    .join('')}${button(t.reset, 'reset', 'quiet')}</section>`;
}
export function header() {
  return `<header>
  <a href="#" data-action="home" class="brand">◆ <span>${t.title}</span> ●</a>
  <div>${button('?', 'rules', 'quiet')}${screen !== 'home' ? button(t.home, 'home', 'quiet') : ''}</div>
  </header>`;
}
export function content(): string {
  if (screen === 'home')
    return `<section class="hero">
  <div class="eyebrow">1A2B · ${lang === 'en' ? 'TWO MINDS, ONE LITTLE MYSTERY' : '一起破解小秘密'}</div>
  <h1>${t.title}</h1>
  <p>${lang === 'en' ? 'A little logic. A lovely rivalry.' : '動動腦，一起破解小秘密。'}</p>
  <div class="hero-digits" aria-hidden="true">
  <span>4</span>
  <span>2</span>
  <span>7</span>
  <small>1A2B</small>
  </div>
  </section>
  <section class="home-grid">
  <div class="panel">
  <h2>${lang === 'en' ? 'Who’s playing?' : '今天誰來挑戰？'}</h2>
  <div class="names">
  <label>◆ <input id="name0" maxlength="40" aria-label="${lang === 'en' ? 'Player 1' : '玩家一'}" value="${esc(names[0])}">
  </label>
  <label>● <input id="name1" maxlength="40" aria-label="${lang === 'en' ? 'Player 2' : '玩家二'}" value="${esc(names[1])}">
  </label>
  </div>
  <div class="settings">
  <label>${t.digits} <select id="digits">
  <option value="3" ${n === 3 ? 'selected' : ''}>${lang === 'en' ? '3 · Easy' : '3 位 · 簡單'}</option>
  <option value="4" ${n === 4 ? 'selected' : ''}>${lang === 'en' ? '4 · Challenge' : '4 位 · 挑戰'}</option>
  </select>
  </label>
  <label>
  <input id="sound" type="checkbox" ${audio.enabled ? 'checked' : ''}> ${t.sound}</label>
  <select id="lang" aria-label="${lang === 'en' ? 'Language' : '語言'}">
  <option value="en" ${lang === 'en' ? 'selected' : ''}>${lang === 'en' ? 'English' : '英文'}</option>
  <option value="zh-TW" ${lang === 'zh-TW' ? 'selected' : ''}>繁體中文</option>
  </select>
  </div>
  <label>${t.ai} <select id="difficulty">
  <option value="normal">${t.normal}</option>
  <option value="easy" ${difficulty === 'easy' ? 'selected' : ''}>${t.easy}</option>
  </select>
  </label>
  </div>
  <div class="modes">${(['same', 'ai', 'relay', 'online'] as Mode[])
    .map(
      (m, i) => `<button data-mode="${m}">
  <span class="mode-icon">${['◆ ●', '◆ ◇', '↗ ↙', '⌁'][i]}</span>
  <span>${t[m]}</span>
  <span>→</span>
  </button>`,
    )
    .join('')}</div>
  </section>${scoreboard()}${button(t.rules, 'rules', 'quiet')}`;
  if (screen === 'rules') return rulesScreen(t, lang === 'en');
  if (screen === 'handover')
    return handoverScreen(labelName(seat), seat === 0 ? '◆' : '●', t.pass, t.ready);
  if (screen === 'onlineLobby')
    return `<section class="panel">
  <h1>${t.online}</h1>
  <p>${lang === 'en' ? 'Create a room or enter a six-character room code.' : '建立房間或輸入六位房號。'}</p>${button(t.create, 'createRoom', 'primary')}<div class="room-boxes">${Array.from({ length: 6 }, (_, i) => `<input data-room-digit="${i}" maxlength="1" aria-label="${lang === 'en' ? 'Room code' : '房號'} ${i + 1}" autocapitalize="characters">`).join('')}</div>${button(t.join, 'joinRoom')}</section>`;
  if (screen === 'share' || screen === 'waiting') return shareView();
  if (screen === 'reply') {
    const e = game!.history[seat].at(-1)!;
    return `<section class="handover-card">
  <div class="guess-slots">${[...e.g].map((d) => `<span class="chip">${esc(d)}</span>`).join('')}</div>
  <h1 class="reply thinking" role="status">${esc(e.r!.a)}A${esc(e.r!.b)}B</h1>${button((lang === 'en' ? 'Pass to ' : '交給 ') + labelName(game!.turn), 'nextPlayer', 'primary')}</section>`;
  }
  if (screen === 'spectator')
    return `<section class="panel">
  <h1>${t.spectator}</h1>
  <p>${t.wait}</p>${histories()}</section>`;
  if (screen === 'result') return resultView();
  if (!game) return '';
  if (screen === 'secret')
    return `<section class="play-top">
  <div class="eyebrow">${seat === 0 ? '◆' : '●'} ${esc(labelName(seat))}</div>
  <h1>${t.secret}</h1>
  <p>${lang === 'en' ? `${esc(game.n)} distinct digits. Zero can come first.` : `${esc(game.n)} 個不重複的數字，第一位可以是 0。`}</p>${secretSlots()}${button(t.peek, 'peek', 'eye')}</section>${keypad(true)}`;
  if (screen === 'play')
    return `<section class="play-top">
  <div class="eyebrow">${seat === 0 ? '◆' : '●'} ${esc(labelName(seat))}</div>
  <h1>${thinking ? t.thinking : game.turn === seat ? t.guess : t.wait}</h1>${thinking ? '<div class="thinking">● ● ●</div>' : ''}${
    privateData[seat]
      ? `<div class="own-secret">
  <span>${lang === 'en' ? 'My secret' : '我的秘密數字'}</span>
  <strong id="own-secret">${'●'.repeat(game.n)}</strong>${button(t.peek, 'peek', 'eye')}</div>`
      : ''
  }${session ? onlineStatus() : ''}</section>
  <div class="play-middle">${histories()}<details class="notes-disclosure">
  <summary>${t.notes}</summary>${notes()}</details>
  </div>${game.turn === seat && !thinking ? `<div class="guess-slots">${Array.from({ length: game.n }, (_, i) => `<span class="chip">${esc(input[i] ?? '·')}</span>`).join('')}</div>${keypad(false)}` : ''}`;
  return '';
}
export function secretSlots() {
  return `<div class="guess-slots" id="secret-slots">${Array.from({ length: game!.n }, (_, i) => `<span class="chip">${input[i] ? '●' : '·'}</span>`).join('')}</div>`;
}
function keypad(secret: boolean) {
  return `<section class="keypad" aria-label="${secret ? t.secret : t.guess}">${Array.from({ length: 10 }, (_, d) => `<button data-digit="${d}" ${input.includes(String(d)) ? 'disabled' : ''}>${d}</button>`).join('')}${button('⌫', 'delete')}${button(t.submit, 'submit', 'primary')}</section>`;
}
function histories() {
  if (!game) return '';
  const order = [seat, other(seat)];
  return `<section class="histories">${order
    .map(
      (
        s,
        i,
      ) => `<div class="history ${i ? 'opponent-history ' + (!showOpponent ? 'collapsed' : '') : ''}">
  <h2>${s === 0 ? '◆' : '●'} ${esc(labelName(s as Seat))} <small>${game!.history[s].length}</small>
  </h2>
  <ol>${
    game!.history[s]
      .map(
        (e) => `<li>
  <span class="guess-chips">${[...e.g].map((d) => `<span class="mini-chip">${esc(d)}</span>`).join('')}</span>
  <strong class="reply">${e.r ? `${esc(e.r.a)}A${esc(e.r.b)}B` : '…'}</strong>
  </li>`,
      )
      .join('') || `<li class="empty">—</li>`
  }</ol>
  </div>`,
    )
    .join(
      '',
    )}</section>${button(showOpponent ? t.history : t.opponent, 'toggleHistory', 'history-toggle quiet')}`;
}
function notes() {
  if (!privateData[seat] || !game) return '';
  const possible = hint ? new Set(candidates(game.n, game.history[seat]).join('')) : null;
  return `<section class="notes">
  <div>
  <h2>${t.notes}</h2>
  <label>
  <input type="checkbox" id="hint" ${hint ? 'checked' : ''}> ${t.hint}</label>
  </div>
  <div class="note-digits">${privateData[seat]!.notes.map((v, d) => `<button data-note="${d}" class="note-${v} ${possible && !possible.has(String(d)) ? 'impossible' : ''}" aria-label="${d}: ${(lang === 'en' ? ['unknown', 'ruled out', 'confirmed'] : ['未確定', '已排除', '已確認'])[v]}">${d}${v === 2 ? ' ✓' : ''}</button>`).join('')}</div>
  </section>`;
}
function shareView() {
  if (!game) return '';
  const url = shareURL(),
    q = qr(0, 'L');
  q.addData(url);
  q.make();
  return `<section class="panel share-card">
  <h1>${esc(session ? session.code : t.share)}</h1>
  <div class="qr">${q.createSvgTag({ cellSize: 4, margin: 16, scalable: true })}</div>
  <p>${t.scan}</p>${session && session.room.status === 'waiting' ? `<p data-countdown>${countdown()}</p>` : ''}${button(t.share, 'share', 'primary')}<input class="share-url" readonly aria-label="${t.share}" value="${esc(url)}">${session && session.room.status === 'playing' ? button(t.start, 'continueOnline') : ''}</section>`;
}
export function shareURL() {
  const u = new URL(location.href);
  u.hash = '';
  u.searchParams.delete('room');
  if (mode === 'online' && session) u.searchParams.set('room', session.code);
  else if (game) u.hash = encode(game);
  return u.href;
}
function onlineStatus() {
  const opp = session!.room.seats.find((s) => s.seat === other(seat)),
    holder = session!.room.seats.find((s) => s.seat === session!.room.turn);
  return `<p>${opp?.joined && !opp.online ? `${esc(labelName(other(seat)))} ${t.offline}` : ''}</p>${holder && holder.seat !== seat && holder.idleSeconds >= 120 ? button(t.skip, 'skip') : ''}`;
}
function resultView() {
  if (!game) return '';
  return `<section class="result-card">
  <div class="confetti" aria-hidden="true">${Array.from(
    { length: 20 },
    (_, i) => `<i style="--i:${i}">
  </i>`,
  ).join('')}</div>
  <div class="giant">${game.result === 'draw' ? '◆ ●' : game.result === 0 ? '◆' : '●'}</div>
  <h1>${game.result === 'draw' ? t.draw : esc(labelName(game.result as Seat)) + ' ' + t.wins}</h1>
  <p class="verification">${verified === null ? t.verifying : verified ? t.verified : t.mismatch}</p>${mode === 'relay' && verified === null ? `<p>${lang === 'en' ? 'Send the link to the other player to see the result' : '把連結傳給對方，就能看到結果'}</p>` : ''}<div class="reveals">${(
    [0, 1] as Seat[]
  )
    .map(
      (s) => `<div>
  <h2>${esc(labelName(s))}</h2>
  <strong>${esc(game!.reveals[s]?.secret ?? '•••')}</strong>
  <p>${game!.history[s].length} ${lang === 'en' ? 'guesses' : '次猜測'}</p>
  </div>`,
    )
    .join(
      '',
    )}</div>${scoreboard()}${mode === 'relay' ? button(t.share, 'shareResult') : ''}${button(t.rematch, 'rematch', 'primary')}${button(t.home, 'home', 'quiet')}</section>`;
}
