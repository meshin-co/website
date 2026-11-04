import dns from 'node:dns';

const suffix = process.env.DNS_LAPSE_SUFFIX ?? '';
const resolving = new Map(
  (process.env.DNS_LAPSE_RESOLVE ?? '')
    .split(',')
    .filter((pair) => pair !== '')
    .map((pair) => pair.split('='))
);
const realLookup = dns.lookup;

const isUnderSuffix = (hostname) => suffix !== '' && typeof hostname === 'string' && hostname.endsWith(suffix);

const notFound = (hostname) =>
  Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), {
    errno: -3008,
    code: 'ENOTFOUND',
    syscall: 'getaddrinfo',
    hostname,
  });

dns.lookup = function lookup(hostname, options, callback) {
  const resolvesTo = resolving.get(hostname);
  if (resolvesTo === undefined && !isUnderSuffix(hostname)) return realLookup.call(this, hostname, options, callback);
  const [settings, done] = typeof options === 'function' ? [{}, options] : [options ?? {}, callback];
  if (resolvesTo === undefined) return process.nextTick(done, notFound(hostname));
  const answer = { address: resolvesTo, family: resolvesTo.includes(':') ? 6 : 4 };
  return process.nextTick(() => (settings.all ? done(null, [answer]) : done(null, answer.address, answer.family)));
};
