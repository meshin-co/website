const LOOPBACK = new Set(['127.0.0.1', '127.0.0.2', '[::1]', '::1', 'localhost']);
const realFetch = globalThis.fetch;

globalThis.fetch = (input, init) => {
  const { hostname } = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!LOOPBACK.has(hostname)) throw new Error(`the job under test may reach loopback hosts only, not ${hostname}`);
  return realFetch(input, init);
};
