import { useState, useEffect } from "react"
import type { User, Session } from "@supabase/supabase-js"
import { supabase } from "./supabaseClient"
import { pairUserAndProductRelation } from "./misc"

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
      if (event === "SIGNED_IN") pairUserAndProductRelation()
      const user = session?.user ?? null
      setAuthState({ user, session, loading: false })
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
        if (data.user) pairUserAndProductRelation()
        setAuthState({ user: data.user ?? null, session: data.session ?? null, loading: false })
        return
      }

      // 无 pending session，读取已有 session
      const { data: { session } } = await supabase.auth.getSession()
      console.log("[useSupabaseAuth] getSession:", session?.user?.email ?? "null")
      setAuthState({ user: session?.user ?? null, session, loading: false })
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
  }

  return {
    ...authState,
    signIn,
    signOut
  }
}

/**
 * 轻量 hook，通过 background 消息获取当前登录用户信息。
 * 适用于 content script——background 是唯一可靠读取 Supabase session 的上下文。
 * 监听 chrome.storage 变化（Supabase 的 sb-* key），自动触发重新获取。
 */
export function useUserInfo() {
  const [user, setUser] = useState<SimpleUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUser = () => {
      chrome.runtime.sendMessage({ action: "getUser" }, (response: SimpleUser | null) => {
        // chrome.runtime.lastError 在对端不处理时会出现，忽略即可
        if (chrome.runtime.lastError) {
          setLoading(false)
          return
        }
        setUser(response ?? null)
        setLoading(false)
      })
    }

    fetchUser()

    // 监听 Supabase 在 chrome.storage 里的 session key（sb-* 前缀）变化
    // 登录 / 登出均会触发，重新向 background 获取最新用户信息
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      const keys = Object.keys(changes)
      if (keys.some((k) => k.startsWith("sb-") || k === "fliphtml5_pending_session")) {
        fetchUser()
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  return { user, loading }
}
