// Background script for Chrome extension
// Service Worker 环境下 Supabase adapter 不生效，直接操作 chrome.storage.local

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openExtractTextPage") {
    const url = chrome.runtime.getURL("tabs/extract-text.html")
    chrome.tabs.create({ url })
    sendResponse({ success: true })
  }

  if (message.action === "openDashboard") {
    const url = chrome.runtime.getURL("tabs/dashboard.html")
    chrome.tabs.query({ url }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id != null) {
        chrome.tabs.update(tabs[0].id, { active: true })
        if (tabs[0].windowId != null) chrome.windows.update(tabs[0].windowId, { focused: true })
      } else {
        chrome.tabs.create({ url })
      }
    })
  }

  if (message.type === "SUPABASE_TOKEN") {
    const raw = message.hash as string
    const hash = raw.startsWith("#") ? raw.slice(1) : raw
    const params = new URLSearchParams(hash)

    const accessToken = params.get("access_token")
    const refreshToken = params.get("refresh_token")
    const targetUrl = message.target as string

    if (!accessToken || !refreshToken || !targetUrl) {
      console.warn("[background] missing token or target")
      return
    }

    // 直接存原始 token，由目标页（popup/dashboard）读取后调 setSession()
    chrome.storage.local.set({
      fliphtml5_pending_session: { access_token: accessToken, refresh_token: refreshToken }
    }, () => {
      console.log("[background] pending session stored, opening:", targetUrl)

      // 关闭中转回调页
      chrome.tabs.query({ url: "https://product.extensionkit.cc/auth/callback*" }, (callbackTabs) => {
        callbackTabs.forEach((tab) => { if (tab.id != null) chrome.tabs.remove(tab.id) })
      })

      // 打开或聚焦目标页
      chrome.tabs.query({ url: targetUrl }, (tabs) => {
        if (tabs.length > 0 && tabs[0].id != null) {
          chrome.tabs.update(tabs[0].id, { active: true })
          if (tabs[0].windowId != null) chrome.windows.update(tabs[0].windowId, { focused: true })
        } else {
          chrome.tabs.create({ url: targetUrl })
        }
      })
    })
  }

  return true
})
