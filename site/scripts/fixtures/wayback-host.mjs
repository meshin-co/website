import { PAGE } from './wayback-fakes.mjs';
import { availabilityFor } from './wayback-recorded.mjs';
import { startHost } from './http-host.mjs';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n');

const send = (res, status, type, body) => {
  res.writeHead(status, { 'content-type': type, 'content-length': Buffer.byteLength(body) });
  res.end(body);
};

export async function startArchive({ empty = false, capture = 'page', unavailable = false } = {}) {
  const host = await startHost((req, res) => {
    const url = new URL(req.url, 'http://fake.invalid');
    if (unavailable) return send(res, 503, 'text/plain', 'down');
    if (url.pathname === '/available') {
      const answer = availabilityFor({
        address: url.searchParams.get('url'),
        timestamp: url.searchParams.get('timestamp'),
        empty,
      });
      return send(res, 200, 'application/json', JSON.stringify(answer));
    }
    if (url.pathname.startsWith('/web/')) {
      if (capture === 'gone') return send(res, 404, 'text/plain', 'not found');
      if (capture === 'pdf') return send(res, 200, 'application/pdf', PDF);
      return send(res, 200, 'text/html; charset=utf-8', PAGE);
    }
    return send(res, 404, 'text/plain', 'not found');
  });
  return {
    origin: host.origin,
    environment: {
      WAYBACK_AVAILABILITY_URL: `${host.origin}/available`,
      WAYBACK_PLAYBACK_ORIGIN: host.origin,
    },
    requests: host.requests,
    availability: () => host.requests.filter(({ url }) => url.startsWith('/available')),
    playback: () => host.requests.filter(({ url }) => url.startsWith('/web/')),
    close: host.close,
  };
}
