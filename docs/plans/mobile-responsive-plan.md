# TrguiNG 移动端适配方案与分阶段实施计划

## 1. 项目背景

TrguiNG 是基于 Tauri + React 18 + Mantine UI v6 + Webpack 的 Transmission 远程控制 GUI，支持桌面端（Tauri）和独立 Web 两种运行模式。当前 UI 为纯桌面布局，需要进行移动端 H5/响应式适配。

**核心约束**：
- 不修改 Rust 后端代码
- 不改变 RPC 业务逻辑
- 桌面端功能零回归
- 基于原组件条件渲染，不复制一套移动端组件

---

## 2. 技术选型

### 2.1 响应式检测

使用 `@mantine/hooks` 提供的 `useMediaQuery` hook，而非 CSS media query。

**原因**：当前组件大量使用 `sx` prop 和内联 style，`useMediaQuery` 返回 boolean 可以在 JS 层做条件渲染（控制组件挂载/卸载），而 CSS media query 无法控制 React 组件的条件挂载。

```typescript
// src/hooks/useResponsive.ts
function useIsMobile(): boolean   // 断点 768px
function useIsTablet(): boolean   // 断点 1024px
```

### 2.2 布局方案

| 组件 | 桌面方案 | 移动方案 | 切换方式 |
|------|---------|---------|---------|
| 全局布局 | SplitLayout (react-split 三面板) | Flex column 单列 | `useIsMobile()` 条件渲染 |
| 左侧 Filters | 固定面板 | Mantine Drawer (右侧滑入) | `useIsMobile()` 控制渲染位置 |
| 底部 Details | SplitLayout 底部面板 | Modal fullScreen | `useIsMobile()` 控制渲染方式 |
| TorrentTable | @tanstack/react-table + virtual | 卡片列表 + virtual | `useIsMobile()` 条件渲染 |
| Toolbar | Flex row 水平排列 15+ 按钮 | 双行紧凑布局 + 底部固定操作栏 | `useIsMobile()` 条件渲染 |
| StatusBar | Flex row 6 段信息 | 精简 3 段 + wrap | `useIsMobile()` 控制默认 visible |
| Modals | 标准 Mantine Modal | Modal fullScreen | `HkModal` 内部自动判断 |
| ContextMenu | 右键菜单 | 长按 500ms + 底部 ActionSheet | `useIsMobile()` 控制 position |

### 2.3 组件拆分规则

**核心原则**：业务逻辑共享，仅布局层分离。

- **共享**：RPC 调用、状态管理、过滤逻辑、事件处理、数据转换
- **分离**：DOM 结构、布局方式、交互触发方式（右键 vs 长按）
- **新建唯一组件**：`TorrentCard`（移动端卡片视图），因其 DOM 结构与表格行差异过大，不适合在一个组件内用条件分支

---

## 3. 当前界面分析

### 3.1 桌面布局

```
┌─────────────────────────────────────────────────────────┐
│ Toolbar (Flex row, ~15个按钮 + 搜索框 + Tracker下拉)     │
├───────────┬─────────────────────────┬───────────────────┤
│ Filters   │ TorrentTable            │ Details           │
│ 5个分组    │ 20+列, 虚拟滚动          │ Tabs 6个面板      │
├───────────┴─────────────────────────┴───────────────────┤
│ StatusBar (6段信息 + 主题/字体/版本按钮)                   │
└─────────────────────────────────────────────────────────┘
```

### 3.2 各组件移动端问题

| 组件 | 文件 | 问题 |
|------|------|------|
| Toolbar | `src/components/toolbar.tsx` | 15+ 按钮水平溢出，搜索框和 Tracker 下拉无法并排 |
| TorrentTable | `src/components/tables/torrenttable.tsx` | 20+ 列无法显示，行高太小触屏不友好，右键菜单不可用 |
| Filters | `src/components/filters.tsx` | 占用屏幕宽度，与列表争抢空间 |
| Details | `src/components/details.tsx` | 底部面板高度不足，Tab 文字溢出 |
| StatusBar | `src/components/statusbar.tsx` | flexWrap=nowrap 强制不换行，文字溢出 |
| SplitLayout | `src/components/splitlayout.tsx` | react-split 三面板不适合小屏 |
| Modals | `src/components/modals/*.tsx` | 标准 Modal 尺寸不适合移动端 |
| ContextMenu | `src/components/tables/torrenttable.tsx` | 右键菜单无触发方式 |

---

