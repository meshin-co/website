export const timedOut = () => new DOMException('The operation was aborted due to timeout', 'TimeoutError');

export const unreachable = (code) => new TypeError('fetch failed', { cause: Object.assign(new Error(code), { code }) });

export const notFound = (host = 'lapsed.example') =>
  new TypeError('fetch failed', {
    cause: Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), {
      errno: -3008,
      code: 'ENOTFOUND',
      syscall: 'getaddrinfo',
      hostname: host,
    }),
  });

export const notFoundWithoutAName = () =>
  new TypeError('fetch failed', { cause: Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }) });

export function scripted(...steps) {
  const calls = [];
  const fetch = async (address, init) => {
    calls.push({ address, ...init });
    const step = steps[Math.min(calls.length - 1, steps.length - 1)];
    if (step instanceof Error || step instanceof DOMException) throw step;
    const { status, headers = {} } = typeof step === 'number' ? { status: step } : step;
    return new Response(status === 200 ? 'body' : null, { status, headers });
  };
  fetch.calls = calls;
  return fetch;
}

export const waits = () => {
  const slept = [];
  const sleep = async (ms) => void slept.push(ms);
  sleep.slept = slept;
  return sleep;
};
