import { useState } from "react"
import { ConfigProvider, Button, Avatar, Typography, Card, Spin, Divider, Space } from "antd"
import { GoogleOutlined, LogoutOutlined, UserOutlined, FileImageOutlined } from "@ant-design/icons"
import { useSupabaseAuth } from "../core/useSupabaseAuth"
import "./dashboard.css"

const { Title, Text } = Typography

function Dashboard() {
  const { user, loading, signIn, signOut } = useSupabaseAuth()

  return (
    <ConfigProvider>
      <div className="dashboard-root">
        {/* Header */}
        <div className="dashboard-header">
          <FileImageOutlined style={{ fontSize: 24, color: "#fff" }} />
          <Title level={4} style={{ margin: 0, color: "#fff", fontWeight: 600 }}>
            FlipHTML5 Downloader
          </Title>
        </div>

        <div className="dashboard-body">
          {loading ? (
            <div className="dashboard-center">
              <Spin size="large" />
            </div>
          ) : user ? (
            <UserProfile user={user} onSignOut={signOut} />
          ) : (
            <LoginPanel onSignIn={signIn} />
          )}
        </div>
      </div>
    </ConfigProvider>
  )
}

function LoginPanel({ onSignIn }: { onSignIn: () => Promise<void> }) {
  const [signingIn, setSigningIn] = useState(false)

  const handleSignIn = async () => {
    setSigningIn(true)
    try {
      await onSignIn()
    } finally {
      // signInWithOAuth 会跳转离开此页，finally 不一定执行；
      // 若跳转未发生（报错等），则重置 loading 避免卡死
      setSigningIn(false)
    }
  }

  return (
    <div className="dashboard-center">
      <Card className="dashboard-card" variant="outlined">
        <div className="login-panel">
          <div className="login-icon-wrap">
            <UserOutlined style={{ fontSize: 48, color: "#bfbfbf" }} />
          </div>
          <Title level={4} style={{ margin: "16px 0 8px" }}>
            Sign in to your account
          </Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 24, textAlign: "center" }}>
            Sync your download history and settings across devices
          </Text>
          <Button
            type="primary"
            size="large"
            icon={<GoogleOutlined />}
            onClick={handleSignIn}
            loading={signingIn}
            block
            style={{ height: 44 }}
          >
            {signingIn ? "Redirecting to Google..." : "Continue with Google"}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function UserProfile({
  user,
  onSignOut
}: {
  user: NonNullable<ReturnType<typeof useSupabaseAuth>["user"]>
  onSignOut: () => void
}) {
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined
  const fullName = (user.user_metadata?.full_name as string) || user.email || "User"
  const email = user.email || ""

  return (
    <div className="profile-wrap">
      <Card className="dashboard-card" variant="outlined">
        <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
          {/* 用户信息 */}
          <div className="profile-info">
            <Avatar
              size={64}
              src={avatarUrl}
              icon={!avatarUrl ? <UserOutlined /> : undefined}
              style={{ flexShrink: 0 }}
            />
            <div className="profile-text">
              <Text strong style={{ fontSize: 16, display: "block" }}>
                {fullName}
              </Text>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {email}
              </Text>
            </div>
          </div>

          <Divider style={{ margin: "4px 0" }} />

          {/* 退出登录 */}
          <Button
            icon={<LogoutOutlined />}
            onClick={onSignOut}
            block
            danger
          >
            Sign Out
          </Button>
        </Space>
      </Card>
    </div>
  )
}

export default Dashboard