## 4. 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| TorrentCard 布局 | **卡片型（2-3行）** | 信息密度和触屏体验平衡 |
| Details 入口 | **全屏 Modal** | 内容多（Tabs+表格+文件树），半屏放不下 |
| 右键菜单替代 | **长按 500ms** | 移动端标准交互模式 |
| 下拉刷新 | **不需要** | 已有可配置轮询间隔（会话/详情/活动/未活动） |
| 组件策略 | **基于原组件条件渲染** | 业务逻辑相同，仅布局不同，避免双倍维护成本 |

---

## 5. 分阶段实施计划

### Phase 0: 基础设施（1天）

**目标**：建立响应式检测能力，不影响现有 UI。

**文件变更**：
- 新建 `src/hooks/useResponsive.ts`

**内容**：
```typescript
import { useMediaQuery } from "@mantine/hooks";

export function useIsMobile() {
    return useMediaQuery("(max-width: 768px)");
}

export function useIsTablet() {
    return useMediaQuery("(max-width: 1024px)");
}
```

**验收标准**：
- [ ] `npm run webpack-serve` 构建通过
- [ ] 桌面端功能无变化
- [ ] 在浏览器开发者工具中切换到移动端视口时，hook 返回正确值

---

### Phase 1: Modal 全屏适配（0.5天）

**目标**：所有弹窗在移动端自动全屏。

**文件变更**：
- `src/components/modals/common.tsx`

**改动**：
- `HkModal` 组件内部调用 `useIsMobile()`
- 移动端自动传入 `<Modal fullScreen>` prop
- 所有子 modal 自动继承，无需逐个修改

**验收标准**：
- [ ] 桌面端 Modal 行为不变
- [ ] 移动端打开设置、添加种子等 modal 时全屏显示
- [ ] Modal 内部内容可滚动，关闭按钮正常

---

### Phase 2: StatusBar 简化（0.5天）

**目标**：移动端状态栏紧凑显示核心信息。

**文件变更**：
- `src/components/statusbar.tsx`

**改动**：
- 移动端默认 `visible=false`：连接状态、剩余空间、列表总大小
- 移动端默认 `visible=true`：下载速度、上传速度、选中大小
- `flexWrap` 从 `"nowrap"` 改为 `"wrap"`，允许自然换行
- 右键菜单仍可手动切换任意段的显示/隐藏（已有基础设施）

**验收标准**：
- [ ] 移动端状态栏仅显示 3 段核心信息，不溢出
- [ ] 桌面端状态栏保持完整显示
- [ ] 右键菜单可配置各段显示/隐藏

---

### Phase 3: Filters Drawer 化（1天）

**目标**：移动端 Filters 从左侧面板变为抽屉。

**文件变更**：
- `src/components/server.tsx`

**改动**：
- 移动端 `showFiltersPanel` 不影响 SplitLayout（left 始终 undefined）
- 新建 state：`filtersDrawerOpened: boolean`
- Filters 通过 Mantine `Drawer` 渲染，内容完全复用现有 `<Filters>` 组件
- Drawer 触发入口在 Phase 4 的汉堡按钮

**验收标准**：
- [ ] 桌面端 Filters 面板正常显示
- [ ] 移动端 Filters 不占用主布局空间
- [ ] Drawer 内 Filters 功能完整（筛选、分组、右键菜单）

---

### Phase 4: Toolbar 移动端适配（1.5天）

**目标**：移动端 Toolbar 从单行水平排列变为紧凑双行布局。

**文件变更**：
- `src/components/toolbar.tsx`

**桌面端布局**（不变）：
```
[添加文件] [添加链接] [开始] [暂停] [删除] [队列↑↓] [移动] [标签] [优先级] [全局开始] [全局暂停] [限速] [搜索框] [Tracker▼] [布局] [设置]
```

**移动端布局**：
```
┌─────────────────────────────────┐
│ [☰] [搜索框==================]  │  ← 顶部行
├─────────────────────────────────┤
│ [+] [▶] [⏸] [✕] [···]         │  ← 底部固定操作栏
└─────────────────────────────────┘
```

**各元素说明**：
- `☰` — 汉堡按钮，toggle Filters Drawer（Phase 3）
- 搜索框 — 满宽，带清除按钮
- `+` — 添加种子（Menu: 文件/链接）
- `▶` — 开始选中
- `⏸` — 暂停选中
- `✕` — 删除选中
- `···` — 更多操作 Menu（队列、移动、标签、优先级、限速、布局切换、设置、Tracker 选择）

