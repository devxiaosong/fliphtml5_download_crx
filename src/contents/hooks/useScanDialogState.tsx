import { useState, useEffect, useRef, useCallback } from "react"
import { Modal, message } from "antd"
import { logInfo, getAppInfo } from "../../core/misc"
import { useTextExport } from "./useTextExport"
import { addDownloadHistory } from "../../utils/downloadHistory"

export interface ImageState {
  thumbImages: string[]
  normalImages: string[]
  totalPages: number
  isLoaded: boolean
}

export interface MetaInfo {
  title: string
  pageCount: number
  pageWidth: number
  pageHeight: number
}

interface FlipHTML5Rules {
  baseUrl: string
  homepage?: string
}

function getHtmlConfig(): Promise<any> {
  return new Promise((resolve) => {
    const eventName = "htmlConfigLoaded_" + Date.now()
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
        const fliphtml5Pages = (window.global && window.global.fliphtml5_pages) || null;
        const htmlConfigMeta = (window.htmlConfig && window.htmlConfig.meta) || null;
        const combinedData = { fliphtml5_pages: fliphtml5Pages, htmlConfig_meta: htmlConfigMeta };
        window.dispatchEvent(new CustomEvent('${eventName}', { detail: combinedData }));
      })();
    `
    )
    document.documentElement.appendChild(element)
    element.click()
    element.remove()
  })
}

const initialImageState: ImageState = {
  thumbImages: [],
  normalImages: [],
  totalPages: 0,
  isLoaded: false
}

export interface UseScanDialogStateReturn {
  visible: boolean
  loading: boolean
  imageState: ImageState
  metaInfo: MetaInfo | null
  openScanDialog: () => Promise<void>
  handleClose: () => void
  getHomepage: () => string | undefined
  handleExtractText: () => Promise<void>
}

export function useScanDialogState(): UseScanDialogStateReturn {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [imageState, setImageState] = useState<ImageState>(initialImageState)
  const [metaInfo, setMetaInfo] = useState<MetaInfo | null>(null)
  const fliphtml5RulesRef = useRef<FlipHTML5Rules | null>(null)
  const metaInfoRef = useRef<MetaInfo | null>(null)
  const coverUrlRef = useRef<string | undefined>(undefined)

  const { handleExtractText } = useTextExport({ metaInfoRef, coverUrlRef })

  const openScanDialog = useCallback(async () => {
    const currentUrl = window.location.href
    logInfo("open_dialog", `Dialog opened | URL: ${currentUrl}`)
    setVisible(true)

    const maxRetries = 3
    const retryDelay = 3000

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await new Promise((r) => setTimeout(r, retryDelay))
        const pageConfig = await getHtmlConfig()

        if (!pageConfig.fliphtml5_pages || !Array.isArray(pageConfig.fliphtml5_pages)) {
          throw new Error("fliphtml5_pages not found or invalid")
        }
        if (!pageConfig.htmlConfig_meta) {
          throw new Error("htmlConfig.meta not found")
        }

        const meta: MetaInfo = {
          title: pageConfig.htmlConfig_meta.title || "no title",
          pageCount: pageConfig.htmlConfig_meta.pageCount || 0,
          pageWidth: pageConfig.htmlConfig_meta.pageWidth || 0,
          pageHeight: pageConfig.htmlConfig_meta.pageHeight || 0
        }
        setMetaInfo(meta)
        metaInfoRef.current = meta

        const baseUrl = currentUrl.split(/[#?]/)[0]
        const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/"
        const cleanPath = (path: string) => {
          if (!path) return ""
          let cleaned = path.startsWith("./") ? path.slice(2) : path
          return cleaned.split("?")[0]
        }

        const thumbImages: string[] = []
        const normalImages: string[] = []
        pageConfig.fliphtml5_pages.forEach((page: any) => {
          thumbImages.push(normalizedBaseUrl + cleanPath(page.t))
          normalImages.push(normalizedBaseUrl + cleanPath(page.n))
        })

        setImageState({
          thumbImages,
          normalImages,
          totalPages: meta.pageCount || thumbImages.length,
          isLoaded: true
        })
        coverUrlRef.current = normalImages[0]

        addDownloadHistory({
          title: meta.title,
          url: currentUrl,
          pages: meta.pageCount || thumbImages.length,
          type: "PDF",
          coverUrl: normalImages[0],
        })

        logInfo(
          "load_images",
          `Loaded ${thumbImages.length} images, title: ${meta.title} | URL: ${currentUrl}`
        )
        return
      } catch (error) {
        console.error(`Attempt ${attempt}/${maxRetries} failed:`, error)
        if (attempt < maxRetries) continue
        console.error("All retry attempts failed")
        logInfo(
          "load_images",
          `Failed to load after ${maxRetries} attempts: ${error} | URL: ${currentUrl}`
        )
        Modal.error({
          title: "Failed to Load",
          content: (
            <div>
              <p>Unable to load the page content. Please refresh the page and try again.</p>
              <p style={{ marginTop: "12px", fontSize: "12px", color: "#666" }}>
                If the problem persists, please contact support:{" "}
                <a href="mailto:extensionkit@gmail.com" style={{ marginLeft: "4px" }}>
                  extensionkit@gmail.com
                </a>
              </p>
            </div>
          ),
          onOk: () => setVisible(false)
        })
        setVisible(false)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const appInfo = await getAppInfo()
        if (cancelled || !appInfo || !(appInfo as any).fliphtml5_rules) {
          if (!cancelled) throw new Error("fliphtml5_rules not found in appInfo")
          return
        }
        fliphtml5RulesRef.current = (appInfo as any).fliphtml5_rules
        setLoading(false)
        if (
          !cancelled &&
          window.location.href.startsWith(fliphtml5RulesRef.current!.baseUrl)
        ) {
          openScanDialog()
        }
      } catch (error) {
        if (!cancelled) {
          setLoading(false)
          message.error("Failed to load application configuration. Please refresh the page.")
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [openScanDialog])

  const handleClose = useCallback(() => {
    logInfo(
      "close_dialog",
      `Dialog closed (totalImages: ${imageState.totalPages}) | URL: ${window.location.href}`
    )
    setVisible(false)
  }, [imageState.totalPages])

  const getHomepage = useCallback(
    () => fliphtml5RulesRef.current?.homepage,
    []
  )

  return {
    visible,
    loading,
    imageState,
    metaInfo,
    openScanDialog,
    handleClose,
    getHomepage,
    handleExtractText
  }
}
