import { useState, useEffect } from "react"
import { Button, Slider, Space, Typography } from "antd"
import { PlayCircleOutlined } from "@ant-design/icons"

const { Text } = Typography

export default function ScanControl() {
  const [scanSpeed, setScanSpeed] = useState(1000)
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

      // 检查是否在 fliphtml5 网站
      const url = tab.url || ''
      if (!url.includes('fliphtml5.com')) {
        alert('Please use this extension on FlipHTML5 websites')
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
    <Space direction="vertical" size="large" style={{ width: '100%', padding: '20px 0' }}>
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
    </Space>
  )
}
