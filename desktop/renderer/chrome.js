// Breeze 浏览器外壳逻辑：标签管理、导航操控、安全存储面板、实时壁纸广播
const $ = (s) => document.querySelector(s);
const tabsEl = $('#tabs');
const omni = $('#omnibox');
const menu = $('#menu');
const starBtn = $('#star');

const toast = (msg) => {
  const t = $('#toast');
  t.innerHTML = `<span>${escapeHtml(msg)}</span>`;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.remove('show');
  }, 2800);
};

let tabs = [];
let state = {
  wallpaper: 'aurora',
  customWallpaper: null,
  bookmarks: [],
  passwords: [],
  home: 'breeze://newtab',
  encryptionAvailable: true
};

const DEFAULT_PAGE_ICON = `<svg class="favicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;

/* ---------- 标签渲染 ---------- */
function renderTabs() {
  tabsEl.innerHTML = '';
  for (const t of tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (t.active ? ' active' : '');
    
    const iconWrap = document.createElement('span');
    iconWrap.innerHTML = DEFAULT_PAGE_ICON;

    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = t.title || '新标签页';

    const x = document.createElement('button');
    x.className = 'x';
    x.title = '关闭标签页';
    x.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    x.onclick = (e) => {
      e.stopPropagation();
      breeze.tab.close(t.id);
    };

    el.onclick = () => breeze.tab.activate(t.id);
    el.append(iconWrap.firstElementChild, title, x);
    tabsEl.appendChild(el);
  }
}

/* ---------- 交互事件 ---------- */
$('#newtab-btn').onclick = () => breeze.tab.new();
$('#back').onclick = () => breeze.nav.back();
$('#fwd').onclick = () => breeze.nav.fwd();
$('#reload').onclick = () => breeze.nav.reload();
$('#min').onclick = () => breeze.win.min();
$('#max').onclick = () => breeze.win.max();
$('#cls').onclick = () => breeze.win.close();

$('#menu-btn').onclick = (e) => {
  e.stopPropagation();
  menu.classList.toggle('open');
};
document.addEventListener('click', (e) => {
  if (!menu.contains(e.target)) menu.classList.remove('open');
});

omni.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const val = omni.value.trim();
    if (val) {
      breeze.nav.go(val);
      omni.blur();
    }
  }
});

function updateStarIcon(isStarred) {
  if (isStarred) {
    starBtn.classList.add('active-star');
    starBtn.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
  } else {
    starBtn.classList.remove('active-star');
    starBtn.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
  }
}

starBtn.onclick = async () => {
  const active = tabs.find(t => t.active);
  if (!active || !/^https?:/.test(active.url)) return toast('当前页面不支持添加到收藏夹');
  const bms = state.bookmarks || [];
  const starred = bms.some(b => b.url === active.url);
  if (starred) {
    state = await breeze.bookmarks.remove(active.url);
    updateStarIcon(false);
    toast('已从收藏夹移除');
  } else {
    state = await breeze.bookmarks.add({ title: active.title || active.url, url: active.url });
    updateStarIcon(true);
    toast('已添加到收藏夹');
  }
};

$('#mi-import').onclick = async () => {
  menu.classList.remove('open');
  toast('正在扫描并导入 Chrome 书签与历史记录…');
  try {
    const r = await breeze.chrome.import();
    state = await breeze.state.get();
    toast(`导入成功：书签 ${r.bookmarks} 条，历史记录 ${r.history} 条`);
  } catch (err) {
    toast('导入遇到问题：' + err.message);
  }
};

$('#mi-import-passwords').onclick = async () => {
  menu.classList.remove('open');
  try {
    const r = await breeze.chrome.importPasswords();
    if (r.note === 'cancelled') return;
    state = await breeze.state.get();
    toast(r.encrypted
      ? `已安全导入 ${r.count} 条密码（已开启系统级保险箱加密）`
      : `已导入 ${r.count} 条密码（当前环境为明文存储模式）`);
  } catch (err) {
    toast('密码导入失败：' + err.message);
  }
};

$('#mi-bookmarks').onclick = () => { menu.classList.remove('open'); showBookmarks(); };
$('#mi-passwords').onclick = () => { menu.classList.remove('open'); showPasswords(); };

$('#mi-custom-wall').onclick = async () => {
  menu.classList.remove('open');
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const f = input.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      state = await breeze.state.set({ customWallpaper: reader.result, wallpaper: 'custom' });
      renderWallSwatches();
      breeze.wallpaper?.changed?.();
      toast('自定义壁纸设置完成，所有新标签页已同步');
    };
    reader.readAsDataURL(f);
  };
  input.click();
};

/* ---------- 模态弹窗：书签管理 ---------- */
function showBookmarks() {
  const old = $('#bm-overlay');
  if (old) old.remove();

  const ov = document.createElement('div');
  ov.id = 'bm-overlay';
  ov.className = 'modal-overlay';

  const bms = state.bookmarks || [];
  const listHtml = bms.length > 0 ? bms.map(b =>
    `<div class="list-row">
       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" style="flex-shrink:0"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
       <a class="item-link" href="#" data-url="${encodeURIComponent(b.url)}">${escapeHtml(b.title || b.url)}</a>
       <button class="action-btn del-btn" data-del="${encodeURIComponent(b.url)}" title="移除此书签">删除</button>
     </div>`).join('')
    : '<div class="empty-state">收藏夹空空如也<br><span style="font-size:12px;opacity:0.7">在浏览网页时点击地址栏右侧的 ☆ 即可加入收藏</span></div>';

  ov.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          书签与收藏夹 (${bms.length})
        </h2>
        <button class="close-btn" id="bm-close">✕</button>
      </div>
      <div class="modal-body">${listHtml}</div>
    </div>`;

  document.body.appendChild(ov);

  ov.querySelector('#bm-close').onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };

  ov.querySelectorAll('a[data-url]').forEach(a => {
    a.onclick = (e) => {
      e.preventDefault();
      breeze.nav.go(decodeURIComponent(a.dataset.url));
      ov.remove();
    };
  });

  ov.querySelectorAll('button[data-del]').forEach(b => {
    b.onclick = async () => {
      state = await breeze.bookmarks.remove(decodeURIComponent(b.dataset.del));
      ov.remove();
      showBookmarks();
    };
  });
}

