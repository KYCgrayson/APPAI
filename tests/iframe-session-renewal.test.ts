import test from "node:test";
import assert from "node:assert/strict";
import { createIframeSessionRenewal } from "../src/templates/sections/iframe-session-renewal.ts";

test("one frame coalesces simultaneous triggers and waits 30 seconds between attempts", async () => {
  let now = 1000;
  let calls = 0;
  let finish!: () => void;
  const renew = createIframeSessionRenewal(() => {
    calls++;
    return new Promise<void>(resolve => { finish = resolve; });
  }, () => now);
  const first = renew();
  const second = renew();
  assert.equal(calls, 1);
  assert.equal(first, second);
  finish();
  await first;
  now += 29_999;
  await renew();
  assert.equal(calls, 1);
  now++;
  const third = renew();
  assert.equal(calls, 2);
  finish();
  await third;
});

test("authentication changes bypass the delay and changes during a request get a fresh grant", async () => {
  let calls = 0;
  let finish!: () => void;
  const renew = createIframeSessionRenewal(async () => {
    calls++;
    if (calls === 1) await new Promise<void>(resolve => { finish = resolve; });
  }, () => 1000);
  const first = renew();
  void renew(true);
  void renew(true);
  assert.equal(calls, 1);
  finish();
  await first;
  assert.equal(calls, 2);
  await renew(true);
  assert.equal(calls, 3);
  await renew();
  assert.equal(calls, 3);
});

test("failed requests are throttled too and frames have independent queues", async () => {
  let now = 0;
  let calls = 0;
  const fail = createIframeSessionRenewal(async () => { calls++; throw new Error("offline"); }, () => now);
  await assert.rejects(fail(), /offline/);
  await fail();
  assert.equal(calls, 1);
  now = 30_000;
  await assert.rejects(fail(), /offline/);
  const another = createIframeSessionRenewal(async () => { calls++; }, () => now);
  await another();
  assert.equal(calls, 3);
});
