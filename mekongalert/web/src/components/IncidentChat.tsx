import { Button, Card, Flex, Input, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { apiGet, apiPost } from "../lib/api";

interface IncidentMessage {
  id: string;
  tenant_id: string;
  profile_id: string;
  body_original: string;
  lang_original: string;
  translations: Record<string, string>;
  created_at: string;
}

interface Props {
  alertId: string;
}

// 5s polling per the WOW-pack spec's own "whichever is faster to ship" call —
// no Supabase Realtime wiring needed for a demo-scale chat panel.
const POLL_MS = 5000;

export default function IncidentChat({ alertId }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [messages, setMessages] = useState<IncidentMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});

  const myLang = profile?.tenants?.default_lang ?? "en";

  useEffect(() => {
    const load = () => apiGet<IncidentMessage[]>(`/api/alerts/${alertId}/messages`).then(setMessages);
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [alertId]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await apiPost(`/api/alerts/${alertId}/messages`, { body: text });
      setText("");
      const fresh = await apiGet<IncidentMessage[]>(`/api/alerts/${alertId}/messages`);
      setMessages(fresh);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="hover-lift mk-card" title={<span className="eyebrow">{t("incidentChat.title")}</span>}>
      <Flex vertical gap={8} style={{ maxHeight: 320, overflowY: "auto", marginBottom: 12 }}>
        {messages.length === 0 && <Typography.Text type="secondary">{t("incidentChat.noMessages")}</Typography.Text>}
        {messages.map((m) => {
          const isMine = m.tenant_id === profile?.tenant_id;
          const shown = showOriginal[m.id] ? m.body_original : (m.translations[myLang] ?? m.body_original);
          return (
            <div key={m.id} style={{ alignSelf: isMine ? "flex-end" : "flex-start", maxWidth: "80%" }}>
              <div
                style={{
                  background: isMine ? "#1677ff" : "#f0f0f0",
                  color: isMine ? "#fff" : "#000",
                  borderRadius: 8,
                  padding: "6px 12px",
                }}
              >
                {shown}
              </div>
              <Typography.Link
                style={{ fontSize: 11, display: "block", textAlign: isMine ? "right" : "left" }}
                onClick={() => setShowOriginal((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
              >
                {showOriginal[m.id] ? t("incidentChat.showTranslation") : t("incidentChat.showOriginal")}
              </Typography.Link>
            </div>
          );
        })}
      </Flex>
      <Flex gap={8}>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPressEnter={send}
          placeholder={t("incidentChat.placeholder")}
          disabled={sending}
        />
        <Button className="btn-pop" type="primary" onClick={send} loading={sending}>
          {t("incidentChat.send")}
        </Button>
      </Flex>
    </Card>
  );
}
