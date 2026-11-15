// Lớp bảo vệ: integration test không bao giờ được chạy ghi / xoá trên database thật.
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertSafeTarget, describeUri } = require('../integration/harness');

test('chấp nhận MongoDB local với database lumea_test*', () => {
  assert.equal(assertSafeTarget('mongodb://127.0.0.1:27018/lumea_test').db, 'lumea_test');
  assert.equal(assertSafeTarget('mongodb://localhost:27017/lumea_test_ci?retryWrites=true').db, 'lumea_test_ci');
});

test('từ chối database không phải lumea_test* (kể cả deco3d đang dùng chung)', () => {
  assert.throws(() => assertSafeTarget('mongodb://127.0.0.1:27017/deco3d'), /lumea_test/);
  assert.throws(() => assertSafeTarget('mongodb://127.0.0.1:27017/lumea_demo'), /lumea_test/);
  assert.throws(() => assertSafeTarget('mongodb://127.0.0.1:27017/'), /lumea_test/);
});

test('từ chối host từ xa (Atlas) nếu chưa khai báo TEST_DB_ALLOWED_HOSTS', () => {
  const uri = 'mongodb+srv://user:secret@cluster0.abcde.mongodb.net/lumea_test';
  const prev = process.env.TEST_DB_ALLOWED_HOSTS;
  delete process.env.TEST_DB_ALLOWED_HOSTS;
  try {
    assert.throws(() => assertSafeTarget(uri), /không nằm trong danh sách cho phép/);
    process.env.TEST_DB_ALLOWED_HOSTS = 'cluster0.abcde.mongodb.net';
    assert.equal(assertSafeTarget(uri).db, 'lumea_test');
  } finally {
    if (prev === undefined) delete process.env.TEST_DB_ALLOWED_HOSTS; else process.env.TEST_DB_ALLOWED_HOSTS = prev;
  }
});

test('thông báo lỗi không lộ mật khẩu trong URI', () => {
  try {
    assertSafeTarget('mongodb://admin:SuperSecret123@10.0.0.5:27017/lumea_test');
    assert.fail('phải từ chối');
  } catch (err) {
    assert.doesNotMatch(err.message, /SuperSecret123/);
  }
  assert.deepEqual(describeUri('mongodb://a:b@h1:1,h2:2/db').hosts, ['h1', 'h2']);
});
