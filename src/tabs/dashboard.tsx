import { useState, useEffect } from "react"
import { ConfigProvider, Button, Avatar, Typography, Spin, Radio, Checkbox, Tag, Divider, message } from "antd"
import {
  GoogleOutlined, LogoutOutlined, UserOutlined, FileImageOutlined,
  CrownOutlined, LockOutlined, CheckCircleOutlined, SketchOutlined, SafetyCertificateOutlined
} from "@ant-design/icons"
import { useSupabaseAuth } from "../core/useSupabaseAuth"
import { getTierList, getMembership, makeSubscriptionOrder } from "../core/misc"
import "./dashboard.css"

const { Title, Text } = Typography

const FEATURES = [
  "Unlimited PDF downloads",
  "No watermarks",
  "High-quality image export",
  "Priority support",
]

const TERMS_URL = "https://extensionkit.cc/terms-of-service"

// ─── Root ────────────────────────────────────────────────────────────────────

function Dashboard() {
  const { user, loading, signIn, signOut } = useSupabaseAuth()

  return (
    <ConfigProvider>
      <div className="db-root">

        {/* Header */}
        <div className="db-header">
          <div className="db-header-brand">
            <div className="db-header-icon-wrap">
              <FileImageOutlined style={{ fontSize: 22, color: "#fff" }} />
            </div>
            <div>
              <div className="db-header-title">FlipHTML5 Downloader</div>
              <div className="db-header-sub">Manage your account and subscription</div>
            </div>
          </div>
        </div>

        {/* Two-column body */}
        <div className="db-main">
          <div className="db-columns">

            {/* Left: Account */}
            <div className="db-col-left">
              {loading
                ? <div className="db-col-loading"><Spin size="large" /></div>
                : user
                  ? <AccountCard user={user} onSignOut={signOut} />
                  : <LoginCard onSignIn={signIn} />
              }
            </div>

            {/* Right: Pricing */}
            <div className="db-col-right">
              <PricingPanel isLoggedIn={!!user && !loading} />
            </div>

          </div>
        </div>
      </div>
    </ConfigProvider>
  )
}

// ─── Account Card (logged in) ────────────────────────────────────────────────

function AccountCard({
  user,
  onSignOut,
}: {
  user: NonNullable<ReturnType<typeof useSupabaseAuth>["user"]>
  onSignOut: () => void
}) {
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined
  const fullName = (user.user_metadata?.full_name as string) || user.email || "User"
  const email = user.email || ""

  return (
    <div className="ac-card">
      {/* Avatar with gradient ring */}
      <div className="ac-avatar-ring">
        <Avatar
          size={72}
          src={avatarUrl}
          icon={!avatarUrl ? <UserOutlined /> : undefined}
        />
      </div>

      <Title level={4} className="ac-name">{fullName}</Title>
      <Text type="secondary" className="ac-email">{email}</Text>

      <Divider className="ac-divider" />

      <Button
        icon={<LogoutOutlined />}
        onClick={onSignOut}
        block
        danger
        ghost
        size="large"
        className="ac-signout"
      >
        Sign Out
      </Button>
    </div>
  )
}

// ─── Login Card (logged out) ─────────────────────────────────────────────────

