import { useState, useEffect } from "react"
import type { User, Session } from "@supabase/supabase-js"
import { supabase } from "../supabaseClient"
import { triggerGoogleLogin } from "../utils/misc"

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
    // 监听登录状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false
      })
    })

    // 检查 background 存入的 OAuth session（postMessage 流程）
    chrome.storage.local.get("supabase_session", async (result) => {
      const stored = result.supabase_session as { access_token?: string; refresh_token?: string } | undefined
      if (stored?.access_token && stored?.refresh_token) {
        await supabase.auth.setSession({
          access_token: stored.access_token,
          refresh_token: stored.refresh_token
        })
        // 用完即清，避免重复消费
        chrome.storage.local.remove("supabase_session")
      } else {
        // 没有待消费的 session，读取已有的
        const { data: { session } } = await supabase.auth.getSession()
        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = () => {
    triggerGoogleLogin()
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
