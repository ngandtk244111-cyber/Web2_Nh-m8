// Hạ tầng integration test: kiểm tra database đích AN TOÀN, xoá sạch DB test, seed tài khoản,
// khởi động server thật trên cổng riêng và gọi API bằng HTTP (fetch có sẵn trong Node).
//
// AN TOÀN DỮ LIỆU — test chỉ chạy khi TẤT CẢ điều kiện sau đúng:
//  1. URI lấy từ MONGODB_URI_TEST (mặc định: MongoDB Docker local mongodb://127.0.0.1:27018/lumea_test).
//  2. Tên database bắt đầu bằng "lumea_test".
//  3. Host thuộc danh sách cho phép: localhost / 127.0.0.1 / ::1, hoặc host khai báo trong TEST_DB_ALLOWED_HOSTS.
//  4. Không trùng host + database với MONGODB_URI trong server/.env, và database không phải "deco3d".
//  5. Database đang rỗng HOẶC đã có collection đánh dấu __lumea_test_marker (do harness tạo) — DB thật
//     có dữ liệu mà không có dấu này thì từ chối.
// Không in URI ra log (có thể chứa mật khẩu).

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

const SERVER_DIR = path.join(__dirname, '..', '..');
const DEFAULT_TEST_URI = 'mongodb://127.0.0.1:27018/lumea_test';
const MARKER = '__lumea_test_marker';
const FORBIDDEN_DBS = ['deco3d'];
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

