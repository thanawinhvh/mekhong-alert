import { Card, Empty, Flex, List, Radio, Result, Spin, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { apiGet } from "../lib/api";
import { severityColor } from "../lib/severity";
import type { AlertDetail, TenantSummary } from "../lib/types";

const LANGS = [
  { value: "th", label: "ไทย" },
  { value: "zh-CN", label: "中文" },
  { value: "en", label: "English" },
  { value: "lo", label: "ລາວ" },
  { value: "vi", label: "Tiếng Việt" },
];

interface StatusResponse {
  tenant: TenantSummary;
  alerts: AlertDetail[];
}

export default function PublicStatus() {
  const { t } = useTranslation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [lang, setLang] = useState("th");

  useEffect(() => {
    if (!tenantSlug) return;
    apiGet<StatusResponse>(`/public/status/${tenantSlug}`)
      .then((res) => {
        setData(res);
        setLang(res.tenant.default_lang ?? "th");
      })
      .catch(() => setNotFound(true));
  }, [tenantSlug]);

  if (notFound) return <Result status="404" title={t("publicStatus.agencyNotFound")} />;
  if (!data) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: "100vh" }}>
        <Spin size="large" />
      </Flex>
    );
  }

  return (
    <Flex justify="center" style={{ padding: 24 }}>
      <Flex vertical gap={16} style={{ maxWidth: 640, width: "100%" }}>
        <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {data.tenant.name_en}
          </Typography.Title>
          <Radio.Group
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            options={LANGS}
            optionType="button"
            size="small"
          />
        </Flex>

        {data.alerts.length === 0 && <Empty description={t("publicStatus.noActiveAlerts")} />}

        {data.alerts.map((alert) => {
          const tr = alert.translations.find((x) => x.lang === lang) ?? alert.translations[0];
          return (
            <Card key={alert.id}>
              <Flex vertical gap={8}>
                <Flex gap={8}>
                  <Tag color={severityColor(alert.severity)}>{t("common.severity", { n: alert.severity })}</Tag>
                  <Tag>{t(`common.eventTypes.${alert.event_type}`)}</Tag>
                </Flex>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {tr?.headline ?? alert.headline}
                </Typography.Title>
                {tr && (
                  <List
                    size="small"
                    dataSource={tr.guidance}
                    renderItem={(item, idx) => (
                      <List.Item>
                        {idx + 1}. {item}
                      </List.Item>
                    )}
                  />
                )}
              </Flex>
            </Card>
          );
        })}
      </Flex>
    </Flex>
  );
}
