import { useState } from "react"
import { Card, Button, Space, Typography, Segmented, Tooltip, message } from "antd"
import { DownloadOutlined } from "@ant-design/icons"
import { PageThumbnail } from "./PageThumbnail"
import { generateImageFileName, downloadImage, getLabelByIndex } from "../utils/imageDownload"

const { Text } = Typography

export type ImagesPerRow = 2 | 4 | 6
export type ExportMode = "all" | "range" | "selected"

interface ImagePreviewCardProps {
  displayImages: string[]
  imagesPerRow: ImagesPerRow
  setImagesPerRow: (v: ImagesPerRow) => void
  exportMode: ExportMode
  selectedPages: Set<number>
  setSelectedPages: (set: Set<number>) => void
  totalPages: number
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  /** 书名，用于生成图片下载文件名 */
  title?: string
}

export function ImagePreviewCard({
  displayImages,
  imagesPerRow,
  setImagesPerRow,
  exportMode,
  selectedPages,
  setSelectedPages,
  totalPages,
  scrollContainerRef,
  title = ""
}: ImagePreviewCardProps) {
  const [batchDownloading, setBatchDownloading] = useState(false)
  const showCheckbox = exportMode === "selected"

  const handleCheck = (index: number, checked: boolean) => {
    const next = new Set(selectedPages)
    if (checked) next.add(index)
    else next.delete(index)
    setSelectedPages(next)
  }

  const handleBatchDownload = async () => {
    if (selectedPages.size === 0) return
    setBatchDownloading(true)
    const sortedIndices = Array.from(selectedPages).sort((a, b) => a - b)
    let successCount = 0
    for (const index of sortedIndices) {
      const imgUrl = displayImages[index]
      if (!imgUrl) continue
      const label = getLabelByIndex(index, displayImages.length)
      try {
        await downloadImage(imgUrl, generateImageFileName(title, label))
        successCount++
        // 避免浏览器拦截连续下载
        await new Promise((resolve) => setTimeout(resolve, 300))
      } catch {
        // 继续下载下一张
      }
    }
    setBatchDownloading(false)
    message.success(`Downloaded ${successCount} image(s)`)
  }

  const imageCountText =
    displayImages.length > 0 ? `${displayImages.length}` : "0"

  return (
    <Card
      size="small"
      title={
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px"
          }}
        >
          <span>Pages: {imageCountText}</span>
          <Space size="middle">
            <Space size="small">
              <Text style={{ fontSize: "13px" }}>Pages per row:</Text>
              <Segmented<ImagesPerRow>
                value={imagesPerRow}
                onChange={(value) => setImagesPerRow(value as ImagesPerRow)}
                options={[
                  { label: "2", value: 2 },
                  { label: "4", value: 4 },
                  { label: "6", value: 6 }
                ]}
                size="small"
              />
            </Space>
            {showCheckbox && displayImages.length > 0 && (
              <Space size="small">
                <Button
                  size="small"
                  onClick={() => {
                    setSelectedPages(
                      new Set(Array.from({ length: totalPages }, (_, i) => i))
                    )
                  }}
                >
                  Select All
                </Button>
                <Button size="small" onClick={() => setSelectedPages(new Set())}>
                  Clear All
                </Button>
                <Tooltip
                  title={
                    selectedPages.size === 0
                      ? "No pages selected"
                      : `Download ${selectedPages.size} selected image(s)`
                  }
                >
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={handleBatchDownload}
                    loading={batchDownloading}
                    disabled={selectedPages.size === 0}
                    type="primary"
                    ghost
                  />
                </Tooltip>
              </Space>
            )}
          </Space>
        </div>
      }
      styles={{ body: { padding: 0 } }}
    >
      <div className="image-preview-container">
        {displayImages.length === 0 ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "#999"
            }}
          >
            <Text type="secondary">Loading images...</Text>
          </div>
        ) : (
          <div className="image-preview-scroll" ref={scrollContainerRef}>
            {displayImages.length > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: "8px"
                }}
              >
                <PageThumbnail
                  imgUrl={displayImages[0]}
                  label="Cover"
                  index={0}
                  showCheckbox={showCheckbox}
                  checked={selectedPages.has(0)}
                  onCheckChange={(checked) => handleCheck(0, checked)}
                  narrow
                  title={title}
                />
              </div>
            )}

            {displayImages.length > 2 && (
              <div
                className="image-preview-grid"
                style={{
                  gridTemplateColumns: `repeat(${imagesPerRow}, 1fr)`,
                  marginBottom: displayImages.length > 1 ? "8px" : "0"
                }}
              >
                {displayImages.slice(1, -1).map((imgUrl: string, idx: number) => {
                  const index = idx + 1
                  return (
                    <PageThumbnail
                      key={index}
                      imgUrl={imgUrl}
                      label={`Page ${index + 1}`}
                      index={index}
                      showCheckbox={showCheckbox}
                      checked={selectedPages.has(index)}
                      onCheckChange={(checked) => handleCheck(index, checked)}
                      title={title}
                    />
                  )
                })}
              </div>
            )}

            {displayImages.length > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center"
                }}
              >
                <PageThumbnail
                  imgUrl={displayImages[displayImages.length - 1]}
                  label="Back Cover"
                  index={displayImages.length - 1}
                  showCheckbox={showCheckbox}
                  checked={selectedPages.has(displayImages.length - 1)}
                  onCheckChange={(checked) =>
                    handleCheck(displayImages.length - 1, checked)
                  }
                  narrow
                  title={title}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