/** Lấy danh sách host + tên database từ URI mongodb:// hoặc mongodb+srv:// (không in ra mật khẩu). */
function describeUri(uri) {
  const m = /^mongodb(\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/.exec(String(uri || ''));
  if (!m) throw new Error('MONGODB_URI_TEST không đúng định dạng mongodb://');
  const hosts = m[2].split(',').map(h => h.replace(/:\d+$/, '').toLowerCase());
  const hostPorts = m[2].toLowerCase().split(',').sort().join(',');
  return { srv: !!m[1], hosts, hostPorts, db: decodeURIComponent(m[3] || '') };
}

function assertSafeTarget(uri) {
  const target = describeUri(uri);
  if (!/^lumea_test/.test(target.db)) {
    throw new Error(`Từ chối chạy test: database test phải bắt đầu bằng "lumea_test" (đang là "${target.db || '(trống)'}")`);
  }
  if (FORBIDDEN_DBS.includes(target.db.toLowerCase())) throw new Error('Từ chối chạy test trên database đang dùng chung');
  const allowed = [...LOCAL_HOSTS, ...String(process.env.TEST_DB_ALLOWED_HOSTS || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean)];
  const bad = target.hosts.filter(h => !allowed.includes(h));
  if (bad.length) throw new Error(`Từ chối chạy test: host ${bad.join(', ')} không nằm trong danh sách cho phép (TEST_DB_ALLOWED_HOSTS)`);

  const envPath = path.join(SERVER_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const devUri = dotenv.parse(fs.readFileSync(envPath)).MONGODB_URI;
    if (devUri) {
      const dev = describeUri(devUri);
      if (dev.hostPorts === target.hostPorts && dev.db === target.db) {
        throw new Error('Từ chối chạy test: MONGODB_URI_TEST trùng database development trong server/.env');
      }
    }
  }
  return target;
}

/** Kết nối, kiểm tra dấu DB test, xoá sạch dữ liệu cũ của lần test trước. */
async function prepareDatabase(uri) {
  const target = assertSafeTarget(uri);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  if (db.databaseName !== target.db) throw new Error('Database sau khi kết nối không khớp database đã kiểm tra');
  const collections = (await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name);
  if (collections.length && !collections.includes(MARKER)) {
    throw new Error(`Từ chối chạy test: database "${target.db}" đã có dữ liệu nhưng không có dấu ${MARKER} — có thể không phải DB test`);
  }
  await db.dropDatabase();
  await db.collection(MARKER).insertOne({ createdAt: new Date(), note: 'Database dành riêng cho integration test của Luméa' });
  // Dựng index theo schema (unique quoteId, bankTxnRef...) trước khi test chạy song song.
  for (const name of ['Order', 'Quote', 'PaymentTransaction', 'Admin', 'User', 'CustomRequest', 'Product']) {
    await require(path.join(SERVER_DIR, 'models', name)).syncIndexes();
  }
  return target;
}

async function seedAccounts() {
  const Admin = require(path.join(SERVER_DIR, 'models', 'Admin'));
  const User = require(path.join(SERVER_DIR, 'models', 'User'));
  const password = await bcrypt.hash('Test@12345', 10);
  const admins = {
    super: { username: 't_super', fullName: 'Test Super', role: 'Super Admin' },
    manager: { username: 't_manager', fullName: 'Test Manager', role: 'Store Manager' },
    care: { username: 't_care', fullName: 'Test Care', role: 'Customer Care' },
    warehouse: { username: 't_warehouse', fullName: 'Test Warehouse', role: 'Warehouse Lead' },
  };
  for (const a of Object.values(admins)) await Admin.create({ ...a, password });
  const users = {
    alice: { fullName: 'Alice Test', phone: '0900000001', email: 'alice@test.local' },
    bob: { fullName: 'Bob Test', phone: '0900000002', email: 'bob@test.local' },
  };
  for (const u of Object.values(users)) await User.create({ ...u, password });
  return { admins, users, password: 'Test@12345' };
}

function startServer(uri, port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['index.js'], {
      cwd: SERVER_DIR,
      env: {
        ...process.env,
        MONGODB_URI: uri, // dotenv không ghi đè biến đã có -> server dùng DB test, không đọc DB trong .env
        PORT: String(port),
        NODE_ENV: 'test',
        ADMIN_TOKEN_SECRET: 'integration-test-secret',
        // Không gọi cổng thật: endpoint trỏ cổng đóng (lỗi ngay) -> đi nhánh trang thanh toán thử.
        // Khoá ký giả để test tự ký IPN / callback / URL quay về.
        PAYMENT_SANDBOX: 'true',
        MOMO_ENDPOINT: 'http://127.0.0.1:9/momo', MOMO_PARTNER_CODE: 'TESTPARTNER', MOMO_ACCESS_KEY: 'test-access', MOMO_SECRET_KEY: 'test-momo-secret',
        MOMO_REDIRECT_URL: 'http://localhost:4200/checkout-momo-return', MOMO_IPN_URL: 'http://127.0.0.1:9/ipn',
        ZALOPAY_ENDPOINT: 'http://127.0.0.1:9/zalopay', ZALOPAY_APP_ID: '2553', ZALOPAY_KEY1: 'test-zp-key1', ZALOPAY_KEY2: 'test-zp-key2',
        ZALOPAY_REDIRECT_URL: 'http://localhost:4200/checkout-zalopay-return',
        GEMINI_API_KEY: '',
        SMTP_USER: '',
        SMTP_PASS: '',
        BANK_CODE: '', BANK_NAME: '', BANK_ACCOUNT_NUMBER: '', BANK_ACCOUNT_NAME: '',
        ADMIN_DEFAULT_USERNAME: 't_super',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let log = '';
    const onData = (d) => {
      log += d.toString();
      if (log.includes('Failed to connect to MongoDB')) reject(new Error('Server không kết nối được DB test'));
      if (log.includes('MongoDB connected') && log.includes('listening')) resolve({ child, getLog: () => log });
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', code => reject(new Error(`Server thoát sớm (code ${code}):\n${log.slice(-2000)}`)));
    setTimeout(() => reject(new Error(`Server không khởi động sau 30s:\n${log.slice(-2000)}`)), 30000).unref();
  });
}

function apiClient(port) {
  const base = `http://127.0.0.1:${port}/api`;
  return async function api(method, url, { token, body } = {}) {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* không phải JSON */ }
    return { status: res.status, data };
  };
}

module.exports = { DEFAULT_TEST_URI, describeUri, assertSafeTarget, prepareDatabase, seedAccounts, startServer, apiClient, SERVER_DIR };
