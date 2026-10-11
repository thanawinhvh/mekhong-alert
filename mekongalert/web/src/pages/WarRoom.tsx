import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import AlertMap from "../components/AlertMap";
import GaugeChart from "../components/GaugeChart";
import { useAuth } from "../contexts/AuthContext";
import { apiGet } from "../lib/api";
import { severityColor } from "../lib/severity";
import { tenantCenter } from "../lib/tenantCenter";
import type { Alert, GaugeReading } from "../lib/types";
import { useCountUp } from "../lib/useCountUp";

const REFRESH_MS = 10_000;

const STAT_DELAY_CLASSES = ["", "fade-in-up-delay-1", "fade-in-up-delay-2", "fade-in-up-delay-3"];

function StatTile({
  label,
  value,
  delayIndex = 0,
}: {
  label: string;
  value: string | number;
  delayIndex?: number;
}) {
  const numeric = typeof value === "number" ? value : 0;
  const animated = useCountUp(numeric, 700);
  const display = typeof value === "number" ? animated : value;
  return (
    <div
      className={`hover-lift fade-in-up mk-card ${STAT_DELAY_CLASSES[delayIndex] ?? ""}`}
      style={{ borderRadius: 20, padding: 16, textAlign: "center", flex: 1 }}
    >
      <div className="stat-number" style={{ color: "#fff" }}>
        {display}
      </div>
      <div className="eyebrow" style={{ marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

export default function WarRoom() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [readings, setReadings] = useState<GaugeReading[]>([]);

  useEffect(() => {
    const load = () => {
      apiGet<Alert[]>("/api/alerts").then(setAlerts);
      apiGet<GaugeReading[]>("/api/gauge?station=MUKDAHAN").then(setReadings);
    };
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const activeAlerts = alerts.filter((a) => a.status !== "draft" && a.status !== "expired");
  const sharedCount = alerts.filter((a) => a.shared_from).length;
  const latestReading = readings[readings.length - 1];

  const tenants = profile?.tenants;
  const tenantName =
    i18n.language === "th"
      ? tenants?.name_th ?? tenants?.name_en
      : i18n.language === "zh-CN"
        ? tenants?.name_zh ?? tenants?.name_en
        : tenants?.name_en;

  return (
    <div className="animated-gradient-warroom" style={{ minHeight: "100vh", padding: 24 }}>
      <div
        className="fade-in-up"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}
      >
        <h1
          className="font-display"
          style={{ color: "#fff", margin: 0, fontSize: 24, display: "flex", alignItems: "center", gap: 14 }}
        >
          <img src="/logo.png" alt="" width={60} height={60} className="logo-breathe" />
          {t("appName")} {t("nav.warroom")} — {tenantName}
        </h1>
        <Link to="/overview" style={{ color: "#8a94a6", fontSize: 14 }}>
          {t("warRoom.backToDashboard")}
        </Link>
      </div>

      <div className="fade-in-up" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div className="hover-lift" style={{ background: "#141a24", borderRadius: 8, padding: 8 }}>
          <AlertMap alerts={alerts} center={tenantCenter(profile?.tenants?.slug)} height={480} />
        </div>
        <div
          className="hover-lift"
          style={{ background: "#141a24", borderRadius: 8, padding: 16, maxHeight: 496, overflowY: "auto" }}
        >
          <h3
            className="font-display"
            style={{ color: "#fff", marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}
          >
            <span className="pulse-dot" />
            {t("warRoom.activeAlerts")}
          </h3>
          {activeAlerts.length === 0 && <div style={{ color: "#8a94a6" }}>{t("warRoom.noActiveAlerts")}</div>}
          {activeAlerts.map((a) => (
            <div key={a.id} style={{ marginBottom: 10, borderBottom: "1px solid #262d3a", paddingBottom: 10 }}>
              <div style={{ color: "#fff", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                {a.severity >= 4 && <span className="pulse-dot pulse-dot-red" />}
                {a.headline}
              </div>
              <div style={{ fontSize: 12, color: severityColor(a.severity) }}>
                {t("common.severity", { n: a.severity })} · {t(`common.eventTypes.${a.event_type}`)} ·{" "}
                {t(`common.alertStatus.${a.status}`)}
                {a.shared_from && ` · ${t("warRoom.shared")}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
        <StatTile label={t("warRoom.statActiveAlerts")} value={activeAlerts.length} delayIndex={0} />
        <StatTile label={t("warRoom.statSharedIncidents")} value={sharedCount} delayIndex={1} />
        <StatTile label={t("warRoom.statTotalAlerts")} value={alerts.length} delayIndex={2} />
        <StatTile
          label={t("warRoom.statFloodStage")}
          value={latestReading ? `${latestReading.flood_stage_m} m` : "-"}
          delayIndex={3}
        />
      </div>

      <div className="hover-lift fade-in-up mk-card" style={{ padding: 16, marginTop: 16 }}>
        <h3 style={{ marginTop: 0, color: "#fff" }} className="font-display">
          {t("warRoom.waterLevelTitle")}
        </h3>
        <GaugeChart readings={readings} />
      </div>
    </div>
  );
}
