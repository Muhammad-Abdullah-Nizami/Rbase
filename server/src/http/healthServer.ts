import { createServer, type Server } from 'node:http';

/**
 * A bare HTTP server exposing a health endpoint. Render (and any uptime check)
 * pings this; the WebSocket gateway also attaches to it so both share one port.
 */
export function createHealthServer(): Server {
  return createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });
}
