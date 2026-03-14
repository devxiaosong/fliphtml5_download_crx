/**
 * Chrome/Firefox 跨浏览器兼容封装。
 *
 * Chrome MV3：chrome.storage / chrome.tabs 不传回调时返回 Promise。
 * Firefox MV2：chrome.* 兼容层不传回调时返回 undefined，必须使用回调形式。
 * 这里统一用回调包 Promise，在两个平台上都能正常工作。
 */

// ─── storage.local ───────────────────────────────────────────────────────────

export function storageGet(keys: string | string[] | null): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result ?? {}))
  })
}

export function storageSet(items: Record<string, any>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => resolve())
  })
}

export function storageRemove(keys: string | string[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, () => resolve())
  })
}

// ─── tabs ─────────────────────────────────────────────────────────────────────

export function tabsQuery(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve) => {
    chrome.tabs.query(queryInfo, (tabs) => resolve(tabs ?? []))
  })
}
