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
  const text = 'DEMO'
  const fontSize = 120  // 增大字号，更明显
  
  // 保存当前状态
  ctx.save()
  
  // 设置水印样式
  ctx.font = `bold ${fontSize}px sans-serif`  // 加粗字体
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'  // 增加不透明度到30%
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  // 移动到画布中心
  ctx.translate(canvas.width / 2, canvas.height / 2)
  
  // 旋转 -45 度
  ctx.rotate(-45 * Math.PI / 180)
  
  // 绘制水印文本（带描边更明显）
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'  // 白色描边
  ctx.lineWidth = 3
  ctx.strokeText(text, 0, 0)
  ctx.fillText(text, 0, 0)
  
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
