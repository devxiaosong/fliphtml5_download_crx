import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://next-js-supabase-paddle-hq-starter-kappa.vercel.app/auth/callback*"],
  run_at: "document_start"
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return
  if (event.data?.type !== "SUPABASE_TOKEN") return

  chrome.runtime.sendMessage({
    type: "SUPABASE_TOKEN",
    hash: event.data.hash
  })
})
