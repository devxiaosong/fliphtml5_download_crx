import { useEffect } from "react"
import { Tabs, ConfigProvider } from "antd"
import { logInfo } from "./utils/misc"
import ScanControl from "./components/ScanControl"
import AccountPanel from "./components/AccountPanel"

function IndexPopup() {
  useEffect(() => {
    logInfo("popup", "popup open")
  }, [])

  const items = [
    {
      key: 'scan',
      label: '扫描控制',
      children: <ScanControl />
    },
    {
      key: 'account',
      label: '账户与付费',
      children: <AccountPanel />
    }
  ]

  return (
    <ConfigProvider>
      <div style={{
        width: "400px",
        minHeight: "500px",
        background: "#ffffff"
      }}>
        <Tabs 
          defaultActiveKey="scan" 
          items={items}
          style={{ padding: "16px" }}
        />
      </div>
    </ConfigProvider>
  )
}

export default IndexPopup
