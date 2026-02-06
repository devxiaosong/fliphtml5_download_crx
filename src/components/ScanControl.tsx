import { useState, useEffect } from "react"
import { Button, Slider, Flex, Typography, Divider } from "antd"
import { PlayCircleOutlined, LinkOutlined, FileImageOutlined } from "@ant-design/icons"

const { Text, Link, Title } = Typography

export default function ScanControl() {
  const [scanSpeed, setScanSpeed] = useState(3000)  // 默认最慢档
  const [isButtonEnabled, setIsButtonEnabled] = useState(false)

  // 检查当前页面是否是有效的 FlipHTML5 页面
  const checkCurrentPage = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const url = tab.url || ''
      
      // 去掉协议部分 (http:// 或 https://)
      const urlWithoutProtocol = url.split('//')[1] || ''
      
      // 情况 2: online.fliphtml5.com - 直接可用（优先判断）
      if (urlWithoutProtocol.startsWith('online.fliphtml5.com')) {
        setIsButtonEnabled(true)
        return
      }
      
      // 情况 1: fliphtml5.com 短链接 - 需要至少 3 个路径段
      if (urlWithoutProtocol.startsWith('fliphtml5.com')) {
        try {
          const urlObj = new URL(url)
          const pathSegments = urlObj.pathname.split('/').filter(seg => seg.length > 0)
          
          // 至少需要 3 个路径段
          if (pathSegments.length >= 3) {
            setIsButtonEnabled(true)
            return
          }
        } catch (error) {
          console.error('Failed to parse URL:', error)
        }
      }
      
      // 其他情况，按钮禁用
      setIsButtonEnabled(false)
    } catch (error) {
      console.error('Failed to check current page:', error)
      setIsButtonEnabled(false)
    }
  }

  // 初始化：加载扫描速度设置和检查当前页面
  useEffect(() => {
    // 加载扫描速度设置
    chrome.storage.local.get(['scanSpeed'], (result: { scanSpeed?: number }) => {
      if (result.scanSpeed) {
        setScanSpeed(result.scanSpeed)
      }
    })
    
    // 检查当前页面是否有效
    checkCurrentPage()
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

      const url = tab.url || ''
      
      // 去掉协议部分 (http:// 或 https://)
      const urlWithoutProtocol = url.split('//')[1] || ''
      
      // 情况 2: 处理 online.fliphtml5.com 网站（优先判断）
      if (urlWithoutProtocol.startsWith('online.fliphtml5.com')) {
        // 向 content script 发送消息，注入对话框
        chrome.tabs.sendMessage(tab.id, {
          action: 'showScanDialog',
          scanSpeed: scanSpeed
        })
        return
      }
      
      // 情况 1: 处理 fliphtml5.com 短链接
      if (urlWithoutProtocol.startsWith('fliphtml5.com')) {
        try {
          const urlObj = new URL(url)
          const pathSegments = urlObj.pathname.split('/').filter(seg => seg.length > 0)
          
          // 检查是否有至少 3 个路径段（格式：/seg1/seg2/seg3/）
          if (pathSegments.length >= 3) {
            // 构建 online.fliphtml5.com URL，只取前两个分段
            const onlineUrl = `https://online.fliphtml5.com/${pathSegments[0]}/${pathSegments[1]}`
            
            // 打开新的标签页
            chrome.tabs.create({ url: onlineUrl })
            return
          } else {
            alert('Invalid FlipHTML5 URL format. Expected format: fliphtml5.com/xxx/yyy/zzz/')
            return
          }
        } catch (error) {
          console.error('Failed to parse URL:', error)
          alert('Invalid URL format')
          return
        }
      }
      
      // 如果都不是，提示用户
      alert('Please use this extension on FlipHTML5 website (fliphtml5.com or online.fliphtml5.com)')

    } catch (error) {
      console.error('Failed to start scan:', error)
    }
  }

  return (
    <Flex vertical gap="large" style={{ width: '100%', margin: 0 }}>
      {/* 标题栏 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '12px 0',
        textAlign: 'center',
        margin: 0
      }}>
        <Flex align="center" justify="center" gap="small">
          <FileImageOutlined style={{ fontSize: '22px', color: '#fff' }} />
          <Title level={4} style={{ margin: 0, color: '#fff', fontWeight: 600, fontSize: '18px' }}>
            FlipHTML5 Downloader
          </Title>
        </Flex>
      </div>

      <div style={{ padding: '0 16px 20px 16px' }}>
        <Flex vertical gap="large">
          {/* 仅在无效页面时显示示例链接提示 */}
          {!isButtonEnabled && (
            <>
              <div style={{ 
                background: '#fff7e6', 
                padding: '12px', 
                borderRadius: '4px',
                border: '1px solid #ffd591',
                textAlign: 'center'
              }}>
                <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                  Current page is not a valid FlipHTML5 page
                </Text>
                <Link 
                  href="https://online.fliphtml5.com/oddka/BBC-Science-Focus-December-2025" 
                  target="_blank"
                  style={{ fontSize: '13px' }}
                >
                  <LinkOutlined /> Click to open example page
                </Link>
              </div>
              <Divider style={{ margin: '0' }} />
            </>
          )}

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
            disabled={!isButtonEnabled}
            block
          >
            Start Scan
          </Button>
        </Flex>
      </div>
    </Flex>
  )
}
