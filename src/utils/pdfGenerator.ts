export type PDFOrientation = 'portrait' | 'landscape' | 'square'

export interface WatermarkOptions {
  text: string
  fontSize: number  // 基准 595 宽度下的字号，实际生成时按 canvas 宽度等比缩放
  angle: number     // 0–360 度，逆时针
}

interface PDFOptions {
  orientation: PDFOrientation
  addWatermark: boolean
  watermarkOptions?: WatermarkOptions
  title?: string
  homepage?: string
  customPageSize?: { width: number; height: number }
  onProgress?: (current: number, total: number) => void
  imageQuality?: number
  headerText?: string
  headerUrl?: string
  footerText?: string
  footerUrl?: string
}

// PDF 字符串中转义特殊字符
function escapePdfString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

// PDF 页面尺寸（单位：points, 1mm = 2.83465 points）
const PAGE_SIZES = {
  portrait: { width: 595, height: 842 },    // A4 纵向 (210x297mm)
  landscape: { width: 842, height: 595 },   // A4 横向
  square: { width: 595, height: 595 }       // 正方形
}

// 添加水印到canvas（支持自定义文字、字号、角度）
function addWatermarkToCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  options: WatermarkOptions
): void {
  const { text, fontSize, angle } = options
  // 按 canvas 实际宽度等比缩放字号（基准 595px = A4 宽度单位）
  const scaledFontSize = Math.max(12, Math.round(fontSize * canvas.width / 595))
  const lineHeight = scaledFontSize * 1.8
  const radians = -(angle * Math.PI / 180)

  ctx.save()
  ctx.font = `bold ${scaledFontSize}px sans-serif`
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const textWidth = ctx.measureText(text).width
  const diagonal = Math.sqrt(canvas.width ** 2 + canvas.height ** 2)

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(radians)

  const rowSpacing = lineHeight
  const colSpacing = textWidth + scaledFontSize * 2
  const numRows = Math.ceil(diagonal / rowSpacing) + 2
  const numCols = Math.ceil(diagonal / colSpacing) + 2

  for (let row = -numRows; row <= numRows; row++) {
    for (let col = -numCols; col <= numCols; col++) {
      ctx.fillText(text, col * colSpacing, row * rowSpacing)
    }
  }

  ctx.restore()
}

// 加载图片
async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// 将图片转换为带水印的 canvas
export async function imageToCanvas(
  imageUrl: string,
  addWatermark: boolean,
  watermarkOptions?: WatermarkOptions
): Promise<HTMLCanvasElement> {
  const img = await loadImage(imageUrl)

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  ctx.drawImage(img, 0, 0)

  if (addWatermark && watermarkOptions) {
    addWatermarkToCanvas(canvas, ctx, watermarkOptions)
  }

  return canvas
}

// 简单的 PDF 生成器类
class SimplePDFGenerator {
  private objects: string[] = []
  private objectOffsets: number[] = []
  private content: string = ''

  private objectId = 0
  private pageIds: number[] = []
  private imageIds: number[] = []
  private fontId: number = 0

  constructor(
    private pageWidth: number,
    private pageHeight: number,
    private title: string = 'Document',
    private homepage?: string,
    private headerText?: string,
    private headerUrl?: string,
    private footerText?: string,
    private footerUrl?: string,
  ) {
    this.content = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'

    // 任何文字渲染（homepage / 自定义 header / footer）都需要字体对象
    if (this.homepage || this.headerText || this.footerText) {
      this.fontId = this.addObject(
        `<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>`
      )
    }
  }

  private addObject(obj: string): number {
    this.objectOffsets.push(this.content.length)
    const id = ++this.objectId
    this.content += `${id} 0 obj\n${obj}\nendobj\n`
    return id
  }

