# Bili-DL · 现代化 B 站全能媒体下载器

<div align="center">

<p align="center">
  <a href="https://github.com/SXP-Simon/bili-dl" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/GitHub-SXP--Simon%2Fbili--dl-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub Repo">
  </a>
  <a href="https://www.typescriptlang.org/" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/TypeScript-7.0+-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  </a>
  <a href="https://react.dev/" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/React-19.0+-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React">
  </a>
  <a href="https://tailwindcss.com/" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/TailwindCSS-v4.0+-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="TailwindCSS">
  </a>
  <a href="https://vite.dev/" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/Vite-6.0+-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite">
  </a>
  <a href="https://github.com/SXP-Simon/bili-dl/blob/master/LICENSE" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
  </a>
</p>

<table align="center" width="100%">
  <tr>
    <td align="center" width="63%" valign="middle">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://fastly.jsdelivr.net/gh/SXP-Simon/bili-dl@master/assets/demo-dark.png" />
        <source media="(prefers-color-scheme: light)" srcset="https://fastly.jsdelivr.net/gh/SXP-Simon/bili-dl@master/assets/demo-light.png" />
        <img src="https://fastly.jsdelivr.net/gh/SXP-Simon/bili-dl@master/assets/demo-light.png" alt="Bili-DL 主下载面板" width="100%" />
      </picture>
    </td>
    <td align="center" width="37%" valign="middle">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://fastly.jsdelivr.net/gh/SXP-Simon/bili-dl@master/assets/setting-dark.png" />
        <source media="(prefers-color-scheme: light)" srcset="https://fastly.jsdelivr.net/gh/SXP-Simon/bili-dl@master/assets/setting-light.png" />
        <img src="https://fastly.jsdelivr.net/gh/SXP-Simon/bili-dl@master/assets/setting-light.png" alt="Bili-DL 偏好与下载器设置" width="100%" />
      </picture>
    </td>
  </tr>
</table>

<p align="center">
  <b>极简 · 清爽 · 高性能</b><br>
  基于 React 19 + TypeScript 5.9 + Tailwind CSS v4 构建的 B 站视频下载油猴脚本。<br>
  支持 4K/1080P 前端无损合成 MP4、音频导出、弹幕转 ASS、官方字幕转 SRT、多 P/合集批量导出，以及 IDM / ABDM / Aria2 外部下载。
</p>

</div>

---

