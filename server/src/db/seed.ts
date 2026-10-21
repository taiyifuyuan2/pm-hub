import type { DatabaseSync } from "node:sqlite";
import { mockAiLogs, mockMemos, mockMessages, mockTasks } from "./seedData";

export function seedSampleData(db: DatabaseSync) {
  const insertTask = db.prepare(
    "INSERT INTO tasks (id, title, description, status, category, createdAt, scheduledAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertMemo = db.prepare("INSERT INTO memos (taskId, content, updatedAt) VALUES (?, ?, ?)");
  const insertLog = db.prepare(
    "INSERT INTO ai_logs (id, taskId, sender, kind, message, timestamp, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertMessage = db.prepare(
    "INSERT INTO messages (id, taskId, source, sender, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
  );

  db.exec("BEGIN");
  try {
    for (const t of mockTasks) {
      insertTask.run(t.id, t.title, t.description, t.status, t.category, t.createdAt, t.scheduledAt ?? null);
    }
    for (const m of Object.values(mockMemos)) insertMemo.run(m.taskId, m.content, m.updatedAt);
    for (const l of Object.values(mockAiLogs).flat()) {
      insertLog.run(l.id, l.taskId, l.sender, l.kind ?? "text", l.message, l.timestamp, l.status ?? null);
    }
    for (const m of Object.values(mockMessages).flat()) {
      insertMessage.run(m.id, m.taskId, m.source, m.sender, m.content, m.timestamp);
    }
    db.exec("COMMIT");
    console.log("[db] seeded sample data");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
