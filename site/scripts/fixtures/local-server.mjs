import { createServer } from 'node:http';

export async function localServer(answer) {
  const requests = [];
  const server = createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      requests.push({ method: request.method, url: request.url, body: Buffer.concat(chunks).toString('utf8') });
      const seen = requests.filter(({ url }) => url === request.url).length;
      answer({ request, response, seen });
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    requests,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  };
}

export async function closedOrigin() {
  const server = await localServer(() => {});
  const { origin } = server;
  await server.close();
  return origin;
}

export const reply = (response, status, headers = {}, body = '') => {
  response.writeHead(status, headers);
  response.end(body);
};
