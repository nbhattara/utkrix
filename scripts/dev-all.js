// Starts the full UtkriX stack: backend API, three Vite frontends, and the
// subdomain dev gateway. Usage: npm run start
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const services = [
  {
    name: 'backend',
    cwd: path.join(root, 'elearning-master-backend'),
    cmd: process.execPath,
    args: ['server.js'],
    env: (() => { const e = { ...process.env }; delete e.JWT_SECRET; return e; })(),
  },
  { name: 'website', cwd: root, cmd: 'npm', args: ['run', 'dev'] },
  { name: 'login', cwd: path.join(root, 'login-frontend'), cmd: 'npm', args: ['run', 'dev'] },
  { name: 'portal', cwd: path.join(root, 'utkrix-tech'), cmd: 'npm', args: ['run', 'dev'] },
  { name: 'gateway', cwd: root, cmd: process.execPath, args: ['scripts/dev-gateway.js'] },
];

const children = [];
const prefix = (name, stream) => {
  let buf = '';
  stream.on('data', (chunk) => {
    buf += chunk;
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (line.trim()) console.log(`[${name}] ${line}`);
    }
  });
};

for (const svc of services) {
  const isWin = process.platform === 'win32';
  const child = spawn(isWin ? 'cmd' : svc.cmd, isWin ? ['/c', svc.cmd, ...svc.args] : svc.args, {
    cwd: svc.cwd,
    env: svc.env || process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  prefix(svc.name, child.stdout);
  prefix(svc.name, child.stderr);
  child.on('exit', (code) => {
    console.log(`[${svc.name}] exited with code ${code}`);
    shutdown(code ?? 1);
  });
  children.push(child);
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try { child.kill('SIGTERM'); } catch {}
  }
  setTimeout(() => process.exit(code), 500).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('UtkriX stack starting...');
console.log('  website : http://localhost:5173 (gateway) / :5177 (direct)');
console.log('  login   : http://localhost:5174');
console.log('  portal  : http://localhost:5175');
console.log('  api     : http://localhost:5000');
console.log('Press Ctrl+C to stop all services.');
