import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect, useRef } from "react"
import { ConfigProvider, Modal, Button, Flex, Space, Typography, Card, message, Segmented, InputNumber, Radio, Tooltip, Avatar, Tag } from "antd"
import { DownloadOutlined, FileTextOutlined, LayoutOutlined, BorderOutlined, CompressOutlined, QuestionCircleOutlined, UserOutlined, FileImageOutlined, CrownOutlined } from "@ant-design/icons"
import type { PDFOrientation } from "../utils/pdfGenerator"
import { useUserInfo } from "../core/useSupabaseAuth"
import { useUserTier } from "./hooks/useUserTier"

type PDFOrientationUI = PDFOrientation | "auto"
import { usePdfExport } from "./hooks/usePdfExport"
import { useScanDialogState } from "./hooks/useScanDialogState"
import { ImagePreviewCard } from "./components/ImagePreviewCard"

const { Text } = Typography

//https://online.fliphtml5.com/oddka/BBC-Science-Focus-December-2025/#p=1
export const config: PlasmoCSConfig = {
  matches: ["https://online.fliphtml5.com/*"],
  all_frames: false,
  css: ["scanDialog.css"]
}

function ScanDialog() {
  const {
    visible,
    loading,
    imageState,
    metaInfo,
    handleClose,
    getHomepage,
    handleExtractText
  } = useScanDialogState()

  const { user } = useUserInfo()
  const { isPro } = useUserTier()

  const openDashboard = () => {
    // content script 无法直接调 chrome.tabs，通过 background 转发
    chrome.runtime.sendMessage({ action: "openDashboard" })
  }

  const [pdfOrientation, setPdfOrientation] = useState<PDFOrientationUI>("portrait")
  const [imagesPerRow, setImagesPerRow] = useState<2 | 4 | 6>(4)

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const pdfExport = usePdfExport({
    imageState,
    metaInfo,
    getHomepage
  })
  const {
    splitMode,
    setSplitMode,
    pagesPerFile,
    setPagesPerFile,
    imageQuality,
    setImageQuality,
    exportMode,
    setExportMode,
    exportRange,
    setExportRange,
    selectedPages,
    setSelectedPages,
    downloading,
    pdfProgress,
    handleDownloadPDF
  } = pdfExport

  // 非 Pro 用户锁定所有选项为默认值
  useEffect(() => {
    if (!isPro) {
      setPdfOrientation("portrait")
      setImageQuality(0.92)
      setSplitMode("all")
      setExportMode("all")
    }
  }, [isPro])

  // 首次加载完成后初始化导出范围为全部页
  const loadedOnceRef = useRef(false)
  useEffect(() => {
    if (imageState.isLoaded && imageState.totalPages > 0 && !loadedOnceRef.current) {
      loadedOnceRef.current = true
      setExportRange({ start: 1, end: imageState.totalPages })
    }
    if (!imageState.isLoaded) loadedOnceRef.current = false
  }, [imageState.isLoaded, imageState.totalPages, setExportRange])

  const displayImages = imageState.thumbImages

  // 非 Pro 用户点击 Extract Text：下载示例文件
  const handleExtractTextFree = async () => {
    try {
      const url = chrome.runtime.getURL("extract-text-example.txt")
      const resp = await fetch(url)
      const text = await resp.text()
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = "extract-text-example.txt"
      a.click()
      URL.revokeObjectURL(a.href)
      message.info({
        content: (
          <span>
            Sample downloaded.{" "}
            <span
              style={{ color: "#667eea", cursor: "pointer", fontWeight: 600 }}
              onClick={() => { openDashboard(); message.destroy() }}
            >
              Upgrade to Pro
            </span>
            {" "}to extract real text.
          </span>
        ),
        duration: 5,
      })
    } catch {
      message.error("Failed to download sample.")
    }
  }

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#667eea', borderRadius: 10, borderRadiusLG: 12 } }}>
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
            borderRadius: '16px',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.2)'
          }}>
            <div style={{ marginBottom: '20px' }}>
              <div className="loading-spinner" style={{
                width: '48px',
                height: '48px',
                border: '4px solid #eef0f6',
                borderTop: '4px solid #667eea',
                borderRadius: '50%',
                margin: '0 auto'
              }} />
            </div>
          </div>
        </div>
      )}

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileImageOutlined style={{ fontSize: 18, color: 'rgba(255,255,255,0.9)' }} />
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, letterSpacing: '0.2px' }}>FlipHTML5 Scanner</span>
            </div>
            <Tooltip title={user ? `${user.name || user.email} · Dashboard` : "Sign in · Dashboard"}>
              <div onClick={openDashboard} style={{ cursor: 'pointer', lineHeight: 0 }}>
                {user?.avatar_url ? (
                  <Avatar size={28} src={user.avatar_url}
                    style={{ border: '2px solid rgba(255,255,255,0.6)' }} />
                ) : (
                  <Avatar size={28} icon={<UserOutlined />}
                    style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.4)', color: '#fff' }} />
                )}
              </div>
            </Tooltip>
          </div>
        }
        open={visible}
        onCancel={handleClose}
        footer={null}
        width={800}
        centered
        maskClosable={false}
        className="scan-modal"
        style={{ maxHeight: '90vh' }}
        styles={{
          header: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '14px 20px',
            margin: 0,
            borderRadius: 0,
          },
          content: {
            borderRadius: '16px',
            overflow: 'hidden',
            padding: 0,
          },
          body: {
            padding: '16px 20px',
            maxHeight: 'calc(90vh - 110px)',
            overflow: 'hidden',
          },
        }}
      >
        {/* Export Settings */}
        <Card size="small" style={{ marginBottom: '16px', borderRadius: '12px', border: '1px solid #eef0f6', background: '#f7f8fc', position: 'relative' }}>
          {/* Pro 角标：非 Pro 用户显示在右上角 */}
          {!isPro && (
            <Tooltip
              title={
                <div style={{ fontSize: '12px', lineHeight: 1.7 }}>
                  <div><strong>Pro feature</strong></div>
                  <div style={{ marginTop: 4 }}>PDF Orientation, Image Quality, Pages per File and Export Range are locked to defaults for free users.</div>
                  <div style={{ marginTop: 6, color: '#a5b4fc', cursor: 'pointer' }} onClick={openDashboard}>
                    → Go to Dashboard to upgrade
                  </div>
                </div>
              }
              styles={{ root: { maxWidth: 280 } }}
            >
              <Tag
                icon={<CrownOutlined />}
                color="gold"
                style={{ position: 'absolute', top: 10, right: 10, cursor: 'pointer', zIndex: 1 }}
                onClick={openDashboard}
              >
                Pro
              </Tag>
            </Tooltip>
          )}
          <Flex vertical gap="middle">
            {/* 第一行：PDF方向选择 */}
            <Flex align="center" gap={16}>
              <Flex align="center" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                <Text strong>PDF Orientation</Text>
                <Tooltip
                  title={
                    <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                      <div><strong>Portrait</strong> — Standard A4 vertical layout. Best for most books and documents.</div>
                      <div style={{ marginTop: '6px' }}><strong>Landscape</strong> — A4 horizontal layout. Suitable for wide-format pages.</div>
                      <div style={{ marginTop: '6px' }}><strong>Square</strong> — 595×595pt square pages. Good for square-format content.</div>
                      <div style={{ marginTop: '6px' }}><strong>Auto Fit</strong> — Detects each page's aspect ratio and fits it to the nearest A4 size automatically.</div>
                    </div>
                  }
                  styles={{ root: { maxWidth: '320px' } }}
                >
                  <QuestionCircleOutlined style={{ marginLeft: '4px', color: '#8c8c8c', cursor: 'pointer' }} />
                </Tooltip>
                <Text strong>:</Text>
              </Flex>
              <Segmented
                value={pdfOrientation}
                onChange={(value) => setPdfOrientation(value as PDFOrientationUI)}
                disabled={!isPro}
                options={[
                  { label: 'Portrait', value: 'portrait', icon: <FileTextOutlined /> },
                  { label: 'Landscape', value: 'landscape', icon: <LayoutOutlined /> },
                  { label: 'Square', value: 'square', icon: <BorderOutlined /> },
                  { label: 'Auto Fit', value: 'auto', icon: <CompressOutlined /> }
                ]}
              />
            </Flex>

            {/* 第二行：图片质量选择 */}
            <Flex align="center" gap={16}>
              <Flex align="center" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                <Text strong>PDF Quality</Text>
                <Tooltip
                  title={
                    <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                      <div><strong>Original (0.92)</strong> — Preserves the original image quality. Largest file size.</div>
                      <div style={{ marginTop: '6px' }}><strong>Medium (0.75)</strong> — Reduces quality moderately. File size may shrink by 40–60% while retaining acceptable visual quality.</div>
                      <div style={{ marginTop: '6px' }}><strong>Low (0.50)</strong> — Further reduces quality. Visual degradation becomes noticeable, and the additional file size reduction is less significant compared to Medium.</div>
                    </div>
                  }
                  styles={{ root: { maxWidth: '320px' } }}
                >
                  <QuestionCircleOutlined style={{ marginLeft: '4px', color: '#8c8c8c', cursor: 'pointer' }} />
                </Tooltip>
                <Text strong>:</Text>
              </Flex>
              <Segmented
                value={imageQuality}
                onChange={(value) => setImageQuality(value as number)}
                disabled={!isPro}
                options={[
                  { label: 'Original', value: 0.92 },
                  { label: 'Medium', value: 0.75 },
                  { label: 'Low', value: 0.5 }
                ]}
              />
            </Flex>

            {/* 第三行：分页导出设置 */}
            <Flex align="center" gap={16}>
              <Flex align="center" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                <Text strong>Pages per File</Text>
                <Tooltip
                  title={
                    <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                      <div><strong>All in one file</strong> — Exports every page into a single PDF. Simple, but large books may produce very large files.</div>
                      <div style={{ marginTop: '6px' }}><strong>Custom</strong> — Splits the export into multiple PDFs each containing the specified number of pages. Recommended for books with 200+ pages to keep individual files manageable.</div>
                    </div>
                  }
                  styles={{ root: { maxWidth: '320px' } }}
                >
                  <QuestionCircleOutlined style={{ marginLeft: '4px', color: '#8c8c8c', cursor: 'pointer' }} />
                </Tooltip>
                <Text strong>:</Text>
              </Flex>
              <Radio.Group value={splitMode} onChange={(e) => setSplitMode(e.target.value)} disabled={!isPro}>
                <Space orientation="horizontal" size="large">
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
            </Flex>

            {/* 第四行：导出范围选择 */}
            <Flex align="center" gap={16}>
              <Flex align="center" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                <Text strong>Export Range</Text>
                <Tooltip
                  title={
                    <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                      <div><strong>All Pages</strong> — Exports every page of the book.</div>
                      <div style={{ marginTop: '6px' }}><strong>Range</strong> — Exports a consecutive page range. Useful when you only need a specific chapter or section.</div>
                      <div style={{ marginTop: '6px' }}><strong>Selected</strong> — Exports only the pages you manually select in the preview below. Click thumbnails to toggle selection.</div>
                    </div>
                  }
                  styles={{ root: { maxWidth: '300px' } }}
                >
                  <QuestionCircleOutlined style={{ marginLeft: '4px', color: '#8c8c8c', cursor: 'pointer' }} />
                </Tooltip>
                <Text strong>:</Text>
              </Flex>
              <Radio.Group value={exportMode} onChange={(e) => setExportMode(e.target.value)} disabled={!isPro}>
                <Space orientation="horizontal" size="large">
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
            </Flex>
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
          <Tooltip
            title={!isPro
              ? <span>Pro feature · Click to download a sample output</span>
              : undefined
            }
          >
            <Button
              size="large"
              icon={<FileTextOutlined />}
              disabled={imageState.thumbImages.length === 0}
              onClick={isPro ? handleExtractText : handleExtractTextFree}
            >
              Extract Text
              {!isPro && (
                <CrownOutlined style={{ marginLeft: 5, fontSize: 12, color: '#faad14' }} />
              )}
            </Button>
          </Tooltip>
        </div>

        {/* PDF Generation Progress */}
        {pdfProgress && (
          <div style={{ textAlign: 'center', marginBottom: '16px', color: '#667eea' }}>
            <Text type="secondary">
              {pdfProgress.totalFiles > 1 
                ? `Generating file ${pdfProgress.currentFile}/${pdfProgress.totalFiles} (${pdfProgress.currentPage}/${pdfProgress.totalPages} pages) - ${Math.round((pdfProgress.currentFile - 1 + (pdfProgress.currentPage / pdfProgress.totalPages)) / pdfProgress.totalFiles * 100)}%`
                : `Generating PDF... ${pdfProgress.currentPage}/${pdfProgress.totalPages} pages (${Math.round((pdfProgress.currentPage / pdfProgress.totalPages) * 100)}%)`
              }
            </Text>
          </div>
        )}

        <ImagePreviewCard
          displayImages={displayImages}
          imagesPerRow={imagesPerRow}
          setImagesPerRow={setImagesPerRow}
          exportMode={exportMode}
          selectedPages={selectedPages}
          setSelectedPages={setSelectedPages}
          totalPages={imageState.totalPages}
          scrollContainerRef={scrollContainerRef}
          title={metaInfo?.title ?? ""}
        />

        {/* Support Information */}
        <div style={{ textAlign: 'center', marginTop: '16px', paddingTop: '8px', borderTop: '1px solid #f0f0f0' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Support by{' '}
            <a
              href="mailto:extensionkit@gmail.com"
              style={{ color: '#667eea', textDecoration: 'none' }}
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
