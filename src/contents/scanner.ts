import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://fliphtml5.com/*", "https://online.fliphtml5.com/*"],
  all_frames: false,
  run_at: "document_idle"
}

const MAX_PAGES = 500

interface ScanProgress {
  currentPage: number
  totalPages: number
  imageUrl: string
  isComplete: boolean
}

let isScanning = false
let shouldStop = false

// 扫描所有页面
async function scanAllPages(scanSpeed: number = 1000): Promise<string[]> {
  const images: string[] = []
  let pageNumber = 1
  const flipbookBaseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/')

  isScanning = true
  shouldStop = false

  // 发送开始扫描消息
  window.postMessage({ 
    type: 'SCAN_STATUS', 
    action: 'started' 
  }, '*')

  while (pageNumber <= MAX_PAGES && !shouldStop) {
    // 检查是否应该停止
    const stopScan = await new Promise<boolean>(resolve => {
      chrome.storage.local.get('stopScan', (data: { stopScan?: boolean }) => {
        resolve(data.stopScan || false)
      })
    })

    if (stopScan) {
      console.log('Scan stopped by user')
      shouldStop = true
      break
    }

    // 导航到当前页
    window.location.hash = `#p=${pageNumber}`
    console.log(`Scanning page ${pageNumber}...`)

    // 等待页面加载
    await new Promise(resolve => setTimeout(resolve, scanSpeed))

    // 提取当前页的图片
    const pageImgs = document.querySelectorAll('div.side-image img')
    let foundImages = false

    for (const img of pageImgs) {
      let src = (img as HTMLImageElement).getAttribute('src') || ''
      
      // 处理相对路径
      if (src.startsWith('./')) {
        src = flipbookBaseUrl + src.replace(/^\.\//, '')
      } else if (src.startsWith('/')) {
        src = window.location.origin + src
      } else if (!/^https?:/i.test(src)) {
        src = flipbookBaseUrl + src
      }

      if (src && !images.includes(src)) {
        images.push(src)
        foundImages = true

        // 发送进度更新到页面
        window.postMessage({
          type: 'SCAN_PROGRESS',
          data: {
            currentPage: pageNumber,
            totalPages: MAX_PAGES,
            imageUrl: src,
            imageIndex: images.length - 1,
            isComplete: false
          } as ScanProgress
        }, '*')
      }
    }

    // 如果没有找到新图片，可能已经到达末尾
    if (!foundImages && pageNumber > 10) {
      console.log('No new images found, scan complete')
      break
    }

    pageNumber++
  }

  isScanning = false

  // 发送完成消息
  window.postMessage({
    type: 'SCAN_PROGRESS',
    data: {
      currentPage: pageNumber - 1,
      totalPages: pageNumber - 1,
      imageUrl: '',
      isComplete: true
    } as ScanProgress
  }, '*')

  // 清除停止标志
  chrome.storage.local.remove('stopScan')

  console.log(`Scan complete. Total images: ${images.length}`)
  return images
}

// 监听来自 popup 或对话框的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startScan') {
    if (isScanning) {
      sendResponse({ error: 'Scan already in progress' })
      return
    }

    const scanSpeed = request.scanSpeed || 1000
    scanAllPages(scanSpeed).then(images => {
      sendResponse({ success: true, images })
    }).catch(error => {
      console.error('Scan error:', error)
      sendResponse({ error: error.message })
    })

    return true // 保持消息通道打开
  }

  if (request.action === 'stopScan') {
    shouldStop = true
    chrome.storage.local.set({ stopScan: true })
    sendResponse({ success: true })
  }

  if (request.action === 'getScanStatus') {
    sendResponse({ isScanning, shouldStop })
  }
})

// 导出函数供其他模块使用
export { scanAllPages }
