# FlipHTML5 Downloader

一个 Chrome 浏览器扩展，通过自动扫描 fliphtml5.com、online.fliphtml5.com 等在线电子书网站，将电子书保存为 PDF 文件下载到本地。

## 功能特性

### 核心功能
- ✅ **自动扫描**：自动翻页并提取电子书所有页面图片
- ✅ **实时预览**：扫描过程中实时显示已扫描的图片缩略图（每行4张）
- ✅ **多种版式**：支持竖版、横版、正方版三种 PDF 格式
- ✅ **可调速度**：扫描速度可调（500ms-3000ms）
- ✅ **进度显示**：实时显示扫描进度和当前页码
- ✅ **付费系统**：模拟登录和付费功能（Google OAuth + 订阅制）

### 付费特性
- **免费版**：完整功能，PDF 每页带 "DEMO" 水印
- **付费版**：无水印导出
  - 月度订阅：$3.99/月
  - 年度订阅：$19.99/年

## 技术栈

- **框架**：Plasmo v0.90.5
- **UI 库**：React 18.3.1 + Ant Design 6.2.3
- **PDF 生成**：jsPDF
- **后端**：Supabase（用户认证与付费管理）
- **语言**：TypeScript
- **构建工具**：Parcel (内置于 Plasmo)

## 安装依赖

```bash
pnpm install
```

## 开发模式

开发模式支持热重载 (HMR)：

```bash
pnpm run dev
```

开发构建文件位于：`build/chrome-mv3-dev/`

## 生产构建

```bash
pnpm run build
```

生产构建文件位于：`build/chrome-mv3-prod/`

## 在 Chrome 中加载扩展

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目的 `build/chrome-mv3-dev/` 或 `build/chrome-mv3-prod/` 目录

## 项目结构

```
fliphtml5_download_crx/
├── src/
│   ├── popup.tsx                 # Popup 主页面（双 Tab）
│   ├── components/
│   │   ├── ScanControl.tsx      # 扫描控制组件
│   │   └── AccountPanel.tsx     # 账户与付费组件
│   ├── contents/
│   │   ├── scanDialog.tsx       # 页面注入对话框
│   │   ├── scanDialog.css       # 对话框样式
│   │   └── scanner.ts           # 扫描逻辑
│   ├── utils/
│   │   ├── pdfGenerator.ts      # PDF 生成与水印
│   │   ├── config.ts
│   │   └── misc.ts
│   └── supabaseClient.ts        # Supabase 配置
├── assets/                       # 扩展图标
├── package.json
└── 需求文档.md                  # 完整需求文档
```

## 使用说明

### 基本使用流程

1. **访问目标网站**：打开 fliphtml5.com 或 online.fliphtml5.com 的电子书页面
2. **打开扩展**：点击浏览器工具栏的扩展图标
3. **登录账户**（可选）：
   - 切换到"账户与付费" Tab
   - 点击"使用 Google 登录"（模拟登录）
   - 查看或购买付费套餐
4. **启动扫描**：
   - 切换到"扫描控制" Tab
   - 调整扫描速度（建议使用默认 1000ms）
   - 点击"启动扫描"按钮
5. **扫描过程**：
   - 页面上会弹出扫描对话框
   - 选择 PDF 版式（竖版/横版/正方版）
   - 点击"开始扫描"
   - 实时查看扫描进度和图片预览
6. **下载 PDF**：
   - 扫描完成后点击"下载 PDF"按钮
   - 免费版 PDF 每页带 "DEMO" 水印
   - 付费版无水印

### 注意事项

- 扫描速度过快可能导致图片加载失败，建议使用默认速度
- 扫描过程中可随时点击"停止扫描"按钮中断
- 最多扫描 500 页（防止意外无限循环）
- 当前登录和付费功能为模拟实现，真实功能将在后续版本中集成

## 许可证

ISC
