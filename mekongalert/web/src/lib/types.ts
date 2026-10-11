export type EventType = "flood" | "storm" | "landslide" | "fire" | "earthquake" | "other";
export type AlertStatus = "draft" | "localized" | "approved" | "broadcast" | "expired";

export interface TenantSummary {
  id: string;
  slug: string;
  name_en: string;
  name_th: string | null;
  name_zh: string | null;
  country: "TH" | "CN";
  default_lang?: string;
}

export interface Alert {
  id: string;
  tenant_id: string;
  source: string;
  event_type: EventType;
  severity: number;
  headline: string;
  description: string;
  source_lang: string;
  area_codes: string[];
  center_lat: number | null;
  center_lng: number | null;
  radius_km: number | null;
  onset_at: string | null;
  expires_at: string | null;
  status: AlertStatus;
  created_by: string | null;
  created_at: string;
  shared_from?: TenantSummary | null;
}

export interface AlertTranslation {
  id: string;
  alert_id: string;
  lang: string;
  headline: string;
  guidance: string[];
  tts_script: string | null;
  tts_url: string | null;
  model: string | null;
}

export interface AlertDetail extends Alert {
  translations: AlertTranslation[];
}

export interface Area {
  id: string;
  tenant_id: string;
  code: string;
  name_local: string;
  name_en: string;
  lat: number | null;
  lng: number | null;
}

export interface GaugeReading {
  id: number;
  station: string;
  level_m: number;
  flood_stage_m: number;
  reading_at: string;
}

export type ReportStatus = "new" | "verified" | "dismissed" | "resolved";
export type Credibility = "low" | "medium" | "high";

export interface CitizenReport {
  id: string;
  tenant_id: string | null;
  line_user_id: string | null;
  message_text: string | null;
  photo_url: string | null;
  lat: number | null;
  lng: number | null;
  ai_category: string | null;
  ai_severity: number | null;
  ai_summary_en: string | null;
  ai_summary_local: string | null;
  ai_credibility: Credibility | null;
  status: ReportStatus;
  linked_alert_id: string | null;
  created_at: string;
}

export interface Sitrep {
  id: string;
  tenant_id: string;
  content_th: string;
  content_zh: string;
  generated_by: string | null;
  created_at: string;
}

export interface ShelterRecommendation {
  name: string;
  capacity: number;
  distance_km?: number;
  note?: string;
}

export interface ImpactAssessment {
  id: string;
  alert_id: string;
  content_th: string;
  content_zh: string;
  shelter_recommendations: ShelterRecommendation[];
  estimated_affected_population: number | null;
  created_at: string;
}

export type TaskStatus = "new" | "doing" | "done";

export interface ResponseTask {
  id: string;
  alert_id: string;
  tenant_id: string;
  title: string;
  assignee: string | null;
  status: TaskStatus;
  created_by: string | null;
  created_at: string;
}
