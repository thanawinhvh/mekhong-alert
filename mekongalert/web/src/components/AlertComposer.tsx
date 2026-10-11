import { Button, Drawer, Form, Input, InputNumber, Select, message } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiGet, apiPost } from "../lib/api";
import type { Area, EventType } from "../lib/types";
import AlertMap from "./AlertMap";

const EVENT_TYPES: EventType[] = ["flood", "storm", "landslide", "fire", "earthquake", "other"];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultCenter: [number, number];
  initialValues?: { event_type?: EventType; severity?: number; headline?: string; description?: string };
}

export default function AlertComposer({ open, onClose, onCreated, defaultCenter, initialValues }: Props) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [areas, setAreas] = useState<Area[]>([]);
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPin(null);
    form.setFieldsValue({ severity: 3, source_lang: "th", ...initialValues });
    apiGet<Area[]>("/api/areas")
      .then(setAreas)
      .catch(() => message.error("Failed to load areas"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    const values = await form.validateFields();
    if (!pin) {
      message.error("Click the map to set the alert location");
      return;
    }
    setSubmitting(true);
    try {
      await apiPost("/api/alerts", { ...values, center_lat: pin[0], center_lng: pin[1] });
      message.success("Alert created");
      form.resetFields();
      onCreated();
      onClose();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Failed to create alert");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      title={t("alerts.newAlert")}
      open={open}
      onClose={onClose}
      width={480}
      extra={
        <Button className="btn-pop mk-pill-btn" type="primary" loading={submitting} onClick={submit}>
          {t("alertComposer.createDraft")}
        </Button>
      }
    >
      <Form layout="vertical" form={form}>
        <Form.Item name="event_type" label={t("alertComposer.eventType")} rules={[{ required: true }]}>
          <Select options={EVENT_TYPES.map((v) => ({ value: v, label: t(`common.eventTypes.${v}`) }))} />
        </Form.Item>
        <Form.Item name="severity" label={t("alertComposer.severityRange")} rules={[{ required: true }]}>
          <InputNumber min={1} max={5} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="headline" label={t("alertComposer.headline")} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label={t("alertComposer.description")} rules={[{ required: true }]}>
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="area_codes" label={t("alertComposer.affectedAreas")} rules={[{ required: true }]}>
          <Select
            mode="multiple"
            options={areas.map((a) => ({ value: a.code, label: `${a.name_local} (${a.name_en})` }))}
          />
        </Form.Item>
        <Form.Item label={t("alertComposer.locationLabel")}>
          <AlertMap alerts={[]} center={defaultCenter} pin={pin} onMapClick={(lat, lng) => setPin([lat, lng])} height={220} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