function LoginCard({ onSignIn }: { onSignIn: () => Promise<void> }) {
  const [signingIn, setSigningIn] = useState(false)

  const handleSignIn = async () => {
    setSigningIn(true)
    try { await onSignIn() } finally { setSigningIn(false) }
  }

  return (
    <div className="ac-card">
      <div className="lc-icon-wrap">
        <FileImageOutlined style={{ fontSize: 36, color: "#667eea" }} />
      </div>

      <Title level={4} className="ac-name" style={{ marginTop: 16 }}>Welcome</Title>
      <Text type="secondary" className="ac-email">
        Sign in to manage your subscription and settings
      </Text>

      <Divider className="ac-divider" />

      <Button
        type="primary"
        icon={<GoogleOutlined />}
        onClick={handleSignIn}
        loading={signingIn}
        block
        size="large"
        className="lc-signin-btn"
      >
        {signingIn ? "Redirecting…" : "Continue with Google"}
      </Button>
    </div>
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
      const url = `${currentTier.pay_page}?vendor_id=${rsp.vendor_id}&env=${rsp.env}&order_uuid=${rsp.order_uuid}`
      window.open(url)
    } catch {
      messageApi.error("Failed to create order, please try again")
    } finally {
      setSubscribing(false)
    }
  }

  if (loadingTiers) {
    return (
      <div className="pc-card">
        <div className="db-col-loading"><Spin size="large" /></div>
      </div>
    )
  }

  if (tierList.length === 0) return null

  return (
    <div className="pc-card">
      {contextHolder}

      {/* Gradient header */}
      <div className="pc-header">
        {isPro ? (
          <>
            <Tag icon={<CrownOutlined />} color="gold" className="pc-pro-tag">Pro Member</Tag>
            <div className="pc-header-title">You're all set!</div>
            <div className="pc-header-sub">Thanks for being a Pro member. Enjoy unlimited access.</div>
          </>
        ) : (
          <>
            <div className="pc-promo-badge">✦ 25% OFF · LIMITED TIME OFFER</div>
            <div className="pc-header-title">Upgrade to Pro</div>
            <div className="pc-header-sub">Unlock all features and download without limits</div>
          </>
        )}
      </div>

      {/* Body */}
      <div className="pc-body">

        {/* Feature grid */}
        <div className="pc-feature-grid">
          {FEATURES.map((f) => (
            <div key={f} className="pc-feature-item">
              <CheckCircleOutlined className="pc-feature-icon" />
              <Text style={{ fontSize: 13 }}>{f}</Text>
            </div>
          ))}
        </div>

        <Divider style={{ margin: "20px 0" }} />

        {/* Tier selector */}
        <div className="pc-tier-row">
          <Radio.Group
            value={tierId}
            buttonStyle="solid"
            onChange={(e) => setTierId(e.target.value)}
          >
            {tierList.map((tier, index) => (
              <Radio.Button key={index} value={index} className="pc-tier-btn">
                {tier.period_type}
              </Radio.Button>
            ))}
          </Radio.Group>
        </div>

        {/* Price display */}
        {currentTier && (
          <div className="pc-price-box">
            <span className="pc-price-main">${currentTier.equivalent_selling_price}</span>
            <span className="pc-price-original">${currentTier.equivalent_list_price}</span>
            <span className="pc-price-period">/ {currentTier.equivalent_period}</span>
          </div>
        )}

        {/* Money-back */}
        <div className="pc-money-back">
          <SafetyCertificateOutlined />
          7-Day Money Back Guarantee
        </div>

        {/* CTA button */}
        {isPro ? (
          <Button
            block
            size="large"
            icon={<SketchOutlined />}
            onClick={() => window.open(cancelUrl)}
            loading={loadingMembership}
            className="pc-unsub-btn"
          >
            Manage Subscription
          </Button>
        ) : (
          <Button
            type="primary"
            block
            size="large"
            icon={<CrownOutlined />}
            onClick={handleSubscribe}
            loading={subscribing}
            className="pc-sub-btn"
          >
            Subscribe Now
          </Button>
        )}

        {/* ToS */}
        {!isPro && (
          <div className="pc-tos-row">
            <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <Text style={{ fontSize: 12 }}>
              I agree to the{" "}
              <a href={TERMS_URL} target="_blank" rel="noreferrer" className="pc-tos-link">
                Terms of Service
              </a>
            </Text>
          </div>
        )}

        {/* Payment security */}
        <div className="pc-security">
          <LockOutlined style={{ marginRight: 5 }} />
          Secured by <strong>PayPal</strong> and <strong>Paddle</strong> · No account needed
        </div>

      </div>
    </div>
  )
}

export default Dashboard
