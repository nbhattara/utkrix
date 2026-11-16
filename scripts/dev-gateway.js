// Dev gateway: serves all apps on port 5173, routed by Host header.
//   abc.localhost / localhost / 127.0.0.1  -> main site        (vite :5176)
//   login.*                                -> login app        (vite :5174)
//   employees.* / employee.*              -> employee portal  (vite :5175)
//   admin.*                                -> admin portal     (vite :5175 until a dedicated app exists)
//
// Each app keeps its own Vite dev server (HMR works through the proxy,
// including WebSockets). Start the app dev servers first, then run:
//   node scripts/dev-gateway.js
import http from 'node:http';
import httpProxy from 'http-proxy';

const GATEWAY_PORT = Number(process.env.GATEWAY_PORT) || 5173;

const BACKENDS = {
  main: 5177,
  login: 5174,
  portal: 5175,
};

const proxies = new Map();
const proxyFor = (port) => {
  if (!proxies.has(port)) {
    proxies.set(port, httpProxy.createProxyServer({
      target: `http://localhost:${port}`,
      changeOrigin: false, // preserve Host so Vite allowedHosts sees the real subdomain
      ws: true,
    }));
    proxies.get(port).on('error', (err, req, res) => {
      const socket = res?.socket;
      if (socket && !socket.destroyed) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(`Dev gateway: backend on :${port} is not running.\n${err.message}`);
      }
    });
  }
  return proxies.get(port);
};

const routeFor = (host = '') => {
  const name = host.split(':')[0].toLowerCase();
  if (name.startsWith('login.')) return 'login';
  if (name.startsWith('employees.') || name.startsWith('employee.')) return 'portal';
  if (name.startsWith('admin.')) return 'portal';
  return 'main';
};

const server = http.createServer((req, res) => {
  const key = routeFor(req.headers.host);
  proxyFor(BACKENDS[key]).web(req, res);
});

server.on('upgrade', (req, socket, head) => {
  const key = routeFor(req.headers.host);
  proxyFor(BACKENDS[key]).ws(req, socket, head);
});

server.listen(GATEWAY_PORT, () => {
  console.log(`Dev gateway listening on http://localhost:${GATEWAY_PORT}`);
  console.log('  main site   -> :5177 (abc.localhost, localhost)');
  console.log('  login app   -> :5174 (login.*)');
  console.log('  portal app  -> :5175 (employees.*, employee.*, admin.*)');
});
