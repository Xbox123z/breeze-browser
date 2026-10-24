// Breeze 浏览器外壳逻辑：标签、导航、菜单、壁纸设置。
const $ = (s) => document.querySelector(s);
const tabsEl = $('#tabs');
const omni = $('#omnibox');
const menu = $('#menu');
const toast = (msg) => {
  const t = $('#toast');
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', 2600);
};

let tabs = [];
let state = { wallpaper: 'aurora', bookmarks: [] };

/* ---------- 标签渲染 ---------- */
function renderTabs() {
  tabsEl.innerHTML = '';
  for (const t of tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (t.active ? ' active' : '');
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = t.title || 'New Tab';
    const x = document.createElement('button');
    x.className = 'x'; x.textContent = '✕';
    x.onclick = (e) => { e.stopPropagation(); breeze.tab.close(t.id); };
    el.onclick = () => breeze.tab.activate(t.id);
    el.append(title, x);
    tabsEl.appendChild(el);
  }
  if (tabs.length === 0) tabsEl.innerHTML = '<div style="color:var(--muted);padding:8px">No tabs</div>';
}

/* ---------- 事件 ---------- */
$('#newtab-btn').onclick = () => breeze.tab.new();
$('#back').onclick = () => breeze.nav.back();
$('#fwd').onclick = () => breeze.nav.fwd();
$('#reload').onclick = () => breeze.nav.reload();
$('#min').onclick = () => breeze.win.min();
$('#max').onclick = () => breeze.win.max();
$('#cls').onclick = () => breeze.win.close();
$('#menu-btn').onclick = () => menu.classList.toggle('open');
document.addEventListener('click', (e) => {
  if (!menu.contains(e.target) && e.target.id !== 'menu-btn') menu.classList.remove('open');
});

omni.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && omni.value.trim()) {
    breeze.nav.go(omni.value.trim());
    omni.blur();
  }
});

$('#star').onclick = async () => {
  const active = tabs.find(t => t.active);
  if (!active || !/^https?:/.test(active.url)) return toast('当前页不可收藏');
  const starred = state.bookmarks.some(b => b.url === active.url);
  if (starred) { state = await breeze.bookmarks.remove(active.url); $('#star').textContent = '☆'; toast('已取消收藏'); }
  else { state = await breeze.bookmarks.add({ title: active.title, url: active.url }); $('#star').textContent = '★'; toast('已收藏'); }
};

$('#mi-import').onclick = async () => {
  menu.classList.remove('open');
  toast('正在从 Chrome 导入…');
  const r = await breeze.chrome.import();
  state = await breeze.state.get();
  toast(`导入完成：书签 ${r.bookmarks} 条，历史 ${r.history} 条`);
};

$('#mi-import-passwords').onclick = async () => {
  menu.classList.remove('open');
  const r = await breeze.chrome.importPasswords();
  state = await breeze.state.get();
  toast(`导入 ${r.count} 条密码`);
};

$('#mi-passwords').onclick = () => { menu.classList.remove('open'); showPasswords(); };

$('#mi-bookmarks').onclick = () => { menu.classList.remove('open'); showBookmarks(); };
$('#mi-custom-wall').onclick = async () => {
  menu.classList.remove('open');
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async () => {
    const f = input.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      state = await breeze.state.set({ customWallpaper: reader.result, wallpaper: 'custom' });
      renderWallSwatches();
      toast('壁纸已更新（新标签页生效）');
    };
    reader.readAsDataURL(f);
  };
  input.click();
};

