import { Button, Card, Flex, List, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiGet, apiPost } from "../lib/api";
import type { ImpactAssessment } from "../lib/types";

interface Props {
  alertId: string;
  canGenerate: boolean;
}

export default function ImpactAssessmentCard({ alertId, canGenerate }: Props) {
  const { t } = useTranslation();
  const [assessment, setAssessment] = useState<ImpactAssessment | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = () => {
    apiGet<ImpactAssessment | null>(`/api/alerts/${alertId}/impact-assessment`)
      .then(setAssessment)
      .finally(() => setLoaded(true));
  };

  useEffect(load, [alertId]);

  const generate = async () => {
    setGenerating(true);
    try {
      await apiPost(`/api/alerts/${alertId}/impact-assessment`, {});
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Impact assessment failed");
    } finally {
      setGenerating(false);
    }
  };

  if (!loaded) return null;
  if (!assessment && !canGenerate) return null;

  return (
    <Card
      className="hover-lift mk-card"
      title={<span className="eyebrow">{t("impactAssessment.title")}</span>}
      extra={
        canGenerate && (
          <Button className="btn-pop mk-pill-btn" size="small" loading={generating} onClick={generate}>
            {assessment ? t("impactAssessment.regenerate") : t("impactAssessment.generate")}
          </Button>
        )
      }
    >
      {!assessment && <Typography.Text type="secondary">{t("impactAssessment.notGenerated")}</Typography.Text>}
      {assessment && (
        <Flex vertical gap={12}>
          <Tag color="gold">{t("impactAssessment.aiEstimateTag")}</Tag>
          {assessment.estimated_affected_population != null && (
            <Typography.Text strong>
              {t("impactAssessment.estimatedAffectedPopulation", {
                n: assessment.estimated_affected_population.toLocaleString(),
              })}
            </Typography.Text>
          )}
          <Flex gap={24} wrap="wrap">
            <div style={{ flex: 1, minWidth: 260 }}>
              <Typography.Title level={5}>ไทย</Typography.Title>
              <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>{assessment.content_th}</Typography.Paragraph>
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <Typography.Title level={5}>中文</Typography.Title>
              <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>{assessment.content_zh}</Typography.Paragraph>
            </div>
          </Flex>
          {assessment.shelter_recommendations.length > 0 && (
            <div>
              <Typography.Title level={5}>{t("impactAssessment.shelterRecommendations")}</Typography.Title>
              <List
                dataSource={assessment.shelter_recommendations}
                renderItem={(s, idx) => (
                  <List.Item>
                    <Typography.Text>
                      {idx + 1}. <strong>{s.name}</strong> — capacity {s.capacity}
                      {s.distance_km != null ? `, ${s.distance_km} km away` : ""}
                      {s.note ? ` — ${s.note}` : ""}
                    </Typography.Text>
                  </List.Item>
                )}
              />
            </div>
          )}
        </Flex>
      )}
    </Card>
  );
}
