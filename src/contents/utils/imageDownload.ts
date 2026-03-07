export function generateImageFileName(title: string, label: string): string {
  let safeTitle = (title || "no title")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
  if (safeTitle.length > 100) safeTitle = safeTitle.slice(0, 100)
  const safeLabel = label.replace(/\s+/g, "-")
  const now = new Date()
  const timestamp = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}_${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`
  return `${safeTitle}-${safeLabel}-${timestamp}.jpg`
}

export async function downloadImage(imgUrl: string, fileName: string): Promise<void> {
  const response = await fetch(imgUrl)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 根据图片索引和总数获取页面标签 */
export function getLabelByIndex(index: number, totalImages: number): string {
  if (index === 0) return "Cover"
  if (index === totalImages - 1) return "Back Cover"
  return `Page ${index + 1}`
}
