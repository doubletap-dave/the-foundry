import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const dbPath = process.env.VERCEL ? "/tmp/foundry.db" : path.join(process.cwd(), "data", "foundry.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS sparks (
    id TEXT PRIMARY KEY,
    owner TEXT,
    text TEXT NOT NULL,
    status TEXT NOT NULL,
    take TEXT,
    hours TEXT,
    packet TEXT,
    research TEXT,
    legs TEXT,
    error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

const sparkCols = sqlite.prepare('PRAGMA table_info(sparks)').all() as { name: string }[];
if (!sparkCols.some((c) => c.name === 'owner')) {
  sqlite.exec('ALTER TABLE sparks ADD COLUMN owner TEXT');
}

export const db = drizzle(sqlite, { schema });
export { schema, sqlite };
