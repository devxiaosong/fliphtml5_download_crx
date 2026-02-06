import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect, useRef } from "react"
import { ConfigProvider, Modal, Button, Progress, Flex, Space, Typography, Card, message, Dropdown } from "antd"
import type { MenuProps } from "antd"
import { PlayCircleOutlined, PauseCircleOutlined, DownloadOutlined, FileTextOutlined, LayoutOutlined, BorderOutlined } from "@ant-design/icons"
import { generatePDF, downloadPDF, type PDFOrientation } from "../utils/pdfGenerator"
import "./scanDialog.css"

const { Text } = Typography

//https://online.fliphtml5.com/oddka/BBC-Science-Focus-December-2025/#p=1
export const config: PlasmoCSConfig = {
  matches: ["https://online.fliphtml5.com/*"],
  all_frames: false,
  css: ["scanDialog.css"]
}

const MAX_PAGES = 500

interface ScanState {
  isScanning: boolean
  isPaused: boolean
  currentPage: number
  totalPages: number
  scannedImages: string[]
  isComplete: boolean
}

function ScanDialog() {
  const [visible, setVisible] = useState(false)
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape' | 'square'>('portrait')
  const [scanState, setScanState] = useState<ScanState>({
    isScanning: false,
    isPaused: false,
    currentPage: 0,
    totalPages: 0,
    scannedImages: [],
    isComplete: false
  })
  
  const shouldStopRef = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)  // 滚动容器引用

  // ========== 扫描逻辑 ==========
  
  // 使用 XPath 查询单个元素
  function getElementByXPath(xpath: string): Element | null {
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
    return result.singleNodeValue as Element | null
  }

  // 使用 XPath 查询多个元素
  function getElementsByXPath(xpath: string): Element[] {
    const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
    const elements: Element[] = []
    for (let i = 0; i < result.snapshotLength; i++) {
      const node = result.snapshotItem(i)
      if (node) elements.push(node as Element)
    }
    return elements
  }

  // 调试函数：打印 DOM 信息
  function debugDOM() {
    console.log('========== SCAN DEBUG ==========')
    console.log('Current URL:', window.location.href)
    console.log('Document ready state:', document.readyState)
    
    const bookContainer = document.getElementById('bookContainer')
    console.log('bookContainer exists:', !!bookContainer)
    
    if (bookContainer) {
      console.log('✅ Found bookContainer!')
    }
    
    // 测试 XPath 选择器
    const inputXPath = "//div[@class='pageNumber']/label/input"
    const inputs = getElementsByXPath(inputXPath)
    console.log('Page input found:', inputs.length > 0)
    if (inputs.length > 0) {
      const value = (inputs[0] as HTMLInputElement).value || ''
      console.log('Page input value:', value)
    }
    
    const nextBtnXPath = "//div[@class='flip_button_right button']"
    const nextBtn = getElementByXPath(nextBtnXPath)
    console.log('Next button found:', !!nextBtn)
    
    const leftImageXPath = "//div[@id='bookContainer']//div[@class='left-mask-side' and (contains(@style, 'z-index: 2') or contains(@style, 'z-index:2'))]//div[@class='side-image']/img"
    const leftImages = getElementsByXPath(leftImageXPath)
    console.log('Left side images found:', leftImages.length)
    
    const rightImageXPath = "//div[@id='bookContainer']//div[@class='right-mask-side' and (contains(@style, 'z-index: 2') or contains(@style, 'z-index:2'))]//div[@class='side-image']/img"
    const rightImages = getElementsByXPath(rightImageXPath)
    console.log('Right side images found:', rightImages.length)
    
    console.log('===============================')
  }

  // 获取总页数
  function getTotalPages(): number {
    // 从 input 元素的 value 中解析总页数
    const inputXPath = "//div[@class='pageNumber']/label/input"
    const inputs = getElementsByXPath(inputXPath)
    
    if (inputs.length > 0) {
      const value = (inputs[0] as HTMLInputElement).value || ''
      console.log(`📊 Input value: "${value}"`)
      
      // 解析 "16-17/92" 或 "1/92" 格式，提取斜杠后面的数字
      const match = value.match(/\/(\d+)/)
      if (match) {
        const total = parseInt(match[1], 10)
        console.log(`📊 Total pages: ${total}`)
        return total
      }
    }
    
    console.log(`❌ Cannot parse total pages`)
    return 0
  }

  // 获取当前页面的图片
  function getCurrentPageImages(): string[] {
    const images: string[] = []

    // 获取左侧页面图片
    const leftXPath = "//div[@id='bookContainer']//div[@class='left-mask-side' and (contains(@style, 'z-index: 2') or contains(@style, 'z-index:2'))]//div[@class='side-image']/img"
    const leftImgs = getElementsByXPath(leftXPath)
    if (leftImgs.length > 0) {
      const src = (leftImgs[0] as HTMLImageElement).src
      if (src) {
        images.push(src)
        console.log(`  📄 Left page image: ${src.substring(0, 80)}...`)
      }
    }

    // 获取右侧页面图片
    const rightXPath = "//div[@id='bookContainer']//div[@class='right-mask-side' and (contains(@style, 'z-index: 2') or contains(@style, 'z-index:2'))]//div[@class='side-image']/img"
    const rightImgs = getElementsByXPath(rightXPath)
    if (rightImgs.length > 0) {
      const src = (rightImgs[0] as HTMLImageElement).src
      if (src) {
        images.push(src)
        console.log(`  📄 Right page image: ${src.substring(0, 80)}...`)
      }
    }

    return images
  }

  // 等待页面准备完成（检测下一页按钮）
  async function waitForPageReady(maxWaitTime: number = 10000): Promise<boolean> {
    const nextBtnXPath = "//div[@class='flip_button_right button']"
    const startTime = Date.now()

    console.log('⏳ Waiting for page to be ready...')

    while (Date.now() - startTime < maxWaitTime) {
      const nextBtn = getElementByXPath(nextBtnXPath) as HTMLElement
      if (nextBtn && nextBtn.offsetWidth > 0 && nextBtn.offsetHeight > 0) {
        console.log('✅ Page ready! Next button is visible')
        return true
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log('❌ Page ready timeout after 10s')
    return false
  }

  // 点击下一页按钮
  function clickNextPage(): boolean {
    const nextBtnXPath = "//div[@class='flip_button_right button']"
    const nextBtn = getElementByXPath(nextBtnXPath) as HTMLElement

    if (nextBtn && nextBtn.offsetWidth > 0 && nextBtn.offsetHeight > 0) {
      console.log('🖱️ Clicking next page button')
      nextBtn.click()
      return true
    } else {
      console.log('❌ Cannot find next page button')
      return false
    }
  }

  // 扫描所有页面
  async function scanAllPages(scanSpeed: number = 3000, continueScanning: boolean = false) {
    console.log(continueScanning ? '▶️ Continuing scan...' : '🚀 Starting scan...')
    console.log(`⚙️ Scan speed: ${scanSpeed}ms`)

    shouldStopRef.current = false

    // 调试 DOM 结构
    debugDOM()

    // 等待页面加载完成
    const isReady = await waitForPageReady()
    if (!isReady) {
      console.log('❌ Page not ready, aborting scan')
      message.error('Page not ready after 10 seconds')
      setScanState(prev => ({ ...prev, isScanning: false, isPaused: true }))
      return
    }

    // 从 state 中获取总页数（已在弹窗打开时获取）
    const totalPages = scanState.totalPages
    console.log(`📚 Total pages to scan: ${totalPages}`)

    if (totalPages === 0) {
      console.log('❌ Cannot detect total pages, aborting scan')
      message.error('Cannot detect total pages')
      setScanState(prev => ({ ...prev, isScanning: false, isPaused: true }))
      return
    }

    // 继续扫描则使用已有的图片数组，否则从头开始
    const allImages: string[] = continueScanning ? [...scanState.scannedImages] : []
    let flipCount = continueScanning ? Math.ceil((allImages.length - 1) / 2) : 0  // 计算已翻页次数

    // 如果不是继续扫描，获取第一页的图片
    if (!continueScanning) {
      console.log(`\n📖 Scanning first page, collected images: ${allImages.length}/${totalPages}...`)
      const firstPageImages = getCurrentPageImages()
      allImages.push(...firstPageImages)

      // 更新状态
      setScanState(prev => ({
        ...prev,
        currentPage: allImages.length,
        scannedImages: [...allImages]
      }))

      flipCount++
    } else {
      console.log(`\n▶️ Continuing from image ${allImages.length}/${totalPages}...`)
    }

    // 扫描剩余页面
    while (allImages.length < totalPages && flipCount < MAX_PAGES && !shouldStopRef.current) {
      console.log(`\n📖 Flipping page ${flipCount + 1}, collected images: ${allImages.length}/${totalPages}...`)

      // 点击下一页
      const clicked = clickNextPage()
      if (!clicked) {
        console.log('❌ Failed to click next page button, stopping scan')
        break
      }

      // 等待页面加载
      await new Promise(resolve => setTimeout(resolve, scanSpeed))

      // 获取当前页图片
      const pageImages = getCurrentPageImages()
      if (pageImages.length > 0) {
        allImages.push(...pageImages)
        console.log(`  ✅ Collected ${pageImages.length} image(s), total: ${allImages.length}/${totalPages}`)

        // 更新状态
        setScanState(prev => ({
          ...prev,
          currentPage: allImages.length,
          scannedImages: [...allImages]
        }))
      } else {
        console.log(`  ⚠️ No images found after flip ${flipCount + 1}`)
      }

      flipCount++
    }

    // 扫描完成或暂停
    const isComplete = allImages.length >= totalPages
    const isPaused = shouldStopRef.current && !isComplete

    console.log(`\n✨ Scan ${isComplete ? 'completed' : isPaused ? 'paused' : 'stopped'}!`)
    console.log(`📊 Total images collected: ${allImages.length}`)
    console.log(`📄 Total flips: ${flipCount}, Images: ${allImages.length}/${totalPages}`)

    setScanState(prev => ({
      ...prev,
      isScanning: false,
      isPaused,
      isComplete,
      scannedImages: [...allImages]
    }))

    if (isComplete) {
      message.success(`Scan completed! ${allImages.length} images collected.`)
    } else if (isPaused) {
      message.info(`Scan paused. ${allImages.length} images collected.`)
    } else {
      message.warning(`Scan stopped. ${allImages.length} images collected.`)
    }
  }

  // ========== 事件处理 ==========

  // 监听来自 popup 的消息
  useEffect(() => {
    const handleMessage = (request: any) => {
      if (request.action === 'showScanDialog') {
        // 清空之前的缓存数据
        console.log('🧹 Clearing previous scan data...')
        setScanState({
          isScanning: false,
          isPaused: false,
          currentPage: 0,
          totalPages: 0,
          scannedImages: [],
          isComplete: false
        })
        
        // 重置停止标志
        shouldStopRef.current = false
        
        // 打开弹窗
        setVisible(true)
        
        // 弹窗打开时立即获取总页数
        const total = getTotalPages()
        console.log(`📊 Total pages detected: ${total}`)
        setScanState(prev => ({
          ...prev,
          totalPages: total
        }))
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [])

  // 自动滚动到底部显示最新图片
  useEffect(() => {
    if (scanState.isScanning && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [scanState.scannedImages.length, scanState.isScanning])

  // 开始扫描（首次扫描）
  const handleStartScan = () => {
    console.log('🚀 Starting scan from dialog...')
    
    // 清除之前的扫描数据（保留总页数）
    setScanState(prev => ({
      isScanning: true,
      isPaused: false,
      currentPage: 0,
      totalPages: prev.totalPages, // 保留已获取的总页数
      scannedImages: [],
      isComplete: false
    }))

    // 开始扫描
    scanAllPages(3000, false)  // 使用最慢档速度，从头开始
  }

  // 继续扫描
  const handleContinueScan = () => {
    console.log('▶️ Continuing scan from dialog...')
    
    setScanState(prev => ({
      ...prev,
      isScanning: true,
      isPaused: false,
    }))

    // 继续扫描（不清空数组）
    scanAllPages(3000, true)
  }

  // 暂停扫描
  const handlePauseScan = () => {
    console.log('⏸️ Pausing scan from dialog...')
    shouldStopRef.current = true
  }

  // 下载 PDF
  const handleDownloadPDF = async (orientation: PDFOrientation = 'portrait') => {
    if (scanState.scannedImages.length === 0) {
      message.error('No images to download. Please scan first.')
      return
    }

    const imagesToUse = scanState.scannedImages

    try {
      const hide = message.loading('Generating PDF...', 0)
      
      const pdf = await generatePDF(imagesToUse, {
        orientation,
        addWatermark: true  // 始终添加水印
      })

      downloadPDF(pdf, `fliphtml5_ebook_${orientation}.pdf`)
      
      hide()
      message.success('PDF downloaded successfully!')
    } catch (error) {
      message.error('Failed to generate PDF')
      console.error('PDF generation failed:', error)
    }
  }

  // 关闭对话框
  const handleClose = () => {
    if (scanState.isScanning) {
      shouldStopRef.current = true
    }
    setVisible(false)
  }

  const displayImages = scanState.scannedImages
  const imageCountText = scanState.scannedImages.length > 0
    ? `${scanState.scannedImages.length}`
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
        {/* Progress Display */}
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Flex vertical gap="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text>Current Page: {scanState.currentPage}</Text>
              <Text>
                {scanState.isComplete ? 'Scan Complete' : 
                 scanState.isScanning ? 'Scanning...' : 
                 scanState.isPaused ? 'Paused' : 
                 'Ready'}
              </Text>
            </div>
            <Progress
              percent={scanState.totalPages > 0 ? Math.round((scanState.currentPage / scanState.totalPages) * 100) : 0}
              status={scanState.isComplete ? 'success' : scanState.isScanning ? 'active' : 'normal'}
            />
          </Flex>
        </Card>

        {/* Control Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
          {/* 初始状态：Start Scan */}
          {(!scanState.isScanning && !scanState.isPaused && !scanState.isComplete) && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleStartScan}
              size="large"
            >
              Start Scan
            </Button>
          )}

          {/* 扫描中：Pause Scan */}
          {scanState.isScanning && (
            <Button
              type="primary"
              icon={<PauseCircleOutlined />}
              onClick={handlePauseScan}
              size="large"
            >
              Pause Scan
            </Button>
          )}

          {/* 暂停后：Continue Scan (outline样式) */}
          {(!scanState.isScanning && scanState.isPaused && !scanState.isComplete) && (
            <Button
              type="default"
              icon={<PlayCircleOutlined />}
              onClick={handleContinueScan}
              size="large"
            >
              Continue Scan
            </Button>
          )}

          {/* 完成后：Completed (灰化不可点击) */}
          {scanState.isComplete && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              disabled
              size="large"
            >
              Completed
            </Button>
          )}

          <Space.Compact>
            <Button
              type="primary"
              size="large"
              disabled={scanState.isScanning || scanState.scannedImages.length === 0}
              onClick={() => handleDownloadPDF('portrait')}
            >
              Download
            </Button>
            <Dropdown
              menu={{ items: downloadMenuItems }}
              trigger={['hover']}
              disabled={scanState.isScanning || scanState.scannedImages.length === 0}
            >
              <Button
                type="primary"
                size="large"
                icon={<DownloadOutlined />}
                disabled={scanState.isScanning || scanState.scannedImages.length === 0}
              />
            </Dropdown>
          </Space.Compact>
        </div>

        {/* Image Preview Area */}
        <Card size="small" title={`Scanned Images: ${imageCountText}`} styles={{ body: { padding: 0 } }}>
          <div className="image-preview-container">
            {displayImages.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                <Text type="secondary">No images scanned yet. Click "Start Scan" to begin.</Text>
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
      </Modal>
    </ConfigProvider>
  )
}

export default ScanDialog
