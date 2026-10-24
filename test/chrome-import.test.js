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

// ---- 壁纸定义一致性 ----
// chrome.js（色板）与 newtab.html（渲染）各有一份壁纸定义，
// 若两者漂移，切换壁纸后新标签页会显示错误颜色。这里做静态校验。
console.log('\nwallpaper definitions');

const fs = require('fs');
const chromeSrc = fs.readFileSync(path.join(__dirname, '../desktop/renderer/chrome.js'), 'utf8');
const newtabSrc = fs.readFileSync(path.join(__dirname, '../desktop/renderer/newtab.html'), 'utf8');

function wallIds(src) {
  const out = new Set();
  // 格式 A（chrome.js）：{ id: 'aurora', css: 'linear-gradient(...)' }
  const reA = /id:\s*'([a-z]+)'/g;
  let m;
  while ((m = reA.exec(src))) out.add(m[1]);
  // 格式 B（newtab.html）：aurora: 'linear-gradient(...)' / 'center/cover...'
  // 只匹配紧跟渐变/背景值的键，避免把 chrome.js 的 css: 也算成一个壁纸 id
  const reB = /(?:^|[\s{,])([a-z]+):\s*'(?:linear-gradient\(|center\/)/gm;
  while ((m = reB.exec(src))) out.add(m[1]);
  out.delete('css'); // chrome.js 里的字段名，不是壁纸 id
  return out;
}

test('chrome.js and newtab.html define the same wallpaper ids', () => {
  const a = wallIds(chromeSrc);
  const b = wallIds(newtabSrc);
  assert.ok(a.size >= 8, `chrome.js should define >= 8 wallpapers, got ${a.size}`);
  for (const id of a) {
    assert.ok(b.has(id), `newtab.html is missing wallpaper "${id}"`);
  }
  for (const id of b) {
    assert.ok(a.has(id), `chrome.js is missing wallpaper "${id}"`);
  }
});

test('newtab reads wallpaper via IPC (not only localStorage)', () => {
  assert.ok(
    newtabSrc.includes('breeze.state.get') || newtabSrc.includes("breeze.state?.get"),
    'newtab.html must fetch wallpaper through the preload IPC bridge'
  );
  assert.ok(
    newtabSrc.includes('wallpaper:apply'),
    'newtab.html must listen for wallpaper:apply to repaint live'
  );
});

console.log(`\n${passed} passed`);
