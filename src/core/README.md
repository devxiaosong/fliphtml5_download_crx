# Core — 跨项目通用模块

本目录包含 Chrome 扩展的**登录认证**与**后端通信**核心逻辑，与业务无关，可直接复制到新项目复用。

---

## 目录结构

```
src/core/
├── config.ts           # 产品信息配置（每个项目必改）
├── supabaseClient.js   # Supabase 客户端（chrome.storage 适配器）
├── misc.ts             # 日志上报 + 应用配置检查
├── useSupabaseAuth.ts  # React Hook：登录态管理
├── authCallback.ts     # OAuth 回调消息转发逻辑
└── backgroundAuth.ts   # Background 消息处理（getUser / SUPABASE_TOKEN）
```

---

## 复制到新项目的步骤

### 1. 复制整个 `src/core/` 目录

```bash
cp -r src/core /path/to/new-project/src/core
```

### 2. 修改 `config.ts`

只需改以下字段，其余保持不变：

```ts
export const productInfo = {
  product_alias: "crx_your_product_name",  // ← 改为新产品名
  branch: "main",
  browser_type: getBrowserType(),
  distribution: "production",
  version: "",
  product_id: "",
}
```

### 3. 在 `background.ts` 中接入认证消息处理

```ts
import { handleAuthMessages } from "./core/backgroundAuth"

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // auth 相关消息由 core 统一处理
  if (handleAuthMessages(message, sender, sendResponse)) return true

  // 在此添加本项目独有的业务消息处理
  if (message.action === "yourCustomAction") {
    // ...
  }

  return true
})
```

### 4. 创建 `src/contents/authCallback.ts`

Plasmo 要求 content script 必须位于 `src/contents/`，新建此文件并 re-export core 中的实现：

```ts
export { config } from "../core/authCallback"
```

### 5. 在页面组件中使用 Hook

**扩展内部页面**（popup、dashboard、options 等）使用 `useSupabaseAuth`：

```tsx
import { useSupabaseAuth } from "../core/useSupabaseAuth"

function MyPage() {
  const { user, loading, signIn, signOut } = useSupabaseAuth()
  // ...
}
```

**Content Script 页面**（注入到第三方网站的组件）使用 `useUserInfo`：

```tsx
import { useUserInfo } from "../core/useSupabaseAuth"

function MyContentScript() {
  const { user, loading } = useUserInfo()
  // user 为 null 表示未登录，包含 { email, name, avatar_url }
}
```

### 6. 使用日志上报（可选）

```ts
import { logInfo, logError, logWarning } from "../core/misc"

logInfo("event_name", "event_detail")
logError("error_name", "error_detail")
```

### 7. 使用应用配置检查（可选）

```ts
import { getAppInfo, dynamicRules, tierList } from "../core/misc"

const info = await getAppInfo()  // 从 Supabase Edge Function 拉取配置
```

---

## 认证流程说明

```
用户点击 Sign in
    ↓
useSupabaseAuth.signIn()
    ↓
跳转 Google OAuth → 回调到 product.extensionkit.cc/auth/callback
    ↓
core/authCallback.ts（content script）监听 window.message，转发给 background
    ↓
core/backgroundAuth.ts 接收 SUPABASE_TOKEN，存入 chrome.storage.local，关闭回调页
    ↓
打开/聚焦 dashboard 页面
    ↓
useSupabaseAuth 检测到 pending session，调用 setSession() 完成登录
```

---

## 注意事项

- `supabaseClient.js` 使用 `chrome.storage.local` 替代 `localStorage`，使 background service worker、popup、content script 之间可以**共享同一个 session**
- Content script 中不能直接读取 Supabase session（service worker 休眠问题），应使用 `useUserInfo` 通过消息向 background 获取
- `package.json` 的 `manifest.permissions` 只需 `["activeTab", "storage"]`，无需 `tabs` 权限
