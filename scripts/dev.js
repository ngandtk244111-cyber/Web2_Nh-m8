// `npm run dev` — chạy cùng lúc backend (server/, cổng 4300) và giao diện my-client (cổng 4200).
// Tự cài thư viện cho server nếu chưa có, và tự tạo server/.env từ .env.example nếu chưa có.
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const serverDir = path.join(root, 'server');
const envFile = path.join(serverDir, '.env');
const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';

if (!fs.existsSync(path.join(serverDir, 'node_modules'))) {
  console.log('[dev] Cài thư viện cho server (lần đầu)...');
  const r = spawnSync(npm, ['install'], { cwd: serverDir, stdio: 'inherit', shell: isWin });
  if (r.status !== 0) process.exit(r.status || 1);
}

if (!fs.existsSync(envFile)) {
  fs.copyFileSync(path.join(serverDir, '.env.example'), envFile);
  console.log('[dev] Đã tạo server/.env từ .env.example.');
}

const geminiKey = (fs.readFileSync(envFile, 'utf8').match(/^GEMINI_API_KEY=(.*)$/m) || [])[1];
if (!geminiKey || !geminiKey.trim()) {
  console.warn('\n[dev] ⚠ GEMINI_API_KEY đang trống trong server/.env — chatbox AI sẽ không trả lời.');
  console.warn('[dev]   Lấy key miễn phí tại https://aistudio.google.com/apikey rồi dán vào server/.env, chạy lại `npm run dev`.\n');
}

const children = [
  spawn(npm, ['start'], { cwd: serverDir, stdio: 'inherit', shell: isWin }),
  spawn(npm, ['start'], { cwd: root, stdio: 'inherit', shell: isWin }),
];

// Một bên tắt (hoặc Ctrl+C) thì tắt luôn bên còn lại.
const stopAll = () => children.forEach((c) => !c.killed && c.kill());
children.forEach((c) => c.on('exit', stopAll));
process.on('SIGINT', () => { stopAll(); process.exit(0); });
