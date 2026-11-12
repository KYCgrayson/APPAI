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
  let awaitingPosition = false;
  let playing = false;
  let youtubeState: number | undefined;
  let acknowledged = false;
  let connected = false;
  let failed = false;
  let seekAttempt = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let blocked: ReturnType<typeof setTimeout> | undefined;
  let handshake: ReturnType<typeof setInterval> | undefined;
  function state(value: VideoState) { if (!disposed) report(value, desired); }
  function fail() {
    failed = true; awaitingPosition = false; confirmed = false;
    clearTimeout(timeout); clearTimeout(blocked); clearInterval(handshake);
    state("error");
  }
  function armTimeout() { clearTimeout(timeout); timeout = setTimeout(fail, 8000); }
  function youtubeBlocked() {
    // Autoplay rejection is not a seek acknowledgement. Buffering is progress,
    // and an unknown state must not be mistaken for a paused player.
    if (!ready || !confirmed || youtubeState === undefined || playing || blocked !== undefined) return;
    blocked = setTimeout(() => {
      blocked = undefined;
      if (ready && confirmed && !playing && youtubeState !== undefined) state("blocked");
    }, wantsPlay ? 1800 : 0);
  }
  function seekYouTube() {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (confirmed || disposed) return;
      if (seekAttempt++ === 0) seekYouTube();
      else fail();
    }, 2000);
    send({ event: "command", func: "seekTo", args: [desired, true] });
    if (wantsPlay) send({ event: "command", func: "playVideo", args: [] });
  }
  function confirm(t: unknown) {
    if (!ready || !awaitingPosition || typeof t !== "number" || !Number.isFinite(t) || Math.abs(t - desired) > 1 || confirmed) return;
    confirmed = true;
    clearTimeout(timeout);
    state("seeked");
    if (kind === "youtube") youtubeBlocked();
    else if (wantsPlay && !playing) blocked = setTimeout(() => state("blocked"), 1800);
    else if (!playing) state("blocked"); // navigation may intentionally leave the player paused
  }
  function didPlay() { playing = true; clearTimeout(blocked); blocked = undefined; if (confirmed) state("seeked"); }
  function apply() {
    if (disposed || !ready || kind === "youtube" && failed) return;
    confirmed = false;
    awaitingPosition = true;
    if (kind === "file") playing = false;
    clearTimeout(blocked); blocked = undefined;
    state("ready");
    if (kind === "youtube") {
      seekAttempt = 0;
      seekYouTube();
    } else {
      armTimeout();
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
      if (disposed || kind === "youtube" && failed) return;
      desired = t; wantsPlay = play;
      confirmed = false; awaitingPosition = false;
      clearTimeout(blocked); blocked = undefined;
      if (ready) clearTimeout(timeout);
      if (ready) schedule();
    },
    connect() {
      if (ready || disposed || connected) return;
      connected = true;
      state("loading"); armTimeout();
      if (kind === "file" || acknowledged) return;
      const hello = () => send(kind === "youtube" ? { event: "listening", id: "appai-video", channel: "widget" } : { method: "ping" });
      clearInterval(handshake); handshake = setInterval(hello, 250); hello();
    },
    ready: markReady,
    receive(message: PlayerMessage) {
      if (disposed || kind === "youtube" && failed) return;
      const info = message.info as { currentTime?: unknown; playerState?: unknown } | undefined;
      if (kind === "youtube") {
        if (typeof message.event === "string") {
          acknowledged = true; clearInterval(handshake);
        }
        // Delivery messages acknowledge listening and carry API data, not
        // readiness. Only onReady may flush queued commands; never iframe load.
        if (message.event === "onReady") markReady();
        if (message.event === "onError") { fail(); return; }
        const playerState = message.event === "onStateChange" ? message.info : info?.playerState;
        if (typeof playerState === "number") {
          youtubeState = playerState;
          if (playerState === 1 || playerState === 3) didPlay();
          else playing = false;
        }
        if (message.event === "infoDelivery") confirm(info?.currentTime);
        youtubeBlocked();
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
