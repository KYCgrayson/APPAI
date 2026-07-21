export async function checkManagedRuntimeHealth(url: string, expected: { appId: string; version: string; healthPath?: string }, fetcher: typeof fetch = fetch) {
  const target = new URL(url); if (target.protocol !== "https:" || target.username || target.password) throw new Error("INVALID_HEALTH_URL");
  const healthPath = expected.healthPath || "/api/health";
  if (!healthPath.startsWith("/") || healthPath.startsWith("//")) throw new Error("INVALID_HEALTH_PATH");
  const response = await fetcher(new URL(healthPath, target), { redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (response.status !== 200) throw new Error("HEALTH_FAILED");
  const body = await response.json() as { ok?: unknown; appId?: unknown; version?: unknown };
  if (body.ok !== true || body.appId !== expected.appId || body.version !== expected.version) throw new Error("HEALTH_CONTRACT_MISMATCH");
}

/** Bounded retry for a newly assigned custom-domain certificate/DNS edge. */
export async function checkManagedRuntimeHealthWithRetry(
  url: string,
  expected: { appId: string; version: string; healthPath?: string },
  options: { attempts?: number; delayMs?: number; fetcher?: typeof fetch; wait?: (ms: number) => Promise<void> } = {},
) {
  const attempts = options.attempts ?? 12;
  const wait = options.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await checkManagedRuntimeHealth(url, expected, options.fetcher);
      return;
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) await wait(options.delayMs ?? 2_000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("HEALTH_FAILED");
}
