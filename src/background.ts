import { handleAuthMessages } from "./core/backgroundAuth"

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (handleAuthMessages(message, sender, sendResponse)) return true

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

  return true
})
