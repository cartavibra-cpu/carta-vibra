import { Client } from "pg";
import fs from "fs";

const url = new URL("https://omvbgobaslvarlklqrke.supabase.co");
const host = url.hostname;

const db = new Client({
  user: "postgres",
  host,
  database: "postgres",
  password: process.env.SUPABASE_DB_PASSWORD || "",
  port: 5432,
  ssl: { rejectUnauthorized: false },
});

const sql = fs.readFileSync(new URL("./apply-schema.sql", import.meta.url), "utf8");

await db.connect();
try {
  await db.query(sql);
} finally {
  await db.end();
}
