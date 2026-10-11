import { Button, Flex, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import AlertComposer from "../components/AlertComposer";
import { useAuth } from "../contexts/AuthContext";
import { apiGet } from "../lib/api";
import { severityColor } from "../lib/severity";
import { tenantCenter } from "../lib/tenantCenter";
import type { Alert } from "../lib/types";

export default function Alerts() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const load = () => {
    setLoading(true);
    apiGet<Alert[]>("/api/alerts")
      .then(setAlerts)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const columns: ColumnsType<Alert> = [
    {
      title: t("alerts.columns.headline"),
      dataIndex: "headline",
      render: (headline: string, record) => <Link to={`/alerts/${record.id}`}>{headline}</Link>,
    },
    {
      title: t("alerts.columns.type"),
      dataIndex: "event_type",
      render: (v: string) => t(`common.eventTypes.${v}`),
    },
    {
      title: t("alerts.columns.severity"),
      dataIndex: "severity",
      render: (s: number) => <Tag color={severityColor(s)}>{s}</Tag>,
    },
    {
      title: t("alerts.columns.status"),
      dataIndex: "status",
      render: (v: string) => t(`common.alertStatus.${v}`),
    },
    { title: t("alerts.columns.created"), dataIndex: "created_at", render: (v: string) => new Date(v).toLocaleString() },
  ];

  return (
    <Flex vertical gap={16} className="fade-in-up">
      <Flex justify="space-between" align="center">
        <Typography.Title level={3} style={{ margin: 0 }} className="font-display">
          {t("alerts.title")}
        </Typography.Title>
        <Button className="btn-pop mk-pill-btn" type="primary" onClick={() => setComposerOpen(true)}>
          {t("alerts.newAlert")}
        </Button>
      </Flex>
      <div className="mk-card hover-lift" style={{ padding: 8 }}>
        <Table rowKey="id" columns={columns} dataSource={alerts} loading={loading} />
      </div>
      <AlertComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={load}
        defaultCenter={tenantCenter(profile?.tenants?.slug)}
      />
    </Flex>
  );
}
