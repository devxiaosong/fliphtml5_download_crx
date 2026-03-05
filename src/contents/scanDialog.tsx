import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect, useRef, useCallback } from "react"
import { ConfigProvider, Modal, Button, Flex, Space, Typography, Card, message, Dropdown, Segmented, InputNumber, Radio, Input, Checkbox } from "antd"
import type { MenuProps } from "antd"
import { DownloadOutlined, FileTextOutlined, LayoutOutlined, BorderOutlined } from "@ant-design/icons"
import { generatePDF, downloadPDF } from "../utils/pdfGenerator"
import type { PDFOrientation } from "../utils/pdfGenerator"
import { logInfo, getAppInfo } from "../utils/misc"

const { Text } = Typography

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

interface MetaInfo {
  title: string
  pageCount: number
  pageWidth: number
  pageHeight: number
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
  const [metaInfo, setMetaInfo] = useState<MetaInfo | null>(null)
  
  // 新增的导出控制状态
  const [splitMode, setSplitMode] = useState<'all' | 'custom'>('all') // 分页模式：全部或自定义
  const [pagesPerFile, setPagesPerFile] = useState<number>(150) // 自定义模式下每份的页数，默认150
  const [exportMode, setExportMode] = useState<'all' | 'range' | 'selected'>('all')
  const [exportRange, setExportRange] = useState<{ start: number; end: number }>({ start: 1, end: 1 })
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const [imagesPerRow, setImagesPerRow] = useState<2 | 4 | 6>(4) // 每行显示的图片数量，默认4
  
  // PDF 生成进度状态
  const [pdfProgress, setPdfProgress] = useState<{
    currentFile: number
    totalFiles: number
    currentPage: number
    totalPages: number
    message: string
  } | null>(null)

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
    const currentUrl = window.location.href
    logInfo('open_dialog', `Dialog opened | URL: ${currentUrl}`)

    // 打开弹窗
    setVisible(true)

    // 重试机制：等待3秒，最多重试3次
    const maxRetries = 3
    const retryDelay = 3000 // 3秒
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 等待3秒
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        
        const pageConfig = await getHtmlConfig()
        
        // 验证必需的数据
        if (!pageConfig.fliphtml5_pages || !Array.isArray(pageConfig.fliphtml5_pages)) {
          throw new Error('fliphtml5_pages not found or invalid')
        }
        
        if (!pageConfig.htmlConfig_meta) {
          throw new Error('htmlConfig.meta not found')
        }
        
        // 保存 meta 信息
        const meta: MetaInfo = {
          title: pageConfig.htmlConfig_meta.title || 'no title',
          pageCount: pageConfig.htmlConfig_meta.pageCount || 0,
          pageWidth: pageConfig.htmlConfig_meta.pageWidth || 0,
          pageHeight: pageConfig.htmlConfig_meta.pageHeight || 0
        }
        setMetaInfo(meta)
        
