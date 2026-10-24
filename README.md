<div align="center">

# 🍃 Breeze Browser

**一款为你扫除一切冗余、回归纯粹阅读与探索的跨平台轻量浏览器**

[Windows](https://github.com/Xbox123z/breeze-browser/releases) • [macOS](https://github.com/Xbox123z/breeze-browser/releases) • [Android](https://github.com/Xbox123z/breeze-browser/releases)

[![Build & Test](https://github.com/Xbox123z/breeze-browser/actions/workflows/build.yml/badge.svg)](https://github.com/Xbox123z/breeze-browser/actions)
[![Release](https://img.shields.io/github/v/release/Xbox123z/breeze-browser?color=6366f1&logo=github)](https://github.com/Xbox123z/breeze-browser/releases)
[![Platform](https://img.shields.io/badge/Platforms-Windows%20%7C%20macOS%20%7C%20Android-brightgreen.svg)](https://github.com/Xbox123z/breeze-browser)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## 💡 为什么选择 Breeze？

现在的 Chrome 和 Edge 变得越来越臃肿：侧边栏推荐、强制资讯流、联想购物广告、繁杂的拓展弹窗与设置项。

**Breeze** 专为追求**清爽、私密、快速**的用户而生。它保留了 Chromium 现代渲染引擎的强悍兼容性，大刀阔斧削减了 90% 不必要的臃肿功能，并带来**精致的毛玻璃现代界面、平滑无缝的多壁纸切换，以及一键导入 Chrome 历史与加密凭据**。

---

## ✨ 核心亮点

- 🪟 **全平台统一美学**
  - **桌面端 (Windows / macOS)**：基于 Electron + Chromium 构建，采用现代无边框毛玻璃外壳，沉浸式标题栏。
  - **移动端 (Android)**：轻量原生 Kotlin + 极速 WebView，极低内存占用与闪电启动。
- 🎨 **可切换壁纸系统 (Live Repaint)**
  - 8 套经过严格调色的内置极光渐变风格（Aurora、Dusk、Forest、Ocean、Paper 等）。
  - 支持本地自定义壁纸图片。通过进程间广播，已开启的新标签页**无需刷新即可实时重绘变色**。
- 📥 **无缝 Chrome 数据迁移**
  - **书签与历史**：自动定位并扫描本地 Chrome 用户配置（Profiles），一键聚合去重。
  - **密码保险箱**：支持 Chrome 密码 CSV 导出文件导入，配合管理面板快速查看与一键复制。
- 🔒 **硬件级密钥保护 (Safe Storage)**
  - 密码绝不以明文落盘。通过 Electron `safeStorage` 接口，自动调用平台原生安全库（Windows DPAPI、macOS Keychain、Linux libsecret）加密入库。
- ✂️ **极简主义交互**
  - 仅保留核心：胶囊式 Omnibox 地址栏、前进/后退/刷新/收藏 4 个按钮。
  - 默认拦截第三方追踪与权限请求弹窗，告别恼人骚扰。

---

## 🖼️ 软件架构设计

```text
┌─────────────────────────────────────────────────────────────┐
│                       Breeze Browser                        │
├──────────────────────────────┬──────────────────────────────┤
│    Desktop (Win / macOS)     │      Mobile (Android)        │
│                              │                              │
│ ┌──────────────────────────┐ │ ┌──────────────────────────┐ │
│ │  Host Window (Frame: 0)  │ │ │  MainActivity (Kotlin)   │ │
│ │  • Modern Tabbar & Drag  │ │ │  • Immersive Top Omnibox │ │
│ │  • SVG Smooth Toolbar    │ │ │  • Bottom Quick Actions  │ │
│ └────────────┬─────────────┘ │ └────────────┬─────────────┘ │
│              │ IPC Bridge    │              │ Android API   │
│ ┌────────────▼─────────────┐ │ ┌────────────▼─────────────┐ │
│ │   WebContentsView Tabs   │ │ │     System WebView       │ │
│ │  • Chromium Sandbox      │ │ │  • DOM / JS Acceleration │ │
│ │  • Live Wallpaper Sync   │ │ │  • HTML Bookmark Parser  │ │
│ └────────────┬─────────────┘ │ └────────────┬─────────────┘ │
│              │ Encrypt Store │              │ SharedPrefs   │
│ ┌────────────▼─────────────┐ │ ┌────────────▼─────────────┐ │
│ │ DPAPI / Keychain Storage │ │ │ Local Storage / KeyStore │ │
│ └──────────────────────────┘ │ └──────────────────────────┘ │
└──────────────────────────────┴──────────────────────────────┘
```

---

## 🚀 快速上手

### 1. 下载即用 (Releases)

前往 [GitHub Releases 页面](https://github.com/Xbox123z/breeze-browser/releases) 直接获取最新安装包：
- **Windows**: `Breeze.Setup.exe` (支持一键安装)
- **macOS**: `Breeze-arm64.dmg` (支持 Apple Silicon 及 Intel)
- **Android**: `app-release.apk` (即装即用)

---

### 2. 源码构建

#### 💻 桌面端开发 (Windows / macOS)

**前置依赖**：Node.js 20+

```bash
# 1. 克隆仓库
git clone https://github.com/Xbox123z/breeze-browser.git
cd breeze-browser

# 2. 安装依赖
npm install

# 3. 本地开发调试
npm start

# 4. 运行全套单元测试 (含 CSV 解析和壁纸一致性校验)
node test/chrome-import.test.js

# 5. 打包生产分发包
npm run pack:win    # 打包 Windows NSIS 安装包
npm run pack:mac    # 打包 macOS DMG 镜像
```

#### 📱 Android 端编译

用 **Android Studio** 打开 `android/` 目录：
1. 自动执行 Gradle 同步（JDK 17）。
2. 连接真机或模拟器，点击 `Run 'app'` 即可。
3. 命令行快速构建：
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

---

## 📖 核心功能指引

### 从 Chrome 迁移你的数据

1. 打开右上角菜单 `⋮`
2. 点击 **「从 Chrome 导入书签/历史…」**：Breeze 会自动检索本机 Chrome 的数据目录并完成无损合并。
3. **导入密码**：
   - 在 Chrome 打开 `chrome://password-manager/settings`，点击「导出密码」获取 `.csv` 文件。
   - 在 Breeze 菜单点击 **「导入 Chrome 密码 (CSV)…」** 载入。
   - 所有密码立即受到系统加密通道保护，并可在「加密密码保险箱」中安全查阅。

### 切换与自定义壁纸

1. 点击右上角菜单 `⋮` → 选择 8 款调优渐变色块之一。
2. 或点击 **「自定义上传壁纸图片…」** 选择任意高清壁纸。
3. 所有已开启或新开启的标签页将通过底层 IPC 广播实时应用新壁纸。

---

## ⚖️ 功能特性对比

| 功能特性 | 原版 Google Chrome | Breeze Browser | 说明 |
|---|:---:|:---:|---|
| **搜索与多标签核心体验** | ✅ | ✅ | 保留高速 Chromium 核心与 Omnibox |
| **个性化壁纸实时切换** | 需进入特定设置页 | ✅ 实时无缝 | 8 组预设 + 本地上传，多页即时生效 |
| **Chrome 书签/历史无缝导入** | 需多步导出 | ✅ 一键直读 | 本地自动扫描 Profiles 去重合并 |
| **密码安全加密库** | 需登录 Google 账号 | ✅ 本地系统级隔离 | DPAPI / Keychain 本地加密，拒绝云端泄露 |
| **界面视觉纯净度** | 各种侧栏、资讯打扰 | ✅ 极简沉浸 | 隐藏原生菜单，仅保留 4 个高频按钮 |
| **追踪拦截与隐私** | 采集遥测数据 | ✅ 零收集 | 默认拒绝任何无意义权限请求 |

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 协议开源。欢迎提交 Issue 与 Pull Request！