  async addImagePage(imageDataUrl: string): Promise<void> {
    // 从 data URL 提取 JPEG 数据
    const base64Data = imageDataUrl.split(',')[1]
    const imageData = atob(base64Data)

    // 获取图片尺寸
    const img = new Image()
    img.src = imageDataUrl
    await new Promise(resolve => { img.onload = resolve })

    const imgWidth = img.width
    const imgHeight = img.height

    // 计算适应页面的尺寸
    const imgRatio = imgWidth / imgHeight
    const pageRatio = this.pageWidth / this.pageHeight

    let finalWidth: number, finalHeight: number, x: number, y: number

    if (imgRatio > pageRatio) {
      finalWidth = this.pageWidth
      finalHeight = this.pageWidth / imgRatio
      x = 0
      y = (this.pageHeight - finalHeight) / 2
    } else {
      finalHeight = this.pageHeight
      finalWidth = this.pageHeight * imgRatio
      x = (this.pageWidth - finalWidth) / 2
      y = 0
    }

    // 创建图片对象
    const imageId = this.addObject(
      `<<\n/Type /XObject\n/Subtype /Image\n/Width ${imgWidth}\n/Height ${imgHeight}\n/ColorSpace /DeviceRGB\n/BitsPerComponent 8\n/Filter /DCTDecode\n/Length ${imageData.length}\n>>\nstream\n${imageData}\nendstream`
    )
    this.imageIds.push(imageId)

    // 创建页面内容流
    let contentStream = `q\n${finalWidth.toFixed(2)} 0 0 ${finalHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im${imageId} Do\nQ`

    // 如果有 homepage，在页眉和页脚添加链接文本
    const linkAnnotIds: number[] = []

    // 自定义 Header 文字（左上角）
    if (this.headerText && this.fontId) {
      const fs = 11
      const txt = escapePdfString(this.headerText)
      const tw = this.headerText.length * fs * 0.52
      const tx = 10
      const ty = this.pageHeight - fs - 8
      const color = this.headerUrl ? '0 0 0.8 rg' : '0.3 0.3 0.3 rg'
      contentStream += `\nBT\n/F1 ${fs} Tf\n${tx} ${ty} Td\n${color}\n(${txt}) Tj\nET`
      if (this.headerUrl) {
        const actionId = this.addObject(`<<\n/S /URI\n/URI (${this.headerUrl})\n>>`)
        linkAnnotIds.push(this.addObject(
          `<<\n/Type /Annot\n/Subtype /Link\n/Rect [${tx} ${ty} ${tx + tw} ${ty + fs}]\n/Border [0 0 0]\n/A ${actionId} 0 R\n>>`
        ))
      }
    }

    // 自定义 Footer 文字（左下角）
    if (this.footerText && this.fontId) {
      const fs = 11
      const txt = escapePdfString(this.footerText)
      const tw = this.footerText.length * fs * 0.52
      const tx = 10
      const ty = 8
      const color = this.footerUrl ? '0 0 0.8 rg' : '0.3 0.3 0.3 rg'
      contentStream += `\nBT\n/F1 ${fs} Tf\n${tx} ${ty} Td\n${color}\n(${txt}) Tj\nET`
      if (this.footerUrl) {
        const actionId = this.addObject(`<<\n/S /URI\n/URI (${this.footerUrl})\n>>`)
        linkAnnotIds.push(this.addObject(
          `<<\n/Type /Annot\n/Subtype /Link\n/Rect [${tx} ${ty} ${tx + tw} ${ty + fs}]\n/Border [0 0 0]\n/A ${actionId} 0 R\n>>`
        ))
      }
    }

    const contentId = this.addObject(
      `<<\n/Length ${contentStream.length}\n>>\nstream\n${contentStream}\nendstream`
    )

    // 创建页面对象（有字体则引用 F1）
    const resourcesDict = this.fontId
      ? `/XObject << /Im${imageId} ${imageId} 0 R >>\n/Font << /F1 ${this.fontId} 0 R >>`
      : `/XObject << /Im${imageId} ${imageId} 0 R >>`

    const annotsRef = linkAnnotIds.length > 0
      ? `/Annots [${linkAnnotIds.map(id => `${id} 0 R`).join(' ')}]\n`
      : ''

    const pageId = this.addObject(
      `<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n${resourcesDict}\n>>\n/MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}]\n/Contents ${contentId} 0 R\n${annotsRef}>>`
    )
    this.pageIds.push(pageId)
  }

  generate(): Blob {
    // 创建 Pages 对象
    const pagesId = this.addObject(
      `<<\n/Type /Pages\n/Kids [${this.pageIds.map(id => `${id} 0 R`).join(' ')}]\n/Count ${this.pageIds.length}\n>>`
    )

    // 创建 Catalog 对象
    const catalogId = this.addObject(
      `<<\n/Type /Catalog\n/Pages ${pagesId} 0 R\n>>`
    )

    // 创建 Info 对象
    const infoId = this.addObject(
      `<<\n/Title (${this.title})\n/Producer (FlipHTML5 Downloader)\n/Creator (FlipHTML5 Downloader Extension)\n>>`
    )

    // 创建 cross-reference table
    const xrefOffset = this.content.length
    this.content += 'xref\n'
    this.content += `0 ${this.objectId + 1}\n`
    this.content += '0000000000 65535 f \n'

    for (const offset of this.objectOffsets) {
      this.content += `${offset.toString().padStart(10, '0')} 00000 n \n`
    }

    // 创建 trailer
    this.content += 'trailer\n'
    this.content += `<<\n/Size ${this.objectId + 1}\n/Root ${catalogId} 0 R\n/Info ${infoId} 0 R\n>>\n`
    this.content += 'startxref\n'
    this.content += `${xrefOffset}\n`
    this.content += '%%EOF'

    // 转换为 Blob
    const bytes = new Uint8Array(this.content.length)
    for (let i = 0; i < this.content.length; i++) {
      bytes[i] = this.content.charCodeAt(i)
    }

    return new Blob([bytes], { type: 'application/pdf' })
  }
}

// 生成 PDF
export async function generatePDF(
  imageUrls: string[],
  options: PDFOptions
): Promise<Blob> {
  if (imageUrls.length === 0) {
    throw new Error('No images to generate PDF')
  }

  const {
    orientation, addWatermark, watermarkOptions, title, homepage,
    customPageSize, onProgress, imageQuality = 0.92,
    headerText, headerUrl, footerText, footerUrl,
  } = options
  const pageSize = customPageSize ?? PAGE_SIZES[orientation]

  const pdf = new SimplePDFGenerator(
    pageSize.width,
    pageSize.height,
    title || 'FlipHTML5 Download',
    homepage,
    headerText,
    headerUrl,
    footerText,
    footerUrl,
  )

  // 逐页添加图片
  for (let i = 0; i < imageUrls.length; i++) {
    console.log(`Processing image ${i + 1}/${imageUrls.length}...`)

    try {
      const canvas = await imageToCanvas(imageUrls[i], addWatermark, watermarkOptions)
      const imgData = canvas.toDataURL('image/jpeg', imageQuality)
      await pdf.addImagePage(imgData)

      // 调用进度回调
      if (onProgress) {
        onProgress(i + 1, imageUrls.length)
      }
    } catch (error) {
      console.error(`Failed to process image ${i + 1}:`, error)
    }
  }

  console.log('PDF generation complete')
  return pdf.generate()
}

// 下载 PDF 文件
export function downloadPDF(blob: Blob, filename: string = 'fliphtml5-download.pdf'): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
