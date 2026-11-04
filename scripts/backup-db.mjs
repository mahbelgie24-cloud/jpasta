#!/usr/bin/env node
/**
 * Encrypted-at-rest is out of scope locally; this produces a compressed
 * logical dump of the JPasta database into backups/ with a 7-day retention,
 * plus a printed restore command (the restore-verify habit from the
 * Ayasofia G3 runbook).
 *
 * Usage:
 *   node scripts/backup-db.mjs                 # docker exec path (default)
 *   JPASTA_DB_CONTAINER=x node scripts/backup-db.mjs
 *   pg_dump must be on PATH otherwise (set JPASTA_USE_PG_DUMP=1)
 *
 * Cron example (daily 03:30):
 *   30 3 * * * cd /home/max/Projects/jpasta && node scripts/backup-db.mjs >> backups/backup.log 2>&1
 */
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";

// minimal .env.local loader
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    const k = m?.[1];
    const v = m?.[2];
    if (k && v !== undefined && !process.env[k]) process.env[k] = v.trim();
  }
} catch {
  // fall back to the ambient environment
}

const url =
  process.env.DATABASE_URL ??
  "postgresql://jpasta:jpasta@localhost:54330/jpasta";
const parsed = new URL(url);
const DB = parsed.pathname.replace("/", "") || "jpasta";
const CONTAINER = process.env.JPASTA_DB_CONTAINER ?? "jpasta-pg";
const RETENTION_DAYS = 7;

mkdirSync("backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const out = join("backups", `jpasta_${stamp}.sql.gz`);

const args = [];
if (parsed.username) args.push("-U", parsed.username);
args.push("-d", DB);

let dump;
if (process.env.JPASTA_BACKUP_MODE === "remote") {
  // CI/production path: the postgres:17 image guarantees a pg_dump that
  // matches a Neon 17 server, without installing a client on the runner.
  // pg_dump accepts the connection URI as its dbname argument.
  dump = execFileSync(
    "docker",
    ["run", "--rm", "postgres:17", "pg_dump", url],
    {
      maxBuffer: 256 * 1024 * 1024,
    },
  );
} else if (process.env.JPASTA_USE_PG_DUMP === "1") {
  // host path: connect over TCP with the mapped host/port
  const hostArgs = parsed.hostname ? ["-h", parsed.hostname] : [];
  const portArgs = parsed.port ? ["-p", parsed.port] : [];
  dump = execFileSync("pg_dump", [...args, ...hostArgs, ...portArgs], {
    maxBuffer: 256 * 1024 * 1024,
  });
} else {
  // container path: pg_dump runs INSIDE the container — unix socket, no
  // host/port mapping (the mapped :54330 only exists on the host).
  dump = execFileSync("docker", ["exec", CONTAINER, "pg_dump", ...args], {
    maxBuffer: 256 * 1024 * 1024,
  });
}

// gzip via node zlib (no shell pipeline)
const { gzipSync } = await import("node:zlib");
const { writeFileSync } = await import("node:fs");
const gz = gzipSync(dump);

// Optional client-side encryption before the archive leaves the machine.
// GitHub encrypts artifacts at rest, but the bundle itself is not encrypted;
// a production deploy should set this secret. `-pass env:` keeps the key out
// of the process list and shell history.
const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY?.trim();
let finalOut = out;
if (encryptionKey) {
  if (encryptionKey.length < 32) {
    throw new Error("BACKUP_ENCRYPTION_KEY must be at least 32 characters");
  }
  finalOut = `${out}.enc`;
  const encrypted = execFileSync(
    "openssl",
    [
      "enc",
      "-aes-256-cbc",
      "-pbkdf2",
      "-salt",
      "-pass",
      "env:BACKUP_ENCRYPTION_KEY",
    ],
    { input: gz, maxBuffer: 256 * 1024 * 1024, env: process.env },
  );
  writeFileSync(finalOut, encrypted);
} else {
  writeFileSync(finalOut, gz);
  if (process.env.JPASTA_BACKUP_MODE === "remote") {
    console.warn(
      "⚠ BACKUP_ENCRYPTION_KEY is not set — the uploaded dump is not client-side encrypted.",
    );
  }
}

// retention
const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
let pruned = 0;
for (const f of readdirSync("backups")) {
  const p = join("backups", f);
  if (f.startsWith("jpasta_") && statSync(p).mtimeMs < cutoff) {
    unlinkSync(p);
    pruned += 1;
  }
}

console.log(
  `✓ backup written: ${finalOut} (${Math.round(dump.length / 1024)} KB raw${encryptionKey ? ", encrypted" : ""})`,
);
console.log(
  `  pruned ${pruned} old backup(s) older than ${RETENTION_DAYS} days`,
);
console.log(
  encryptionKey
    ? `  restore: openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY -in ${finalOut} | gunzip -c | psql "$DATABASE_URL"`
    : `  restore: gunzip -c ${finalOut} | psql "$DATABASE_URL"`,
);
console.log(
  `  VERIFY the restore before trusting it (G3 habit): restore into a scratch DB and count orders.`,
);
