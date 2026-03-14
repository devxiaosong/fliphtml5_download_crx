import { supabase } from "./supabaseClient.js"

/**
 * 处理与认证相关的 background 消息。
 * 在 chrome.runtime.onMessage.addListener 回调中调用，
 * 返回 true 表示已处理该消息，返回 false 表示不处理（交给业务层继续判断）。
 */

// background 端缓存，避免每次内容脚本初始化都重复请求
let cachedAppConfig: any = null
let cachedMembership: any = null

export function handleAppConfigMessages(
  message: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  if (message.action !== "getAppConfig") return false

  ;(async () => {
    if (cachedAppConfig) {
      sendResponse({ data: cachedAppConfig, error: null })
      return
    }
    try {
      const { data, error } = await supabase.functions.invoke("check-app", {
        body: message.productInfo
      })
      if (data && typeof data === "object") {
        cachedAppConfig = data
      }
      sendResponse({ data: data ?? null, error: error ? error.message : null })
    } catch (e: any) {
      sendResponse({ data: null, error: String(e) })
    }
  })()

  return true
}

export function handleMembershipMessages(
  message: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  if (message.action !== "getMembership") return false

  ;(async () => {
    if (cachedMembership) {
      sendResponse({ data: cachedMembership, error: null })
      return
    }
    try {
      const { data, error } = await supabase.functions.invoke("get-membership", {
        body: JSON.stringify(message.productInfo)
      })
      if (data) cachedMembership = data
      sendResponse({ data: data ?? null, error: error ? error.message : null })
    } catch (e: any) {
      sendResponse({ data: null, error: String(e) })
    }
  })()

  return true
}

export function handleLogEventMessages(
  message: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  if (message.action !== "logEvent") return false

  // 火忘式调用，不需要等待结果
  supabase.functions.invoke("log-event", { body: JSON.stringify(message.payload) }).catch(() => {})
  sendResponse({ ok: true })
  return true
}

export function handleAuthMessages(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  // 返回当前登录用户的精简信息（email / name / avatar_url），未登录返回 null
  if (message.action === "getUser") {
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user ?? null
      if (user) {
        const meta = user.user_metadata ?? {}
        sendResponse({
          email: user.email ?? "",
          name: String(meta.full_name ?? meta.name ?? user.email ?? ""),
          avatar_url: String(meta.avatar_url ?? meta.picture ?? "")
        })
      } else {
        sendResponse(null)
      }
    })()
    return true
  }

  // 接收 OAuth 回调 token，存入 storage 并导航至目标页
  if (message.type === "SUPABASE_TOKEN") {
    const raw = message.hash as string
    const hash = raw.startsWith("#") ? raw.slice(1) : raw
    const params = new URLSearchParams(hash)

    const accessToken = params.get("access_token")
    const refreshToken = params.get("refresh_token")
    const targetUrl = message.target as string

    if (!accessToken || !refreshToken || !targetUrl) {
      console.warn("[background] missing token or target")
      return false
    }

    chrome.storage.local.set({
      fliphtml5_pending_session: { access_token: accessToken, refresh_token: refreshToken }
    }, () => {
      console.log("[background] pending session stored, opening:", targetUrl)

      // 关闭中转回调页（直接用 sender.tab.id，无需额外 host_permissions）
      if (sender.tab?.id != null) {
        chrome.tabs.remove(sender.tab.id)
      }

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
    return true
  }

  return false
}
