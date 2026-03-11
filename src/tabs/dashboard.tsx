import { useState, useEffect } from "react"
import {
  ConfigProvider, Button, Avatar, Typography, Spin, Radio, Checkbox,
  Tag, Divider, message, Tabs, Form, Input, Slider, Table, Switch, Popconfirm
} from "antd"
import {
  GoogleOutlined, LogoutOutlined, UserOutlined, FileImageOutlined,
  CrownOutlined, LockOutlined, CheckCircleOutlined, SketchOutlined,
  SafetyCertificateOutlined, SettingOutlined, HistoryOutlined, FileTextOutlined,
  DeleteOutlined, LinkOutlined
} from "@ant-design/icons"
import { useSupabaseAuth, useUserInfo } from "../core/useSupabaseAuth"
import { getTierList, getMembership, makeSubscriptionOrder } from "../core/misc"
import {
  getWatermarkSettings, saveWatermarkSettings,
  getHeaderFooterSettings, saveHeaderFooterSettings,
} from "../utils/pdfSettings"
import { getDownloadHistory, clearDownloadHistory, type HistoryRecord } from "../utils/downloadHistory"
import "./dashboard.css"

const { Title, Text } = Typography

const FEATURES: { title: string; desc: string }[] = [
  { title: "PDF Orientation", desc: "Portrait · Landscape · Square · Auto Fit" },
  { title: "Image Quality", desc: "Medium & Low compression to reduce file size" },
  { title: "Split PDF", desc: "Export large books across multiple files" },
  { title: "Page Range", desc: "Export specific ranges or hand-picked pages" },
  { title: "Full Text Extraction", desc: "Extract all pages (free plan: first 5 only)" },
  { title: "Header & Footer", desc: "Custom text with optional clickable links" },
  { title: "Watermark Control", desc: "Customize content, size, angle — or disable" },
]

const TERMS_URL = "https://extensionkit.cc/terms-of-service"

// ─── Root ────────────────────────────────────────────────────────────────────

function Dashboard() {
  const { user, loading, signIn, signOut } = useSupabaseAuth()

  const tabItems = [
    {
      key: "pricing",
      label: <span className="tab-label"><CrownOutlined />Pricing</span>,
      children: <PricingPanel isLoggedIn={!!user && !loading} onSignIn={signIn} />,
    },
    {
      key: "settings",
      label: <span className="tab-label"><SettingOutlined />Settings</span>,
      children: <SettingsPanel />,
    },
    {
      key: "history",
      label: <span className="tab-label"><HistoryOutlined />History</span>,
      children: <HistoryPanel />,
    },
  ]

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

            {/* Left: Account — always visible */}
            <div className="db-col-left">
              {loading
                ? <div className="db-col-loading"><Spin size="large" /></div>
                : user
                  ? <AccountCard user={user} onSignOut={signOut} />
                  : <LoginCard onSignIn={signIn} />
              }
            </div>

            {/* Right: Tabbed panels */}
            <div className="db-col-right">
              <div className="right-panel-card">
                <Tabs
                  defaultActiveKey="pricing"
                  items={tabItems}
                  className="right-tabs"
                />
              </div>
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
        block danger ghost size="large"
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
        block size="large"
        className="lc-signin-btn"
      >
        {signingIn ? "Redirecting…" : "Continue with Google"}
      </Button>
    </div>
  )
}

// ─── Tab: Pricing ─────────────────────────────────────────────────────────────

