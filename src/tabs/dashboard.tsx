import { Typography, ConfigProvider } from "antd"

const { Title } = Typography

function Dashboard() {
  return (
    <ConfigProvider>
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white"
      }}>
        <Title level={1} style={{ color: "white", fontSize: "64px", marginBottom: "20px" }}>
          Hello World
        </Title>
        <p style={{ fontSize: "20px", opacity: 0.9 }}>
          欢迎来到 Dashboard 页面
        </p>
      </div>
    </ConfigProvider>
  )
}

export default Dashboard
