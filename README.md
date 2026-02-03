# Plasmo Chrome Extension

这是一个基于 Plasmo 框架开发的 Chrome 浏览器扩展，使用 React 和 Ant Design UI 框架。

## 功能

- **Popup 页面**：点击扩展图标显示弹出窗口，包含一个打开 Dashboard 的按钮
- **Dashboard 页面**：独立的标签页，显示 "Hello World" 欢迎信息

## 技术栈

- **框架**：Plasmo v0.90.5
- **UI 库**：React 18.3.1 + Ant Design 6.2.3
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
plasmo_crx/
├── src/                   # 源代码目录
│   ├── popup.tsx         # 弹出窗口页面
│   └── tabs/
│       └── dashboard.tsx # Dashboard 标签页
├── assets/
│   └── icon.png          # 扩展图标
├── tsconfig.json         # TypeScript 配置
├── package.json          # 项目配置
└── build/               # 构建输出目录
```

## 使用说明

1. 安装扩展后，点击工具栏中的扩展图标
2. 在弹出窗口中点击"打开 Dashboard"按钮
3. 将打开一个新标签页，显示 Dashboard 页面

## 许可证

ISC
