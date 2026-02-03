import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect } from "react"
import { ConfigProvider, Modal, Button, Progress, Space, Typography, Card, Tag, message, Dropdown } from "antd"
import type { MenuProps } from "antd"
import { PlayCircleOutlined, PauseCircleOutlined, DownloadOutlined, FileTextOutlined, LayoutOutlined, BorderOutlined } from "@ant-design/icons"
import { generatePDF, downloadPDF, type PDFOrientation } from "../utils/pdfGenerator"
import "./scanDialog.css"

const { Text, Title } = Typography

export const config: PlasmoCSConfig = {
  matches: ["https://fliphtml5.com/*", "https://online.fliphtml5.com/*"],
  all_frames: false,
  css: ["scanDialog.css"]
}

interface ScanState {
  isScanning: boolean
  isPaused: false
  currentPage: number
  totalPages: number
  scannedImages: string[]
  isComplete: boolean
}

interface UserState {
  isPaid: boolean
  subscriptionType: 'free' | 'monthly' | 'yearly'
}

function ScanDialog() {
  const [visible, setVisible] = useState(false)
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape' | 'square'>('portrait')
  const [userState, setUserState] = useState<UserState>({ isPaid: false, subscriptionType: 'free' })
  const [scanState, setScanState] = useState<ScanState>({
    isScanning: false,
    isPaused: false,
    currentPage: 0,
    totalPages: 0,
    scannedImages: [],
    isComplete: false
  })

  // 使用真实的 FlipHTML5 图片作为预览
  const mockImages = Array.from({ length: 16 }, () => 
    'https://online.fliphtml5.com/xuvta/AAU_February_2026_DIGITAL/files/large/36df87257eff34cf7a79cea3a6c7415c.webp?1770040226'
  )

  // 监听来自 popup 的消息
  useEffect(() => {
    const handleMessage = (request: any) => {
      if (request.action === 'showScanDialog') {
        setVisible(true)
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [])

  // 监听扫描进度
  useEffect(() => {
    const handleScanProgress = (event: MessageEvent) => {
      if (event.data.type === 'SCAN_PROGRESS') {
        const data = event.data.data
        setScanState(prev => ({
          ...prev,
          currentPage: data.currentPage,
          totalPages: data.totalPages,
          isComplete: data.isComplete,
          scannedImages: data.imageUrl 
            ? [...prev.scannedImages, data.imageUrl]
            : prev.scannedImages
        }))
      }

      if (event.data.type === 'SCAN_STATUS') {
        if (event.data.action === 'started') {
          setScanState(prev => ({ ...prev, isScanning: true }))
        }
      }
    }

    window.addEventListener('message', handleScanProgress)
    return () => {
      window.removeEventListener('message', handleScanProgress)
    }
  }, [])

  // 加载用户状态
  useEffect(() => {
    chrome.storage.local.get(['userState'], (result: { userState?: UserState }) => {
      if (result.userState) {
        setUserState(result.userState)
      }
    })
  }, [visible])

  // 开始扫描
  const handleStartScan = () => {
    // 清除之前的扫描数据
    setScanState({
      isScanning: true,
      isPaused: false,
      currentPage: 0,
      totalPages: 0,
      scannedImages: [],
      isComplete: false
    })

    // 清除停止标志
    chrome.storage.local.remove('stopScan')

    // 发送消息给 content script 开始扫描
    chrome.runtime.sendMessage({
      action: 'startScan',
      scanSpeed: 1000 // 默认速度
    }, (response) => {
      if (response && response.error) {
        console.error('Failed to start scan:', response.error)
        setScanState(prev => ({ ...prev, isScanning: false }))
      }
    })
  }

  // 停止扫描
  const handleStopScan = () => {
    setScanState({
      ...scanState,
      isScanning: false
    })

    chrome.storage.local.set({ stopScan: true })
  }

  // 下载 PDF
  const handleDownloadPDF = async () => {
    // 如果没有真实扫描图片，使用前4张预览图片
    const imagesToDownload = scanState.scannedImages.length > 0 
      ? scanState.scannedImages 
      : mockImages.slice(0, 4)

    if (imagesToDownload.length === 0) {
      message.error('No images to download')
      return
    }

    const hideMessage = message.loading('Generating PDF, please wait...', 0)

    try {
      // 生成文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const filename = `fliphtml5-${timestamp}.pdf`

      // 生成 PDF
      const pdfBlob = await generatePDF(imagesToDownload, {
        orientation: pdfOrientation,
        addWatermark: !userState.isPaid,
        title: `FlipHTML5 Download - ${timestamp}`
      })

      // 下载 PDF
      downloadPDF(pdfBlob, filename)

      hideMessage()
      message.success(`PDF downloaded successfully! ${imagesToDownload.length} pages`)
      
    } catch (error) {
      hideMessage()
      console.error('Failed to generate PDF:', error)
      message.error('PDF generation failed, please try again')
    }
  }

  // 关闭对话框
  const handleClose = () => {
    if (scanState.isScanning) {
      if (!confirm('Scan is in progress. Are you sure you want to close?')) {
        return
      }
      handleStopScan()
    }
    setVisible(false)
  }

  const progress = scanState.totalPages > 0 
    ? Math.round((scanState.currentPage / scanState.totalPages) * 100)
    : 0

  // 显示的图片列表（如果有扫描图片就显示扫描的，否则显示模拟的）
  const displayImages = scanState.scannedImages.length > 0 ? scanState.scannedImages : mockImages

  // PDF 格式下拉菜单
  const getOrientationIcon = (orientation: string) => {
    switch (orientation) {
      case 'portrait':
        return <FileTextOutlined />
      case 'landscape':
        return <LayoutOutlined />
      case 'square':
        return <BorderOutlined />
      default:
        return <FileTextOutlined />
    }
  }

  const getOrientationLabel = (orientation: string) => {
    switch (orientation) {
      case 'portrait':
        return 'Portrait'
      case 'landscape':
        return 'Landscape'
      case 'square':
        return 'Square'
      default:
        return 'Portrait'
    }
  }

  const downloadMenuItems: MenuProps['items'] = [
    {
      key: 'portrait',
      icon: <FileTextOutlined />,
      label: 'Portrait (A4 210×297mm)',
      onClick: () => {
        setPdfOrientation('portrait')
        handleDownloadPDF()
      }
    },
    {
      key: 'landscape',
      icon: <LayoutOutlined />,
      label: 'Landscape (A4 297×210mm)',
      onClick: () => {
        setPdfOrientation('landscape')
        handleDownloadPDF()
      }
    },
    {
      key: 'square',
      icon: <BorderOutlined />,
      label: 'Square (210×210mm)',
      onClick: () => {
        setPdfOrientation('square')
        handleDownloadPDF()
      }
    }
  ]

  return (
    <ConfigProvider>
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>FlipHTML5 Scanner</span>
            {userState.isPaid ? (
              <Tag color="gold">Premium - No Watermark</Tag>
            ) : (
              <Tag>Free - With Watermark</Tag>
            )}
          </div>
        }
        open={visible}
        onCancel={handleClose}
        footer={null}
        width={800}
        centered
        maskClosable={false}
      >
        {/* 扫描进度 - 放在最上面 */}
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text>Current Page: {scanState.currentPage}</Text>
              <Text>{scanState.isComplete ? 'Scan Complete' : scanState.isScanning ? 'Scanning...' : 'Ready'}</Text>
            </div>
            <Progress 
              percent={progress} 
              status={scanState.isComplete ? 'success' : scanState.isScanning ? 'active' : 'normal'} 
            />
          </Space>
        </Card>

        {/* 控制按钮 - 居中放置 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
          {/* Start/Stop Scan 按钮 */}
          {!scanState.isScanning ? (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleStartScan}
              size="large"
            >
              Start Scan
            </Button>
          ) : (
            <Button
              danger
              icon={<PauseCircleOutlined />}
              onClick={handleStopScan}
              size="large"
            >
              Stop Scan
            </Button>
          )}

          {/* Download 按钮 - 鼠标移上去显示下拉菜单 */}
          <Dropdown 
            menu={{ items: downloadMenuItems }}
            trigger={['hover']}
            disabled={scanState.isScanning || displayImages.length === 0}
          >
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              size="large"
              disabled={scanState.isScanning || displayImages.length === 0}
            >
              Download
            </Button>
          </Dropdown>
        </div>

        {/* 图片预览区 */}
        <div className="image-preview-container">
          <div className="image-preview-title">
            <Text strong>
              Scanned Images: {scanState.scannedImages.length > 0 ? scanState.scannedImages.length : `${mockImages.length} (Preview)`}
            </Text>
          </div>
          <div className="image-preview-scroll">
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
        </div>
      </Modal>
    </ConfigProvider>
  )
}

export default ScanDialog
