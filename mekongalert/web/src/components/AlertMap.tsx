import L from "leaflet";
import "leaflet/dist/leaflet.css";
import icon2x from "leaflet/dist/images/marker-icon-2x.png";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import { useEffect, useRef } from "react";
import type { Alert } from "../lib/types";
import { severityColor } from "../lib/severity";

// Vite doesn't resolve Leaflet's default marker image paths automatically.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: icon2x, iconUrl: icon, shadowUrl: iconShadow });

interface Props {
  alerts: Alert[];
  center: [number, number];
  height?: number;
  pin?: [number, number] | null;
  onMapClick?: (lat: number, lng: number) => void;
}

export default function AlertMap({ alerts, center, height = 360, pin, onMapClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Layer[]>([]);
  const pinMarkerRef = useRef<L.Marker | null>(null);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(center, 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    map.on("click", (e) => onMapClickRef.current?.(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = alerts
      .filter((a) => a.center_lat != null && a.center_lng != null)
      .map((a) => {
        const isShared = Boolean(a.shared_from);
        const isUrgent = a.severity >= 4;
        const marker = L.circleMarker([a.center_lat as number, a.center_lng as number], {
          radius: 10,
          color: severityColor(a.severity),
          fillColor: severityColor(a.severity),
          fillOpacity: isShared ? 0.4 : 0.8,
          weight: isShared ? 3 : 3,
          dashArray: isShared ? "4,4" : undefined,
          className: isUrgent ? "marker-pulse" : undefined,
        }).bindPopup(
          `<b>${a.headline}</b><br/>${a.event_type} &middot; severity ${a.severity}` +
            (isShared ? `<br/><em>Shared from ${a.shared_from!.name_en}</em>` : ""),
        );
        marker.addTo(map);
        return marker;
      });
  }, [alerts]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pinMarkerRef.current) {
      map.removeLayer(pinMarkerRef.current);
      pinMarkerRef.current = null;
    }
    if (pin) pinMarkerRef.current = L.marker(pin).addTo(map);
  }, [pin]);

  return <div ref={containerRef} style={{ height, width: "100%", borderRadius: 8 }} />;
}
