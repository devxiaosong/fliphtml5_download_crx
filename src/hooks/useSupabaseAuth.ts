import { useState, useEffect } from "react"
import type { User, Session } from "@supabase/supabase-js"
import { supabase } from "../supabaseClient"

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

export interface SimpleUser {
  email: string
  name: string
  avatar_url: string
}

/** 将登录用户的精简信息持久化到 chrome.storage，供 content script 等跨上下文读取 */
async function saveUserToStorage(user: User | null) {
  if (user) {
    const meta = user.user_metadata ?? {}
    const info: SimpleUser = {
      email: user.email ?? "",
      name: meta.full_name ?? meta.name ?? user.email ?? "",
      avatar_url: meta.avatar_url ?? meta.picture ?? ""
    }
    await chrome.storage.local.set({ fliphtml5_user: info })
  } else {
    await chrome.storage.local.remove("fliphtml5_user")
  }
}

export function useSupabaseAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true
  })

  useEffect(() => {
    // INITIAL_SESSION 在异步 storage 读完前就触发，会误报 null，跳过它
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return
      const user = session?.user ?? null
      setAuthState({ user, session, loading: false })
      saveUserToStorage(user)
    })

    const init = async () => {
      // 优先消费 background 存入的 pending session（OAuth 回调后）
      const result = await chrome.storage.local.get("fliphtml5_pending_session")
      const pending = result.fliphtml5_pending_session as
        | { access_token: string; refresh_token: string }
        | undefined

      if (pending?.access_token && pending?.refresh_token) {
        console.log("[useSupabaseAuth] consuming pending session...")
        await chrome.storage.local.remove("fliphtml5_pending_session")
        const { data, error } = await supabase.auth.setSession({
          access_token: pending.access_token,
          refresh_token: pending.refresh_token
        })
        console.log("[useSupabaseAuth] setSession:", data.user?.email ?? "null", error?.message ?? "")
        setAuthState({ user: data.user ?? null, session: data.session ?? null, loading: false })
        await saveUserToStorage(data.user ?? null)
        return
      }

      // 无 pending session，读取已有 session
      const { data: { session } } = await supabase.auth.getSession()
      console.log("[useSupabaseAuth] getSession:", session?.user?.email ?? "null")
      const user = session?.user ?? null
      setAuthState({ user, session, loading: false })
      await saveUserToStorage(user)
    }

    init()
    return () => subscription.unsubscribe()
  }, [])

  const signIn = async () => {
    const target = chrome.runtime.getURL("tabs/dashboard.html")
    const redirectTo = `https://product.extensionkit.cc/auth/callback?target=${encodeURIComponent(target)}`
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    await saveUserToStorage(null)
  }

  return {
    ...authState,
    signIn,
    signOut
  }
}

/**
 * 轻量 hook，仅从 chrome.storage 读取已持久化的用户信息。
 * 适用于 content script（无法可靠运行完整 Supabase 客户端的场景）。
 */
export function useUserInfo() {
  const [user, setUser] = useState<SimpleUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 初次读取
    chrome.storage.local.get("fliphtml5_user", (result) => {
      setUser((result.fliphtml5_user as SimpleUser) ?? null)
      setLoading(false)
    })

    // 监听后续变化（登录/登出后同步更新）
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ("fliphtml5_user" in changes) {
        setUser((changes.fliphtml5_user.newValue as SimpleUser) ?? null)
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  return { user, loading }
}
