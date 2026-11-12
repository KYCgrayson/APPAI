import test from "node:test";
import assert from "node:assert/strict";
import { createVideoController, trustedVideoMessage, type VideoState, type PlayerMessage } from "../src/lib/video-controller.ts";

for (const kind of ["youtube", "vimeo", "file"] as const) test(`${kind}: latest pending seek wins, acknowledgement and blocked playback are visible`, async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const sent: PlayerMessage[] = [];
  const states: { state: VideoState; time: number }[] = [];
  const player = createVideoController(kind, 0, message => sent.push(message), (state, time) => states.push({ state, time }));
  player.connect(); player.request(30, true); player.request(90, true);
  player.ready(); await Promise.resolve();
  const seeks = sent.filter(m => m.func === "seekTo" || m.method === "setCurrentTime");
  assert.equal(seeks.length, 1);
  assert.deepEqual(kind === "youtube" ? seeks[0].args : seeks[0].value, kind === "youtube" ? [90, true] : 90);
  player.receive(kind === "youtube" ? { event: "infoDelivery", info: { currentTime: 30, playerState: 2 } } : { method: "setCurrentTime", value: 30 });
  assert.equal(states.at(-1)?.state, "ready");
  player.receive(kind === "youtube" ? { event: "infoDelivery", info: { currentTime: 90 } } : { method: "setCurrentTime", value: 90 });
  assert.equal(states.at(-1)?.state, "seeked");
  t.mock.timers.tick(1800);
  assert.deepEqual(states.at(-1), { state: "blocked", time: 90 });
  player.receive(kind === "youtube" ? { event: "onStateChange", info: 1 } : { event: "play" });
  assert.equal(states.at(-1)?.state, "seeked");
  player.request(120, false); await Promise.resolve();
  assert.equal(states.at(-1)?.time, 120);
  player.dispose();
  const count = states.length;
  t.mock.timers.tick(9000);
  assert.equal(states.length, count);
});

test("missing/refused embeds and failed seeks time out after eight seconds", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const states: VideoState[] = [];
  const player = createVideoController("youtube", 90, () => {}, state => states.push(state));
  player.connect(); t.mock.timers.tick(7999);
  assert.equal(states.at(-1), "loading");
  t.mock.timers.tick(1); assert.equal(states.at(-1), "error");
  player.dispose();
  const vimeo = createVideoController("vimeo", 90, () => {}, state => states.push(state));
  vimeo.connect(); vimeo.receive({ event: "ready" }); await Promise.resolve();
  t.mock.timers.tick(8000); assert.equal(states.at(-1), "error");
  vimeo.receive({ event: "error", data: { method: "play" } });
  assert.equal(states.at(-1), "blocked");
  vimeo.dispose();
});

test("messages require the exact provider origin AND current frame window", async () => {
  const { trustedVideoMessage } = await import("../src/lib/video-controller.ts");
  const frame = {};
  const data = { event: "onReady" };
  assert.deepEqual(trustedVideoMessage({ origin: "https://www.youtube-nocookie.com", source: frame, data: JSON.stringify(data) }, frame, "youtube"), data);
  assert.deepEqual(trustedVideoMessage({ origin: "https://player.vimeo.com", source: frame, data }, frame, "vimeo"), data);
  for (const event of [
    { origin: "https://www.youtube.com", source: frame, data },
    { origin: "https://www.youtube-nocookie.com.evil.test", source: frame, data },
    { origin: "https://www.youtube-nocookie.com", source: {}, data },
    { origin: "null", source: frame, data },
    { origin: "https://www.youtube-nocookie.com", source: frame, data: "bad json" },
    { origin: "https://www.youtube-nocookie.com", source: frame, data: null },
    { origin: "https://www.youtube-nocookie.com", source: frame, data: [] },
  ]) assert.equal(trustedVideoMessage(event, frame, "youtube"), null);
});

for (const kind of ["youtube", "vimeo", "file"] as const) test(`${kind}: seeks only confirm within one second`, async () => {
  for (const offset of [-1.01, -1, -0.9, 0.9, 1, 1.01, 1.49, NaN, Infinity]) {
    const states: VideoState[] = [];
    const player = createVideoController(kind, 90, () => {}, state => states.push(state));
    player.request(90, true); player.ready(); await Promise.resolve();
    player.receive(kind === "youtube" ? { event: "infoDelivery", info: { currentTime: 90 + offset } } : { event: "seeked", data: { seconds: 90 + offset } });
    assert.equal(states.includes("seeked"), Number.isFinite(offset) && Math.abs(offset) <= 1, String(offset));
    player.dispose();
  }
});

