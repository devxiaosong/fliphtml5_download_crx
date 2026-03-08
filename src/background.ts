// Background script for Chrome extension
import { supabase } from "./supabaseClient"

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openExtractTextPage") {
    const url = chrome.runtime.getURL("tabs/extract-text.html")
    chrome.tabs.create({ url })
    sendResponse({ success: true })
  }

  if (message.type === "SUPABASE_TOKEN") {
    const raw = message.hash as string
    const hash = raw.startsWith("#") ? raw.slice(1) : raw
    const params = new URLSearchParams(hash)

    const accessToken = params.get("access_token")
    const refreshToken = params.get("refresh_token")
    const targetUrl = message.target as string

    if (!accessToken || !refreshToken || !targetUrl) {
      console.warn("[background] SUPABASE_TOKEN: missing token or target", { accessToken: !!accessToken, refreshToken: !!refreshToken, targetUrl })
      return
    }

    console.log("[background] SUPABASE_TOKEN received, calling setSession...")

    // Supabase 自动通过 chromeStorageAdapter 持久化 session
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ data, error }) => {
        if (error) {
          console.error("[background] setSession failed:", error.message)
          return
        }
        console.log("[background] setSession success, user:", data.user?.email)

        // 关闭中转回调页
        chrome.tabs.query({ url: "https://product.extensionkit.cc/auth/callback*" }, (callbackTabs) => {
          console.log("[background] closing callback tabs:", callbackTabs.length)
          callbackTabs.forEach((tab) => { if (tab.id != null) chrome.tabs.remove(tab.id) })
        })

        // 打开或聚焦目标页
        chrome.tabs.query({ url: targetUrl }, (tabs) => {
          if (tabs.length > 0 && tabs[0].id != null) {
            console.log("[background] focusing existing tab:", targetUrl)
            chrome.tabs.update(tabs[0].id, { active: true })
            if (tabs[0].windowId != null) chrome.windows.update(tabs[0].windowId, { focused: true })
          } else {
            console.log("[background] creating new tab:", targetUrl)
            chrome.tabs.create({ url: targetUrl })
          }
        })
      })
  }

  return true
})
