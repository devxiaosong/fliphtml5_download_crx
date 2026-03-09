import { createClient } from '@supabase/supabase-js'
import type { SupportedStorage } from '@supabase/supabase-js'

const supabaseUrl = 'https://qbedzukaxpsvpodfmhqj.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZWR6dWtheHBzdnBvZGZtaHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODgxOTMxNDUsImV4cCI6MjAwMzc2OTE0NX0.lzRgom-8Kqn3iwnt-6ja2iUEG8q6gpc7vuuU8-Se4lY'

// 用 chrome.storage.local 替代 localStorage，实现跨页面共享 session
const chromeStorageAdapter: SupportedStorage = {
  getItem: (key: string) =>
    new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        const val = result[key] ?? null
        console.log(`[storage] getItem "${key}":`, val ? "found" : "null")
        resolve(val)
      })
    }),
  setItem: (key: string, value: string) =>
    new Promise((resolve) => {
      console.log(`[storage] setItem "${key}"`)
      chrome.storage.local.set({ [key]: value }, () => resolve())
    }),
  removeItem: (key: string) =>
    new Promise((resolve) => {
      console.log(`[storage] removeItem "${key}"`)
      chrome.storage.local.remove(key, () => resolve())
    })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: chromeStorageAdapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
})
