import { useState, useEffect } from "react"
import { Button, Card, Flex, Typography, Divider, Tag } from "antd"
import { GoogleOutlined, UserOutlined, CrownOutlined } from "@ant-design/icons"

const { Title, Text, Paragraph } = Typography

interface UserState {
  isLoggedIn: boolean
  username: string
  isPaid: boolean
  subscriptionType: 'free' | 'monthly' | 'yearly'
  expiryDate?: string
}

export default function AccountPanel() {
  const [userState, setUserState] = useState<UserState>({
    isLoggedIn: false,
    username: '',
    isPaid: false,
    subscriptionType: 'free'
  })

  // 从 storage 加载用户状态
  useEffect(() => {
    chrome.storage.local.get(['userState'], (result: { userState?: UserState }) => {
      if (result.userState) {
        setUserState(result.userState)
      }
    })
  }, [])

  // 模拟登录
  const handleLogin = () => {
    const newUserState: UserState = {
      isLoggedIn: true,
      username: 'user@example.com',
      isPaid: false,
      subscriptionType: 'free'
    }
    setUserState(newUserState)
    chrome.storage.local.set({ userState: newUserState })
  }

  // 模拟登出
  const handleLogout = () => {
    const newUserState: UserState = {
      isLoggedIn: false,
      username: '',
      isPaid: false,
      subscriptionType: 'free'
    }
    setUserState(newUserState)
    chrome.storage.local.set({ userState: newUserState })
  }

  // 模拟购买
  const handleSubscribe = (type: 'monthly' | 'yearly') => {
    const expiryDate = new Date()
    if (type === 'monthly') {
      expiryDate.setMonth(expiryDate.getMonth() + 1)
    } else {
      expiryDate.setFullYear(expiryDate.getFullYear() + 1)
    }

    const newUserState: UserState = {
      ...userState,
      isPaid: true,
      subscriptionType: type,
      expiryDate: expiryDate.toISOString().split('T')[0]
    }
    setUserState(newUserState)
    chrome.storage.local.set({ userState: newUserState })
  }

  // 未登录状态
  if (!userState.isLoggedIn) {
    return (
      <Flex vertical gap="large" style={{ width: '100%', padding: '20px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <UserOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
          <Title level={4}>Login Account</Title>
          <Text type="secondary">Login to access full features</Text>
        </div>

        <Button
          type="primary"
          size="large"
          icon={<GoogleOutlined />}
          onClick={handleLogin}
          block
        >
          Sign in with Google
        </Button>

        <Text type="secondary" style={{ fontSize: '12px', textAlign: 'center', display: 'block' }}>
          By logging in, you agree to our Terms of Service
        </Text>
      </Flex>
    )
  }

  // 已登录状态
  return (
    <Flex vertical gap="large" style={{ width: '100%', padding: '20px 0' }}>
      {/* 用户信息 */}
      <Card size="small">
        <Flex vertical gap="small" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>{userState.username}</Text>
            <Button size="small" onClick={handleLogout}>Logout</Button>
          </div>
          
          {userState.isPaid ? (
            <div>
              <Tag color="gold" icon={<CrownOutlined />}>
                {userState.subscriptionType === 'monthly' ? 'Monthly Plan' : 'Yearly Plan'}
              </Tag>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                Expires: {userState.expiryDate}
              </Text>
            </div>
          ) : (
            <Tag>Free Version</Tag>
          )}
        </Flex>
      </Card>

      <Divider style={{ margin: '8px 0' }}>Pricing Plans</Divider>

      {/* 付费套餐 */}
      {!userState.isPaid && (
        <>
          <Card 
            size="small" 
            hoverable
            style={{ borderColor: '#1890ff' }}
          >
            <Flex vertical gap="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>Monthly Plan</Text>
                <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>$3.99/month</Text>
              </div>
              <Paragraph style={{ margin: 0, fontSize: '12px' }} type="secondary">
                • Export PDF without watermark<br />
                • Unlimited downloads<br />
                • Auto-renewal monthly
              </Paragraph>
              <Button 
                type="primary" 
                size="small" 
                block
                onClick={() => handleSubscribe('monthly')}
              >
                Subscribe Monthly
              </Button>
            </Flex>
          </Card>

          <Card 
            size="small" 
            hoverable
            style={{ borderColor: '#52c41a' }}
          >
            <Flex vertical gap="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>Yearly Plan</Text>
                  <Tag color="gold" style={{ marginLeft: '8px' }}>Recommended</Tag>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text strong style={{ fontSize: '18px', color: '#52c41a' }}>$19.99/year</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>Save 58%</Text>
                </div>
              </div>
              <Paragraph style={{ margin: 0, fontSize: '12px' }} type="secondary">
                • Export PDF without watermark<br />
                • Unlimited downloads<br />
                • Auto-renewal yearly
              </Paragraph>
              <Button 
                type="primary" 
                size="small" 
                block
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                onClick={() => handleSubscribe('yearly')}
              >
                Subscribe Yearly
              </Button>
            </Flex>
          </Card>
        </>
      )}

      {userState.isPaid && (
        <Card size="small">
          <Text type="success" style={{ display: 'block', textAlign: 'center' }}>
            ✓ You are a premium user. Download PDFs without watermark
          </Text>
        </Card>
      )}

      <Text type="secondary" style={{ fontSize: '11px', textAlign: 'center', display: 'block' }}>
        Note: This is a demo version. Real payment will be integrated in future releases
      </Text>
    </Flex>
  )
}
