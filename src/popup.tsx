import { useEffect } from "react"
import { Button, ConfigProvider } from "antd"
import { DashboardOutlined } from "@ant-design/icons"
import { logInfo } from "./utils/misc"

function IndexPopup() {
  useEffect(() => {
    logInfo("popup", "popup open")
  }, [])

  const openDashboard = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("tabs/dashboard.html")
    })
  }

  return (
    <ConfigProvider>
      <div style={{
        minWidth: "300px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "20px",
        background: "#ffffff"
      }}>
        <h2 style={{
          margin: 0,
          fontSize: "18px",
          color: "#1890ff"
        }}>Chrome 插件</h2>
        <Button 
          type="primary" 
          icon={<DashboardOutlined />}
          onClick={openDashboard}
          size="large"
        >
          打开 Dashboard
        </Button>
      </div>
    </ConfigProvider>
  )
}

export default IndexPopup
