// Chrome 数据导入：书签（JSON 直读）+ 历史（SQLite 只读拷贝）+ 密码（Chrome 导出的 CSV）。
//
// 关于密码：Chrome 的 "Login Data" 里密码是加密的
//   - Windows: DPAPI（新版为 App-Bound Encryption，绑定 Chrome 自身进程）
//   - macOS: Keychain
// 第三方应用无法可靠解密，因此这里只支持导入 Chrome **导出**的 CSV：
//   Chrome → 设置 → 密码管理器 → 已保存的密码 → 三点菜单 → 导出密码
// Windows:  %LOCALAPPDATA%\Google\Chrome\User Data\<Profile>\
// macOS:    ~/Library/Application Support/Google/Chrome/<Profile>/
const fs = require('fs');
const path = require('path');
const os = require('os');

function chromeUserDataDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local'), 'Google/Chrome/User Data');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/Google/Chrome');
  }
  return path.join(os.homedir(), '.config/google-chrome');
}

function findProfiles(base) {
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base)
    .filter(n => n === 'Default' || /^Profile \d+$/.test(n))
    .map(n => path.join(base, n));
}

/** 读取书签：Chrome 的 Bookmarks 是普通 JSON，直接解析。 */
function importBookmarks(profileDir) {
  const file = path.join(profileDir, 'Bookmarks');
  if (!fs.existsSync(file)) return [];
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (node.type === 'url') out.push({ title: node.name || node.url, url: node.url });
    (node.children || []).forEach(walk);
  };
  Object.values(data.roots || {}).forEach(walk);
  return out;
}

/**
 * 读取历史：History 是 SQLite。Chrome 运行时锁定文件，
 * 所以先拷贝到临时文件再查询。
 * 为保持零原生依赖，这里只在 better-sqlite3 可用时启用，
 * 否则返回说明性 note（书签导入不受影响）。
 */
function importHistory(profileDir) {
  const src = path.join(profileDir, 'History');
  if (!fs.existsSync(src)) return { history: [], note: 'no History file' };
  let Database;
  try { Database = require('better-sqlite3'); }
  catch { return { history: [], note: 'history import requires optional dep better-sqlite3 (npm i -D better-sqlite3)' }; }
  const tmp = path.join(os.tmpdir(), `breeze-history-${Date.now()}.db`);
  fs.copyFileSync(src, tmp);
  try {
    const db = new Database(tmp, { readonly: true, fileMustExist: true });
    const rows = db.prepare(
      'SELECT url, title, last_visit_time FROM urls ORDER BY last_visit_time DESC LIMIT 5000'
    ).all();
    db.close();
    return { history: rows, note: 'ok' };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/** 导入全部 profile：书签合并去重，历史取第一个 profile。 */
async function importChrome() {
  const base = chromeUserDataDir();
  const profiles = findProfiles(base);
  if (!profiles.length) {
    return { bookmarks: [], history: [], note: `Chrome not found at ${base}` };
  }
  const seen = new Set();
  const bookmarks = [];
  let history = [];
  let note = 'ok';
  for (const p of profiles) {
    for (const b of importBookmarks(p)) {
      if (!seen.has(b.url)) { seen.add(b.url); bookmarks.push(b); }
    }
    if (!history.length) {
      const h = importHistory(p);
      history = h.history;
      note = h.note;
    }
  }
  return { bookmarks, history, note };
}

/**
 * 解析 Chrome 导出的密码 CSV。
 * 表头（Chrome 会带一个 BOM）：name,url,username,password,note
 * 字段可能被引号包裹、含逗号/换行，这里做最小化但正确的 CSV 解析。
 */
function parsePasswordCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // 去 BOM
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }  // 转义引号
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  const out = [];
  if (!rows.length) return out;
  const header = rows[0].map(h => h.trim().toLowerCase());
  const idx = {
    name: header.indexOf('name'),
    url: header.indexOf('url'),
    user: header.indexOf('username'),
    pass: header.indexOf('password'),
  };
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 2) continue;
    const pass = idx.pass >= 0 ? r[idx.pass] : '';
    if (!pass) continue; // 没有密码的行跳过
    out.push({
      name: idx.name >= 0 ? r[idx.name] : '',
      url: idx.url >= 0 ? r[idx.url] : '',
      username: idx.user >= 0 ? r[idx.user] : '',
      password: pass,
    });
  }
  return out;
}

/** 导入 Chrome 导出的密码 CSV（由用户在文件选择对话框里指定文件）。 */
async function importPasswordsCsv(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { passwords: [], note: 'file not found' };
  }
  const text = fs.readFileSync(filePath, 'utf8');
  return { passwords: parsePasswordCsv(text), note: 'ok' };
}

module.exports = { importChrome, importPasswordsCsv, parsePasswordCsv };
