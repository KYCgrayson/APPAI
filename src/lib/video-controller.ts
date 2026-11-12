export type VideoState = "loading" | "ready" | "seeked" | "blocked" | "error";
export type PlayerMessage = Record<string, unknown>;

/** Treat all window messages as untrusted, including other embeds on the page. */
export function trustedVideoMessage(event: { origin: string; source: unknown; data: unknown }, source: unknown, kind: "youtube" | "vimeo" | "file"): PlayerMessage | null {
  const origin = kind === "youtube" ? "https://www.youtube-nocookie.com" : "https://player.vimeo.com";
  if (kind === "file" || !source || event.source !== source || event.origin !== origin) return null;
  let value = event.data;
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return null; } }
  return value && typeof value === "object" && !Array.isArray(value) ? value as PlayerMessage : null;
}

/** Small SDK-free state machine. Only receive messages after source/origin checks. */
export function createVideoController(kind: "youtube" | "vimeo" | "file", initial: number, send: (message: PlayerMessage) => void, report: (state: VideoState, t: number) => void) {
  let desired = initial;
  let wantsPlay = false;
  let ready = false;
  let disposed = false;
  let queued = false;
  let confirmed = false;
  let playing = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let blocked: ReturnType<typeof setTimeout> | undefined;
  let handshake: ReturnType<typeof setInterval> | undefined;
  function state(value: VideoState) { if (!disposed) report(value, desired); }
  function armTimeout() { clearTimeout(timeout); timeout = setTimeout(() => { clearInterval(handshake); state("error"); }, 8000); }
  function confirm(t: unknown) {
    if (!ready || typeof t !== "number" || !Number.isFinite(t) || Math.abs(t - desired) > 1 || confirmed) return;
    confirmed = true;
    clearTimeout(timeout);
    state("seeked");
    if (wantsPlay && !playing) blocked = setTimeout(() => state("blocked"), 1800);
    else if (!playing) state("blocked"); // navigation may intentionally leave the player paused
  }
  function didPlay() { playing = true; clearTimeout(blocked); if (confirmed) state("seeked"); }
  function apply() {
    if (disposed || !ready) return;
    confirmed = false;
    if (kind === "file") playing = false;
    clearTimeout(blocked);
    armTimeout();
    state("ready");
    if (kind === "youtube") {
      send({ event: "command", func: "seekTo", args: [desired, true] });
      if (wantsPlay) send({ event: "command", func: "playVideo", args: [] });
    } else {
      send({ method: "setCurrentTime", value: desired });
      if (wantsPlay) send({ method: "play" });
      if (kind === "vimeo") send({ method: "getPaused" });
    }
  }
  function schedule() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; apply(); });
  }
  function markReady() {
    if (ready || disposed) return;
    ready = true; clearInterval(handshake);
    if (kind === "youtube") for (const event of ["onStateChange", "onError", "onAutoplayBlocked"]) send({ event: "command", func: "addEventListener", args: [event] });
    if (kind === "vimeo") for (const value of ["play", "pause", "ended", "playProgress", "timeupdate", "seeked", "error"]) send({ method: "addEventListener", value });
    schedule();
  }
  return {
    request(t: number, play: boolean) {
      desired = t; wantsPlay = play;
      clearTimeout(blocked);
      if (ready) schedule();
    },
    connect() {
      if (ready || disposed) return;
      state("loading"); armTimeout();
      if (kind === "file") return;
      const hello = () => send(kind === "youtube" ? { event: "listening", id: "appai-video", channel: "widget" } : { method: "ping" });
      hello(); clearInterval(handshake); handshake = setInterval(hello, 250);
    },
    ready: markReady,
    receive(message: PlayerMessage) {
      if (disposed) return;
      const info = message.info as { currentTime?: unknown; playerState?: unknown } | undefined;
      if (kind === "youtube") {
        if (message.event === "onReady" || message.event === "initialDelivery" || message.event === "infoDelivery") markReady();
        if (message.event === "onError") { clearTimeout(timeout); state("error"); }
        if (message.event === "onAutoplayBlocked") { clearTimeout(blocked); state("blocked"); }
        const playerState = message.event === "onStateChange" ? message.info : info?.playerState;
        if (playerState === 1) didPlay();
        else if (typeof playerState === "number") playing = false;
        if (message.event === "infoDelivery") confirm(info?.currentTime);
      } else {
        if (message.event === "ready" || message.method === "ping") markReady();
        if (message.event === "play" || message.method === "play") didPlay();
        if (kind === "vimeo") {
          if (message.method === "getPaused" && message.value === false || message.event === "playProgress" || message.event === "timeupdate") didPlay();
          if (message.method === "getPaused" && message.value === true || message.event === "pause" || message.event === "ended") playing = false;
        }
        if (message.method === "setCurrentTime") confirm(message.value);
        if (message.event === "seeked" || message.event === "timeupdate" || message.event === "playProgress") confirm((message.data as { seconds?: unknown } | undefined)?.seconds);
        if (message.event === "error") {
          const method = (message.data as { method?: string } | undefined)?.method;
          clearTimeout(blocked);
          if (method === "play") state("blocked");
          else { clearTimeout(timeout); state("error"); }
        }
      }
    },
    dispose() { disposed = true; clearTimeout(timeout); clearTimeout(blocked); clearInterval(handshake); },
  };
}
