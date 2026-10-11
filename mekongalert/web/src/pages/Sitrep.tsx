import { Button, Card, Empty, Flex, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiGet, apiPost } from "../lib/api";
import type { Sitrep as SitrepData } from "../lib/types";

export default function Sitrep() {
  const { t } = useTranslation();
  const [sitreps, setSitreps] = useState<SitrepData[]>([]);
  const [generating, setGenerating] = useState(false);

  const load = () => apiGet<SitrepData[]>("/api/sitrep").then(setSitreps);

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      await apiPost("/api/sitrep", {});
      message.success("Situation report generated");
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "SITREP generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Flex vertical gap={16} className="fade-in-up">
      <Flex justify="space-between" align="center" className="no-print">
        <Typography.Title level={3} style={{ margin: 0 }} className="font-display">
          {t("sitrep.title")}
        </Typography.Title>
        <Flex gap={8}>
          <Button className="btn-pop mk-pill-btn" onClick={generate} loading={generating} type="primary">
            {t("sitrep.generate")}
          </Button>
          {sitreps.length > 0 && (
            <Button className="btn-pop mk-pill-btn" onClick={() => window.print()}>
              {t("sitrep.printSave")}
            </Button>
          )}
        </Flex>
      </Flex>

      {sitreps.length === 0 && <Empty description={t("sitrep.empty")} />}

      {sitreps.map((s) => (
        <Card
          className="hover-lift mk-card"
          key={s.id}
          title={<span className="eyebrow">{new Date(s.created_at).toLocaleString()}</span>}
        >
          <Flex gap={24} wrap="wrap">
            <div style={{ flex: 1, minWidth: 280 }}>
              <Typography.Title level={5}>ไทย</Typography.Title>
              <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>{s.content_th}</Typography.Paragraph>
            </div>
            <div style={{ flex: 1, minWidth: 280 }}>
              <Typography.Title level={5}>中文</Typography.Title>
              <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>{s.content_zh}</Typography.Paragraph>
            </div>
          </Flex>
        </Card>
      ))}
    </Flex>
  );
}
