// ─── Header / Footer ─────────────────────────────────────────────────────────

export interface HeaderFooterSettings {
  enabled: boolean
  headerText: string
  headerUrl: string   // 可选：设置后文字渲染为可点击链接
  footerText: string
  footerUrl: string
}

export const DEFAULT_HEADER_FOOTER: HeaderFooterSettings = {
  enabled: false,
  headerText: "",
  headerUrl: "",
  footerText: "",
  footerUrl: "",
}

// 免费用户强制显示的系统品牌 footer
export const FREE_SYSTEM_FOOTER = {
  footerText: "FlipHTML5 PDF Downloader",
  footerUrl: "https://www.fliphtml5.com",
}

const HEADER_FOOTER_KEY = "fliphtml5_header_footer_settings"

export async function getHeaderFooterSettings(): Promise<HeaderFooterSettings> {
  const result = await chrome.storage.local.get(HEADER_FOOTER_KEY)
  return { ...DEFAULT_HEADER_FOOTER, ...(result[HEADER_FOOTER_KEY] ?? {}) }
}

export async function saveHeaderFooterSettings(settings: HeaderFooterSettings): Promise<void> {
  await chrome.storage.local.set({ [HEADER_FOOTER_KEY]: settings })
}

// ─── Watermark ────────────────────────────────────────────────────────────────

export interface WatermarkSettings {
  enabled: boolean
  text: string
  fontSize: number  // slider 单位（基准 595 宽度），生成时会按 canvas 实际宽度等比缩放
  angle: number     // 0–360 度，逆时针
}

export const DEFAULT_WATERMARK: WatermarkSettings = {
  enabled: true,
  text: "CONFIDENTIAL",
  fontSize: 36,
  angle: 45,
}

const WATERMARK_KEY = "fliphtml5_watermark_settings"

export async function getWatermarkSettings(): Promise<WatermarkSettings> {
  const result = await chrome.storage.local.get(WATERMARK_KEY)
  return { ...DEFAULT_WATERMARK, ...(result[WATERMARK_KEY] ?? {}) }
}

export async function saveWatermarkSettings(settings: WatermarkSettings): Promise<void> {
  await chrome.storage.local.set({ [WATERMARK_KEY]: settings })
}
