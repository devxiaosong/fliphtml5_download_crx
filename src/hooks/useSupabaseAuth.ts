import { useState, useEffect } from "react"
import type { User, Session } from "@supabase/supabase-js"
import { supabase } from "../supabaseClient"

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

export function useSupabaseAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true
  })

  useEffect(() => {
    // INITIAL_SESSION 在异步 storage 读完前就触发，会误报 null，跳过它
    // 后续的 SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED 正常处理
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return
      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false
      })
    })

    // 初始状态由 getSession() 决定，它会正确等待异步 storage 读取完成
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false
      })
    })

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
