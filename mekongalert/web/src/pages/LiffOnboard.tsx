import liff from "@line/liff";
import { Button, Card, Checkbox, Flex, Radio, Result, Select, Spin, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { provinceLabel } from "../lib/provinceLabel";

interface PublicArea {
  tenant_slug: string;
  code: string;
  name_local: string;
  name_en: string;
}

const LANGS = [
  { value: "th", label: "ไทย" },
  { value: "lo", label: "ລາວ" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "zh-CN", label: "中文" },
  { value: "en", label: "English" },
];

export default function LiffOnboard() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [areas, setAreas] = useState<PublicArea[]>([]);
  const [lang, setLang] = useState("th");
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [areaCodes, setAreaCodes] = useState<string[]>([]);
  const [shareLocation, setShareLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    liff
      .init({ liffId: import.meta.env.VITE_LIFF_ID })
      .then(async () => {
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        const profile = await liff.getProfile();
        setUserId(profile.userId);
        setReady(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "LIFF init failed"));
  }, []);

  useEffect(() => {
    if (ready) apiGet<PublicArea[]>("/public/areas").then(setAreas);
  }, [ready]);

  const tenantSlugs = [...new Set(areas.map((a) => a.tenant_slug))];
  const districtOptions = areas.filter((a) => a.tenant_slug === tenantSlug);

  const submit = async () => {
    if (!userId) return;
    setSubmitting(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      if (shareLocation && navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject),
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
      await apiPost("/public/subscribers", { line_user_id: userId, lang, area_codes: areaCodes, lat, lng });
      setDone(true);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  if (error) return <Result status="error" title="LIFF error" subTitle={error} />;
  if (!ready) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: "100vh" }}>
        <Spin size="large" />
      </Flex>
    );
  }
  if (done) return <Result status="success" title="ลงทะเบียนรับแจ้งเตือนสำเร็จ / Subscribed" />;

  return (
    <Flex justify="center" style={{ padding: 24 }}>
      <Card style={{ maxWidth: 480, width: "100%" }} title="MekhongAlert — รับการแจ้งเตือน">
        <Flex vertical gap={16}>
          <div>
            <Typography.Text strong>ภาษา / Language</Typography.Text>
            <Radio.Group
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              options={LANGS}
              optionType="button"
              style={{ display: "block", marginTop: 8 }}
            />
          </div>
          <div>
            <Typography.Text strong>จังหวัด / Province</Typography.Text>
            <Select
              style={{ width: "100%", marginTop: 8 }}
              value={tenantSlug ?? undefined}
              onChange={(v) => {
                setTenantSlug(v);
                setAreaCodes([]);
              }}
              options={tenantSlugs.map((slug) => ({ value: slug, label: provinceLabel(slug) }))}
            />
          </div>
          {tenantSlug && (
            <div>
              <Typography.Text strong>อำเภอ / District</Typography.Text>
              <Select
                mode="multiple"
                style={{ width: "100%", marginTop: 8 }}
                value={areaCodes}
                onChange={setAreaCodes}
                options={districtOptions.map((a) => ({ value: a.code, label: `${a.name_local} (${a.name_en})` }))}
              />
            </div>
          )}
          <Checkbox checked={shareLocation} onChange={(e) => setShareLocation(e.target.checked)}>
            แชร์ตำแหน่งของฉัน / Share my location
          </Checkbox>
          <Button type="primary" block onClick={submit} loading={submitting} disabled={areaCodes.length === 0}>
            ลงทะเบียน / Subscribe
          </Button>
        </Flex>
      </Card>
    </Flex>
  );
}
