import { useState, useEffect } from "react"
import { ConfigProvider, Button, Avatar, Typography, Card, Spin, Divider, Space, Radio, Checkbox, Tag, message } from "antd"
import {
  GoogleOutlined, LogoutOutlined, UserOutlined, FileImageOutlined,
  CrownOutlined, LockOutlined, CheckCircleOutlined, SketchOutlined
} from "@ant-design/icons"
import { useSupabaseAuth } from "../core/useSupabaseAuth"
import { getTierList, getMembership, makeSubscriptionOrder } from "../core/misc"
import "./dashboard.css"

const { Title, Text } = Typography

const FEATURES = [
  "Download unlimited PDF files",
  "No watermarks on exported PDFs",
  "High-quality image export",
  "Priority support",
]

const TERMS_URL = "https://extensionkit.cc/terms-of-service"

function Dashboard() {
  const { user, loading, signIn, signOut } = useSupabaseAuth()

  return (
    <ConfigProvider>
      <div className="dashboard-root">
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
          ) : (
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              {user ? (
                <UserProfile user={user} onSignOut={signOut} />
              ) : (
                <LoginPanel onSignIn={signIn} />
              )}
              <PricingPanel isLoggedIn={!!user} />
            </Space>
          )}
        </div>
      </div>
    </ConfigProvider>
  )
}

// ─── Login Panel ─────────────────────────────────────────────────────────────

function LoginPanel({ onSignIn }: { onSignIn: () => Promise<void> }) {
  const [signingIn, setSigningIn] = useState(false)

  const handleSignIn = async () => {
    setSigningIn(true)
    try {
      await onSignIn()
    } finally {
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

// ─── User Profile ─────────────────────────────────────────────────────────────

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
    <Card className="dashboard-card" variant="outlined">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
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

        <Button icon={<LogoutOutlined />} onClick={onSignOut} block danger>
          Sign Out
        </Button>
      </Space>
    </Card>
  )
}

// ─── Pricing Panel ────────────────────────────────────────────────────────────

function PricingPanel({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [tierId, setTierId] = useState(0)
  const [checked, setChecked] = useState(false)
  const [tierList, setTierList] = useState<any[]>([])
  const [isPro, setIsPro] = useState(false)
  const [cancelUrl, setCancelUrl] = useState("")
  const [loadingTiers, setLoadingTiers] = useState(true)
  const [loadingMembership, setLoadingMembership] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  useEffect(() => {
    getTierList()
      .then((list) => { if (list) setTierList(list) })
      .finally(() => setLoadingTiers(false))

    if (isLoggedIn) {
      getMembership()
        .then((data) => {
          if (!data) return
          setIsPro(data["membership"] === "pro")
          setCancelUrl(data["cancel_url"] || "")
        })
        .finally(() => setLoadingMembership(false))
    } else {
      setLoadingMembership(false)
    }
  }, [isLoggedIn])

  const currentTier = tierList[tierId]

  const handleSubscribe = async () => {
    if (!checked) {
      messageApi.warning("Please agree to the Terms of Service first")
      return
    }
    if (!currentTier) return
    setSubscribing(true)
    try {
      const rsp = await makeSubscriptionOrder(currentTier.tier_uuid)
      const jumpToUrl = `${currentTier.pay_page}?vendor_id=${rsp.vendor_id}&env=${rsp.env}&order_uuid=${rsp.order_uuid}`
      window.open(jumpToUrl)
    } catch {
      messageApi.error("Failed to create order, please try again")
    } finally {
      setSubscribing(false)
    }
  }

  if (loadingTiers) {
    return (
      <Card className="dashboard-card">
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <Spin />
        </div>
      </Card>
    )
  }

  if (tierList.length === 0) return null

  return (
    <Card className="dashboard-card">
      {contextHolder}

      {/* Title / Pro badge */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        {isPro ? (
          <Tag icon={<CrownOutlined />} color="gold" style={{ fontSize: 14, padding: "4px 14px" }}>
            Pro Member
          </Tag>
        ) : (
          <Title level={4} style={{ margin: 0 }}>Upgrade to Pro</Title>
        )}
      </div>

      {/* Feature list */}
      <div style={{ marginBottom: 16 }}>
        {FEATURES.map((f) => (
          <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 14, flexShrink: 0 }} />
            <Text style={{ fontSize: 13 }}>{f}</Text>
          </div>
        ))}
      </div>

      <Divider style={{ margin: "12px 0" }} />

      {/* Promo badge */}
      <div style={{ textAlign: "center", marginBottom: 12, color: "#faad14", fontWeight: "bold", fontSize: 13 }}>
        25% OFF — LIMITED TIME OFFER!
      </div>

      {/* Tier selector */}
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <Radio.Group
          value={tierId}
          buttonStyle="solid"
          onChange={(e) => setTierId(e.target.value)}
        >
          {tierList.map((tier, index) => (
            <Radio.Button key={index} value={index}>
              {tier.period_type}
            </Radio.Button>
          ))}
        </Radio.Group>
      </div>

      {/* Price */}
      {currentTier && (
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <span style={{ color: "#ff4d4f", fontSize: 34, fontWeight: "bold" }}>
            ${currentTier.equivalent_selling_price}
          </span>
          <span style={{ color: "#bfbfbf", fontSize: 16, textDecoration: "line-through", marginLeft: 8 }}>
            ${currentTier.equivalent_list_price}
          </span>
          <span style={{ color: "#8c8c8c", fontSize: 13, marginLeft: 4 }}>
            /{currentTier.equivalent_period}
          </span>
        </div>
      )}

      {/* Money-back */}
      <div style={{ textAlign: "center", marginBottom: 14, color: "#ff4d4f", fontSize: 12, fontWeight: "bold" }}>
        7-DAY MONEY BACK GUARANTEE
      </div>

      {/* Subscribe / Unsubscribe */}
      {isPro ? (
        <Button
          block
          size="large"
          icon={<SketchOutlined />}
          onClick={() => window.open(cancelUrl)}
          loading={loadingMembership}
        >
          Unsubscribe
        </Button>
      ) : (
        <Button
          type="primary"
          block
          size="large"
          icon={<CrownOutlined />}
          onClick={handleSubscribe}
          loading={subscribing}
          style={{ background: "#ff4d4f", borderColor: "#ff4d4f" }}
        >
          Subscribe Now
        </Button>
      )}

      {/* ToS checkbox */}
      {!isPro && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <Text style={{ fontSize: 12 }}>
            I agree to the{" "}
            <a href={TERMS_URL} target="_blank" rel="noreferrer" style={{ color: "#ff4d4f" }}>
              Terms of Service
            </a>
          </Text>
        </div>
      )}

      {/* Payment security */}
      <div style={{ marginTop: 14, fontSize: 12, color: "#8c8c8c", textAlign: "center" }}>
        <LockOutlined style={{ marginRight: 4 }} />
        Secured by <strong style={{ color: "#595959" }}>PayPal</strong> and{" "}
        <strong style={{ color: "#595959" }}>Paddle</strong>. No account needed.
      </div>
    </Card>
  )
}

export default Dashboard