        // 处理图片 URL
        const baseUrl = currentUrl.split(/[#?]/)[0]
        const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'
        
        // 处理路径：移除 ./ 前缀和查询参数
        const cleanPath = (path: string) => {
          if (!path) return ''
          let cleaned = path.startsWith('./') ? path.substring(2) : path
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
          
        })
        
        // 更新状态
        setImageState({
          thumbImages: thumbImages,
          normalImages: normalImages,
          totalPages: meta.pageCount || thumbImages.length,
          isLoaded: true
        })
        
        // 初始化导出范围的结束页为总页数
        setExportRange({ start: 1, end: meta.pageCount || thumbImages.length })

        logInfo('load_images', `Loaded ${thumbImages.length} images, title: ${meta.title} | URL: ${currentUrl}`)
        
        // 加载成功，退出重试循环
        return
        
      } catch (error) {
        console.error(`Attempt ${attempt}/${maxRetries} failed:`, error)
        
        // 如果还有重试次数，继续
        if (attempt < maxRetries) {
          console.log(`Waiting ${retryDelay}ms before retry...`)
          continue
        }
        
        // 所有重试都失败，显示友好的错误提示
        console.error('All retry attempts failed')
        logInfo('load_images', `Failed to load after ${maxRetries} attempts: ${error} | URL: ${currentUrl}`)
        
        Modal.error({
          title: 'Failed to Load',
          content: (
            <div>
              <p>Unable to load the page content. Please refresh the page and try again.</p>
              <p style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
                If the problem persists, please contact support: 
                <a href="mailto:extensionkit@gmail.com" style={{ marginLeft: '4px' }}>
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
      // 获取 title，如果没有则使用 "no title"
      let title = metaInfo?.title || 'no title'
      
      // 处理特殊字符：清理非法文件名字符（Windows + Unix）
      title = title.replace(/[<>:"/\\|?*]/g, '_')
      // 将多个空格替换为单个空格
      title = title.replace(/\s+/g, ' ').trim()
      
      // 截断到最大长度
      const maxLength = 100
      if (title.length > maxLength) {
        title = title.slice(0, maxLength)
      }

      // 生成时间戳
      const now = new Date()
      const timestamp = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`

      // 生成分页后缀
      const partSuffix = partNumber !== undefined ? `-part${partNumber}` : ''

      // 生成文件名：title-orientation-timestamp-partN.pdf
      const fileName = `${title}-${orientation}-${timestamp}${partSuffix}`

      return `${fileName}.pdf`

    } catch (error) {
      // 异常情况，使用默认名称
      const now = new Date()
      const timestamp = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
      const partSuffix = partNumber !== undefined ? `-part${partNumber}` : ''
      return `no_title-${orientation}-${timestamp}${partSuffix}.pdf`
    }
  }

  // 下载 PDF
  const handleDownloadPDF = async (orientation: PDFOrientation = 'portrait') => {
    const currentUrl = window.location.href
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

    logInfo('handle_download_pdf', `Starting PDF download (exportMode: ${exportMode}, splitMode: ${splitMode}, orientation: ${orientation}, totalImages: ${filteredImages.length}, pagesPerFile: ${pagesPerFile}) | URL: ${currentUrl}`)

    const homepage = fliphtml5RulesRef.current!.homepage

    setDownloading(true)

    try {
      // 第二步：根据 splitMode 决定是否分页导出
      if (splitMode === 'custom' && pagesPerFile > 0 && filteredImages.length > pagesPerFile) {
        // 分页导出多个PDF
        const totalFiles = Math.ceil(filteredImages.length / pagesPerFile)

        for (let i = 0; i < totalFiles; i++) {
          const startIdx = i * pagesPerFile
          const endIdx = Math.min(startIdx + pagesPerFile, filteredImages.length)
          const batchImages = filteredImages.slice(startIdx, endIdx)
          
          // 更新进度：当前文件和文件内页面进度
          setPdfProgress({
            currentFile: i + 1,
            totalFiles: totalFiles,
            currentPage: 0,
            totalPages: batchImages.length,
            message: `Generating file ${i + 1}/${totalFiles}...`
          })
          
          const fileName = generatePdfFileName(orientation, i + 1)
          
          const pdf = await generatePDF(batchImages, {
            orientation,
            addWatermark: true,
            homepage,
            onProgress: (current, total) => {
              setPdfProgress({
                currentFile: i + 1,
                totalFiles: totalFiles,
                currentPage: current,
                totalPages: total,
                message: `File ${i + 1}/${totalFiles}: Processing page ${current}/${total}`
              })
            }
          })

          downloadPDF(pdf, fileName)
          
          // 添加小延迟以避免浏览器同时下载过多文件
          if (i < totalFiles - 1) {
            await new Promise(resolve => setTimeout(resolve, 300))
          }
        }

        setPdfProgress(null)
        message.success(`Successfully downloaded ${totalFiles} PDF files!`)
        logInfo('end_download', `PDF downloaded successfully (${totalFiles} files, ${filteredImages.length} images total) | URL: ${currentUrl}`)
      } else {
        // 单个PDF导出
        setPdfProgress({
          currentFile: 1,
          totalFiles: 1,
          currentPage: 0,
          totalPages: filteredImages.length,
          message: 'Generating PDF...'
        })
        
        const fileName = generatePdfFileName(orientation)

        const pdf = await generatePDF(filteredImages, {
          orientation,
          addWatermark: true,
          homepage,
          onProgress: (current, total) => {
            setPdfProgress({
              currentFile: 1,
              totalFiles: 1,
              currentPage: current,
              totalPages: total,
              message: `Processing page ${current}/${total}`
            })
          }
        })

        downloadPDF(pdf, fileName)

        setPdfProgress(null)
        message.success('PDF downloaded successfully!')
        logInfo('end_download', `PDF downloaded successfully (1 file, ${filteredImages.length} images) | URL: ${currentUrl}`)
      }
    } catch (error) {
      setPdfProgress(null)
      message.error('Failed to generate PDF')
      logInfo('download_error', `Failed to generate PDF: ${error} | URL: ${currentUrl}`)
    } finally {
      setDownloading(false)
    }
  }

  // 关闭对话框
  const handleClose = () => {
    const currentUrl = window.location.href
    logInfo('close_dialog', `Dialog closed (totalImages: ${imageState.totalPages}) | URL: ${currentUrl}`)
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

        {/* PDF Generation Progress */}
        {pdfProgress && (
          <div style={{ textAlign: 'center', marginBottom: '16px', color: '#1890ff' }}>
            <Text type="secondary">
              {pdfProgress.totalFiles > 1 
                ? `Generating file ${pdfProgress.currentFile}/${pdfProgress.totalFiles} (${pdfProgress.currentPage}/${pdfProgress.totalPages} pages) - ${Math.round((pdfProgress.currentFile - 1 + (pdfProgress.currentPage / pdfProgress.totalPages)) / pdfProgress.totalFiles * 100)}%`
                : `Generating PDF... ${pdfProgress.currentPage}/${pdfProgress.totalPages} pages (${Math.round((pdfProgress.currentPage / pdfProgress.totalPages) * 100)}%)`
              }
            </Text>
          </div>
        )}

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
