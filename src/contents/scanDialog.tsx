import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect, useRef, useCallback } from "react"
import { ConfigProvider, Modal, Button, Flex, Space, Typography, Card, message, Dropdown, Segmented, InputNumber, Radio, Input, Checkbox } from "antd"
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
  const [downloading, setDownloading] = useState(false)
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape' | 'square'>('portrait')
  const [imageState, setImageState] = useState<ImageState>({
    thumbImages: [],
    normalImages: [],
    totalPages: 0,
    isLoaded: false
  })
  
  // 新增的导出控制状态
  const [splitMode, setSplitMode] = useState<'all' | 'custom'>('all') // 分页模式：全部或自定义
  const [pagesPerFile, setPagesPerFile] = useState<number>(150) // 自定义模式下每份的页数，默认150
  const [exportMode, setExportMode] = useState<'all' | 'range' | 'selected'>('all')
  const [exportRange, setExportRange] = useState<{ start: number; end: number }>({ start: 1, end: 1 })
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const [imagesPerRow, setImagesPerRow] = useState<2 | 4 | 6>(4) // 每行显示的图片数量，默认4

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
        
        // 初始化导出范围的结束页为总页数
        setExportRange({ start: 1, end: thumbImages.length })
        
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

  // 生成 PDF 文件名
  const generatePdfFileName = (orientation: PDFOrientation, partNumber?: number): string => {
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

      // 生成分页后缀
      const partSuffix = partNumber !== undefined ? `-part${partNumber}` : ''

      // 根据路径段数量生成文件名
      let fileName: string
      if (pathSegments.length >= 2) {
        // 有2个或以上路径段：segment1-segment2-orientation-timestamp-partN
        fileName = `${pathSegments[0]}-${pathSegments[1]}-${orientation}-${timestamp}${partSuffix}`
      } else if (pathSegments.length === 1) {
        // 只有1个路径段：segment1-orientation-timestamp-partN
        fileName = `${pathSegments[0]}-${orientation}-${timestamp}${partSuffix}`
      } else {
        // 没有路径段：默认名称
        fileName = `fliphtml5_download-${orientation}-${timestamp}${partSuffix}`
      }

      return `${fileName}.pdf`

    } catch (error) {
      // URL 解析失败或其他异常，使用默认名称
      const now = new Date()
      const timestamp = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
      const partSuffix = partNumber !== undefined ? `-part${partNumber}` : ''
      return `fliphtml5_download-${orientation}-${timestamp}${partSuffix}.pdf`
    }
  }

  // 下载 PDF
  const handleDownloadPDF = async (orientation: PDFOrientation = 'portrait') => {
    const pageInfo = getPageInfo()
    const allImages = imageState.normalImages

    if (allImages.length === 0) {
      message.error('No images to download.')
      return
    }

    // 第一步：根据 exportMode 过滤要导出的图片
    let filteredImages: string[] = []
    
    switch (exportMode) {
      case 'all':
        filteredImages = [...allImages]
        break
      
      case 'range':
        const start = Math.max(1, exportRange.start) - 1 // 转换为0-based索引
        const end = Math.min(exportRange.end, allImages.length) // 1-based，包含这一页
        
        if (exportRange.start > exportRange.end || start >= allImages.length) {
          message.error('Invalid range. Please check your input.')
          return
        }
        
        filteredImages = allImages.slice(start, end)
        break
      
      case 'selected':
        if (selectedPages.size === 0) {
          message.error('Please select at least one page.')
          return
        }
        
        // 将选中的索引转换为图片数组
        const sortedIndices = Array.from(selectedPages).sort((a, b) => a - b)
        filteredImages = sortedIndices.map(index => allImages[index]).filter(Boolean)
        break
    }

    if (filteredImages.length === 0) {
      message.error('No images match your selection.')
      return
    }

    logInfo('handle_download_pdf', `Starting PDF download (exportMode: ${exportMode}, splitMode: ${splitMode}, orientation: ${orientation}, totalImages: ${filteredImages.length}, pagesPerFile: ${pagesPerFile}) | ${pageInfo}`)

    const homepage = fliphtml5RulesRef.current!.homepage

    setDownloading(true)

    try {
      // 第二步：根据 splitMode 决定是否分页导出
      if (splitMode === 'custom' && pagesPerFile > 0 && filteredImages.length > pagesPerFile) {
        // 分页导出多个PDF
        const totalFiles = Math.ceil(filteredImages.length / pagesPerFile)
        const hide = message.loading(`Generating ${totalFiles} PDF files...`, 0)

        for (let i = 0; i < totalFiles; i++) {
          const startIdx = i * pagesPerFile
          const endIdx = Math.min(startIdx + pagesPerFile, filteredImages.length)
          const batchImages = filteredImages.slice(startIdx, endIdx)
          
          const fileName = generatePdfFileName(orientation, i + 1)
          
          const pdf = await generatePDF(batchImages, {
            orientation,
            addWatermark: true,
            homepage
          })

          downloadPDF(pdf, fileName)
          
          // 添加小延迟以避免浏览器同时下载过多文件
          if (i < totalFiles - 1) {
            await new Promise(resolve => setTimeout(resolve, 300))
          }
        }

        hide()
        message.success(`Successfully downloaded ${totalFiles} PDF files!`)
        logInfo('end download', `PDF downloaded successfully (${totalFiles} files, ${filteredImages.length} images total) | ${pageInfo}`)
      } else {
        // 单个PDF导出
        const hide = message.loading('Generating PDF...', 0)
        const fileName = generatePdfFileName(orientation)

        const pdf = await generatePDF(filteredImages, {
          orientation,
          addWatermark: true,
          homepage
        })

        downloadPDF(pdf, fileName)

        hide()
        message.success('PDF downloaded successfully!')
        logInfo('end download', `PDF downloaded successfully (1 file, ${filteredImages.length} images) | ${pageInfo}`)
      }
    } catch (error) {
      message.error('Failed to generate PDF')
      logInfo('download error', `Failed to generate PDF: ${error} | ${pageInfo}`)
    } finally {
      setDownloading(false)
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
        {/* Export Settings */}
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Flex vertical gap="middle">
            {/* 第一行：PDF方向选择 */}
            <div>
              <Text strong style={{ marginRight: '12px' }}>PDF Orientation:</Text>
              <Segmented
                value={pdfOrientation}
                onChange={(value) => setPdfOrientation(value as PDFOrientation)}
                options={[
                  { label: 'Portrait', value: 'portrait', icon: <FileTextOutlined /> },
                  { label: 'Landscape', value: 'landscape', icon: <LayoutOutlined /> },
                  { label: 'Square', value: 'square', icon: <BorderOutlined /> }
                ]}
              />
            </div>

            {/* 第二行：分页导出设置 */}
            <div>
              <Text strong style={{ marginRight: '12px' }}>Pages per File:</Text>
              <Radio.Group value={splitMode} onChange={(e) => setSplitMode(e.target.value)}>
                <Space direction="horizontal" size="large">
                  <Radio value="all">All in one file</Radio>
                  <Radio value="custom">
                    Custom:
                    <InputNumber
                      min={1}
                      max={imageState.totalPages}
                      value={pagesPerFile}
                      onChange={(value) => setPagesPerFile(value || 150)}
                      disabled={splitMode !== 'custom'}
                      style={{ width: '100px', marginLeft: '8px' }}
                    />
                    <Text type="secondary" style={{ marginLeft: '4px', fontSize: '12px' }}>
                      pages
                      {splitMode === 'custom' && imageState.totalPages > 0 && (
                        <span> ({Math.ceil(imageState.totalPages / pagesPerFile)} files)</span>
                      )}
                    </Text>
                  </Radio>
                </Space>
              </Radio.Group>
            </div>

            {/* 第三行：导出范围选择 */}
            <div>
              <Text strong style={{ marginRight: '12px' }}>Export Range:</Text>
              <Radio.Group value={exportMode} onChange={(e) => setExportMode(e.target.value)}>
                <Space direction="horizontal" size="large" wrap>
                  <Radio value="all">All Pages</Radio>
                  <Radio value="range">
                    Range:
                    <InputNumber
                      min={1}
                      max={imageState.totalPages}
                      value={exportRange.start}
                      onChange={(value) => setExportRange(prev => ({ ...prev, start: value || 1 }))}
                      disabled={exportMode !== 'range'}
                      style={{ width: '70px', marginLeft: '8px' }}
                      placeholder="From"
                    />
                    <Text style={{ margin: '0 4px' }}>-</Text>
                    <InputNumber
                      min={exportRange.start}
                      max={imageState.totalPages}
                      value={exportRange.end}
                      onChange={(value) => setExportRange(prev => ({ ...prev, end: value || imageState.totalPages }))}
                      disabled={exportMode !== 'range'}
                      style={{ width: '70px' }}
                      placeholder="To"
                    />
                    <Text type="secondary" style={{ marginLeft: '4px', fontSize: '12px' }}>
                      ({Math.max(0, exportRange.end - exportRange.start + 1)} pages)
                    </Text>
                  </Radio>
                  <Radio value="selected">Selected ({selectedPages.size})</Radio>
                </Space>
              </Radio.Group>
            </div>
          </Flex>
        </Card>

        {/* Control Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
          <Button
            type="primary"
            size="large"
            icon={<DownloadOutlined />}
            disabled={imageState.thumbImages.length === 0 || downloading}
            loading={downloading}
            onClick={() => handleDownloadPDF(pdfOrientation)}
          >
            Download PDF
          </Button>
        </div>

        {/* Image Preview Area */}
        <Card 
          size="small" 
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span>Pages: {imageCountText}</span>
              <Space size="middle">
                <Space size="small">
                  <Text style={{ fontSize: '13px' }}>Pages per row:</Text>
                  <Segmented
                    value={imagesPerRow}
                    onChange={(value) => setImagesPerRow(value as 2 | 4 | 6)}
                    options={[
                      { label: '2', value: 2 },
                      { label: '4', value: 4 },
                      { label: '6', value: 6 }
                    ]}
                    size="small"
                  />
                </Space>
                {exportMode === 'selected' && displayImages.length > 0 && (
                  <Space size="small">
                    <Button 
                      size="small" 
                      onClick={() => {
                        const allPages = new Set(Array.from({ length: imageState.totalPages }, (_, i) => i))
                        setSelectedPages(allPages)
                      }}
                    >
                      Select All
                    </Button>
                    <Button 
                      size="small" 
                      onClick={() => setSelectedPages(new Set())}
                    >
                      Clear All
                    </Button>
                  </Space>
                )}
              </Space>
            </div>
          } 
          styles={{ body: { padding: 0 } }}
        >
          <div className="image-preview-container">
            {displayImages.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                <Text type="secondary">
                  Loading images...
                </Text>
              </div>
            ) : (
              <div className="image-preview-scroll" ref={scrollContainerRef}>
                {/* 渲染封面（第1张，单独一行） */}
                {displayImages.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                    <div className="image-preview-item" style={{ position: 'relative', width: 'auto', maxWidth: '300px' }}>
                      {exportMode === 'selected' && (
                        <Checkbox
                          checked={selectedPages.has(0)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedPages)
                            if (e.target.checked) {
                              newSelected.add(0)
                            } else {
                              newSelected.delete(0)
                            }
                            setSelectedPages(newSelected)
                          }}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            left: '8px',
                            zIndex: 10,
                            transform: 'scale(1.5)'
                          }}
                        />
                      )}
                      <img src={displayImages[0]} alt="Cover" style={{ width: '100%', height: 'auto' }} />
                      <div className="image-preview-overlay">
                        <Text style={{ color: 'white' }}>Cover</Text>
                      </div>
                    </div>
                  </div>
                )}

                {/* 渲染中间页面（按列数排列） */}
                {displayImages.length > 2 && (
                  <div 
                    className="image-preview-grid" 
                    style={{ 
                      gridTemplateColumns: `repeat(${imagesPerRow}, 1fr)`,
                      marginBottom: displayImages.length > 1 ? '8px' : '0'
                    }}
                  >
                    {displayImages.slice(1, -1).map((imgUrl, idx) => {
                      const index = idx + 1
                      return (
                        <div key={index} className="image-preview-item" style={{ position: 'relative' }}>
                          {exportMode === 'selected' && (
                            <Checkbox
                              checked={selectedPages.has(index)}
                              onChange={(e) => {
                                const newSelected = new Set(selectedPages)
                                if (e.target.checked) {
                                  newSelected.add(index)
                                } else {
                                  newSelected.delete(index)
                                }
                                setSelectedPages(newSelected)
                              }}
                              style={{
                                position: 'absolute',
                                top: '8px',
                                left: '8px',
                                zIndex: 10,
                                transform: 'scale(1.5)'
                              }}
                            />
                          )}
                          <img src={imgUrl} alt={`Page ${index + 1}`} />
                          <div className="image-preview-overlay">
                            <Text style={{ color: 'white' }}>Page {index + 1}</Text>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 渲染封底（最后1张，单独一行，仅当总数>1时） */}
                {displayImages.length > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div className="image-preview-item" style={{ position: 'relative', width: 'auto', maxWidth: '300px' }}>
                      {exportMode === 'selected' && (
                        <Checkbox
                          checked={selectedPages.has(displayImages.length - 1)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedPages)
                            if (e.target.checked) {
                              newSelected.add(displayImages.length - 1)
                            } else {
                              newSelected.delete(displayImages.length - 1)
                            }
                            setSelectedPages(newSelected)
                          }}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            left: '8px',
                            zIndex: 10,
                            transform: 'scale(1.5)'
                          }}
                        />
                      )}
                      <img src={displayImages[displayImages.length - 1]} alt="Back Cover" style={{ width: '100%', height: 'auto' }} />
                      <div className="image-preview-overlay">
                        <Text style={{ color: 'white' }}>Back Cover</Text>
                      </div>
                    </div>
                  </div>
                )}
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
