import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://product.extensionkit.cc/auth/callback*"],
  run_at: "document_start"
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return
  if (event.data?.type !== "SUPABASE_TOKEN") return

  // 从 target URL 中提取插件 ID，只处理发给当前插件的消息
  const target = event.data?.target as string | undefined
  if (!target) return
  // 兼容 Chrome (chrome-extension://) 和 Firefox (moz-extension://)
  const extBase = chrome.runtime.getURL("").replace(/\/$/, "")
  if (!target.startsWith(extBase)) return

  chrome.runtime.sendMessage({
    type: "SUPABASE_TOKEN",
    hash: event.data.hash,
    target
  })
})
