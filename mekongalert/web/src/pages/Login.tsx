import { useState } from "react";
import { Alert, Button, Card, Flex, Form, Input, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword(values);
    setLoading(false);
    if (error) {
      setError(t("login.error"));
      return;
    }
    navigate("/");
  };

  return (
    <Flex justify="center" align="center" className="animated-gradient-login" style={{ minHeight: "100vh" }}>
      <Card className="fade-in-up" style={{ width: 360 }}>
        <Flex justify="center" style={{ marginBottom: 8 }}>
          <img src="/logo.png" alt="" width={200} height={200} className="logo-breathe" />
        </Flex>
        <Typography.Title level={3} style={{ textAlign: "center", marginTop: 0 }}>
          {t("appName")}
        </Typography.Title>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish} disabled={loading}>
          <Form.Item name="email" label={t("login.email")} rules={[{ required: true }]}>
            <Input autoComplete="email" />
          </Form.Item>
          <Form.Item name="password" label={t("login.password")} rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading} className="btn-pop">
            {t("login.submit")}
          </Button>
        </Form>
      </Card>
    </Flex>
  );
}
