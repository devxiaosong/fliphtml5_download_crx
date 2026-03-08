// Background script for Chrome extension

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

    const session = {
      access_token: params.get("access_token"),
      refresh_token: params.get("refresh_token"),
      expires_at: params.get("expires_at"),
      token_type: params.get("token_type") ?? "bearer"
    }

    chrome.storage.local.set({ supabase_session: session }, () => {
      // 登录成功后自动打开或聚焦 dashboard
      const dashboardUrl = chrome.runtime.getURL("tabs/dashboard.html")
      chrome.tabs.query({ url: dashboardUrl }, (tabs) => {
        if (tabs.length > 0 && tabs[0].id != null) {
          chrome.tabs.update(tabs[0].id, { active: true })
          if (tabs[0].windowId != null) {
            chrome.windows.update(tabs[0].windowId, { focused: true })
          }
        } else {
          chrome.tabs.create({ url: dashboardUrl })
        }
      })
    })
  }

  return true
})