test("YouTube infoDelivery preserves already-playing state through readiness and repeated seeks", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const states: VideoState[] = [];
  const player = createVideoController("youtube", 30, () => {}, state => states.push(state));
  player.request(30, true);
  // State arrives before the queued initial seek; there is no new play event.
  player.receive({ event: "infoDelivery", info: { playerState: 1, currentTime: 0 } });
  player.receive({ event: "onReady" });
  await Promise.resolve();
  player.receive({ event: "infoDelivery", info: { currentTime: 30 } });
  t.mock.timers.tick(1800);
  assert.equal(states.at(-1), "seeked");
  player.request(90, true); await Promise.resolve();
  player.receive({ event: "infoDelivery", info: { currentTime: 90 } });
  t.mock.timers.tick(1800);
  assert.equal(states.at(-1), "seeked");
  assert.equal(states.includes("blocked"), false);
  // A genuinely paused player must still expose the press-play fallback.
  player.receive({ event: "infoDelivery", info: { playerState: 2 } });
  player.request(120, true); await Promise.resolve();
  player.receive({ event: "infoDelivery", info: { currentTime: 120 } });
  t.mock.timers.tick(1800);
  assert.equal(states.at(-1), "blocked");
  player.dispose();
});

/** Fake cross-origin iframe: the handshake/commands use the real wire format,
 * and all replies go through the same source/origin guard as VideoPlayer. */
function youtubeFrame(onSend: (message: PlayerMessage, reply: (message: PlayerMessage) => void) => void = () => {}) {
  const sent: PlayerMessage[] = [];
  const states: { state: VideoState; time: number }[] = [];
  const origin = "https://www.youtube-nocookie.com";
  const iframe = { contentWindow: { postMessage(data: string, targetOrigin: string) {
    assert.equal(targetOrigin, origin);
    const message = JSON.parse(data);
    sent.push(message);
    onSend(message, reply);
  } } };
  const player = createVideoController("youtube", 0, message => iframe.contentWindow.postMessage(JSON.stringify(message), origin),
    (state, time) => states.push({ state, time }));
  function reply(data: PlayerMessage) {
    const message = trustedVideoMessage({ source: iframe.contentWindow, origin, data: JSON.stringify(data) }, iframe.contentWindow, "youtube");
    if (message) player.receive(message);
  }
  return { player, reply, sent, states, seeks: () => sent.filter(message => message.func === "seekTo") };
}

for (const ackEvent of ["infoDelivery", "initialDelivery"]) test(`YouTube fake iframe: early ${ackEvent} at zero and autoplay block wait for late onReady and position`, async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const f = youtubeFrame();
  t.after(() => f.player.dispose());
  f.player.connect(); f.player.request(90, true);
  t.mock.timers.tick(250);
  assert.equal(f.sent.filter(message => message.event === "listening").length, 2);
  f.reply({ event: ackEvent, info: { currentTime: 0, playerState: -1, apiInterface: ["seekTo", "playVideo"] } });
  f.reply({ event: "onAutoplayBlocked" });
  await Promise.resolve();
  t.mock.timers.tick(1000);
  f.player.connect(); // iframe onLoad after the first delivery must not restart listening
  assert.equal(f.sent.filter(message => message.event === "listening").length, 2);
  assert.equal(f.seeks().length, 0, `${ackEvent} acknowledges listening, not API readiness`);
  assert.equal(f.states.at(-1)?.state, "loading");
  f.reply({ event: "onReady" }); await Promise.resolve();
  assert.deepEqual(f.seeks().map(message => message.args), [[90, true]]);
  f.reply({ event: "infoDelivery", info: { currentTime: 0, playerState: 2 } });
  f.reply({ event: "onAutoplayBlocked" });
  assert.equal(f.states.at(-1)?.state, "ready", "autoplay rejection cannot claim a completed seek");
  t.mock.timers.tick(1999);
  assert.equal(f.states.some(({ state }) => state === "blocked" || state === "seeked" || state === "error"), false);
  f.reply({ event: "infoDelivery", info: { currentTime: 90, playerState: 2 } });
  assert.deepEqual(f.states.at(-1), { state: "seeked", time: 90 });
  t.mock.timers.tick(1800);
  assert.deepEqual(f.states.at(-1), { state: "blocked", time: 90 });
  t.mock.timers.tick(8000);
  assert.equal(f.states.some(({ state }) => state === "error"), false);
});

test("YouTube fake iframe: listening repeats across lost messages until a delayed ack, then stops", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  let hellos = 0;
  const f = youtubeFrame((message, reply) => {
    if (message.event === "listening" && ++hellos === 4) reply({ event: "initialDelivery" });
  });
  t.after(() => f.player.dispose());
  f.player.connect(); f.player.request(90, true);
  t.mock.timers.tick(749); await Promise.resolve();
  assert.equal(hellos, 3); assert.equal(f.seeks().length, 0);
  t.mock.timers.tick(1); await Promise.resolve();
  assert.equal(hellos, 4); assert.equal(f.seeks().length, 0);
  f.reply({ event: "onReady" }); await Promise.resolve();
  assert.equal(f.seeks().length, 1);
  f.reply({ event: "infoDelivery", info: { currentTime: 89.5, playerState: 1 } });
  t.mock.timers.tick(9000);
  assert.equal(hellos, 4);
  assert.equal(f.states.at(-1)?.state, "seeked");
});

