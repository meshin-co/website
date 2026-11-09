import { appendFileSync } from 'node:fs';
import net from 'node:net';

net.Socket.prototype.connect = () => {
  throw new Error('the runner test allows no network connection');
};

const { replies = {}, fallback = { status: 200, body: { d: [] } } } = JSON.parse(process.env.STUB_SCRIPT);
const asked = new Map();
const realSetTimeout = globalThis.setTimeout;

const log = (entry) => appendFileSync(process.env.STUB_LOG, `${JSON.stringify(entry)}\n`);

globalThis.setTimeout = (callback, milliseconds, ...rest) => {
  log({ waited: milliseconds });
  return realSetTimeout(callback, 0, ...rest);
};

function replyTo(phrase) {
  const queue = replies[phrase] ?? [fallback];
  const at = asked.get(phrase) ?? 0;
  asked.set(phrase, at + 1);
  return queue[Math.min(at, queue.length - 1)];
}

globalThis.fetch = async (url, init = {}) => {
  const phrase = new URL(String(url)).searchParams.get('q');
  log({ url: String(url), phrase, signalled: init.signal instanceof AbortSignal });
  const { status, body, failure } = replyTo(phrase);
  if (failure !== undefined) throw new TypeError(failure);
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
};
