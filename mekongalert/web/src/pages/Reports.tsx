import { Card, Col, Image, Row, Select, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ReportMap from "../components/ReportMap";
import { useAuth } from "../contexts/AuthContext";
import { apiGet, apiPatch } from "../lib/api";
import { tenantCenter } from "../lib/tenantCenter";
import type { Alert, CitizenReport, ReportStatus } from "../lib/types";

const STATUS_OPTIONS: ReportStatus[] = ["new", "verified", "dismissed", "resolved"];
const CREDIBILITY_COLOR: Record<string, string> = { high: "red", medium: "orange", low: "default" };

export default function Reports() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    apiGet<CitizenReport[]>("/api/reports")
      .then(setReports)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => {
    apiGet<Alert[]>("/api/alerts").then(setAlerts);
  }, []);

  const setStatus = async (id: string, status: ReportStatus) => {
    await apiPatch(`/api/reports/${id}`, { status });
    load();
  };

  const linkAlert = async (id: string, linked_alert_id: string) => {
    await apiPatch(`/api/reports/${id}`, { linked_alert_id });
    load();
  };

  const columns: ColumnsType<CitizenReport> = [
    {
      title: t("reports.columns.photo"),
      dataIndex: "photo_url",
      render: (url: string | null) => (url ? <Image src={url} width={60} /> : "-"),
    },
    { title: t("reports.columns.message"), dataIndex: "message_text", render: (msg: string | null) => msg || "-" },
    { title: t("reports.columns.category"), dataIndex: "ai_category" },
    { title: t("reports.columns.severity"), dataIndex: "ai_severity" },
    {
      title: t("reports.columns.credibility"),
      dataIndex: "ai_credibility",
      render: (c: string | null) => (c ? <Tag color={CREDIBILITY_COLOR[c]}>{t(`common.credibility.${c}`)}</Tag> : "-"),
    },
    { title: t("reports.columns.aiSummary"), dataIndex: "ai_summary_en" },
    {
      title: t("reports.columns.status"),
      dataIndex: "status",
      render: (status: ReportStatus, record) => (
        <Select
          size="small"
          value={status}
          style={{ width: 110 }}
          onChange={(v) => setStatus(record.id, v)}
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: t(`common.reportStatus.${s}`) }))}
        />
      ),
    },
    {
      title: t("reports.columns.linkToAlert"),
      dataIndex: "linked_alert_id",
      render: (linkedId: string | null, record) => (
        <Select
          size="small"
          allowClear
          placeholder="-"
          style={{ width: 160 }}
          value={linkedId ?? undefined}
          onChange={(v) => linkAlert(record.id, v)}
          options={alerts.map((a) => ({ value: a.id, label: a.headline }))}
        />
      ),
    },
    { title: t("reports.columns.created"), dataIndex: "created_at", render: (v: string) => new Date(v).toLocaleString() },
  ];

  return (
    <Row gutter={16} className="fade-in-up">
      <Col span={12}>
        <Card className="hover-lift mk-card" title={<span className="eyebrow">{t("reports.reportLocations")}</span>}>
          <ReportMap reports={reports} center={tenantCenter(profile?.tenants?.slug)} />
        </Card>
      </Col>
      <Col span={12}>
        <Card className="hover-lift mk-card" title={<span className="eyebrow">{t("reports.citizenReports")}</span>}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={reports}
            loading={loading}
            size="small"
            pagination={{ pageSize: 5 }}
          />
        </Card>
      </Col>
    </Row>
  );
}
