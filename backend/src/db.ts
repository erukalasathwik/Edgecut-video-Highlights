import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { JobRow, JobStatus } from "./types.js";

const dbPath = process.env.DB_PATH || "./data/highlights.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS highlight_jobs (
    id          TEXT PRIMARY KEY,
    video_url   TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'queued',
    progress    INTEGER DEFAULT 0,
    segments    TEXT DEFAULT NULL,
    error       TEXT DEFAULT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export function insertJob(id: string, videoUrl: string) {
  db.prepare(
    `INSERT INTO highlight_jobs (id, video_url, status, progress) VALUES (?, ?, 'queued', 0)`
  ).run(id, videoUrl);
}

export function getJob(id: string): JobRow | undefined {
  return db.prepare(`SELECT * FROM highlight_jobs WHERE id = ?`).get(id) as
    | JobRow
    | undefined;
}

export function updateJobStatus(
  id: string,
  status: JobStatus,
  progress: number
) {
  db.prepare(
    `UPDATE highlight_jobs SET status = ?, progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(status, progress, id);
}

export function completeJob(id: string, segments: unknown) {
  db.prepare(
    `UPDATE highlight_jobs SET status = 'completed', progress = 100, segments = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(JSON.stringify(segments), id);
}

export function failJob(id: string, error: string) {
  db.prepare(
    `UPDATE highlight_jobs SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(error, id);
}
