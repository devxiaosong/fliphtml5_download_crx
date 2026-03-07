import { useState } from "react"
import { Checkbox, Typography } from "antd"
import { DownloadOutlined } from "@ant-design/icons"
import { generateImageFileName, downloadImage } from "../utils/imageDownload"

const { Text } = Typography

const checkboxStyle = {
  position: "absolute" as const,
  top: "8px",
  left: "8px",
  zIndex: 10,
  transform: "scale(1.5)"
}

interface PageThumbnailProps {
  imgUrl: string
  label: string
  index: number
  showCheckbox: boolean
  checked: boolean
  onCheckChange: (checked: boolean) => void
  /** 封面/封底使用较窄宽度 */
  narrow?: boolean
  /** 书名，用于生成下载文件名 */
  title?: string
}

export function PageThumbnail({
  imgUrl,
  label,
  index,
  showCheckbox,
  checked,
  onCheckChange,
  narrow = false,
  title = ""
}: PageThumbnailProps) {
  const [isHovered, setIsHovered] = useState(false)

  const itemStyle = narrow
    ? { position: "relative" as const, width: "auto" as const, maxWidth: "300px" }
    : { position: "relative" as const }

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await downloadImage(imgUrl, generateImageFileName(title, label))
    } catch {
      window.open(imgUrl, "_blank")
    }
  }

  return (
    <div
      className="image-preview-item"
      style={itemStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {showCheckbox && (
        <Checkbox
          checked={checked}
          onChange={(e) => onCheckChange(e.target.checked)}
          style={checkboxStyle}
        />
      )}
      <img
        src={imgUrl}
        alt={label}
        style={narrow ? { width: "100%", height: "auto" } : undefined}
      />
      <div className="image-preview-overlay">
        <Text style={{ color: "white" }}>{label}</Text>
        <button
          className={`image-preview-download-btn${isHovered ? " visible" : ""}`}
          onClick={handleDownload}
          title="Download image"
        >
          <DownloadOutlined />
        </button>
      </div>
    </div>
  )
}
