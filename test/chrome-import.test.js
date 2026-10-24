// Breeze 桌面端单元测试（纯 Node，无需 Electron）
// 运行：node test/chrome-import.test.js
const assert = require('assert');
const path = require('path');
const { parsePasswordCsv } = require(path.join(__dirname, '../desktop/main/chrome-import.js'));

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    process.exitCode = 1;
  }
}

console.log('parsePasswordCsv');

test('parses header + rows (with BOM)', () => {
  const csv =
    '\uFEFFname,url,username,password,note\n' +
    'GitHub,https://github.com/login,xbox123z,secret123,\n';
  const r = parsePasswordCsv(csv);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].name, 'GitHub');
  assert.strictEqual(r[0].username, 'xbox123z');
  assert.strictEqual(r[0].password, 'secret123');
});

test('handles commas inside quoted fields', () => {
  const csv = 'name,url,username,password,note\n"G","https://g.com","u","p,ass",\n';
  const r = parsePasswordCsv(csv);
  assert.strictEqual(r[0].password, 'p,ass');
});

test('handles escaped double quotes ("")', () => {
  const csv = 'name,url,username,password,note\n"B","https://b.com","u","pa""ss""word",\n';
  const r = parsePasswordCsv(csv);
  assert.strictEqual(r[0].password, 'pa"ss"word');
});

test('handles newlines inside quoted fields', () => {
  const csv = 'name,url,username,password,note\n"M","https://m.com","u","line1\nline2",\n';
  const r = parsePasswordCsv(csv);
  assert.strictEqual(r[0].password, 'line1\nline2');
});

test('skips rows without a password', () => {
  const csv =
    'name,url,username,password,note\n' +
    'A,https://a.com,u1,realpass,\n' +
    'B,https://b.com,u2,,\n';
  const r = parsePasswordCsv(csv);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].name, 'A');
});

test('returns empty array for empty input', () => {
  assert.deepStrictEqual(parsePasswordCsv(''), []);
});

console.log(`\n${passed} passed`);