function PricingPanel({ isLoggedIn, onSignIn }: { isLoggedIn: boolean; onSignIn: () => Promise<void> }) {
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
    if (!isLoggedIn) {
      await onSignIn()
      return
    }
    if (!checked) { messageApi.warning("Please agree to the Terms of Service first"); return }
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
    return <div className="tab-loading"><Spin size="large" /></div>
  }

  if (tierList.length === 0) return (
    <div className="tab-empty">
      <CrownOutlined style={{ fontSize: 40, color: "#d9d9d9" }} />
      <div>Pricing info unavailable</div>
    </div>
  )

  return (
    <div className="pricing-tab">
      {contextHolder}

      {/* Gradient banner */}
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
            <div className="pc-header-sub">Unlock PDF customization, full text extraction, and advanced export options</div>
          </>
        )}
      </div>

      <div className="pc-body">
        <div className="pc-feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="pc-feature-item">
              <CheckCircleOutlined className="pc-feature-icon" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#2d2d3a", lineHeight: 1.3 }}>{f.title}</div>
                <div style={{ fontSize: 11, color: "#8c8fa8", marginTop: 2, lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <Divider style={{ margin: "20px 0" }} />

        <div className="pc-tier-row">
          <Radio.Group value={tierId} buttonStyle="solid" onChange={(e) => setTierId(e.target.value)}>
            {tierList.map((tier, index) => (
              <Radio.Button key={index} value={index} className="pc-tier-btn">
                {tier.period_type}
              </Radio.Button>
            ))}
          </Radio.Group>
        </div>

        {currentTier && (
          <div className="pc-price-box">
            <span className="pc-price-main">${currentTier.equivalent_selling_price}</span>
            <span className="pc-price-original">${currentTier.equivalent_list_price}</span>
            <span className="pc-price-period">/ {currentTier.equivalent_period}</span>
          </div>
        )}

        <div className="pc-money-back">
          <SafetyCertificateOutlined />7-Day Money Back Guarantee
        </div>

        {isPro ? (
          <Button block size="large" icon={<SketchOutlined />}
            onClick={() => window.open(cancelUrl)} loading={loadingMembership} className="pc-unsub-btn">
            Manage Subscription
          </Button>
        ) : (
          <Button type="primary" block size="large" icon={<CrownOutlined />}
            onClick={handleSubscribe} loading={subscribing} className="pc-sub-btn">
            Subscribe Now
          </Button>
        )}

        {!isPro && (
          <div className="pc-tos-row">
            <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <Text style={{ fontSize: 12 }}>
              I agree to the{" "}
              <a href={TERMS_URL} target="_blank" rel="noreferrer" className="pc-tos-link">Terms of Service</a>
            </Text>
          </div>
        )}

        <div className="pc-security">
          <LockOutlined style={{ marginRight: 5 }} />
          Secured by <strong>PayPal</strong> and <strong>Paddle</strong> · No account needed
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Settings ────────────────────────────────────────────────────────────

function SettingsPanel() {
  const [hfEnabled, setHfEnabled] = useState(false)
  const [headerText, setHeaderText] = useState("")
  const [headerUrl, setHeaderUrl] = useState("")
  const [footerText, setFooterText] = useState("")
  const [footerUrl, setFooterUrl] = useState("")
  const [wmEnabled, setWmEnabled] = useState(true)
  const [wmText, setWmText] = useState("CONFIDENTIAL")
  const [wmSize, setWmSize] = useState(36)
  const [wmAngle, setWmAngle] = useState(45)
  const [saving, setSaving] = useState(false)
  const [isPro, setIsPro] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()
  const { user } = useUserInfo()

  useEffect(() => {
    getWatermarkSettings().then((s) => {
      setWmEnabled(s.enabled)
      setWmText(s.text)
      setWmSize(s.fontSize)
      setWmAngle(s.angle)
    })
    getHeaderFooterSettings().then((s) => {
      setHfEnabled(s.enabled)
      setHeaderText(s.headerText)
      setHeaderUrl(s.headerUrl)
      setFooterText(s.footerText)
      setFooterUrl(s.footerUrl)
    })
  }, [])

  useEffect(() => {
    if (!user) { setIsPro(false); return }
    getMembership().then((data) => setIsPro(data?.membership === "pro")).catch(() => setIsPro(false))
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all([
        saveWatermarkSettings({ enabled: wmEnabled, text: wmText, fontSize: wmSize, angle: wmAngle }),
        saveHeaderFooterSettings({ enabled: hfEnabled, headerText, headerUrl, footerText, footerUrl }),
      ])
      messageApi.success("Settings saved")
    } catch {
      messageApi.error("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-tab">
      {contextHolder}
      <div className="settings-grid">

        {/* Card: Header & Footer */}
        <div className="settings-card">
          <div className="settings-card-title" style={{ justifyContent: "space-between" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileTextOutlined />
              Header &amp; Footer
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {!isPro && (
                <Tag icon={<CrownOutlined />} color="gold" style={{ fontSize: 11 }}>Pro</Tag>
              )}
              <Switch
                checked={hfEnabled}
                onChange={setHfEnabled}
                checkedChildren="ON"
                unCheckedChildren="OFF"
                disabled={!isPro}
                style={hfEnabled && isPro ? { background: "#667eea" } : {}}
              />
            </span>
          </div>
          <Form layout="vertical" size="middle">

            {/* Header */}
            <Form.Item label="Header Text" style={{ marginBottom: 8 }}>
              <Input
                placeholder="e.g. Confidential · Do Not Distribute"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                allowClear
                disabled={!isPro || !hfEnabled}
              />
            </Form.Item>
            <Form.Item
              label={
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <LinkOutlined style={{ color: isPro && hfEnabled ? "#667eea" : "#d9d9d9" }} />
                  Header Link
                  <span style={{ color: "#aaa", fontWeight: 400, fontSize: 11, marginLeft: 4 }}>
                    (optional · text becomes clickable)
                  </span>
                </span>
              }
              style={{ marginBottom: 16 }}
            >
              <Input
                prefix={<LinkOutlined style={{ color: "#d9d9d9" }} />}
                placeholder="https://example.com"
                value={headerUrl}
                onChange={(e) => setHeaderUrl(e.target.value)}
                allowClear
                disabled={!isPro || !hfEnabled || !headerText}
              />
            </Form.Item>

            {/* Footer */}
            <Form.Item label="Footer Text" style={{ marginBottom: 8 }}>
              <Input
                placeholder="e.g. © 2025 My Company"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                allowClear
                disabled={!isPro || !hfEnabled}
              />
            </Form.Item>
            <Form.Item
              label={
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <LinkOutlined style={{ color: isPro && hfEnabled ? "#667eea" : "#d9d9d9" }} />
                  Footer Link
                  <span style={{ color: "#aaa", fontWeight: 400, fontSize: 11, marginLeft: 4 }}>
                    (optional · text becomes clickable)
                  </span>
                </span>
              }
              style={{ marginBottom: 0 }}
            >
              <Input
                prefix={<LinkOutlined style={{ color: "#d9d9d9" }} />}
                placeholder="https://example.com"
                value={footerUrl}
                onChange={(e) => setFooterUrl(e.target.value)}
                allowClear
                disabled={!isPro || !hfEnabled || !footerText}
              />
            </Form.Item>

            {!isPro && (
              <div style={{ marginTop: 14, padding: "8px 12px", background: "#fffbe6", borderRadius: 8, border: "1px solid #ffe58f", fontSize: 12, color: "#ad6800", lineHeight: 1.6 }}>
🔒 Free plan: a system footer is added to your PDFs.<br />
                        Upgrade to Pro to customize header &amp; footer with your own text and links.
              </div>
            )}
          </Form>
        </div>

        {/* Card: Watermark */}
        <div className="settings-card">
          <div className="settings-card-title" style={{ justifyContent: "space-between" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SettingOutlined />
              Watermark
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {!isPro && (
                <Tag icon={<CrownOutlined />} color="gold" style={{ fontSize: 11 }}>Pro</Tag>
              )}
              <Switch
                checked={wmEnabled}
                onChange={setWmEnabled}
                checkedChildren="ON"
                unCheckedChildren="OFF"
                disabled={!isPro}
                style={wmEnabled && isPro ? { background: "#667eea" } : {}}
              />
            </span>
          </div>
          <Form layout="vertical" size="middle">
            <Form.Item label="Text" style={{ marginBottom: 12 }}>
              <Input
                value={wmText}
                onChange={(e) => setWmText(e.target.value)}
                disabled={!isPro || !wmEnabled}
                allowClear
              />
            </Form.Item>
            <Form.Item label={`Font Size: ${wmSize}px`} style={{ marginBottom: 12 }}>
              <Slider min={12} max={80} value={wmSize} onChange={(v) => setWmSize(v)} disabled={!isPro || !wmEnabled} />
            </Form.Item>
            <Form.Item label={`Angle: ${wmAngle}°`} style={{ marginBottom: 12 }}>
              <Slider min={0} max={360} value={wmAngle} onChange={(v) => setWmAngle(v)} disabled={!isPro || !wmEnabled} />
            </Form.Item>

            {/* Live preview */}
            <div className="wm-preview" style={{ opacity: isPro && wmEnabled ? 1 : 0.4 }}>
              <span
                className="wm-preview-text"
                style={{
                  fontSize: Math.max(10, wmSize * 0.38),
                  transform: `rotate(-${wmAngle}deg)`,
                }}
              >
                {wmText || "Watermark"}
              </span>
            </div>

            {!isPro && (
              <div style={{ marginTop: 14, padding: "8px 12px", background: "#fffbe6", borderRadius: 8, border: "1px solid #ffe58f", fontSize: 12, color: "#ad6800", lineHeight: 1.6 }}>
                🔒 Free plan: a default watermark is applied to all your PDFs.<br />
                Upgrade to Pro to customize the watermark or remove it entirely.
              </div>
            )}
          </Form>
        </div>

      </div>

      <Button
        type="primary"
        block
        size="large"
        className="settings-save-btn"
        loading={saving}
        disabled={!isPro}
        onClick={handleSave}
      >
        Save Settings
      </Button>
    </div>
  )
}

// ─── Tab: History ─────────────────────────────────────────────────────────────

const HISTORY_COLUMNS = [
  {
    title: "",
    dataIndex: "coverUrl",
    key: "cover",
    width: 60,
    render: (url: string) => url
      ? <img src={url} alt="cover" style={{ width: 44, height: 32, objectFit: "cover", borderRadius: 4, display: "block" }} />
      : <div style={{ width: 44, height: 32, background: "#f0f0f0", borderRadius: 4 }} />,
  },
  { title: "Book Title", dataIndex: "title", key: "title", ellipsis: true },
  { title: "Date", dataIndex: "date", key: "date", width: 150 },
  { title: "Pages", dataIndex: "pages", key: "pages", width: 90, align: "center" as const },
]

function HistoryPanel() {
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [messageApi, contextHolder] = message.useMessage()

  useEffect(() => {
    getDownloadHistory().then(setHistory)

    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ("fliphtml5_download_history" in changes) {
        setHistory((changes["fliphtml5_download_history"].newValue as HistoryRecord[]) ?? [])
      }
    }
    chrome.storage.local.onChanged.addListener(handler)
    return () => chrome.storage.local.onChanged.removeListener(handler)
  }, [])

  const handleClear = async () => {
    await clearDownloadHistory()
    setHistory([])
    messageApi.success("History cleared")
  }

  return (
    <div className="history-tab">
      {contextHolder}
      {history.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <Popconfirm
            title="Clear all download history?"
            onConfirm={handleClear}
            okText="Clear"
            cancelText="Cancel"
          >
            <Button size="small" icon={<DeleteOutlined />} danger>
              Clear All
            </Button>
          </Popconfirm>
        </div>
      )}
      <Table
        dataSource={history}
        columns={HISTORY_COLUMNS}
        rowKey="id"
        pagination={false}
        onRow={(record) => ({
          onClick: () => chrome.tabs.create({ url: record.url }),
          style: { cursor: "pointer" },
        })}
        locale={{
          emptyText: (
            <div className="tab-empty">
              <HistoryOutlined style={{ fontSize: 40, color: "#d9d9d9" }} />
              <div className="tab-empty-title">No download history yet</div>
              <div className="tab-empty-sub">Your PDF and text downloads will appear here</div>
            </div>
          ),
        }}
      />
    </div>
  )
}

export default Dashboard
