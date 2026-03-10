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
