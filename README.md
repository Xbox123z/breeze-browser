# Breeze Browser 🍃

> 基于 Chromium 的极简浏览器 —— Windows / macOS / Android。
> 保留 Chrome 的核心能力，去掉一切多余：更简洁的排版、可切换壁纸风格、一键导入 Chrome 数据。

## 特性

- 🪟 **桌面端**（Electron + Chromium）：Windows / macOS 单一代码库
- 🤖 **Android 端**（Kotlin + WebView）：轻量原生壳
- 📥 **Chrome 数据导入**：自动发现 Chrome profile，导入书签 + 历史
- 🔑 **密码导入**：导入 Chrome **导出**的密码 CSV（见下方说明），带遮蔽/复制的管理面板
- 🔒 **密码加密存储**：用 Electron `safeStorage`（Windows DPAPI / macOS Keychain / Linux libsecret）加密后落盘
- 🎨 **壁纸风格**：8 种内置渐变 + 自定义图片，新标签页实时生效
- ✂️ **极简 UI**：无边框窗口、隐藏系统菜单、只保留 地址栏 + 4 个按钮
- 🔖 **书签管理**：收藏 / 导入 / 管理
- 🔒 **隐私默认**：拒绝所有权限请求、禁用弹窗

## 结构

```
breeze-browser/
├── package.json            # Electron 桌面端
├── desktop/
│   ├── main/
│   │   ├── main.js         # 主进程：窗口/标签/IPC/状态
│   │   ├── preload.js      # 安全桥（contextIsolation）
│   │   └── chrome-import.js# Chrome 书签/历史导入
│   └── renderer/
│       ├── chrome.html     # 浏览器外壳 UI（标签栏+工具栏）
│       ├── chrome.js       # 外壳逻辑
│       └── newtab.html     # 新标签页（时钟+搜索+磁贴+壁纸）
└── android/                # Android Studio 项目
    └── app/src/main/java/com/breeze/browser/MainActivity.kt
```

## 桌面端（Windows / macOS）

```bash
npm install
npm start            # 开发运行
npm run pack:win     # 打包 Windows (NSIS)
npm run pack:mac     # 打包 macOS (DMG)
```

首次运行后点击菜单 **“从 Chrome 导入书签/历史…”** 即可。

> 历史导入需要可选依赖 `npm i -D better-sqlite3`（书签导入不需要）。

### 密码导入说明

Chrome 本地的 `Login Data` 里密码是加密的（Windows: DPAPI / App-Bound Encryption；macOS: Keychain），
第三方应用**无法**可靠解密。所以 Breeze 支持的是 Chrome **导出**的 CSV：

```
Chrome → 设置 → 密码管理器 → 已保存的密码 → 三点菜单 → 导出密码
```

然后在 Breeze 菜单里选 **「导入 Chrome 密码 (CSV)…」**。密码默认以 `••••••••` 遮蔽，
点击查看或复制。

**存储安全**：密码会用 Electron `safeStorage` 加密后写入 `userData/breeze-state.json`
（Windows: DPAPI，macOS: Keychain，Linux: libsecret —— 均与系统登录凭据绑定）。

若当前系统不支持加密（例如某些 Linux 桌面无 libsecret），会退化为**明文**存储，
并在密码管理面板顶部显示黄色警告。此时请勿导入真实账号。

## Android 端

用 Android Studio 打开 `android/` 目录，同步 Gradle 后直接运行。

支持：
- 接收系统“用浏览器打开”的链接
- 书签 / 壁纸切换 / 数据清除
- 从 Chrome 导出的 `bookmarks.html` 导入（放到 Downloads 目录）

### Android 发布签名

CI 构建的是 `assembleRelease`。若要产出**正式签名** APK，在仓库 Settings → Secrets 配置：

| Secret | 说明 |
|---|---|
| `BREEZE_KEYSTORE_BASE64` | keystore 文件的 base64：`base64 -w0 breeze.keystore` |
| `BREEZE_KEYSTORE_PASSWORD` | keystore 密码 |
| `BREEZE_KEY_ALIAS` | key alias |
| `BREEZE_KEY_PASSWORD` | key 密码 |

未配置时自动退化为 debug 签名，**构建不会失败**。

生成 keystore：

```bash
keytool -genkey -v -keystore breeze.keystore -alias breeze \
  -keyalg RSA -keysize 2048 -validity 10000
```

## 设计原则

| Chrome 有的 | Breeze 的处理 |
|---|---|
| 地址栏 + 搜索 | ✅ 保留（omnibox） |
| 多标签 | ✅ 保留 |
| 书签 | ✅ 保留 + 导入 |
| 历史 | ✅ 导入，界面不展示（简化） |
| 扩展商店 | ❌ 去掉 |
| 同步账号 | ❌ 去掉（本地 JSON） |
| 阅读清单/侧边栏 | ❌ 去掉 |
| 设置页 | ❌ 去掉（菜单内 4 项） |
| 新标签页 | ✅ 极简重写：时钟 + 搜索 + 磁贴 + 壁纸 |

## License

MIT
