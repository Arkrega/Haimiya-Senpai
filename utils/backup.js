import fs from "fs";
import path from "path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const archiverModule = require("archiver");
const archiver =
  typeof archiverModule === "function"
    ? archiverModule
    : typeof archiverModule?.default === "function"
      ? archiverModule.default
      : typeof archiverModule?.archiver === "function"
        ? archiverModule.archiver
        : null;

if (!archiver) {
  throw new TypeError("Modul archiver tidak menyediakan factory function."); 
}
import { getRuntime, setRuntimeValue } from "./runtime.js";

const ROOT = process.cwd();
const BACKUP_DIR = path.join(ROOT, "backups");
let scheduler = null;
let schedulerToken = 0;

function parseInterval(value) {
  const match = String(value || "").trim().toLowerCase().match(/^(\\d+(?:\\.\\d+)?)(m|h|d|w)$/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
  const ms = amount * multipliers[unit];

  if (!Number.isFinite(ms) || ms < 60_000) return null;
  return Math.floor(ms);
}

function formatInterval(ms) {
  const units = [
    [604800000, "minggu"],
    [86400000, "hari"],
    [3600000, "jam"],
    [60000, "menit"],
  ];
  for (const [size, label] of units) {
    if (ms % size === 0) return `${ms / size} ${label}`;
  }
  return `${Math.round(ms / 60000)} menit`;
}

function stamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
}

export async function createBackup(conn) {
  await fs.promises.mkdir(BACKUP_DIR, { recursive: true });

  const fileName = `Haimiya-Senpai_${stamp()}.zip`;
  const outputPath = path.join(BACKUP_DIR, fileName);

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 6 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);

    archive.glob("**/*", {
      cwd: ROOT,
      dot: true,
      ignore: [
        "node_modules/**",
        "nozomi_session/**",
        "backups/**",
        ".git/**",
        "*.zip",
      ],
    });

    archive.finalize();
  });

  const ownerNumber = String((await import("../config.js")).default.bot?.owner?.number || "").replace(/\D/g, "");
  if (!ownerNumber) throw new Error("Nomor owner tidak ditemukan di config.js");

  const ownerJid = `${ownerNumber}@s.whatsapp.net`;
  const sizeMB = (await fs.promises.stat(outputPath)).size / 1024 / 1024;

  try {
    await conn.sendMessage(ownerJid, {
      document: { url: outputPath },
      mimetype: "application/zip",
      fileName,
      caption:
        `📦 *HAIMIYA-SENPAI BACKUP*\n\n` +
        `🗂️ File: ${fileName}\n` +
        `📏 Ukuran: ${sizeMB.toFixed(2)} MB\n` +
        `🔐 Session WhatsApp tidak disertakan.`,
    });
  } finally {
    await fs.promises.rm(outputPath, { force: true });
  }

  setRuntimeValue("backup", {
    ...getRuntime().backup,
    lastRun: Date.now(),
  });

  return fileName;
}

export function setBackupConfig(intervalMs) {
  setRuntimeValue("backup", {
    ...getRuntime().backup,
    enabled: true,
    interval: intervalMs,
  });
}

export function disableBackup() {
  setRuntimeValue("backup", {
    ...getRuntime().backup,
    enabled: false,
  });
}

export function getBackupStatus() {
  const backup = getRuntime().backup || {};
  return {
    enabled: backup.enabled === true,
    interval: Number(backup.interval) || 86400000,
    lastRun: Number(backup.lastRun) || 0,
  };
}

export { parseInterval, formatInterval };

export function startAutoBackup(conn) {
  schedulerToken += 1;
  const token = schedulerToken;

  if (scheduler) {
    clearTimeout(scheduler);
    scheduler = null;
  }

  const scheduleNext = () => {
    if (token !== schedulerToken) return;

    const { enabled, interval, lastRun } = getBackupStatus();
    if (!enabled) return;

    const safeInterval = Math.max(interval, 60_000);
    const elapsed = lastRun ? Date.now() - lastRun : safeInterval;
    const wait = Math.max(0, safeInterval - elapsed);

    scheduler = setTimeout(async () => {
      if (token !== schedulerToken) return;

      try {
        console.log("[BACKUP] Membuat backup otomatis...");
        await createBackup(conn);
        console.log("[BACKUP] Backup otomatis berhasil dikirim ke owner.");
      } catch (error) {
        console.error("[BACKUP] Gagal:", error.message);
      } finally {
        scheduleNext();
      }
    }, wait);
  };

  scheduleNext();
}