**底部固定栏样式**：
```css
position: fixed;
bottom: 0;
left: 0;
right: 0;
z-index: 100;
background: theme.colors.dark[8];
border-top: 1px solid theme.colors.dark[5];
```

**验收标准**：
- [ ] 桌面端 Toolbar 布局不变
- [ ] 移动端核心操作（添加/开始/暂停/删除）一步可达
- [ ] 底部操作栏固定在屏幕底部，不随列表滚动
- [ ] "更多"Menu 包含所有次要操作
- [ ] 搜索框可正常输入和清除

---

### Phase 5: TorrentTable 卡片视图（2天）

**目标**：移动端将表格行替换为卡片列表。

**文件变更**：
- 新建 `src/components/tables/torrentcard.tsx`
- `src/components/tables/torrenttable.tsx`
- `src/components/tables/common.tsx`（可能需要调整 virtualizer hook 复用）

**TorrentCard 设计**（卡片型，2-3 行）：
```
┌──────────────────────────────────────┐
│ 🟢 种子名称                          │
│    标签1  标签2                       │
├──────────────────────────────────────┤
│ ████████████░░░░░  67.3%             │  ← 进度条
├──────────────────────────────────────┤
│ ↓2.1MB/s  ↑512KB/s  2.4GB  剩余 1h  │  ← 速度/大小/ETA
└──────────────────────────────────────┘
```

**字段来源**（从 AllFields 提取）：
- 第一行：`name` + `labels`（标签，Mantine Badge）
- 第二行：`percentDone` 进度条（复用现有 ProgressBar 组件）
- 第三行：`rateDownload` + `rateUpload` + `totalSize` + `eta`
- 状态图标在名称左侧（复用 StatusIconMap）

**交互**：
- 单击：选中（toggle），高亮显示
- 双击/再次点击已选中的：打开全屏 Details Modal（Phase 6）
- 长按 500ms：触发底部 ActionSheet（Phase 8）

**虚拟滚动**：
- 复用 `@tanstack/react-virtual` 的 `useVirtualizer`
- 卡片行高固定（如 90px），virtualizer 计算不变
- 参考 `common.tsx:537` 的 `useTableVirtualizer`

**TorrentTable 条件渲染逻辑**：
```tsx
if (isMobile) {
    return <MobileTorrentList torrents={...} ... />
} else {
    return <TrguiTable ... />  // 现有桌面逻辑
}
```

**验收标准**：
- [ ] 桌面端表格视图不变
- [ ] 移动端显示卡片列表，每张卡片包含名称/标签/进度/速度/大小
- [ ] 卡片列表虚拟滚动流畅（100+ 种子无卡顿）
- [ ] 单击选中、双击展开详情正常
- [ ] 长按触发 ActionSheet（Phase 8 完成后验证）

---

### Phase 6: Details 全屏 Modal（1天）

**目标**：移动端点击种子后打开全屏详情。

**文件变更**：
- `src/components/server.tsx`
- `src/components/details.tsx`（Tab 适配）

**逻辑**：
- 新建 state：`detailsOpened: boolean` + `detailsTorrentId: number | undefined`
- 移动端：`setCurrentTorrent` 时同时 `setDetailsOpened(true)`
- 渲染：
  ```tsx
  <Modal fullScreen opened={detailsOpened} onClose={() => setDetailsOpened(false)}>
      <Details torrentId={detailsTorrentId} ... />
  </Modal>
  ```
- 桌面端：保持现有逻辑（SplitLayout 底部面板）

**Details 内部 Tab 适配**：
- 移动端 `Tabs.List` 外层包裹 `<ScrollArea horizontal>`，允许横向滚动 Tab
- 或使用 `Tabs.Tab` 的 `p="xs"` 缩小内边距
- 常规 Tab 内的 Grid（`TransferTable`）已有响应式逻辑（`rect.width > 850 ? 3 : 1`），移动端自动变为单列

**验收标准**：
- [ ] 桌面端 Details 在 SplitLayout 底部正常显示
- [ ] 移动端点击种子行/卡片后打开全屏 Details Modal
- [ ] Details 内部 6 个 Tab 可正常切换
- [ ] 移动端 Tab 列表可横向滚动
- [ ] Modal 关闭后返回列表

---

### Phase 7: SplitLayout 单列模式（0.5天）

**目标**：移动端移除面板分割。

**文件变更**：
- `src/components/splitlayout.tsx`

