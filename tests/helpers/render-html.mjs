import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'node:stream';

export function renderHtml(element) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const output = new PassThrough();
    output.on('data', chunk => chunks.push(chunk.toString()));
    output.on('end', () => resolve(chunks.join('')));
    output.on('error', reject);
    const rendering = renderToPipeableStream(element, {
      onAllReady() { rendering.pipe(output); },
      onError: reject,
      onShellError: reject,
    });
  });
}
