import fs from "fs";
import path from "path";

const FILE_AFK = "./database/afk.json";

if (!fs.existsSync("./database")) fs.mkdirSync("./database", { recursive: true });
if (!fs.existsSync(FILE_AFK)) fs.writeFileSync(FILE_AFK, "{}", "utf-8");

export function getAfkDB() {
  return JSON.parse(fs.readFileSync(FILE_AFK, "utf-8"));
}

export function saveAfkDB(data) {
  fs.writeFileSync(FILE_AFK, JSON.stringify(data, null, 2));
}

export function addAfk(jid, reason) {
  const db = getAfkDB();
  db[jid] = { reason: reason || "Tanpa alasan", time: Date.now() };
  saveAfkDB(db);
}

export function checkAfk(jid) {
  const db = getAfkDB();
  return db[jid] || null;
}

export function removeAfk(jid) {
  const db = getAfkDB();
  if (db[jid]) {
    delete db[jid];
    saveAfkDB(db);
    return true;
  }
  return false;
}

export function formatAfkTime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor((ms / (1000 * 60 * 60 * 24)) % 30);
  const months = Math.floor((ms / (1000 * 60 * 60 * 24 * 30)) % 12);
  const years = Math.floor(ms / (1000 * 60 * 60 * 24 * 365));

  const parts = [];
  if (years > 0) parts.push(`${years} tahun`);
  if (months > 0) parts.push(`${months} bulan`);
  if (days > 0) parts.push(`${days} hari`);
  if (hours > 0) parts.push(`${hours} jam`);
  if (minutes > 0) parts.push(`${minutes} menit`);
  if (seconds > 0) parts.push(`${seconds} detik`);

  return parts.length > 0 ? parts.join(", ") : "Baru saja";
}