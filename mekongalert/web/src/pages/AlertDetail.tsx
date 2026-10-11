import { Button, Card, Flex, List, Result, Spin, Tabs, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import ImpactAssessmentCard from "../components/ImpactAssessmentCard";
import IncidentChat from "../components/IncidentChat";
import ShareModal from "../components/ShareModal";
import TaskBoard from "../components/TaskBoard";
import { useAuth } from "../contexts/AuthContext";
import { apiGet, apiPost } from "../lib/api";
import { countryFlag } from "../lib/countryFlag";
import { severityColor } from "../lib/severity";
import type { AlertDetail as AlertDetailData } from "../lib/types";

const LANG_LABELS: Record<string, string> = {
  th: "ไทย",
  "zh-CN": "中文",
  en: "English",
  lo: "ລາວ",
  vi: "Tiếng Việt",
};

export default function AlertDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [data, setData] = useState<AlertDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [localizing, setLocalizing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [ttsLoading, setTtsLoading] = useState<Record<string, boolean>>({});
  const [shareOpen, setShareOpen] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    apiGet<AlertDetailData>(`/api/alerts/${id}`)
      .then(setData)
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [id]);

  const localize = async () => {
    if (!id) return;
    setLocalizing(true);
    try {
      await apiPost(`/api/alerts/${id}/localize`, {});
      message.success("Localized into 5 languages");
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Localization failed");
    } finally {
      setLocalizing(false);
    }
  };

  const approve = async () => {
    if (!id) return;
    setApproving(true);
    try {
      await apiPost(`/api/alerts/${id}/approve`, {});
      message.success("Alert approved");
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setApproving(false);
    }
  };

  const broadcast = async () => {
    if (!id) return;
    setBroadcasting(true);
    try {
      const result = await apiPost<{ audience_count: number; failed: number }>(`/api/alerts/${id}/broadcast`, {});
      message.success(`Sent to ${result.audience_count} subscriber(s)${result.failed ? `, ${result.failed} failed` : ""}`);
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Broadcast failed");
    } finally {
      setBroadcasting(false);
    }
  };

  const generateTts = async (lang: string) => {
    if (!id) return;
    setTtsLoading((prev) => ({ ...prev, [lang]: true }));
    try {
      await apiPost(`/api/alerts/${id}/tts?lang=${encodeURIComponent(lang)}`, {});
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "TTS generation failed");
    } finally {
      setTtsLoading((prev) => ({ ...prev, [lang]: false }));
    }
  };

  const share = async (toTenantSlug: string, note?: string) => {
    if (!id) return;
    try {
      await apiPost(`/api/alerts/${id}/share`, { to_tenant_slug: toTenantSlug, note });
      message.success("Shared to partner agency");
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Share failed");
    }
  };

  if (loading) return <Spin size="large" />;
  if (!data) return <Result status="404" title={t("alertDetail.notFound")} />;

  const isOwn = data.tenant_id === profile?.tenant_id;
  const defaultTabKey = !isOwn ? profile?.tenants?.default_lang : undefined;

  return (
    <Flex vertical gap={16} className="fade-in-up">
      <Card className="hover-lift mk-card">
        <Flex vertical gap={12}>
          {!isOwn && data.shared_from && (
            <Tag color="blue" style={{ width: "fit-content" }}>
              {t("alertDetail.sharedFrom")} {data.shared_from.name_en} {countryFlag(data.shared_from.country)}
            </Tag>
          )}
          <Flex justify="space-between" align="flex-start" wrap="wrap" gap={16}>
            <div>
              <Typography.Title level={3} style={{ margin: 0 }} className="font-display">
                {data.headline}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8, maxWidth: 600 }}>
                {data.description}
              </Typography.Paragraph>
              <Flex gap={8}>
                <Tag color={severityColor(data.severity)}>{t("common.severity", { n: data.severity })}</Tag>
                <Tag>{t(`common.eventTypes.${data.event_type}`)}</Tag>
                <Tag>{t(`common.alertStatus.${data.status}`)}</Tag>
              </Flex>
            </div>
            {isOwn && (
              <Flex gap={8} wrap="wrap">
                <Button className="btn-pop mk-pill-btn" onClick={localize} loading={localizing}>
                  {data.translations.length > 0 ? t("alertDetail.regenerateAll") : t("alertDetail.aiLocalize")}
                </Button>
                <Button
                  className="btn-pop mk-pill-btn"
                  type="primary"
                  onClick={approve}
                  loading={approving}
                  disabled={data.status !== "localized"}
                >
                  {t("alertDetail.approve")}
                </Button>
                <Button
                  className="btn-pop mk-pill-btn"
                  onClick={broadcast}
                  loading={broadcasting}
                  disabled={data.status !== "approved"}
                >
                  {t("alertDetail.broadcast")}
                </Button>
                <Button className="btn-pop mk-pill-btn" onClick={() => setShareOpen(true)}>
                  {t("alertDetail.shareToPartner")}
                </Button>
              </Flex>
            )}
          </Flex>
        </Flex>
      </Card>

      {data.translations.length > 0 && (
        <Card
          className="hover-lift mk-card"
          title={<span className="eyebrow">{t("alertDetail.localizedTranslations")}</span>}
        >
          <Tabs
            defaultActiveKey={defaultTabKey}
            items={data.translations.map((tr) => ({
              key: tr.lang,
              label: LANG_LABELS[tr.lang] ?? tr.lang,
              children: (
                <div>
                  <Typography.Title level={4}>{tr.headline}</Typography.Title>
                  <List
                    dataSource={tr.guidance}
                    renderItem={(item, idx) => (
                      <List.Item>
                        {idx + 1}. {item}
                      </List.Item>
                    )}
                  />
                  {tr.tts_script && (
                    <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 8 }}>
                      <em>{t("alertDetail.ttsScript")}</em> {tr.tts_script}
                    </Typography.Paragraph>
                  )}
                  <Flex align="center" gap={12}>
                    {tr.tts_url ? (
                      <>
                        <audio controls src={tr.tts_url} style={{ height: 32 }} />
                        <a href={tr.tts_url} download>
                          {t("alertDetail.download")}
                        </a>
                      </>
                    ) : (
                      <Button size="small" loading={ttsLoading[tr.lang]} onClick={() => generateTts(tr.lang)}>
                        {t("alertDetail.generateVoiceBulletin")}
                      </Button>
                    )}
                  </Flex>
                </div>
              ),
            }))}
          />
        </Card>
      )}

      <ImpactAssessmentCard alertId={data.id} canGenerate={isOwn} />

      <TaskBoard alertId={data.id} />

      <IncidentChat alertId={data.id} />

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} onShare={share} />
    </Flex>
  );
}
