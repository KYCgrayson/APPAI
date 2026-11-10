/** Coalesce all renewal triggers for one mounted frame. */
export function createIframeSessionRenewal(
  issue: () => Promise<void>,
  now: () => number = Date.now,
) {
  let lastAttempt = -Infinity;
  let pending: Promise<void> | null = null;
  let authChanged = false;
  return function renew(authenticationChanged = false): Promise<void> {
    authChanged ||= authenticationChanged;
    if (pending) return pending;
    if (!authChanged && now() - lastAttempt < 30_000) return Promise.resolve();
    authChanged = false;
    lastAttempt = now();
    pending = (async () => {
      try {
        await issue();
      } finally {
        pending = null;
        if (authChanged) await renew();
      }
    })();
    return pending;
  };
}
