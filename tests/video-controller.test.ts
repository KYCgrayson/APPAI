import test from "node:test";
import assert from "node:assert/strict";
import { createVideoController, type VideoState, type PlayerMessage } from "../src/lib/video-controller.ts";

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
  player.receive(kind === "youtube" ? { event: "infoDelivery", info: { currentTime: 30 } } : { method: "setCurrentTime", value: 30 });
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
