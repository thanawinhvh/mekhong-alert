import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { useEffect, useRef } from "react";
import type { CitizenReport } from "../lib/types";

interface Props {
  reports: CitizenReport[];
  center: [number, number];
  height?: number;
}

const CREDIBILITY_COLORS: Record<string, string> = { high: "#f5222d", medium: "#faad14", low: "#8c8c8c" };

function dotIcon(color: string, pulse: boolean): L.DivIcon {
  const dot = `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 2px rgba(0,0,0,.5)"></div>`;
  return L.divIcon({
    className: "",
    html: pulse ? `<div class="marker-ping-wrap" style="color:${color}">${dot}</div>` : dot,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

// leaflet.markercluster works on L.Marker (icon-based), not L.circleMarker —
// switched from circleMarker to a colored divIcon so pins can cluster.
export default function ReportMap({ reports, center, height = 360 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(center, 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    const cluster = L.markerClusterGroup();
    cluster.addTo(map);
    clusterRef.current = cluster;
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    cluster.clearLayers();
    reports
      .filter((r) => r.lat != null && r.lng != null)
      .forEach((r) => {
        const color = CREDIBILITY_COLORS[r.ai_credibility ?? ""] ?? "#1677ff";
        const photoHtml = r.photo_url
          ? `<img src="${r.photo_url}" style="width:160px;border-radius:4px;margin-bottom:4px;display:block" />`
          : "";
        const summary = r.ai_summary_en ?? r.message_text ?? "(no text)";
        const marker = L.marker([r.lat as number, r.lng as number], {
          icon: dotIcon(color, r.ai_credibility === "high"),
        }).bindPopup(
          `${photoHtml}<div>${summary}</div>`,
        );
        cluster.addLayer(marker);
      });
  }, [reports]);

  return <div ref={containerRef} style={{ height, width: "100%", borderRadius: 8 }} />;
}
