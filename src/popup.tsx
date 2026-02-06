import { useEffect } from "react"
import { ConfigProvider } from "antd"
import { logInfo } from "./utils/misc"
import ScanControl from "./components/ScanControl"

function IndexPopup() {
  useEffect(() => {
    logInfo("popup", "popup open")
  }, [])

  return (
    <ConfigProvider>
      <div style={{
        width: "400px",
        minHeight: "300px",
        background: "#ffffff",
        padding: "16px"
      }}>
        <ScanControl />
      </div>
    </ConfigProvider>
  )
}

export default IndexPopup
