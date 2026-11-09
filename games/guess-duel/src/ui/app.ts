import { keyboardAction, rematchNames, roomURL } from './input.ts';
import { header, content, secretSlots, shareURL } from './views.ts';
import './style.css';
import { esc, button } from './html.ts';
import {
  createGame,
  applyCommit,
  applyGuess,
  applyReply,
  applyReveal,
  score,
  other,
  isValidCode,
  aiGuess,
  type Game,
  type Seat,
} from '../logic/game.ts';
import { commit, randomSalt, verifyGame } from '../logic/commit.ts';
import { encode, decode } from '../relay/codec.ts';
import { RoomsClient, RoomError, apiBase, normalizeCode, type Room } from '../net/rooms.ts';
import { OnlineSession, onlineScreen, canResumeSeat } from '../net/online.ts';
import { strings, locale, roomErrorText, type Locale } from './i18n.ts';
import { Audio } from './audio.ts';
import {
  safeGet,
  safeSet,
  recordScore,
  scoreIdentity,
  resilientStorage,
  cleanupSessions,
} from './storage.ts';
const storage = resilientStorage(() => window.localStorage);
cleanupSessions(() => window.localStorage);
type Mode = 'same' | 'ai' | 'relay' | 'online';
type Private = {
  secret: string;
  salt: string;
  notes: number[];
};
const root = document.querySelector<HTMLDivElement>('#app')!,
  params = new URLSearchParams(location.search),
  audio = new Audio();
let lang: Locale = locale(
    params.get('locale') ?? String(safeGet(storage, 'guess-duel:language') ?? navigator.language),
  ),
  t = strings[lang];
let mode: Mode = 'same',
  screen = 'home',
  game: Game | undefined,
  seat: Seat = 0,
  privateData: Partial<Record<Seat, Private>> = {},
  input = '',
  message = '',
  hint = false,
  showOpponent = false,
  thinking = false,
  verified: boolean | null = null,
  recorded = false,
  returnScreen = 'home',
  session: OnlineSession | undefined,
  busy = false;
const settings = safeGet(storage, 'guess-duel:settings') as any;
let n = settings?.n === 4 ? 4 : 3,
  names: [string, string] =
    Array.isArray(settings?.names) && settings.names.length === 2
      ? settings.names
      : lang === 'en'
        ? ['Player 1', 'Player 2']
        : ['爸爸', '小朋友'],
  difficulty = 'normal';
audio.enabled = settings?.sound !== false;
if (params.get('theme') === 'dark') document.documentElement.dataset.theme = 'dark';
if (/^[a-f\d]{6}$/i.test(params.get('color') ?? ''))
  document.documentElement.style.setProperty('--accent', '#' + params.get('color'));