for (const recovers of [true, false]) test(`YouTube fake iframe: dropped seek retries once, then ${recovers ? "confirms" : "falls back"}`, async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const f = youtubeFrame();
  t.after(() => f.player.dispose());
  f.player.connect(); f.player.request(90, true);
  f.reply({ event: "onReady" }); await Promise.resolve();
  f.reply({ event: "infoDelivery", info: { currentTime: 0, playerState: 2 } });
  f.reply({ event: "onAutoplayBlocked" });
  t.mock.timers.tick(1999); assert.equal(f.seeks().length, 1);
  t.mock.timers.tick(1); assert.equal(f.seeks().length, 2);
  if (recovers) f.reply({ event: "infoDelivery", info: { currentTime: 90, playerState: 1 } });
  t.mock.timers.tick(1999);
  assert.equal(f.states.some(({ state }) => state === "error"), false);
  t.mock.timers.tick(1);
  assert.equal(f.states.at(-1)?.state, recovers ? "seeked" : "error");
  if (!recovers) {
    f.reply({ event: "infoDelivery", info: { currentTime: 90, playerState: 1 } });
    f.player.request(120, true); await Promise.resolve();
  }
  t.mock.timers.tick(9000);
  assert.equal(f.seeks().length, 2);
  assert.equal(f.states.at(-1)?.state, recovers ? "seeked" : "error", "late replies cannot resurrect a failed player");
  assert.equal(f.states.some(({ state }) => state === "blocked"), false);
});

test("YouTube fake iframe: buffering is not blocked, unknown state waits, and a new request invalidates old confirmation", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const f = youtubeFrame();
  t.after(() => f.player.dispose());
  f.player.connect(); f.player.request(90, true);
  f.reply({ event: "onReady" }); await Promise.resolve();
  f.reply({ event: "infoDelivery", info: { currentTime: 90 } });
  f.reply({ event: "onAutoplayBlocked" });
  t.mock.timers.tick(1800);
  assert.equal(f.states.at(-1)?.state, "seeked", "unknown playerState cannot imply blocked");
  f.reply({ event: "onStateChange", info: 2 });
  t.mock.timers.tick(1000);
  f.reply({ event: "onStateChange", info: 3 });
  f.reply({ event: "onAutoplayBlocked" });
  t.mock.timers.tick(1800);
  assert.equal(f.states.at(-1)?.state, "seeked", "buffering cancels the paused fallback timer");
  f.player.request(120, true);
  f.reply({ event: "infoDelivery", info: { currentTime: 120, playerState: 2 } });
  await Promise.resolve();
  assert.equal(f.states.at(-1)?.state, "ready", "pre-command delivery cannot confirm the new seek");
  t.mock.timers.tick(2000);
  assert.deepEqual(f.seeks().map(message => message.args), [[90, true], [120, true], [120, true]]);
  f.reply({ event: "infoDelivery", info: { currentTime: 119, playerState: 3 } });
  t.mock.timers.tick(1800);
  assert.equal(f.states.at(-1)?.state, "seeked");
  f.reply({ event: "onStateChange", info: 2 });
  t.mock.timers.tick(1800);
  assert.deepEqual(f.states.at(-1), { state: "blocked", time: 120 });
});

for (const signal of ["getPaused", "playProgress", "timeupdate"]) test(`Vimeo ${signal} confirms already-playing playback without a new play event`, async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const sent: PlayerMessage[] = [];
  const states: VideoState[] = [];
  const player = createVideoController("vimeo", 90, message => sent.push(message), state => states.push(state));
  player.request(90, true); player.ready(); await Promise.resolve();
  assert.ok(sent.some(message => message.method === "getPaused"));
  player.receive({ method: "setCurrentTime", value: 90 });
  // Even if the paused fallback has appeared, a current state reply repairs it.
  t.mock.timers.tick(1800);
  assert.equal(states.at(-1), "blocked");
  player.receive(signal === "getPaused" ? { method: "getPaused", value: false } : { event: signal, data: { seconds: 90 } });
  t.mock.timers.tick(1800);
  assert.equal(states.at(-1), "seeked");
  player.request(120, true); await Promise.resolve();
  player.receive({ method: "setCurrentTime", value: 120 });
  t.mock.timers.tick(1800);
  assert.equal(states.at(-1), "seeked");
  player.receive({ method: "getPaused", value: true });
  player.request(150, true); await Promise.resolve();
  player.receive({ method: "setCurrentTime", value: 150 });
  t.mock.timers.tick(1800);
  assert.equal(states.at(-1), "blocked");
  player.dispose();
});
