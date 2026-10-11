import { Button, Card, Col, Flex, Input, Row, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import type { ResponseTask, TaskStatus } from "../lib/types";

interface Props {
  alertId: string;
}

const COLUMNS: { status: TaskStatus; titleKey: string }[] = [
  { status: "new", titleKey: "taskBoard.columns.new" },
  { status: "doing", titleKey: "taskBoard.columns.inProgress" },
  { status: "done", titleKey: "taskBoard.columns.done" },
];

export default function TaskBoard({ alertId }: Props) {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<ResponseTask[]>([]);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const load = () => {
    apiGet<ResponseTask[]>(`/api/alerts/${alertId}/tasks`).then(setTasks);
  };

  useEffect(load, [alertId]);

  const addTask = async () => {
    if (!title.trim()) return;
    setAdding(true);
    try {
      await apiPost(`/api/alerts/${alertId}/tasks`, { title });
      setTitle("");
      load();
    } finally {
      setAdding(false);
    }
  };

  const setStatus = async (taskId: string, status: TaskStatus) => {
    await apiPatch(`/api/alerts/${alertId}/tasks/${taskId}`, { status });
    load();
  };

  return (
    <Card className="hover-lift mk-card" title={<span className="eyebrow">{t("taskBoard.title")}</span>}>
      <Flex gap={8} style={{ marginBottom: 16 }}>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onPressEnter={addTask}
          placeholder={t("taskBoard.newTaskPlaceholder")}
        />
        <Button className="btn-pop mk-pill-btn" type="primary" onClick={addTask} loading={adding}>
          {t("taskBoard.add")}
        </Button>
      </Flex>
      <Row gutter={16}>
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((task) => task.status === col.status);
          return (
            <Col span={8} key={col.status}>
              <span className="eyebrow">{t(col.titleKey)}</span>
              <Flex vertical gap={8} style={{ marginTop: 8 }}>
                {colTasks.length === 0 && (
                  <Typography.Text type="secondary">{t("taskBoard.empty")}</Typography.Text>
                )}
                {colTasks.map((task) => (
                  <Card key={task.id} size="small">
                    <div>{task.title}</div>
                    {task.assignee && <Typography.Text type="secondary">{task.assignee}</Typography.Text>}
                    <Flex gap={4} style={{ marginTop: 8 }}>
                      {col.status === "new" && (
                        <Button size="small" onClick={() => setStatus(task.id, "doing")}>
                          {t("taskBoard.start")}
                        </Button>
                      )}
                      {col.status === "doing" && (
                        <Button size="small" onClick={() => setStatus(task.id, "done")}>
                          {t("taskBoard.markDone")}
                        </Button>
                      )}
                    </Flex>
                  </Card>
                ))}
              </Flex>
            </Col>
          );
        })}
      </Row>
    </Card>
  );
}
