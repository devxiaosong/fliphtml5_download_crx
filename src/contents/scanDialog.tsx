import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect, useRef, useCallback } from "react"
import { ConfigProvider, Modal, Button, Flex, Space, Typography, Card, message, Dropdown } from "antd"
import type { MenuProps } from "antd"
import { DownloadOutlined, FileTextOutlined, LayoutOutlined, BorderOutlined } from "@ant-design/icons"
import { generatePDF, downloadPDF } from "../utils/pdfGenerator"
import type { PDFOrientation } from "../utils/pdfGenerator"
import { logInfo, getAppInfo } from "../utils/misc"

const { Text } = Typography

// Helper function to get current page info (URL and page number)
const getPageInfo = (): string => {
  try {
    const url = window.location.href

    // Extract page number from URL (format: #p=1 or &p=1)
    let pageNumber = 'N/A'
    const pageMatch = url.match(/[#&]p=(\d+)/)
    if (pageMatch) {
      pageNumber = pageMatch[1]
    }

    return `URL: ${url} | Page: ${pageNumber}`
  } catch (error) {
    console.error('Failed to get page info:', error)
    return 'URL: unknown | Page: N/A'
  }
}

//https://online.fliphtml5.com/oddka/BBC-Science-Focus-December-2025/#p=1
export const config: PlasmoCSConfig = {
  matches: ["https://online.fliphtml5.com/*"],
  all_frames: false,
  css: ["scanDialog.css"]
}

// 定义 FlipHTML5 规则类型
interface FlipHTML5Rules {
  baseUrl: string
  homepage?: string
}

interface ImageState {
  thumbImages: string[]     // 用于展示的缩略图
  normalImages: string[]    // 用于生成PDF的高清图
  totalPages: number
  isLoaded: boolean         // 是否已加载
}

function ScanDialog() {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape' | 'square'>('portrait')
  const [imageState, setImageState] = useState<ImageState>({
    thumbImages: [],
    normalImages: [],
    totalPages: 0,
    isLoaded: false
  })

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const fliphtml5RulesRef = useRef<FlipHTML5Rules | null>(null)

  // ========== 扫描逻辑 ==========

  // 从页面上下文获取配置信息（绕过 CSP）
  function getHtmlConfig(): Promise<any> {
    return new Promise((resolve) => {
      const eventName = 'htmlConfigLoaded_' + Date.now()
      
      // 监听自定义事件
      window.addEventListener(eventName, (event: any) => {
        resolve(event.detail)
      }, { once: true })
      
      // 使用 DOM 元素的事件处理器来访问页面上下文（绕过 CSP）
      const element = document.createElement('div')
      element.style.display = 'none'
      element.setAttribute('onclick', `
        (function() {
          const fliphtml5Pages = (window.global && window.global.fliphtml5_pages) || null;
          const htmlConfigMeta = (window.htmlConfig && window.htmlConfig.meta) || null;
          
          const combinedData = {
            fliphtml5_pages: fliphtml5Pages,
            htmlConfig_meta: htmlConfigMeta
          };
          
          window.dispatchEvent(new CustomEvent('${eventName}', {
            detail: combinedData
          }));
        })();
      `)
      document.documentElement.appendChild(element)
      element.click()
      element.remove()
    })
  }

  // ========== 事件处理 ==========

  // 打开对话框并加载图片列表
  const openScanDialog = useCallback(async () => {
    const pageInfo = getPageInfo()
    logInfo('open_dialog', `Dialog opened | ${pageInfo}`)

    // 打开弹窗
    setVisible(true)

    // 从页面配置加载图片列表
    try {
      const pageConfig = await getHtmlConfig()
      console.log('=== Page Configuration ===')
      console.log('fliphtml5_pages:', pageConfig.fliphtml5_pages)
      console.log('htmlConfig.meta:', pageConfig.htmlConfig_meta)
      
      // 处理图片 URL
      if (pageConfig.fliphtml5_pages && Array.isArray(pageConfig.fliphtml5_pages)) {
        const currentUrl = window.location.href
        // 获取基础 URL (移除 hash 和查询参数)
        const baseUrl = currentUrl.split(/[#?]/)[0]
        // 确保以 / 结尾
        const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'
        
        // 处理路径：移除 ./ 前缀和查询参数
        const cleanPath = (path: string) => {
          if (!path) return ''
          // 移除 ./ 前缀
          let cleaned = path.startsWith('./') ? path.substring(2) : path
          // 移除查询参数
          cleaned = cleaned.split('?')[0]
          return cleaned
        }
        
        const thumbImages: string[] = []
        const normalImages: string[] = []
        
        pageConfig.fliphtml5_pages.forEach((page: any, index: number) => {
          const normalPath = cleanPath(page.n)
          const thumbPath = cleanPath(page.t)
          
          thumbImages.push(normalizedBaseUrl + thumbPath)
          normalImages.push(normalizedBaseUrl + normalPath)
          
          if (index < 5) {  // 只打印前5个
            console.log(`Page ${index + 1}:`)
            console.log(`  Normal: ${normalizedBaseUrl + normalPath}`)
            console.log(`  Thumb:  ${normalizedBaseUrl + thumbPath}`)
          }
        })
        
        if (pageConfig.fliphtml5_pages.length > 5) {
          console.log(`... and ${pageConfig.fliphtml5_pages.length - 5} more pages`)
        }
        
        // 更新状态
        setImageState({
          thumbImages: thumbImages,
          normalImages: normalImages,
          totalPages: thumbImages.length,
          isLoaded: true
        })
        
        console.log(`=== Loaded ${thumbImages.length} images ===`)
        logInfo('load_images', `Loaded ${thumbImages.length} images from config | ${pageInfo}`)
      } else {
        throw new Error('fliphtml5_pages not found or invalid')
      }
    } catch (error) {
      console.error('Failed to load images from config:', error)
      message.error('Failed to load images. Please refresh the page and try again.')
      logInfo('load_images', `Failed to load from config: ${error} | ${pageInfo}`)
      setVisible(false)
    }
  }, [])

  // 页面加载时先加载配置，然后打开对话框
  useEffect(() => {
    const initializeApp = async () => {
      setLoading(true)

      try {
        // 调用 getAppInfo 获取应用信息
        const appInfo = await getAppInfo()

        if (!appInfo || !(appInfo as any).fliphtml5_rules) {
          throw new Error('fliphtml5_rules not found in appInfo')
        }

        // 从 appInfo 中提取并设置 fliphtml5_rules
        fliphtml5RulesRef.current = (appInfo as any).fliphtml5_rules

        setLoading(false)

        // 如果当前页面匹配 baseUrl，自动打开对话框
        if (window.location.href.startsWith(fliphtml5RulesRef.current!.baseUrl)) {
          openScanDialog()
        }
      } catch (error) {
        setLoading(false)
        message.error('Failed to load application configuration. Please refresh the page.')
      }
    }

    initializeApp()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 监听来自 popup 的消息
  useEffect(() => {
    const handleMessage = (request: any) => {
      if (request.action === 'showScanDialog') {
        if (!fliphtml5RulesRef.current) {
          message.warning('Please wait, loading configuration...')
          return
        }
        openScanDialog()
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [openScanDialog])

  // 生成 PDF 文件名
  const generatePdfFileName = (orientation: PDFOrientation): string => {
    try {
      const currentUrl = window.location.href
      const urlObj = new URL(currentUrl)

      // 提取路径段，过滤空字符串
      let pathSegments = urlObj.pathname
        .split('/')
        .filter(seg => seg.trim() !== '')

      // 处理路径段：解码、清理非法字符、截断长度
      const processSegment = (seg: string): string => {
        try {
          // 解码 URL 编码
          seg = decodeURIComponent(seg)
        } catch {
          // 解码失败，保持原样
        }

        // 清理非法文件名字符（Windows + Unix）
        seg = seg.replace(/[<>:"/\\|?*\s]/g, '_')

        // 截断到最大长度
        const maxLength = 50
        if (seg.length > maxLength) {
          seg = seg.slice(0, maxLength)
        }

        return seg
      }

      // 处理所有路径段
      pathSegments = pathSegments.map(processSegment)

      // 生成时间戳
      const now = new Date()
      const timestamp = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`

      // 根据路径段数量生成文件名
      let fileName: string
      if (pathSegments.length >= 2) {
        // 有2个或以上路径段：segment1-segment2-orientation-timestamp
        fileName = `${pathSegments[0]}-${pathSegments[1]}-${orientation}-${timestamp}`
      } else if (pathSegments.length === 1) {
        // 只有1个路径段：segment1-orientation-timestamp
        fileName = `${pathSegments[0]}-${orientation}-${timestamp}`
      } else {
        // 没有路径段：默认名称
        fileName = `fliphtml5_download-${orientation}-${timestamp}`
      }

      return `${fileName}.pdf`

    } catch (error) {
      // URL 解析失败或其他异常，使用默认名称
      const now = new Date()
      const timestamp = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
      return `fliphtml5_download-${orientation}-${timestamp}.pdf`
    }
  }

  // 下载 PDF
  const handleDownloadPDF = async (orientation: PDFOrientation = 'portrait') => {
    const pageInfo = getPageInfo()

    // 使用高清图生成PDF
    const imagesToUse = imageState.normalImages

    if (imagesToUse.length === 0) {
      message.error('No images to download.')
      return
    }

    const homepage = fliphtml5RulesRef.current!.homepage

    // 生成文件名
    const fileName = generatePdfFileName(orientation)
    logInfo('handle_download_pdf', `Starting PDF download (orientation: ${orientation}, images: ${imagesToUse.length}, fileName: ${fileName}) | ${pageInfo}`)

    try {
      const hide = message.loading('Generating PDF...', 0)

      const pdf = await generatePDF(imagesToUse, {
        orientation,
        addWatermark: true,
        homepage
      })

      downloadPDF(pdf, fileName)

      hide()
      message.success('PDF downloaded successfully!')
      logInfo('end download', `PDF downloaded successfully (orientation: ${orientation}, images: ${imagesToUse.length}, fileName: ${fileName}) | ${pageInfo}`)
    } catch (error) {
      message.error('Failed to generate PDF')
    }
  }

  // 关闭对话框
  const handleClose = () => {
    const pageInfo = getPageInfo()
    logInfo('close dialog', `Dialog closed (totalImages: ${imageState.totalPages}) | ${pageInfo}`)
    setVisible(false)
  }

  const displayImages = imageState.thumbImages
  const imageCountText = imageState.thumbImages.length > 0
    ? `${imageState.thumbImages.length}`
    : '0'

  const downloadMenuItems: MenuProps['items'] = [
    {
      key: 'portrait',
      icon: <FileTextOutlined />,
      label: 'Portrait (A4 210×297mm)',
      onClick: () => {
        setPdfOrientation('portrait')
        handleDownloadPDF('portrait')
      }
    },
    {
      key: 'landscape',
      icon: <LayoutOutlined />,
      label: 'Landscape (A4 297×210mm)',
      onClick: () => {
        setPdfOrientation('landscape')
        handleDownloadPDF('landscape')
      }
    },
    {
      key: 'square',
      icon: <BorderOutlined />,
      label: 'Square (210×210mm)',
      onClick: () => {
        setPdfOrientation('square')
        handleDownloadPDF('square')
      }
    }
  ]

  return (
    <ConfigProvider>
      {/* 全局 Loading */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9999
        }}>
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '8px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{ marginBottom: '20px' }}>
              <div className="loading-spinner" style={{
                width: '48px',
                height: '48px',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #1890ff',
                borderRadius: '50%',
                margin: '0 auto'
              }} />
            </div>
          </div>
        </div>
      )}

      <Modal
        title="FlipHTML5 Scanner"
        open={visible}
        onCancel={handleClose}
        footer={null}
        width={800}
        centered
        maskClosable={false}
        style={{ maxHeight: '90vh' }}
        styles={{ body: { maxHeight: 'calc(90vh - 110px)', overflow: 'hidden' } }}
      >
        {/* Status Display */}
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Flex vertical gap="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text>Total Pages: {imageState.totalPages}</Text>
              <Text>{imageState.isLoaded ? 'Ready' : 'Loading...'}</Text>
            </div>
          </Flex>
        </Card>

        {/* Control Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
          <Space.Compact>
            <Button
              type="primary"
              size="large"
              disabled={imageState.thumbImages.length === 0}
              onClick={() => handleDownloadPDF('portrait')}
            >
              Download
            </Button>
            <Dropdown
              menu={{ items: downloadMenuItems }}
              trigger={['hover']}
              disabled={imageState.thumbImages.length === 0}
            >
              <Button
                type="primary"
                size="large"
                icon={<DownloadOutlined />}
                disabled={imageState.thumbImages.length === 0}
              />
            </Dropdown>
          </Space.Compact>
        </div>

        {/* Image Preview Area */}
        <Card size="small" title={`Images: ${imageCountText}`} styles={{ body: { padding: 0 } }}>
          <div className="image-preview-container">
            {displayImages.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                <Text type="secondary">
                  Loading images...
                </Text>
              </div>
            ) : (
              <div className="image-preview-scroll" ref={scrollContainerRef}>
                <div className="image-preview-grid">
                  {displayImages.map((imgUrl, index) => (
                    <div key={index} className="image-preview-item">
                      <img src={imgUrl} alt={`Page ${index + 1}`} />
                      <div className="image-preview-overlay">
                        <Text style={{ color: 'white' }}>Page {index + 1}</Text>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Support Information */}
        <div style={{ textAlign: 'center', marginTop: '16px', paddingTop: '8px', borderTop: '1px solid #f0f0f0' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Support by{' '}
            <a
              href="mailto:extensionkit@gmail.com"
              style={{ color: '#1890ff', textDecoration: 'none' }}
              onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
            >
              extensionkit@gmail.com
            </a>
          </Text>
        </div>
      </Modal>
    </ConfigProvider>
  )
}

export default ScanDialog
