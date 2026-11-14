import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Uses an existing Chrome installation; never downloads a browser or package.
export async function hostedChromeBrowser(binary) {
  const profile = await mkdtemp(join(tmpdir(), 'appai-hosted-chrome-'));
  const chrome = spawn(binary, ['--headless=new', '--remote-debugging-pipe', '--no-first-run',
    '--no-default-browser-check', '--disable-background-networking', '--disable-extensions',
    `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  let sequence = 0;
  let buffer = '';
  let stderr = '';
  const pending = new Map();
  chrome.stderr.on('data', chunk => { stderr += chunk; });
  const fail = error => {
    for (const request of pending.values()) { clearTimeout(request.timeout); request.reject(error); }
    pending.clear();
  };
  chrome.on('error', fail);
  chrome.on('exit', code => fail(new Error(`Chrome exited ${code}: ${stderr.slice(-1000)}`)));
  chrome.stdio[4].on('data', chunk => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf('\0')) >= 0) {
      const raw = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      if (!raw) continue;
      const message = JSON.parse(raw);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      clearTimeout(request.timeout);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    }
  });
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Chrome timeout: ${method}`)); }, 15000);
      pending.set(id, { resolve, reject, timeout });
      chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
    });
  }
  let sessionId;
  try {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    ({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }));
  } catch (error) {
    chrome.kill();
    await rm(profile, { recursive: true, force: true, maxRetries: 3 });
    throw error;
  }
  return {
    send: (method, params) => send(method, params, sessionId),
    async evaluate(expression) {
      const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
      return response.result.value;
    },
    async close() {
      try { await send('Browser.close'); } finally {
        chrome.kill();
        await rm(profile, { recursive: true, force: true, maxRetries: 3 });
      }
    },
  };
}