/* ---------- 书签管理（极简覆盖层） ---------- */
function showBookmarks() {
  const old = $('#bm-overlay'); if (old) old.remove();
  const ov = document.createElement('div');
  ov.id = 'bm-overlay';
  ov.style.cssText = 'position:absolute;inset:96px 0 0;background:rgba(10,12,16,.96);z-index:30;overflow:auto;padding:24px';
  const list = state.bookmarks.map(b =>
    `<div style="padding:8px 12px;border-radius:8px;display:flex;gap:12px;align-items:center" class="bm-row">
       <a href="#" data-url="${encodeURIComponent(b.url)}" style="color:var(--accent);text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(b.title || b.url)}</a>
       <button data-del="${encodeURIComponent(b.url)}" style="background:none;border:none;color:var(--muted);cursor:pointer">✕</button>
     </div>`).join('') || '<div style="color:var(--muted)">还没有书签 — 点击工具栏 ☆ 收藏，或从 Chrome 导入。</div>';
  ov.innerHTML = `<h2 style="margin-bottom:12px">书签 <button id="bm-close" style="float:right;background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px">✕</button></h2>${list}`;
  document.body.appendChild(ov);
  ov.querySelector('#bm-close').onclick = () => ov.remove();
  ov.querySelectorAll('a[data-url]').forEach(a => a.onclick = (e) => {
    e.preventDefault(); breeze.nav.go(decodeURIComponent(a.dataset.url)); ov.remove();
  });
  ov.querySelectorAll('button[data-del]').forEach(b => b.onclick = async () => {
    state = await breeze.bookmarks.remove(decodeURIComponent(b.dataset.del)); ov.remove(); showBookmarks();
  });
}
function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ---------- 密码管理（默认遮蔽，点击显示） ---------- */
function showPasswords() {
  const old = $('#pw-overlay'); if (old) old.remove();
  const list = state.passwords || [];
  const ov = document.createElement('div');
  ov.id = 'pw-overlay';
  ov.style.cssText = 'position:absolute;inset:96px 0 0;background:rgba(10,12,16,.96);z-index:30;overflow:auto;padding:24px';
  const rows = list.map((p, i) =>
    `<div style="padding:8px 12px;border-radius:8px;display:flex;gap:12px;align-items:center">
       <span style="flex:0 0 180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.name || p.url)}</span>
       <span style="flex:0 0 200px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.username)}</span>
       <button data-i="${i}" style="flex:1;max-width:220px;background:#0c0f14;border:none;color:var(--text);padding:6px 10px;border-radius:6px;cursor:pointer;text-align:left">••••••••</button>
       <button data-copy="${i}" style="background:none;border:none;color:var(--muted);cursor:pointer">复制</button>
     </div>`).join('')
    || `<div style="color:var(--muted)">还没有密码 — 从 Chrome 导出 CSV 后点菜单「导入 Chrome 密码 (CSV)」。<br><br>
         Chrome → 设置 → 密码管理器 → 已保存的密码 → 三点菜单 → 导出密码</div>`;
  ov.innerHTML = `<h2 style="margin-bottom:12px">密码 <button id="pw-close" style="float:right;background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px">✕</button></h2>${rows}`;
  document.body.appendChild(ov);
  ov.querySelector('#pw-close').onclick = () => ov.remove();
  ov.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => {
    const i = +b.dataset.i;
    b.textContent = b.textContent === '••••••••' ? list[i].password : '••••••••';
  });
  ov.querySelectorAll('button[data-copy]').forEach(b => b.onclick = () => {
    const i = +b.dataset.copy;
    navigator.clipboard?.writeText(list[i].password);
    toast('已复制密码');
  });
}

/* ---------- 壁纸 ---------- */
const WALLPAPERS = [
  { id: 'aurora', css: 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)' },
  { id: 'dusk', css: 'linear-gradient(135deg,#41295a,#2F0743)' },
  { id: 'forest', css: 'linear-gradient(135deg,#134e5e,#71b280)' },
  { id: 'sand', css: 'linear-gradient(135deg,#3e5151,#decba4)' },
  { id: 'mono', css: 'linear-gradient(135deg,#141e30,#243b55)' },
  { id: 'rose', css: 'linear-gradient(135deg,#642b73,#c6426e)' },
  { id: 'ocean', css: 'linear-gradient(135deg,#1a2980,#26d0ce)' },
  { id: 'paper', css: 'linear-gradient(135deg,#ece9e6,#ffffff)' },
];
function renderWallSwatches() {
  const box = $('#wallpapers');
  box.innerHTML = '';
  const mk = (id, css) => {
    const d = document.createElement('div');
    d.className = 'swatch' + (state.wallpaper === id ? ' sel' : '');
    d.style.background = css;
    d.title = id;
    d.onclick = async () => { state = await breeze.state.set({ wallpaper: id }); renderWallSwatches(); toast('壁纸已切换（新标签页生效）'); };
    box.appendChild(d);
  };
  WALLPAPERS.forEach(w => mk(w.id, w.css));
  if (state.customWallpaper) mk('custom', `center/cover url(${state.customWallpaper})`);
}

/* ---------- 主进程推送 ---------- */
breeze.on('tabs', (t) => { tabs = t; renderTabs(); });
breeze.on('nav', ({ url, canBack, canFwd }) => {
  if (document.activeElement !== omni) omni.value = url === 'breeze://newtab' ? '' : url;
  $('#back').disabled = !canBack;
  $('#fwd').disabled = !canFwd;
  const active = tabs.find(t => t.active);
  $('#star').textContent = active && state.bookmarks.some(b => b.url === active.url) ? '★' : '☆';
});
breeze.on('state', (s) => { state = s; renderWallSwatches(); });

(async () => { state = await breeze.state.get(); renderWallSwatches(); })();
