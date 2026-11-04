import { ATTEMPT_TIMEOUT_MS, probeUserAgent } from './link-probe.mjs';
import { readResponseText } from './response-text.mjs';

export const LIVE_PAGE_MAX_BYTES = 2 * 1024 * 1024;

const TIMEOUT_NAMES = new Set(['TimeoutError', 'AbortError']);

const isText = (contentType) => contentType.startsWith('text/') || contentType === 'application/xhtml+xml';
const unreadable = (reason) => ({ kind: 'unreadable', reason });

const describeFailure = (error) =>
  TIMEOUT_NAMES.has(error?.name) ? 'timed out' : (error?.cause?.code ?? error?.code ?? error?.message ?? String(error));

async function unchecked(response, contentType) {
  await response.body?.cancel().catch(() => {});
  const what = contentType === '' ? 'declares no content type' : `is ${contentType}`;
  return {
    kind: 'unchecked',
    contentType,
    reason: `the page ${what}, which the machine cannot read; a person must judge it`,
  };
}

export async function readLivePage({
  address,
  fetch = globalThis.fetch,
  maxBytes = LIVE_PAGE_MAX_BYTES,
  timeoutMs = ATTEMPT_TIMEOUT_MS,
  userAgent = probeUserAgent(),
}) {
  try {
    const response = await fetch(address, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': userAgent },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return unreadable(`the address answered HTTP ${response.status} when it was read`);
    }
    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!isText(contentType)) return await unchecked(response, contentType);
    return { kind: 'page', contentType, text: await readResponseText(response, maxBytes) };
  } catch (error) {
    return unreadable(`the address could not be read: ${describeFailure(error)}`);
  }
}