**逻辑**：
- `useIsMobile()` 为 true 时，不渲染 `<Split>` 组件
- 改为简单的 `<Flex direction="column" h="100%">` 包裹 children
- 左侧面板（Filters）已在 Phase 3 中移入 Drawer
- 底部面板（Details）已在 Phase 6 中移入 Modal
- 因此移动端 SplitLayout 实际只接收 `right`（TorrentTable）一个子元素

**验收标准**：
- [ ] 桌面端 SplitLayout 的拖拽分割正常
- [ ] 移动端无分割条，单列布局
- [ ] 移动端内容区占满屏幕高度

---

### Phase 8: ContextMenu 适配（0.5天）

**目标**：移动端长按触发底部 ActionSheet。

**文件变更**：
- `src/components/contextmenu.tsx`
- `src/components/tables/torrenttable.tsx`
- `src/components/tables/torrentcard.tsx`

**ContextMenu 修改**：
- `useIsMobile()` 为 true 时：`position="bottom"`, `middlewares` 去掉 `flip`

**长按触发实现**：
- 在 `TorrentCard` 和桌面端 `TableRow` 上绑定 `onTouchStart` / `onTouchEnd`
- `touchstart` 启动 500ms timer，`touchend` / `touchmove` 取消
- timer 触发时调用 `setContextMenuInfo({ x, y, ... })` 显示菜单

**菜单项触屏优化**：
- 菜单项 `p="md"` 增大点击区域（至少 44px 高度）
- 去掉 `rightSection` 的 `Kbd` 快捷键提示（移动端无键盘）

**验收标准**：
- [ ] 桌面端右键菜单行为不变
- [ ] 移动端长按 500ms 触发底部 ActionSheet
- [ ] 长按过程中手指移动取消触发
- [ ] 菜单项触屏热区足够大（≥44px）
- [ ] 菜单操作（开始/暂停/删除/队列等）正常执行

---

### Phase 9: 整体调试与优化（1天）

**验收标准**：
- [ ] 全流程测试：Web 端桌面浏览器 + 移动端浏览器/模拟器
- [ ] 操作路径：添加种子 → 列表展示 → 筛选 → 查看详情 → 开始/暂停/删除
- [ ] 触屏交互：长按菜单、卡片点击、Modal 关闭
- [ ] 深色/浅色主题在移动端的显示
- [ ] 现有桌面端功能无回归
- [ ] 性能：卡片列表虚拟滚动在 100+ 种子时的流畅度

---

## 6. Phase 依赖关系

```
Phase 0 (hook)
 │
 ├── Phase 1 (Modal全屏)
 ├── Phase 2 (StatusBar)
 ├── Phase 3 (Filters Drawer)
 │    │
 │    └── Phase 4 (Toolbar) ← 需要汉堡按钮控制 Drawer
 │
 ├── Phase 5 (TorrentCard) ← 核心改动
 │    │
 │    └── Phase 6 (Details Modal) ← 需要卡片点击打开详情
 │
 ├── Phase 7 (SplitLayout) ← 依赖 3/6 完成后移除面板
 │
 └── Phase 8 (ContextMenu) ← 依赖 5 的卡片长按
      │
      └── Phase 9 (调试)
```

**建议执行顺序**：0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

**验证节奏**：
- 每个 Phase 完成后运行 `npm run webpack-serve` 验证构建
- Phase 0-4 完成后做一次中期验证（基础框架就绪）
- Phase 5-8 完成后做完整功能验证
- Phase 9 收尾打磨

**总预估工作量**：约 8-10 天

---

## 7. 关键文件索引

| 文件 | 行数 | 角色 | Phase |
|------|------|------|-------|
| `src/hooks/useResponsive.ts` | 新建 | 响应式检测 hook | 0 |
| `src/components/modals/common.tsx` | 292 | Modal 基础组件 | 1 |
| `src/components/statusbar.tsx` | 155 | 状态栏 | 2 |
| `src/components/server.tsx` | 346 | 主布局编排 | 3, 6, 7 |
| `src/components/toolbar.tsx` | 461 | 操作工具栏 | 4 |
| `src/components/tables/torrentcard.tsx` | 新建 | 移动端卡片 | 5 |
| `src/components/tables/torrenttable.tsx` | 794 | 种子列表 | 5 |
| `src/components/tables/common.tsx` | 716 | 表格基础设施 | 5 |
| `src/components/details.tsx` | 522 | 详情面板 | 6 |
| `src/components/splitlayout.tsx` | 80 | 面板分割 | 7 |
| `src/components/contextmenu.tsx` | - | 右键菜单 | 8 |
| `src/components/filters.tsx` | 774 | 筛选面板 | 3 |
