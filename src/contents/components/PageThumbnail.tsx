import { Checkbox, Typography } from "antd"

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
}

export function PageThumbnail({
  imgUrl,
  label,
  index,
  showCheckbox,
  checked,
  onCheckChange,
  narrow = false
}: PageThumbnailProps) {
  const itemStyle = narrow
    ? { position: "relative" as const, width: "auto" as const, maxWidth: "300px" }
    : { position: "relative" as const }

  return (
    <div className="image-preview-item" style={itemStyle}>
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
      </div>
    </div>
  )
}
