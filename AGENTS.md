## 基于 [jayzcoder/TrguiNG](https://github.com/jayzcoder/TrguiNG) 增加部分功能

### 更新 (260803a)
1. add: 忽略错误功能（支持通配符过滤，可在参数设置>其他设置中配置）
2. add: 忽略错误开关（支持右键菜单和设置面板启用/禁用）
3. add: tooltip汉化 Rename (F2) -> 重命名 (F2)
4. add: AGENTS.md项目文档
5. impr: 升级webpack-cli到v7以支持ESM top-level await

### 更新 (240607a)
1. merge: openscopeproject/TrguiNG
2. add: 暂停增加子状态（已完成/未完成）
3. add: 支持tr3批量修改tracker
4. add: 列表不显示子目录种子（可配置，默认显示）
5. add: web增加字体大小调整
6. impr: 拖拽时批量处理
7. impr: 分享率固定2位小数
8. impr: web增加一些字体
9. fix: 取消当前状态显示时异常

### 更新 (240422a)
1. add: 目录分组增加复制路径功能
2. Issue #3 | fix: 一键URL访问跨域问题（简单转跳处理）
3. Issue #4 #10 | 合并 openscopeproject/TrguiNG:1.3.0
4. Issue #9 | impr: 隐藏/展示运行状态（右上角）
5. Issue #6 #7 #12 | 翻译调整
6. windows应用程序部分页面汉化补充

### 更新 (240417a)
1. fix: 体积支持 PB EB 展示
2. fix: 工具栏的一些同步问题
3. impr: version 页汉化

## 新增功能 (240416a)
1. 分组体积展示（可在分组区右键关闭该功能）
2. 双击全选分组，方便快捷操作（可在分组区右键关闭该功能）
3. 增加错误分布分组（可在分组区右键关闭该功能）
4. 增加分组后的Tracker二级过滤（位于顶部搜索框右侧）
5. 多链接下载，可设置下载间隔
6. 调整布局，左下角增加状态指示（主要用于多链接下载展示进度，平常展示列表选中项）
7. 种子列表右键菜单增加复制名称和路径（去重）

## PS. 主要是自用，有想加功能的可以提 issues，不保证实现

## 安装介绍（docker 环境）
1. 从 [releases](https://github.com/jayzcoder/TrguiNG/releases) 下载 `trguing-web-xxxx-zh.zip`
2. 解压到 transmission 设置的 webui 目录即可
3. transmission 需要正确映射并设置环境变量(确保 index.html 位于 TRANSMISSION_WEB_HOME 所在的目录第一层):
   ```
   TRANSMISSION_WEB_HOME=/config/webui/trguing-zh
   ```

## 项目说明

TrguiNG 是一个基于 Tauri 的 Transmission 远程控制 GUI。

- **前端**: React 18 + TypeScript + Mantine UI v6 + Webpack
- **后端**: Rust (Tauri v1) with hyper, tokio, lava_torrent
- **双模式**: 可作为桌面应用 (Tauri) 或独立 Web 应用（无 Tauri API）

## 开发命令

### 仅前端（无 Tauri）
```bash
npm run webpack-serve     # 开发服务器 localhost:8080 (HMR)
npm run webpack-dev       # 一次性开发构建
npm run webpack-prod      # 生产构建 (输出: dist/)
```

### 完整 Tauri 应用
```bash
npm run tauri-dev         # 开发模式: 启动 webpack dev server + Tauri
npm run build             # 生产构建: webpack-prod + Tauri 打包
npm run build-bin         # 构建但不打包（无 .deb/.msi 等）
```

## 架构

### 入口文件
- `src/index.tsx` — 主应用入口，根据 `window.__TAURI__` 检测渲染 `TauriApp` 或 `WebApp`
- `src/createtorrent.tsx` — "创建种子" webview 窗口的独立入口

### 关键目录
- `src/components/` — React 组件 (app.tsx = Tauri UI, webapp.tsx = web UI)
- `src/rpc/` — Transmission RPC 客户端 (client.ts, torrent.ts, transmission.ts)
- `src-tauri/src/` — Rust 后端 (commands, IPC, poller, tray, torrent cache, GeoIP)

### 双模式说明
`src/taurishim.ts` 在非 Tauri 环境下导出 stub。`TAURI` 常量 (`window.__TAURI__`) 控制代码路径。Tauri 专用导入通过动态 `import()` 懒加载 (`webpackMode: "lazy-once"`)。

## 代码规范

### TypeScript / 前端
- **缩进**: 4 空格 (ESLint 强制)
- **引号**: 双引号 (ESLint 强制)
- **分号**: 始终需要
- **尾逗号**: `always-multiline`
- **类型导入**: 使用 `import type { X }` (ESLint 强制)
- **成员分隔符**: 逗号（非分号）
- **TypeScript baseUrl**: `src/` — 导入如 `import { X } from "components/app"` 从 `src/` 解析

### Rust 后端
- Edition 2021, MSRV 1.60
- Release profile: `panic = "abort"`, LTO 启用, 优化体积 (`opt-level = "s"`)
- 使用 `lava_torrent` git 依赖: `https://github.com/openscopeproject/lava_torrent` branch `patches`

## 注意事项

- Webpack 配置 (`webpack.common.js`) 使用 top-level `await` — 需要 `experiments.topLevelAwait: true` 和 ESM (`"type": "module"`)
- `webpack.common.js` 构建时运行 `git describe --tags` — 如果 `.git` 缺少或无 tag 会失败
- Tauri `beforeBuildCommand` 是 `npm run webpack-prod` — webpack 在 Rust 编译前运行
- `tauri.conf.json` 的 `distDir` 指向 `../dist` (相对 `src-tauri/`)
- 配置文件 `trguing.json` 存储在 OS 配置目录 (Tauri) 或 localStorage (web)
- UI 字符串为中文（如 "隐藏"、"退出"）。语言硬编码，非 i18n 方案
