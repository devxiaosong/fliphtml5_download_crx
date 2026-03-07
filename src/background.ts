// Background script for Chrome extension

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openExtractTextPage") {
    // 获取扩展的 URL
    const url = chrome.runtime.getURL("tabs/extract-text.html");
    
    // 打开新标签页
    chrome.tabs.create({ url });
    
    sendResponse({ success: true });
  }
  
  return true;
});