> **个人改款说明（fork）**
>
> 本仓库 fork 自 [SXP-Simon/bili-dl](https://github.com/SXP-Simon/bili-dl)，按个人使用习惯做了这些调整，其余能力保持不变：
>
> 1. **移除音频轨选择界面**：不再列出多条音轨，面板给一个「下载音频」入口，下载视频时也会自动匹配同一条可播放的音轨（优先 AAC，避免 FLAC 音轨塞进 MP4 导致无法播放）；
> 2. **移除本地 AI 语音转写**（Whisper / Transformers.js）及其全部设置项与依赖；
> 3. **接入 IDM**：本地桥接脚本 + IDM 官方 COM 接口，可带 Referer/Cookie/文件名推送（见下方「推送到 IDM」）；
> 4. **只面向 UP 主发布的视频（UGC）**，番剧 / 影视（PGC）暂不支持。

## 🌟 核心特性

- 🎬 **前端音画无损封装（Remux）**：引入 `mp4box.js` 纯前端重构 ISO-BMFF 容器，秒级将 4K / 1080P DASH 视频流与高品质音频流打包为开箱即播的标准 `.mp4` 文件，零转码耗时、不占 CPU。
- 🎵 **音频下载**：面板里一个「下载音频」入口即可导出音频轨（`.m4a`），不用在音轨之间挑选；右键菜单的「一键下载全部音频」可批量导出多 P / 合集音频。
- 🖼️ **超高清封面原图保存**：自动解析官方未压缩、无水印的超高清封面大图。
- 💬 **全量弹幕转标准 ASS**：解析 B 站 XML 弹幕并转换为带颜色、字号和滚动轨迹的标准 `.ass` 字幕文件，播放器挂载即看。
- 📝 **官方双语字幕与 AI 总结导出**：支持官方 CC 双语字幕一键转导出为 `.srt`，支持将 B 站官方 AI 视频提炼与章节大纲一键复制为结构化 Markdown 笔记。
- 📑 **多 P / 合集分集自由切换**：自动识别当前视频所属的多 P 列表或合集剧集，快速切换解析。
- ⚡ **Aria2 / curl 命令行导出**：大文件一键生成带 Referer 防盗链请求头的多线程下载与混流脚本。
- 🎨 **TweakCN 现代轻质感设计**：
  - 采用 OKLCH 清新淡青/薄荷绿调色板与温润米灰纸实质感。
  - 物理微质感与丝滑交互（Cubic-bezier Spring 阻尼反馈、光斑跟随、按压回弹）。
  - 全面支持深色/浅色模式无缝自适应与手动切换。
  - 基于 **Shadow DOM** 彻底隔离宿主样式，绝不污染 B 站原生界面。

---

## 📦 安装与使用

### 方式一：安装本地构建产物（推荐）
1. 在浏览器安装 [Tampermonkey（篡改猴）](https://www.tampermonkey.net/) 或 [ScriptCat（脚本猫）](https://scriptcat.org/) 扩展；
2. 把本仓库 `dist/bili-dl.user.js` 拖进浏览器（或油猴「添加新脚本 → 导入」），确认安装；
3. 打开任意 B 站视频播放页面（`https://www.bilibili.com/video/BV...`），右侧会出现悬浮下载胶囊。

> 这个仓库是个人改款，**不要**去上游 Releases 装官方版——那是带音频选择与 AI 转写的原版。

### 方式二：本地开发模式（支持 HMR 热更新）
```bash
# 1. 进入项目目录（仓库已在本机，无需 clone）
cd D:\Project\Bili_DD

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器
pnpm dev
```
按照终端提示在 Tampermonkey 中添加一次调试脚本代理，之后每次保存代码，B 站页面都会**实时热更新**。

---

## 🚀 推送到 IDM（可选）

IDM 没有本地 HTTP API，网页也不能直接调用它的 COM 接口，所以脚本通过一个**本地桥接脚本**转发：

```
浏览器(油猴脚本) --POST 127.0.0.1:15152--> tools/idm-bridge.ps1 --COM SendLinkToIDM--> IDM
```

这样 Referer、Cookie、User-Agent、文件名都能带进 IDM（B 站部分 CDN 节点没 Referer 会直接 403，只靠 `IDMan.exe` 命令行是下不来的）。

**使用步骤**

1. 启动一次 IDM（首次运行会注册 COM 组件），然后关掉也行；
2. 启动桥接服务（**窗口/进程必须活着**，否则连不上）。任选一种：

   **A. 双击（最省事）**：`tools\start-idm-bridge.bat`，能看到日志。

   **B. 静默运行**：双击 `tools\start-idm-bridge-hidden.vbs`，不弹黑窗口。

   **C. 命令行**：
   ```powershell
   cd D:\Project\Bili_DD
   powershell -ExecutionPolicy Bypass -File .\tools\idm-bridge.ps1
   ```
   也可以在任意目录用绝对路径（`-File "D:\Project\Bili_DD\tools\idm-bridge.ps1"`），失败基本都是因为没 `cd` 到项目目录。

   想先验证连通性可以加 `-DryRun`（只打印不下载）。启动成功会看到
   `IDM 桥接服务已启动: http://127.0.0.1:15152`。

   点下载报 500 时先跑 COM 自检（只入队一条测试任务、不会真下载，验完在 IDM 里删掉）：
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\tools\idm-bridge.ps1 -SelfTest
   ```

3. **想让它开机自动在后台跑**：把 `tools\start-idm-bridge-hidden.vbs` 的**快捷方式**放进启动目录
   （`Win + R` → 输入 `shell:startup` → 回车，把快捷方式粘进去）。以后开机就自动起，不用每次手动开。
4. 打开脚本面板 → 设置 → 启用外部下载器 → 选 **Internet Download Manager**，端口保持 `15152`；
5. 在视频卡片上点「IDM」按钮，或在右键菜单把下载引擎切到外部。

**设置项对 IDM 的作用**

| 脚本设置 | 对 IDM 的影响 |
|---|---|
| 自动创建视频专属子文件夹 | 开 = 每个视频建 `下载\标题\` 子目录；关 = 直接平铺在下载根目录 |
| 每次下载前弹出「另存为」确认框 | 开 = 交给 IDM 时弹它自己的「开始下载」对话框，可当场改目录/文件名；关 = 静默直接开始 |
| 保存目录 | 由桥接服务的 `-Folder` 决定，默认系统「下载」文件夹 |

> 桥接是**常驻小服务**：它只监听 `127.0.0.1`，不联网、不收集数据，唯一作用是把任务转交给 IDM。不跑它就没法从网页调 IDM（浏览器不允许）。

**必须知道的一点**：IDM 只负责下载，不做音视频合并。B 站是 DASH 分离流，所以推给 IDM 的结果**一定是两个文件**，按视频标题各放一个文件夹：

```
下载\标题\43614732472-1-30032.mp4   ← 画面：直接用服务器 URL 里的文件名
下载\标题\audio.m4a                 ← 声音：固定叫 audio
```

- **画面**不指定名字，取服务器 URL 里的文件名（B 站是 `cid-序号-清晰度` 这种，天然唯一）；
- **音频**固定叫 `audio`，靠标题子目录区分不同视频；
- **后缀由桥接服务探测服务器返回的 Content-Type 决定**：

| 服务器声明 | 后缀 |
|---|---|
| `video/mp4` | `.mp4` |
| `audio/mp4` | `.m4a` |
| `audio/flac` | `.flac` |
| `application/octet-stream`（多数 mcdn / upos 节点） | 按轨道类型兜底：画面 `.mp4`、音频 `.m4a` |
| 探测超时/失败 | 同样兜底，不阻塞下载 |

后缀总会被重新计算，所以即使传入的名字已经带了 `.mp4`，也不会再出现 `xxx.mp4.mp4`。

要变成单个 MP4，进入该文件夹合并：

```bash
ffmpeg -i "43614732472-1-30032.mp4" -i audio.m4a -c copy "标题.mp4"
```

如果你要的就是"一个开箱即播的 MP4"，用内置引擎（浏览器内混流）更省事；IDM 适合超大文件、需要断点续传/多线程、或想让下载在关掉网页后继续跑的场景。

---

## 🛠️ 项目架构与技术栈

```text
bili-dl/
├── src/
│   ├── api/                     # 🌐 数据请求与 B 站接口解析
│   │   ├── http.ts              # 封装 GM_xmlhttpRequest，注入 Referer 防盗链头与流式进度
│   │   ├── bilibili.ts          # 解析 DASH 视频流、音频流、分P列表、字幕与 AI 总结
│   │   └── storage.ts           # 用户设置持久化 (GM_getValue / GM_setValue)
│   │
│   ├── media/                   # 🎬 多媒体处理与格式转换
│   │   ├── muxer.ts             # mp4box.js 纯前端音画无损混流为 .mp4
│   │   ├── danmaku.ts           # 弹幕 XML 转标准 .ass 字幕
│   │   ├── subtitle.ts          # 官方 JSON 双语字幕转 .srt
│   │   ├── aria2.ts             # Aria2 / curl 命令行生成器
│   │   └── downloader.ts        # 文件流式下载与保存调度
│   │
│   ├── components/              # 🎨 UI 表现与交互组件
│   │   ├── FloatButton.tsx      # 可拖拽悬浮唤起胶囊
│   │   ├── DownloadModal.tsx    # 主下载弹窗 (深浅色模式、卡片列表)
│   │   ├── SpotlightCard.tsx    # 丝滑光斑与物理微质感卡片
│   │   ├── TabPill.tsx          # 分段滑动控制器
│   │   ├── EpisodePicker.tsx    # 多 P 分集选择器
│   │   ├── ProgressBar.tsx      # 流光动态进度条
│   │   └── Toast.tsx            # 轻量消息气泡通知
│   │
│   ├── styles/                  # 💄 样式
│   │   └── main.css             # Tailwind CSS v4 与 OKLCH 主题定义
│   │
│   ├── App.tsx                  # 🧩 应用主状态容器与主题监听
│   └── main.tsx                 # 🚀 脚本主入口 (Shadow DOM 隔离挂载)
│
├── package.json
├── tsconfig.json
└── vite.config.ts               # Vite + vite-plugin-monkey 打包配置
```

---

## 🔨 开发与工程化

本项目采用现代化的前端代码检查与自动化 CI/CD 工具链：

- **Linter**：使用又新又快的 **OXC ([Oxlint](https://oxc.rs/docs/guide/usage/linter.html))** 进行毫秒级代码静态检查。
- **CI**：GitHub Actions 在 push / PR 时执行 `pnpm check`（Typecheck + Oxlint + Vitest）、构建校验与 Playwright E2E；并在检测到版本号变更（`package.json` 更新或推送 `v*` tag）时自动构建并发布 GitHub Release 产物。

```bash
# 1. 运行 OXC 代码静态检查
pnpm lint

# 2. 运行 TypeScript 类型检查
pnpm typecheck

# 3. 一次跑完 Typecheck + Oxlint + Vitest
pnpm check

# 4. 生产打包
pnpm build
```

打包产物将输出在 `dist/bili-dl.user.js`（单文件包含所有依赖与样式，可独立分发与运行）。

---

## 📄 开源许可

本项目基于 [MIT License](./LICENSE) 开源。仅供技术交流与学习使用。

