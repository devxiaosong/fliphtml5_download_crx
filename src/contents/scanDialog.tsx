import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect, useRef } from "react"
import { ConfigProvider, Modal, Button, Flex, Space, Typography, Card, message, Segmented, InputNumber, Radio, Tooltip, Avatar } from "antd"
import { DownloadOutlined, FileTextOutlined, LayoutOutlined, BorderOutlined, CompressOutlined, QuestionCircleOutlined, UserOutlined } from "@ant-design/icons"
import type { PDFOrientation } from "../utils/pdfGenerator"
import { useUserInfo } from "../hooks/useSupabaseAuth"

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
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '32px' }}>
            <span>FlipHTML5 Scanner</span>
            <Tooltip title={user ? `${user.name || user.email} · Dashboard` : "Sign in · Dashboard"}>
              <div onClick={openDashboard} style={{ cursor: 'pointer', lineHeight: 0 }}>
                {user?.avatar_url ? (
                  <Avatar size={28} src={user.avatar_url} />
                ) : (
                  <Avatar size={28} icon={<UserOutlined />} style={{ background: '#d9d9d9' }} />
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
        style={{ maxHeight: '90vh' }}
        styles={{ body: { maxHeight: 'calc(90vh - 110px)', overflow: 'hidden' } }}
      >
        {/* Export Settings */}
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Flex vertical gap="middle">
            {/* 第一行：PDF方向选择 */}
            <Flex align="center" gap={16}>
              <Text strong style={{ minWidth: '110px' }}>PDF Orientation:</Text>
              <Segmented
                value={pdfOrientation}
                onChange={(value) => setPdfOrientation(value as PDFOrientationUI)}
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
              <Flex align="center" style={{ minWidth: '110px' }}>
                <Text strong>Image Quality</Text>
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
                options={[
                  { label: 'Original', value: 0.92 },
                  { label: 'Medium', value: 0.75 },
                  { label: 'Low', value: 0.5 }
                ]}
              />
            </Flex>

            {/* 第三行：分页导出设置 */}
            <Flex align="center" gap={16}>
              <Text strong style={{ minWidth: '110px' }}>Pages per File:</Text>
              <Radio.Group value={splitMode} onChange={(e) => setSplitMode(e.target.value)}>
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
              <Text strong style={{ minWidth: '110px' }}>Export Range:</Text>
              <Radio.Group value={exportMode} onChange={(e) => setExportMode(e.target.value)}>
                <Space orientation="horizontal" size="large" wrap>
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
          <Button
            size="large"
            icon={<FileTextOutlined />}
            disabled={imageState.thumbImages.length === 0}
            onClick={handleExtractText}
          >
            Extract Text
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
