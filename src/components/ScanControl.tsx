import { useState, useEffect } from "react"
import { Button, Slider, Flex, Typography, Divider } from "antd"
import { PlayCircleOutlined, LinkOutlined } from "@ant-design/icons"

const { Text, Link } = Typography

export default function ScanControl() {
  const [scanSpeed, setScanSpeed] = useState(3000)  // 默认最慢档
  const [isScanning, setIsScanning] = useState(false)

  // 从 storage 加载扫描速度设置
  useEffect(() => {
    chrome.storage.local.get(['scanSpeed'], (result: { scanSpeed?: number }) => {
      if (result.scanSpeed) {
        setScanSpeed(result.scanSpeed)
      }
    })
  }, [])

  // 保存扫描速度到 storage
  const handleSpeedChange = (value: number) => {
    setScanSpeed(value)
    chrome.storage.local.set({ scanSpeed: value })
  }

  // 启动扫描
  const handleStartScan = async () => {
    try {
      // 获取当前活动的标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      
      if (!tab.id) {
        console.error('No active tab found')
        return
      }

      // 检查是否在 online.fliphtml5.com 网站
      const url = tab.url || ''
      if (!url.includes('online.fliphtml5.com')) {
        alert('Please use this extension on online.fliphtml5.com website')
        return
      }

      setIsScanning(true)

      // 向 content script 发送消息，注入对话框
      chrome.tabs.sendMessage(tab.id, {
        action: 'showScanDialog',
        scanSpeed: scanSpeed
      })

    } catch (error) {
      console.error('Failed to start scan:', error)
      setIsScanning(false)
    }
  }

  return (
    <Flex vertical gap="large" style={{ width: '100%', padding: '20px 0' }}>
      {/* 示例链接 */}
      <div style={{ 
        background: '#f0f5ff', 
        padding: '12px', 
        borderRadius: '4px',
        border: '1px solid #adc6ff'
      }}>
        <Text strong style={{ display: 'block', marginBottom: '8px', color: '#1890ff' }}>
          <LinkOutlined /> Example Page
        </Text>
        <Link 
          href="https://online.fliphtml5.com/oddka/BBC-Science-Focus-December-2025" 
          target="_blank"
          style={{ fontSize: '12px', wordBreak: 'break-all' }}
        >
          https://online.fliphtml5.com/oddka/BBC-Science-Focus-December-2025
        </Link>
        <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: '4px' }}>
          Click to open this example page, then start scanning
        </Text>
      </div>

      <Divider style={{ margin: '0' }} />

      {/* 扫描速度设置 */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: '8px' }}>
          Scan Speed: {scanSpeed}ms
        </Text>
        <Slider
          min={500}
          max={3000}
          step={100}
          value={scanSpeed}
          onChange={handleSpeedChange}
          marks={{
            500: 'Fast',
            1000: 'Normal',
            2000: 'Slow',
            3000: 'Very Slow'
          }}
        />
        <Text type="secondary" style={{ fontSize: '12px' }}>
          Recommended: 1000ms. Too fast may cause image loading failure
        </Text>
      </div>

      {/* 启动扫描按钮 */}
      <Button
        type="primary"
        size="large"
        icon={<PlayCircleOutlined />}
        onClick={handleStartScan}
        loading={isScanning}
        block
      >
        {isScanning ? 'Scanning...' : 'Start Scan'}
      </Button>

      <Text type="secondary" style={{ fontSize: '12px', textAlign: 'center', display: 'block' }}>
        Please make sure you have opened a FlipHTML5 ebook page
      </Text>
    </Flex>
  )
}
