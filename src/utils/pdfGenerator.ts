import { jsPDF } from 'jspdf'

export type PDFOrientation = 'portrait' | 'landscape' | 'square'

interface PDFOptions {
  orientation: PDFOrientation
  addWatermark: boolean
  title?: string
}

// PDF 页面尺寸（单位：mm）
const PAGE_SIZES = {
  portrait: { width: 210, height: 297 },    // A4 纵向
  landscape: { width: 297, height: 210 },   // A4 横向
  square: { width: 210, height: 210 }       // 正方形
}

// 添加水印到canvas
function addWatermarkToCanvas(
  canvas: HTMLCanvasElement, 
  ctx: CanvasRenderingContext2D
): void {
  const text = 'Source: FlipHTML5 | Non-Commercial Authorization | Redistribution and Resale Are Strictly Prohibited'
  const fontSize = 96  // 字号
  const lineHeight = 144  // 行间距
  const angle = -45  // 旋转角度
  
  // 保存当前状态
  ctx.save()
  
  // 设置水印样式
  ctx.font = `${fontSize}px sans-serif`
  ctx.fillStyle = 'rgba(0, 0, 0, 0.30)'  // 15% 不透明度
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  // 测量文本宽度
  const textWidth = ctx.measureText(text).width
  
  // 计算旋转后需要覆盖的范围
  const diagonal = Math.sqrt(canvas.width ** 2 + canvas.height ** 2)
  
  // 移动到画布中心
  ctx.translate(canvas.width / 2, canvas.height / 2)
  
  // 旋转
  ctx.rotate(angle * Math.PI / 180)
  
  // 计算需要绘制的行数和列数，确保铺满整个画布
  const rowSpacing = lineHeight
  const colSpacing = textWidth + 100  // 列间距
  const numRows = Math.ceil(diagonal / rowSpacing) + 2
  const numCols = Math.ceil(diagonal / colSpacing) + 2
  
  // 在旋转后的空间中绘制水印网格
  for (let row = -numRows; row <= numRows; row++) {
    for (let col = -numCols; col <= numCols; col++) {
      const x = col * colSpacing
      const y = row * rowSpacing
      ctx.fillText(text, x, y)
    }
  }
  
  // 恢复状态
  ctx.restore()
}

// 加载图片为 Image 对象
async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // 允许跨域
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// 将图片转换为带水印的 canvas
async function imageToCanvas(
  imageUrl: string, 
  addWatermark: boolean
): Promise<HTMLCanvasElement> {
  const img = await loadImage(imageUrl)
  
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }
  
  // 绘制原图
  ctx.drawImage(img, 0, 0)
  
  // 添加水印
  if (addWatermark) {
    addWatermarkToCanvas(canvas, ctx)
  }
  
  return canvas
}

// 生成 PDF
export async function generatePDF(
  imageUrls: string[],
  options: PDFOptions
): Promise<Blob> {
  if (imageUrls.length === 0) {
    throw new Error('No images to generate PDF')
  }

  const { orientation, addWatermark, title } = options
  const pageSize = PAGE_SIZES[orientation]
  
  // 创建 PDF 文档
  const pdf = new jsPDF({
    orientation: orientation === 'square' ? 'portrait' : orientation,
    unit: 'mm',
    format: [pageSize.width, pageSize.height]
  })

  console.log(`Generating PDF with ${imageUrls.length} images...`)
  console.log(`Page size: ${pageSize.width}mm x ${pageSize.height}mm`)
  console.log(`Watermark: ${addWatermark ? 'Yes' : 'No'}`)

  // 逐页添加图片
  for (let i = 0; i < imageUrls.length; i++) {
    console.log(`Processing image ${i + 1}/${imageUrls.length}...`)
    
    try {
      // 转换图片（可能添加水印）
      const canvas = await imageToCanvas(imageUrls[i], addWatermark)
      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      
      // 如果不是第一页，添加新页
      if (i > 0) {
        pdf.addPage([pageSize.width, pageSize.height])
      }
      
      // 计算图片在页面上的尺寸（保持比例，适应页面）
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const imgRatio = imgWidth / imgHeight
      const pageRatio = pageSize.width / pageSize.height
      
      let finalWidth: number
      let finalHeight: number
      let x: number
      let y: number
      
      if (imgRatio > pageRatio) {
        // 图片更宽，以宽度为准
        finalWidth = pageSize.width
        finalHeight = pageSize.width / imgRatio
        x = 0
        y = (pageSize.height - finalHeight) / 2
      } else {
        // 图片更高，以高度为准
        finalHeight = pageSize.height
        finalWidth = pageSize.height * imgRatio
        x = (pageSize.width - finalWidth) / 2
        y = 0
      }
      
      // 添加图片到 PDF
      pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight)
      
    } catch (error) {
      console.error(`Failed to process image ${i + 1}:`, error)
      // 继续处理其他图片
    }
  }

  // 设置 PDF 元数据
  pdf.setProperties({
    title: title || 'FlipHTML5 Download',
    subject: 'Downloaded from FlipHTML5',
    author: 'FlipHTML5 Downloader',
    creator: 'FlipHTML5 Downloader Extension'
  })

  console.log('PDF generation complete')

  // 返回 PDF Blob
  return pdf.output('blob')
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
