import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Form, Input, Button } from 'antd';
import { ExclamationCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/use-auth.hook';
import type { LoginCredentials } from '../types/auth.types';
import { ThemeToggle, useThemeMode } from '@/theme';
import { Callout } from '@/components/common';
import styles from './login.module.css';

/**
 * Split sign-in: a quiet form on the left and a resort photo panel on the
 * right (no live data before sign-in). The 6–12 character password rule and a
 * Caps Lock warning show before submit; server errors show inline.
 */
export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, role } = useAuth();
  const [form] = Form.useForm<LoginCredentials>();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [capsLock, setCapsLock] = useState(false);
  const { mode } = useThemeMode();

  if (isAuthenticated) {
    return <Navigate to={role === 'Administrator' ? '/admin' : '/staff'} replace />;
  }

  const handleFinish = async (values: LoginCredentials) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const user = await login(values);
      navigate(user.role === 'Administrator' ? '/admin' : '/staff', { replace: true });
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const trackCaps = (e: React.KeyboardEvent) => setCapsLock(e.getModifierState?.('CapsLock') ?? false);

  return (
    <div className={styles.page}>
      <div className={styles.formSide}>
        <div className={styles.topRow}>
          <div className={styles.brand}>
            <img
              src={mode === 'dark' ? '/images/kubo-logo-white.png' : '/images/kubo-logo-black.png'}
              alt=""
              className={styles.logo}
            />
            <span>Kubo Beach Resort</span>
          </div>
          <ThemeToggle />
        </div>

        <div className={styles.formWrap}>
          <p className={styles.eyebrow}>Kubo Beach Resort</p>
          <h1 className={styles.title}>Sign in</h1>
          <p className={styles.helper}>Use the username assigned by your administrator.</p>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleFinish}
            requiredMark={false}
            validateTrigger={['onChange', 'onBlur']}
            disabled={loading}
          >
            <Form.Item
              name="username"
              label="Username"
              rules={[{ required: true, whitespace: true, message: 'Enter your username.' }]}
            >
              <Input size="large" autoComplete="username" autoFocus />
            </Form.Item>

            <Form.Item
              name="password"
              label="Password"
              rules={[
                { required: true, message: 'Enter your password.' },
                { min: 6, max: 12, message: 'Passwords are 6 to 12 characters.' },
              ]}
            >
              <Input.Password
                size="large"
                autoComplete="current-password"
                onKeyDown={trackCaps}
                onKeyUp={trackCaps}
                onBlur={() => setCapsLock(false)}
              />
            </Form.Item>

            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              Sign in
            </Button>
          </Form>

          {capsLock && (
            <Callout tone="warn" icon={<InfoCircleOutlined />} style={{ marginTop: 16 }}>
              Caps Lock is on.
            </Callout>
          )}
          {errorMsg && (
            <Callout tone="danger" icon={<ExclamationCircleOutlined />} style={{ marginTop: 16 }}>
              {errorMsg}
            </Callout>
          )}
        </div>

        <p className={styles.footer}>Internal use only · Forgot your password? Ask an administrator to reset it.</p>
      </div>

      <div className={styles.brandPanel} aria-hidden="true">
        <div className={styles.panelText}>
          <h2 className={styles.panelName}>Kubo Beach Resort</h2>
          <p className={styles.tagline}>Every arrival, every kubo, every peso — in one calm front desk.</p>
        </div>
      </div>
    </div>
  );
};
