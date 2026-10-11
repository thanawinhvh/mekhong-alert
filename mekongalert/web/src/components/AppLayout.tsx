import { Button, ConfigProvider, Dropdown, Flex, Layout, Menu, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const { Header, Sider, Content } = Layout;

const LANGS = [
  { key: "en", label: "English" },
  { key: "th", label: "ไทย" },
  { key: "zh-CN", label: "中文" },
];

export default function AppLayout() {
  const { t, i18n } = useTranslation();
  const { profile, signOut } = useAuth();
  const location = useLocation();

  const tenants = profile?.tenants;
  const tenantName =
    i18n.language === "th"
      ? tenants?.name_th ?? tenants?.name_en
      : i18n.language === "zh-CN"
        ? tenants?.name_zh ?? tenants?.name_en
        : tenants?.name_en;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <style>{"@media print { .no-print { display: none !important; } }"}</style>
      <Sider theme="dark" className="no-print mk-sider" width={280}>
        <Flex
          align="center"
          gap={12}
          style={{ padding: 20, fontWeight: 700, fontSize: 22, color: "#fff" }}
          className="font-display"
        >
          <img src="/logo.png" alt="" width={64} height={64} className="logo-breathe" />
          {t("appName")}
        </Flex>
        <ConfigProvider theme={{ components: { Menu: { fontSize: 16, itemHeight: 44 } } }}>
          <Menu
            mode="inline"
            theme="dark"
            selectedKeys={[location.pathname]}
            items={[
              { key: "/overview", icon: "🗺️", label: <Link to="/overview">{t("nav.overview")}</Link> },
              { key: "/alerts", icon: "🚨", label: <Link to="/alerts">{t("nav.alerts")}</Link> },
              { key: "/reports", icon: "📍", label: <Link to="/reports">{t("nav.reports")}</Link> },
              { key: "/sitrep", icon: "📋", label: <Link to="/sitrep">{t("nav.sitrep")}</Link> },
              { key: "/warroom", icon: "🖥️", label: <Link to="/warroom">{t("nav.warroom")}</Link> },
            ]}
          />
        </ConfigProvider>
      </Sider>
      <Layout>
        <Header className="no-print mk-header" style={{ padding: "0 24px" }}>
          <Flex justify="space-between" align="center" style={{ height: "100%" }}>
            <Typography.Text strong style={{ fontSize: 20 }} className="font-display">
              {tenantName}
            </Typography.Text>
            <Flex gap={8}>
              <Dropdown
                menu={{
                  items: LANGS.map((l) => ({ key: l.key, label: l.label })),
                  onClick: ({ key }) => i18n.changeLanguage(key),
                }}
              >
                <Button className="mk-pill-btn" size="large" style={{ fontSize: 16 }}>
                  {i18n.language}
                </Button>
              </Dropdown>
              <Button className="mk-pill-btn" size="large" style={{ fontSize: 16 }} onClick={signOut}>
                {t("home.signOut")}
              </Button>
            </Flex>
          </Flex>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
