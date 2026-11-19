# Changelog

## [1.8.0] - 2026-11-18

个人改款版：只面向 UP 主发布的视频（UGC），不做番剧 / 影视（PGC）。

### 移除

- 移除音频轨选择界面（「音频」tab 与音频卡片）：下载视频时自动选用官方最高音质的可混流音轨，弹窗顶部显示实际选用的音轨。
- 移除本地 AI 语音转写（Whisper / Transformers.js）全链路：模块、组件、设置项、快捷菜单入口、3 个公共 CDN 的 `@connect` 以及 `@huggingface/transformers` 依赖。

### 新增

- `src/media/selection.ts`：音轨/视频轨选择器（`pickBestAudio` / `pickHighestQualityVideo`），不再依赖接口返回顺序。
- 单元测试 `tests/unit/selection.test.ts`。
- **IDM 外部下载器**：`src/downloader/idm.ts` + 本地桥接脚本 `tools/idm-bridge.ps1`，通过 IDM 官方 COM 接口推送任务，可携带 Referer / Cookie / User-Agent / 文件名。
  - IDM 的 `ICIDMLinkTransmitter` 是纯 IUnknown 接口，PowerShell 晚绑定调不到，桥接脚本改用 C# COM interop（官方 IID/CLSID）调用；
  - 增加 `-SelfTest` 自检与 `-DryRun` 干跑；保存目录默认为系统「下载」文件夹；
  - 推给 IDM 的文件：画面沿用服务器 URL 里的文件名、音频固定 `audio`，按视频标题分子目录；后缀由桥接服务探测服务器 `Content-Type` 决定（`video/*`→`.mp4`、`audio/mp4`→`.m4a`、flac→`.flac`，`octet-stream` 按轨道类型兜底）；追加后缀前会剥离已有扩展名，避免出现 `.mp4.mp4`。

### 修复

- 「最高画质 / 最高音质」改为按分辨率、码率、编码兼容性真实排序，避免取到接口返回的第一条。
- 修复设置面板开关滑块只变色、不位移的问题（改用不依赖 CSS 变量的 inline transform）。
- IDM 推送现在受「自动创建视频专属子文件夹」「每次下载前弹出另存为确认框」两个设置控制：前者决定是否按标题建子目录，后者决定 IDM 是静默开始还是弹出「开始下载」对话框。
- 新增 `tools/start-idm-bridge-hidden.vbs`，可无窗口启动桥接并放入 `shell:startup` 实现开机自启。

### 文档

- 新增 `dev_doc/README.md` 文档索引；`改款方案-个人版.md` 标注为「已归档」（方向改为只做 UGC）。
- `开发手记.md` 增加目录与「当前状态速览」，验证结果更新为 139 个测试 / 25 个文件。
- `问题清单.md` 补充 A12–A14 与 C7–C9，新增「D. IDM 集成现状」速览表。
- 避免把 FLAC 音轨混流进 MP4 导致产出不可播放文件。
- 右键菜单与选集器去掉「最高质量 / 最低质量 / 最高画质」话术：「下载全部音频」改为自动匹配音轨（原先固定 64K 最低码率），音频文件名不再带音质后缀。
- 移除导致 `pnpm install` 失败的 lefthook `prepare` 钩子，CI 改为 `pnpm check`。

## [1.5.3] - 2026-10-20

- 改为输出带完整样本索引、音视频交错排列的普通 MP4，避免逐样本碎片导致 Windows 读取文件属性缓慢；保持无损合并。
- 修复 hvc1 编码被误标为 AV1、同清晰度 HEVC 与 AV1 下载选项相互覆盖的问题。
- 增加真实 AVC、HEVC、AV1 合并测试，覆盖样本及时间信息、关键帧、分批提取、长时长和异常输入。
