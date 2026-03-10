import { useCallback } from "react"
import { message } from "antd"
import { logInfo } from "../../core/misc"
import { addDownloadHistory } from "../../utils/downloadHistory"
import type { MetaInfo } from "./useScanDialogState"

export function getTextForPages(): Promise<any[]> {
  return new Promise((resolve) => {
    const eventName = "textForPagesLoaded_" + Date.now()
    window.addEventListener(
      eventName,
      (event: any) => resolve(event.detail),
      { once: true }
    )
    const element = document.createElement("div")
    element.style.display = "none"
    element.setAttribute(
      "onclick",
      `
      (function() {
        const textForPages = (window.global && window.global.textForPages) || [];
        window.dispatchEvent(new CustomEvent('${eventName}', { detail: textForPages }));
      })();
    `
    )
    document.documentElement.appendChild(element)
    element.click()
    element.remove()
  })
}

export function generateTxtFileName(title: string): string {
  try {
    let safeTitle = title || "no title"
    safeTitle = safeTitle.replace(/[<>:"/\\|?*]/g, "_")
    safeTitle = safeTitle.replace(/\s+/g, " ").trim()
    if (safeTitle.length > 100) safeTitle = safeTitle.slice(0, 100)
    const now = new Date()
    const timestamp = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}_${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`
    return `${safeTitle}-text-${timestamp}.txt`
  } catch {
    return `no_title-text.txt`
  }
}

export function extractPageText(page: any): string {
  if (!page) return ""
  if (typeof page === "string") return page
  if (Array.isArray(page)) return page.map(extractPageText).join(" ")
  if (typeof page === "object") {
    if (typeof page.text === "string") return page.text
    if (typeof page.content === "string") return page.content
    return JSON.stringify(page)
  }
  return String(page)
}

export function downloadTxt(content: string, fileName: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

interface UseTextExportParams {
  metaInfoRef: React.RefObject<MetaInfo | null>
  coverUrlRef?: React.RefObject<string | undefined>
}

export function useTextExport({ metaInfoRef, coverUrlRef }: UseTextExportParams) {
  const handleExtractText = useCallback(async () => {
    const currentUrl = window.location.href

    // 如果 URL 中没有 search 参数，先加上再刷新页面
    const urlObj = new URL(currentUrl)
    if (!urlObj.searchParams.has("search")) {
      logInfo("extract_text", `No search param, reloading with ?search=1 | URL: ${currentUrl}`)
      urlObj.searchParams.set("search", "1")
      window.location.href = urlObj.toString()
      return
    }

    logInfo("extract_text", `Extract text triggered | URL: ${currentUrl}`)
    try {
      const textForPages = await getTextForPages()
      console.log("[textForPages]", textForPages)

      if (!Array.isArray(textForPages) || textForPages.length === 0) {
        message.warning("No text content found on this page.")
        return
      }

      const lines: string[] = []
      textForPages.forEach((page: any, index: number) => {
        const pageText = extractPageText(page).trim()
        lines.push(`--- Page ${index + 1} ---`)
        lines.push(pageText || "(empty)")
        lines.push("")
      })

      const content = lines.join("\n")
      const title = metaInfoRef.current?.title || "no title"
      const fileName = generateTxtFileName(title)

      downloadTxt(content, fileName)
      logInfo("extract_text", `Text exported: ${fileName} (${textForPages.length} pages) | URL: ${currentUrl}`)
      message.success(`Text exported: ${fileName}`)
      addDownloadHistory({
        title: metaInfoRef.current?.title || "no title",
        url: currentUrl,
        pages: textForPages.length,
        type: "Text",
        coverUrl: coverUrlRef?.current,
      })
    } catch (error) {
      console.error("Failed to extract text:", error)
      message.error("Failed to extract text.")
    }
  }, [metaInfoRef])

  return { handleExtractText }
}
