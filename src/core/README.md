# src/core

存放与 Plasmo 框架无关的核心逻辑模块，可被 contents、background、tabs 等任意层复用。

---

## authCallback.ts

### 作用

OAuth 登录回调的 content script 逻辑。
监听页面上的 `SUPABASE_TOKEN` 消息，将 token 转发给 background service worker，完成登录闭环。

### 注意

Plasmo 要求 content script **入口文件必须放在 `src/contents/`**。  
因此本文件是逻辑来源（source of truth），实际生效的入口是：

```
src/contents/authCallback.ts   ← Plasmo 打包入口，代码与此文件保持同步
src/core/authCallback.ts       ← 逻辑参考，不会被 Plasmo 直接打包
```

修改逻辑时，**两个文件需同步更新**。

### 消息流程

```
登录页 (product.extensionkit.cc)
  │  postMessage({ type: "SUPABASE_TOKEN", hash, target })
  ▼
src/contents/authCallback.ts  (content script，注入到回调页)
  │  chrome.runtime.sendMessage({ type: "SUPABASE_TOKEN", hash, target })
  ▼
src/background.ts  (service worker，处理 token 写入 storage)
```

### 匹配规则

```typescript
matches: ["https://product.extensionkit.cc/auth/callback*"]
run_at: "document_start"
```