const labelName = (s: Seat) => game?.names[s] ?? names[s];
function saveSettings() {
  safeSet(storage, 'guess-duel:settings', { n, names, sound: audio.enabled });
}
function scoreKey() {
  return scoreIdentity(
    game?.names ?? (mode === 'ai' ? [names[0], lang === 'en' ? 'Computer' : '電腦'] : names),
    mode === 'ai',
  ).key;
}
function render() {
  document.documentElement.lang = lang;
  root.innerHTML =
    header() +
    `<main class="${screen}">${message ? `<p class="notice" role="status">${esc(message)}</p>${message === loginMessage() ? button(lang === 'en' ? 'Sign in' : '登入', 'login') : ''}${message === missingMessage() ? button(lang === 'en' ? 'New room' : '重新開房', 'createRoom') : ''}` : ''}${content()}</main>`;
  bind();
}
function bind() {
  root.querySelectorAll<HTMLElement>('[data-action]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.preventDefault();
      void action(el.dataset.action!);
    }),
  );
  root
    .querySelectorAll<HTMLElement>('[data-mode]')
    .forEach((el) => (el.onclick = () => void start(el.dataset.mode as Mode)));
  root
    .querySelectorAll<HTMLElement>('[data-digit]')
    .forEach((el) => (el.onclick = () => digit(el.dataset.digit!)));
  root.querySelectorAll<HTMLElement>('[data-note]').forEach(
    (el) =>
      (el.onclick = () => {
        const d = +el.dataset.note!;
        privateData[seat]!.notes[d] = (privateData[seat]!.notes[d] + 1) % 3;
        persist();
        render();
      }),
  );
  const byId = (id: string) => document.getElementById(id) as HTMLInputElement | null;
  for (const i of [0, 1]) {
    const el = byId('name' + i);
    if (el)
      el.onchange = () => {
        names[i] =
          el.value.trim().slice(0, 40) ||
          (lang === 'en' ? `Player ${i + 1}` : ['爸爸', '小朋友'][i]);
        saveSettings();
        render();
      };
  }
  const digits = byId('digits');
  if (digits)
    digits.onchange = () => {
      n = +digits.value;
      saveSettings();
    };
  const sound = byId('sound');
  if (sound)
    sound.onchange = () => {
      audio.enabled = sound.checked;
      audio.unlock();
      saveSettings();
    };
  const language = byId('lang');
  if (language)
    language.onchange = () => {
      lang = locale(language.value);
      t = strings[lang];
      safeSet(storage, 'guess-duel:language', lang);
      render();
    };
  const diff = byId('difficulty');
  if (diff) diff.onchange = () => (difficulty = diff.value);
  const hi = byId('hint');
  if (hi)
    hi.onchange = () => {
      hint = hi.checked;
      render();
    };
  root.querySelectorAll<HTMLInputElement>('[data-room-digit]').forEach((el, i, all) => {
    el.oninput = () => {
      el.value = el.value.toUpperCase();
      if (el.value) all[i + 1]?.focus();
    };
    el.onpaste = (e) => {
      e.preventDefault();
      const code = e.clipboardData?.getData('text').replace(/[\s-]/g, '').toUpperCase() ?? '';
      all.forEach((box, j) => (box.value = code[j] ?? ''));
    };
  });
  const peek = root.querySelector<HTMLElement>('[data-action="peek"]');
  if (peek) {
    const hide = () => {
      const own = byId('own-secret');
      if (own) own.textContent = '●'.repeat(game!.n);
      const slots = byId('secret-slots');
      if (slots) slots.innerHTML = secretSlots().replace(/^<div[^>]*>|<\/div>$/g, '');
    };
    const show = () => {
      if (screen === 'secret') {
        const el = byId('secret-slots');
        if (el)
          el.innerHTML = Array.from(
            { length: game!.n },
            (_, i) => `<span class="chip">${input[i] ?? '·'}</span>`,
          ).join('');
      } else {
        const own = byId('own-secret');
        if (own) own.textContent = privateData[seat]?.secret ?? '';
      }
    };
    peek.onpointerdown = (e) => {
      e.preventDefault();
      peek.setPointerCapture(e.pointerId);
      show();
    };
    peek.onpointerup = hide;
    peek.onpointercancel = hide;
    peek.onpointerleave = hide;
    peek.onkeydown = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        show();
      }
    };
    peek.onkeyup = hide;
    peek.onblur = hide;
  }
}
function digit(d: string) {
  audio.unlock();
  if (
    (screen !== 'secret' && screen !== 'play') ||
    busy ||
    thinking ||
    (screen === 'play' && game?.turn !== seat)
  )
    return;
  if (input.length < game!.n && !input.includes(d)) {
    input += d;
    audio.play('key');
    render();
  }
}
async function action(a: string) {
  audio.unlock();
  if (a === 'peek') return;
  if (a === 'home') {
    if (
      game &&
      game.status !== 'finished' &&
      !confirm(lang === 'en' ? 'Leave this game?' : '要離開這一局嗎？')
    )
      return;
    session?.stop();
    session = undefined;
    game = undefined;
    privateData = {};
    screen = 'home';
    input = '';
    message = '';
    history.replaceState(
      null,
      '',
      location.pathname + location.search.replace(/([?&])room=[^&]*&?/, '$1').replace(/[?&]$/, ''),
    );
    render();
    return;
  }
  if (a === 'rules') {
    returnScreen = screen;
    screen = 'rules';
    render();
    return;
  }
  if (a === 'closeRules') {
    screen = returnScreen;
    render();
    return;
  }
  if (a === 'handover') {
    if (screen === 'reply') seat = game!.turn;
    screen = game?.commits.every(Boolean) ? 'play' : 'secret';
    input = '';
    render();
    return;
  }
  if (a === 'delete') {
    input = input.slice(0, -1);
    render();
    return;
  }
  if (a === 'toggleHistory') {
    showOpponent = !showOpponent;
    render();
    return;
  }
  if (a === 'reset') {
    if (confirm(lang === 'en' ? 'Reset all scores?' : '清除所有分數？'))
      safeSet(storage, 'guess-duel-scores', {});
    render();
    return;
  }
  if (a === 'nextPlayer') {
    seat = game!.turn;
    hint = false;
    showOpponent = false;
    screen = 'handover';
    render();
    return;
  }
  if (a === 'login') {
    const url = new URL('/login', getClient().base);
    url.searchParams.set('callbackUrl', location.pathname + location.search);
    try {
      window.top!.location.href = url.href;
    } catch {
      window.open(url.href, '_blank', 'noopener');
    }
    return;
  }
  if (a === 'rematch') {
    if (game) names = rematchNames(game.names, mode === 'relay', seat);
    const first = game ? (mode === 'relay' && seat === 1 ? game.first : other(game.first)) : 0;
    await start(mode, first);
    return;
  }
  if (a === 'shareResult') {
    screen = 'share';
    render();
    return;
  }
  if (a === 'share') {
    try {
      if (navigator.share) await navigator.share({ title: t.title, url: shareURL() });
      else {
        await navigator.clipboard.writeText(shareURL());
        message = t.copy;
        render();
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        try {
          await navigator.clipboard.writeText(shareURL());
          message = t.copy;
          render();
        } catch {
          /* The visible link remains selectable. */
        }
      }
    }
    return;
  }
  if (a === 'skip') {
    try {
      await session?.skip();
    } catch (e) {
      showError(e);
    }
    return;
  }
  if (a === 'createRoom') {
    await connectRoom();
    return;
  }
  if (a === 'joinRoom') {
    const code = Array.from(root.querySelectorAll<HTMLInputElement>('[data-room-digit]'))
      .map((x) => x.value)
      .join('');
    await connectRoom(code);
    return;
  }
  if (a === 'submit' && !busy) {
    await submit();
  }
}
async function start(m: Mode, first: Seat = 0) {
  session?.stop();
  session = undefined;
  mode = m;
  verified = null;
  recorded = false;
  privateData = {};
  input = '';
  message = '';
  hint = false;
  showOpponent = false;
  thinking = false;
  game = createGame({
    n,
    names: m === 'ai' ? [names[0], lang === 'en' ? 'Computer' : '電腦'] : [...names],
    first,
  });
  seat = 0;
  if (m === 'online') {
    screen = 'onlineLobby';
    render();
    return;
  }
  if (m === 'ai') {
    const secret = aiGuess(n, []),
      salt = randomSalt();
    privateData[1] = { secret, salt, notes: Array(10).fill(0) };
    game = applyCommit(game, 1, await commit(secret, salt));
    screen = 'secret';
  } else screen = m === 'same' ? 'handover' : 'secret';
  render();
}
async function submit() {
  if (!game || !isValidCode(input, game.n)) {
    message = t.invalid;
    render();
    return;
  }
  busy = true;
  try {
    message = '';
    const code = input;
    input = '';
    audio.play('submit');
    if (screen === 'secret') {
      const salt = randomSalt();
      privateData[seat] = { secret: code, salt, notes: Array(10).fill(0) };
      const h = await commit(code, salt);
      if (mode === 'online') {
        persistOnline();
        if (session!.room.turn === seat) await session!.send({ t: 'commit', h });
      } else game = applyCommit(game, seat, h);
      persist();
      persistOnline();
      if (mode === 'same' && !game.commits.every(Boolean)) {
        seat = other(seat);
        screen = 'handover';
      } else if (mode === 'relay') {
        screen = 'share';
      } else if (mode === 'same') {
        seat = game.first;
        screen = 'handover';
      } else await advance();
    } else if (screen === 'play') {
      if (mode === 'online') {
        await session!.send({ t: 'guess', g: code });
        await advance();
      } else {
        const guesser = seat;
        game = applyGuess(game, guesser, code);
        if (mode === 'same' || mode === 'ai') {
          game = applyReply(game, other(guesser), score(privateData[other(guesser)]!.secret, code));
          announce();
          if (mode === 'same' && game.status !== 'finished') screen = 'reply';
          else await advance(true);
        } else {
          persist();
          screen = 'share';
        }
      }
    }
    render();
  } catch (e) {
    showError(e);
  } finally {
    busy = false;
  }
}
function announce() {
  const entry = game?.history[other(game.turn)].at(-1);
  if (entry?.r) {
    audio.play('reply', entry.r.a, entry.r.b);
    const live = document.getElementById('live-reply');
    if (live) live.textContent = entry.r.a + 'A' + entry.r.b + 'B';
  }
}
async function advance(afterGuess = false) {
  if (!game) return;
  if (game.status === 'finished') {
    await finish();
    return;
  }
  if (mode === 'online' || mode === 'relay') {
    if (
      mode === 'online' &&
      !game.commits[seat] &&
      privateData[seat] &&
      session!.room.turn === seat
    ) {
      const p = privateData[seat]!;
      await session!.send({ t: 'commit', h: await commit(p.secret, p.salt) });
    }
    const pending = game.history[other(seat)].at(-1);
    if (pending && !pending.r && game.turn === seat && privateData[seat]) {
      const r = score(privateData[seat]!.secret, pending.g);
      if (mode === 'online') await session!.send({ t: 'reply', r: `${r.a}A${r.b}B` });
      else game = applyReply(game, seat, r);
      announce();
      persist();
      if (game.status === 'finished') {
        await finish();
        return;
      }
    }
    if (mode === 'online') screen = onlineScreen(session!.room, seat, Boolean(privateData[seat]));
    else if (!game.commits[seat] && !privateData[seat]) screen = 'secret';
    else if (!game.commits.every(Boolean) || game.turn !== seat) screen = 'share';
    else screen = 'play';
    render();
    return;
  }
  if (mode === 'ai' && game.turn === 1) {
    screen = 'play';
    thinking = true;
    render();
    const id = game.id;
    await new Promise((r) => setTimeout(r, 700));
    if (!game || game.id !== id || mode !== 'ai') return;
    const g = aiGuess(game.n, game.history[1], difficulty);
    game = applyGuess(game, 1, g);
    game = applyReply(game, 0, score(privateData[0]!.secret, g));
    thinking = false;
    announce();
    if (game.status === 'finished') {
      await finish();
      return;
    }
    seat = 0;
    screen = 'play';
  } else if (mode === 'same') {
    seat = game.turn;
    hint = false;
    showOpponent = false;
    screen = afterGuess ? 'handover' : 'play';
  } else screen = 'play';
  render();
}
async function finish() {
  if (!game) return;
  for (const s of [0, 1] as Seat[]) {
    const p = privateData[s];
    if (p && !game.reveals[s]) {
      if (mode === 'online') {
        if (s === seat && session!.room.turn === seat)
          await session!.send({ t: 'reveal', s: p.secret, salt: p.salt });
      } else game = applyReveal(game, s, p.secret, p.salt);
    }
  }
  persist();
  if (game.reveals.every(Boolean)) verified = await verifyGame(game);
  if (!recorded && verified !== null) {
    const result =
      game.result === 'draw'
        ? 'draw'
        : scoreIdentity(game.names, mode === 'ai').seats[game.result!];
    recordScore(storage, scoreKey(), result, game.id);
    recorded = true;
    audio.play('win');
  }
  screen = 'result';
  render();
}
function persist() {
  if (mode === 'online') {
    persistOnline();
    return;
  }
  if (mode !== 'relay' || !game || !privateData[seat]) return;
  safeSet(storage, 'guess-duel:relay:' + game.id, {
    updatedAt: Date.now(),
    gameId: game.id,
    seat,
    ...privateData[seat],
    seq: game.seq,
    shared: encode(game),
  });
}
async function openRelay() {
  mode = 'relay';
  try {
    game = decode(location.hash);
    const saved = safeGet(storage, 'guess-duel:relay:' + game.id) as any;
    if (saved && saved.seq > game.seq) {
      message = t.old;
      game = decode(saved.shared);
      screen = 'share';
      seat = saved.seat;
      privateData[seat] = { secret: saved.secret, salt: saved.salt, notes: saved.notes };
      render();
      return;
    }
    if (saved && (saved.seat === 0 || saved.seat === 1) && isValidCode(saved.secret, game.n)) {
      seat = saved.seat;
      privateData[seat] = {
        secret: saved.secret,
        salt: saved.salt,
        notes: Array.isArray(saved.notes) ? saved.notes : Array(10).fill(0),
      };
    } else if (!game.commits[1]) {
      seat = 1;
    } else {
      screen = game.status === 'finished' ? 'result' : 'spectator';
      if (game.status === 'finished' && game.reveals.every(Boolean))
        verified = await verifyGame(game);
      render();
      return;
    }
    names = game.names;
    n = game.n;
    await advance();
  } catch {
    game = undefined;
    screen = 'home';
    message = t.invalid;
    render();
  }
}
function getClient() {
  return new RoomsClient(
    apiBase(location, params.get('api'), import.meta.env.DEV),
    undefined,
    storage,
  );
}
let advancing = false;
async function connectRoom(code?: string) {
  if (busy) return;
  message = '';
  busy = true;
  render();
  try {
    const client = getClient();
    const clean = code === undefined ? undefined : normalizeCode(code);
    const saved = clean ? (safeGet(storage, client.tokenKey(clean)) as any) : null;
    const d = saved
      ? { ...saved, code: clean, room: (await client.poll(clean!, saved.token, -1)).room }
      : clean !== undefined
        ? { ...(await client.join(clean)), code: clean }
        : await client.create(game ?? createGame({ n, names }));
    if (!saved && code && d.room.state.commits[d.seat]) throw new RoomError(400, 'invalid_state');
    seat = d.seat;
    game = d.room.state;
    n = game!.n;
    names = [...game!.names];
    mode = 'online';
    const local = safeGet(storage, 'guess-duel:online:' + d.code) as any;
    if (local && isValidCode(local.secret, game!.n)) privateData[seat] = local;
    if (!(await canResumeSeat(game!, seat, local))) throw new RoomError(400, 'invalid_state');
    session = new OnlineSession(
      client,
      d.code,
      d.token,
      seat,
      d.room,
      (room: Room) => {
        game = room.state;
        if (!advancing && !busy && screen !== 'rules') {
          advancing = true;
          void advance()
            .catch(showError)
            .finally(() => {
              advancing = false;
            });
        }
      },
      showError,
    );
    game = session.room.state;
    history.replaceState(null, '', roomURL(location.href, d.code));
    screen = code ? 'secret' : 'waiting';
    await advance();
    session.start();
  } catch (e) {
    screen = 'home';
    showError(e);
  } finally {
    busy = false;
  }
}
function loginMessage() {
  return lang === 'en'
    ? 'Sign in to AppAI to create a room (joining doesn’t need it)'
    : '建房要先登入 AppAI（加入不用）';
}
function missingMessage() {
  return lang === 'en' ? 'Room not found. Create a new room.' : '找不到這個房間，請重新開房。';
}
function showError(e: unknown) {
  if (e instanceof RoomError && e.status === 404) {
    session?.stop();
    session = undefined;
    privateData = {};
    game = undefined;
    screen = 'home';
    message = missingMessage();
  } else if (e instanceof RoomError && e.error === 'login_required') message = loginMessage();
  else if (e instanceof RoomError && (e.status === 503 || e.error === 'unavailable'))
    message = t.unavailable;
  else if (e instanceof RoomError && e.error === 'room_not_ready') message = t.wait;
  else if (e instanceof RoomError && e.error === 'not_host')
    message = lang === 'en' ? 'Only the host can start the room.' : '只有房主能開始。';
  else message = e instanceof RoomError ? roomErrorText(e.error, lang) : t.invalid;
  render();
}
// Persist online secrets only on their own device; local pass-and-play secrets never leave memory.
function persistOnline() {
  if (mode === 'online' && session && privateData[seat])
    safeSet(storage, 'guess-duel:online:' + session.code, {
      ...privateData[seat],
      updatedAt: Date.now(),
    });
}
document.addEventListener('keydown', (e) => {
  const actionKey = keyboardAction(
    screen,
    e.key,
    Boolean((e.target as HTMLElement)?.closest('button,input,select,textarea,a,summary')),
  );
  if (!actionKey) return;
  e.preventDefault();
  if (actionKey.type === 'digit') digit(actionKey.value!);
  else void action(actionKey.type);
});
window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#r=')) void openRelay();
});
(window as any).__duelTest = {
  state: () => {
    const result: any = { mode, screen, seat, game: game ? structuredClone(game) : null };
    if (game?.status === 'finished' || (mode === 'same' && params.get('debug') === '1'))
      result.secrets = structuredClone(privateData);
    return result;
  },
  act: async (a: any) => {
    switch (a.type) {
      case 'mode':
        return start(a.mode);
      case 'setSecret':
        input = a.code;
        return submit();
      case 'handover':
        return action('handover');
      case 'guess':
        input = a.code;
        return submit();
      case 'rematch':
        return action('rematch');
      case 'home':
        return action('home');
    }
  },
};
render();
if (location.hash.startsWith('#r=')) void openRelay();
else if (params.has('room')) {
  mode = 'online';
  void connectRoom(params.get('room')!);
}
function countdown() {
  const remaining = Math.max(
    0,
    Math.min(120, Math.ceil((Date.parse(session!.room.expiresAt) - Date.now()) / 1000)),
  );
  return `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} ${lang === 'en' ? 'to enter the room code' : '內請對方輸入房號'}`;
}
setInterval(() => {
  const el = document.querySelector('[data-countdown]');
  if (el && session) {
    el.textContent = countdown();
    if (Date.parse(session.room.expiresAt) <= Date.now())
      showError(new RoomError(404, 'room_not_found'));
  }
}, 1000);
export {
  storage,
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
};