/* ---------- 模态弹窗：密码保险箱 ---------- */
function showPasswords() {
  const old = $('#pw-overlay');
  if (old) old.remove();

  const list = state.passwords || [];
  const ov = document.createElement('div');
  ov.id = 'pw-overlay';
  ov.className = 'modal-overlay';

  const rows = list.length > 0 ? list.map((p, i) =>
    `<div class="list-row">
       <span style="flex:0 0 160px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.name || p.url)}</span>
       <span style="flex:0 0 180px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.username || '—')}</span>
       <button class="reveal-btn" data-i="${i}" title="点击显隐明文">••••••••</button>
       <button class="action-btn" data-copy="${i}">复制密码</button>
     </div>`).join('')
    : `<div class="empty-state">尚未导入密码<br><span style="font-size:12px;opacity:0.7">支持从 Chrome「设置 → 密码管理器 → 导出密码」导入 CSV 文件</span></div>`;

  const securityBanner = state.encryptionAvailable !== false
    ? `<div class="security-alert safe">
         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
         已启用平台原生安全隔离保护 (Windows DPAPI / macOS Keychain)
       </div>`
    : `<div class="security-alert warning">
         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
         警告：当前运行环境未检测到系统密钥库，密码处于简易保护模式
       </div>`;

  ov.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          本地密码保险箱 (${list.length})
        </h2>
        <button class="close-btn" id="pw-close">✕</button>
      </div>
      <div class="modal-body">
        ${securityBanner}
        ${rows}
      </div>
    </div>`;

  document.body.appendChild(ov);

  ov.querySelector('#pw-close').onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };

  ov.querySelectorAll('button.reveal-btn').forEach(b => {
    b.onclick = () => {
      const i = +b.dataset.i;
      const shown = b.dataset.shown === '1';
      b.textContent = shown ? '••••••••' : (list[i].password || '');
      b.dataset.shown = shown ? '0' : '1';
    };
  });

  ov.querySelectorAll('button[data-copy]').forEach(b => {
    b.onclick = () => {
      const i = +b.dataset.copy;
      navigator.clipboard?.writeText(list[i].password || '');
      toast('密码已成功复制到剪贴板');
    };
  });
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ---------- 壁纸主题 ---------- */
const WALLPAPERS = [
  { id: 'aurora', css: 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)' },
  { id: 'dusk',   css: 'linear-gradient(135deg,#41295a,#2F0743)' },
  { id: 'forest', css: 'linear-gradient(135deg,#134e5e,#71b280)' },
  { id: 'sand',   css: 'linear-gradient(135deg,#3e5151,#decba4)' },
  { id: 'mono',   css: 'linear-gradient(135deg,#141e30,#243b55)' },
  { id: 'rose',   css: 'linear-gradient(135deg,#642b73,#c6426e)' },
  { id: 'ocean',  css: 'linear-gradient(135deg,#1a2980,#26d0ce)' },
  { id: 'paper',  css: 'linear-gradient(135deg,#ece9e6,#ffffff)' },
];

function renderWallSwatches() {
  const box = $('#wallpapers');
  box.innerHTML = '';
  const mk = (id, css) => {
    const d = document.createElement('div');
    d.className = 'swatch' + (state.wallpaper === id ? ' sel' : '');
    d.style.background = css;
    d.title = id;
    d.onclick = async () => {
      state = await breeze.state.set({ wallpaper: id });
      renderWallSwatches();
      breeze.wallpaper?.changed?.();
      toast('壁纸风格已切换');
    };
    box.appendChild(d);
  };

  WALLPAPERS.forEach(w => mk(w.id, w.css));
  if (state.customWallpaper) {
    mk('custom', `center/cover no-repeat url("${state.customWallpaper}")`);
  }
}

/* ---------- IPC 数据通道 ---------- */
breeze.on('tabs', (t) => {
  tabs = t;
  renderTabs();
});

breeze.on('nav', ({ url, canBack, canFwd }) => {
  if (document.activeElement !== omni) {
    omni.value = url === 'breeze://newtab' ? '' : url;
  }
  $('#back').disabled = !canBack;
  $('#fwd').disabled = !canFwd;
  const active = tabs.find(t => t.active);
  const bms = state.bookmarks || [];
  updateStarIcon(active && bms.some(b => b.url === active.url));
});

breeze.on('state', (s) => {
  state = s;
  renderWallSwatches();
});

// 初始化启动
(async () => {
  try {
    state = await breeze.state.get();
  } catch (e) {
    // 保持优雅的默认配置
  }
  renderWallSwatches();
})();
