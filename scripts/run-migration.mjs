// Script to execute SQL migrations against Supabase
// Tries multiple connection approaches

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = "hfhymkhdohpkicighwfw";
const DB_PASS = process.env.DB_PASS || "AQ84CW5Y9P5CodhF";

// Possible pooler regions
const REGIONS = [
  "aws-0-us-east-1",
  "aws-0-us-east-2",
  "aws-0-us-west-1",
  "aws-0-us-west-2",
  "aws-0-sa-east-1",
  "aws-0-eu-west-1",
  "aws-0-eu-central-1",
  "aws-0-ap-southeast-1",
  "aws-0-ap-south-1",
];

async function tryConnect(connStr, label) {
  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    console.log(`✅ Connected via ${label}`);
    return client;
  } catch (err) {
    console.log(`❌ ${label}: ${err.message}`);
    return null;
  }
}

async function main() {
  let client = null;

  // Try direct connection first
  const directHost = `db.${PROJECT_REF}.supabase.co`;
  client = await tryConnect(
    `postgresql://postgres:${DB_PASS}@${directHost}:5432/postgres`,
    `Direct (${directHost})`
  );

  // Try session pooler (port 5432)
  if (!client) {
    for (const region of REGIONS) {
      client = await tryConnect(
        `postgresql://postgres.${PROJECT_REF}:${DB_PASS}@${region}.pooler.supabase.com:5432/postgres`,
        `Session pooler ${region}`
      );
      if (client) break;
    }
  }

  // Try transaction pooler (port 6543)
  if (!client) {
    for (const region of REGIONS) {
      client = await tryConnect(
        `postgresql://postgres.${PROJECT_REF}:${DB_PASS}@${region}.pooler.supabase.com:6543/postgres`,
        `Transaction pooler ${region}`
      );
      if (client) break;
    }
  }

  if (!client) {
    console.error("\n❌ Could not connect with any method. Check your database password and project reference.");
    process.exit(1);
  }

  // Execute migrations
  const migrations = ["001_initial_schema.sql", "002_row_level_security.sql"];

  for (const file of migrations) {
    const path = resolve(__dirname, "..", "supabase", "migrations", file);
    const sql = readFileSync(path, "utf-8");
    console.log(`\n📄 Executing ${file}...`);
    try {
      await client.query(sql);
      console.log(`✅ ${file} executed successfully`);
    } catch (err) {
      console.error(`❌ ${file} failed: ${err.message}`);
      if (err.message.includes("already exists")) {
        console.log("   (Table/object may already exist — continuing)");
      } else {
        break;
      }
    }
  }

  await client.end();
  console.log("\n🎉 Done!");
}

main().catch(console.error);
