import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Alert, Typography } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  LoginOutlined,
} from '@ant-design/icons';
import { useAuth } from '../hooks/use-auth.hook';
import type { LoginCredentials } from '../types/auth.types';
import styles from './login.module.css';

const { Title } = Typography;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form] = Form.useForm<LoginCredentials>();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFinish = async (values: LoginCredentials) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const user = await login(values);
      if (user.role === 'Administrator') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/staff', { replace: true });
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        {/* Brand Header */}
        <div className={styles.brandHeader}>
          <div className={styles.brandLogoWrapper}>
            <img
              src="/images/kubo-logo.jpg"
              alt="KUBO Resort Logo"
              className={styles.brandLogoImage}
            />
          </div>
          <Title level={2} className={styles.brandTitle}>
            Kubo Beach Resort
          </Title>
          <div className={styles.brandSubtitle}>
            Reservation Management System
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <Alert
            message="Authentication Failed"
            description={errorMsg}
            type="error"
            showIcon
            closable
            onClose={() => setErrorMsg(null)}
            className={styles.errorMessage}
          />
        )}

        {/* Login Form */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          requiredMark={false}
        >
          <Form.Item
            name="username"
            label="Username"
            rules={[
              { required: true, message: 'Please enter your username.' },
              { min: 3, message: 'Username must be at least 3 characters.' },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Enter assigned username"
              size="large"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please enter your password.' },
              { min: 6, max: 12, message: 'Password must be between 6 and 12 characters (BR-003).' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Enter password"
              size="large"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 24, marginBottom: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              icon={<LoginOutlined />}
              style={{ background: '#0284c7', borderColor: '#0284c7', fontWeight: 600, height: 44 }}
            >
              Log in
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: '0.78rem', color: '#94a3b8' }}>
          KUBO Resort Management System • Internal Use Only
        </div>
      </div>
    </div>
  );
};
