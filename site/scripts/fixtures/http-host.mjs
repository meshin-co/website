import http from 'node:http';

const LOOPBACKS = ['::1', '127.0.0.2'];
const UNAVAILABLE = new Set(['EADDRNOTAVAIL', 'EAFNOSUPPORT']);

const listenOn = (host, handler) =>
  new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.once('error', reject);
    server.listen(0, host, () => resolve(server));
  });

export async function startHost(respond) {
  const requests = [];
  const handler = (req, res) => {
    const nth = requests.filter((seen) => seen.method === req.method && seen.url === req.url).length + 1;
    requests.push({ method: req.method, url: req.url, headers: req.headers });
    respond(req, res, nth);
  };

  for (const loopback of LOOPBACKS) {
    try {
      const server = await listenOn(loopback, handler);
      const shown = loopback.includes(':') ? `[${loopback}]` : loopback;
      const count = (method) => requests.filter((seen) => seen.method === method).length;
      return {
        origin: `http://${shown}:${server.address().port}`,
        requests,
        count,
        close: () => new Promise((resolve) => server.close(resolve)),
      };
    } catch (error) {
      if (!UNAVAILABLE.has(error.code)) throw error;
    }
  }
  throw new Error('no loopback address other than localhost and 127.0.0.1 can be bound on this machine');
}
