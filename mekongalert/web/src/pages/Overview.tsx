import { Alert as AntdAlert, Button, Card, Col, Flex, Row, message } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import AlertComposer from "../components/AlertComposer";
import AlertMap from "../components/AlertMap";
import GaugeChart from "../components/GaugeChart";
import { useAuth } from "../contexts/AuthContext";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import { tenantCenter } from "../lib/tenantCenter";
import type { Alert, EventType, GaugeReading } from "../lib/types";

interface CrowdSignal {
  id: string;
  category: string;
  report_ids: string[];
  status: string;
  created_at: string;
}

export default function Overview() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [readings, setReadings] = useState<GaugeReading[]>([]);
  const [signals, setSignals] = useState<CrowdSignal[]>([]);
  const [simulating, setSimulating] = useState(false);
  const [simulatingQuake, setSimulatingQuake] = useState(false);
  const [generatingSitrep, setGeneratingSitrep] = useState(false);
  const [composerSignal, setComposerSignal] = useState<CrowdSignal | null>(null);

  const generateSitrep = async () => {
    setGeneratingSitrep(true);
    try {
      await apiPost("/api/sitrep", {});
      message.success("Situation report generated");
      navigate("/sitrep");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "SITREP generation failed");
    } finally {
      setGeneratingSitrep(false);
    }
  };

  const load = () => {
    apiGet<Alert[]>("/api/alerts").then(setAlerts);
    apiGet<GaugeReading[]>("/api/gauge?station=MUKDAHAN").then(setReadings);
    apiGet<CrowdSignal[]>("/api/signals").then(setSignals);
  };

  useEffect(load, []);

  const dismissSignal = async (id: string) => {
    await apiPatch(`/api/signals/${id}`, { status: "dismissed" });
    load();
  };

  const draftFromSignal = (signal: CrowdSignal) => {
    setComposerSignal(signal);
  };

  const simulateRise = async () => {
    setSimulating(true);
    try {
      const result = await apiPost<{ created: boolean; alert?: Alert }>("/api/demo/simulate-rise", {});
      load();
      if (result.created && result.alert) {
        message.success("Water level crossed flood stage — draft alert created");
        navigate(`/alerts/${result.alert.id}`);
      } else {
        message.info("Reading recorded, still below the auto-draft threshold");
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Simulate failed");
    } finally {
      setSimulating(false);
    }
  };

  const simulateQuake = async () => {
    setSimulatingQuake(true);
    try {
      const result = await apiPost<{ created: boolean; alert?: Alert }>("/api/demo/simulate-quake", {});
      load();
      if (result.created && result.alert) {
        message.success("Earthquake alert drafted");
        navigate(`/alerts/${result.alert.id}`);
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Simulate failed");
    } finally {
      setSimulatingQuake(false);
    }
  };

  const isMukdahan = profile?.tenants?.slug === "mukdahan-ddpm";

  return (
    <Flex vertical gap={16} className="fade-in-up">
      {signals.map((s) => (
        <AntdAlert
          key={s.id}
          type="warning"
          showIcon
          message={t("overview.signalDetected", { category: s.category, count: s.report_ids.length })}
          action={
            <Flex gap={8}>
              <Button size="small" type="primary" onClick={() => draftFromSignal(s)}>
                {t("overview.draftAlert")}
              </Button>
              <Button size="small" onClick={() => dismissSignal(s.id)}>
                {t("overview.dismiss")}
              </Button>
            </Flex>
          }
        />
      ))}
      <Flex justify="end" gap={8}>
        <Button className="btn-pop mk-pill-btn" onClick={simulateQuake} loading={simulatingQuake}>
          🌋 {t("overview.simulateQuake")}
        </Button>
        <Button className="btn-pop mk-pill-btn" onClick={generateSitrep} loading={generatingSitrep}>
          📋 {t("overview.generateSitrep")}
        </Button>
      </Flex>
      <Row gutter={16}>
        <Col span={14}>
          <Card
            className="hover-lift mk-card"
            title={<span className="eyebrow">{t("overview.mapCardTitle")}</span>}
            style={{ position: "relative", overflow: "hidden" }}
          >
            <div className="radar-sweep" />
            <AlertMap alerts={alerts} center={tenantCenter(profile?.tenants?.slug)} />
          </Card>
        </Col>
        <Col span={10}>
          <Card className="hover-lift mk-card">
            <Flex justify="space-between" align="center" wrap="wrap" gap={8} style={{ marginBottom: 12 }}>
              <span className="eyebrow">{t("overview.gaugeCardTitle")}</span>
              {isMukdahan && (
                <Button className="btn-pop mk-pill-btn" size="small" onClick={simulateRise} loading={simulating}>
                  ⚡ {t("overview.simulateRise")}
                </Button>
              )}
            </Flex>
            <GaugeChart readings={readings} />
          </Card>
        </Col>
      </Row>

      <AlertComposer
        open={composerSignal !== null}
        onClose={() => setComposerSignal(null)}
        onCreated={() => {
          if (composerSignal) dismissSignal(composerSignal.id);
        }}
        defaultCenter={tenantCenter(profile?.tenants?.slug)}
        initialValues={
          composerSignal
            ? {
                event_type: composerSignal.category as EventType,
                headline: `Possible ${composerSignal.category} — AI-detected report cluster`,
                description: `${composerSignal.report_ids.length} independent citizen reports of ${composerSignal.category} corroborated in the same area within 30 minutes.`,
              }
            : undefined
        }
      />
    </Flex>
  );
}
