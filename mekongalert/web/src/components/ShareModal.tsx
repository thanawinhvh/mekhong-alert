import { Form, Input, Modal, Select } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiGet } from "../lib/api";
import type { TenantSummary } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onShare: (toTenantSlug: string, note?: string) => Promise<void>;
}

export default function ShareModal({ open, onClose, onShare }: Props) {
  const { t } = useTranslation();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) apiGet<TenantSummary[]>("/api/tenants").then(setTenants);
  }, [open]);

  const submit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await onShare(values.to_tenant_slug, values.note);
      form.resetFields();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={t("shareModal.title")} open={open} onCancel={onClose} onOk={submit} confirmLoading={submitting}>
      <Form layout="vertical" form={form}>
        <Form.Item name="to_tenant_slug" label={t("shareModal.agency")} rules={[{ required: true }]}>
          <Select options={tenants.map((tn) => ({ value: tn.slug, label: tn.name_en }))} />
        </Form.Item>
        <Form.Item name="note" label={t("shareModal.note")}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
