import fs from "fs";
import path from "path";

const DIR = "./database";
const FILE_GROUPS = path.join(DIR, "groups.json");
const FILE_USERS = path.join(DIR, "users.json");

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
if (!fs.existsSync(FILE_GROUPS)) fs.writeFileSync(FILE_GROUPS, "{}", "utf-8");
if (!fs.existsSync(FILE_USERS)) fs.writeFileSync(FILE_USERS, "{}", "utf-8");

export function getGroupsDB() {
  return JSON.parse(fs.readFileSync(FILE_GROUPS, "utf-8"));
}

export function saveGroupsDB(data) {
  fs.writeFileSync(FILE_GROUPS, JSON.stringify(data, null, 2));
}

export function getGroupData(jid) {
  const db = getGroupsDB();
  if (!db[jid]) {
    db[jid] = {
      antilink_wa: false,
      antilink_tg: false,
      antilink_dc: false,
      antilink_yt_tt: false,
      antispam: false,
      antisticker: false,
      antibot: false,
      action: "warn",
      max_warn: 3,
      muted_users: [],
      whitelist_domains: [],
      whitelist_users: []
    };
    saveGroupsDB(db);
  }
  return db[jid];
}

export function updateGroupData(jid, key, value) {
  const db = getGroupsDB();
  if (!db[jid]) db[jid] = getGroupData(jid);
  db[jid][key] = value;
  saveGroupsDB(db);
}

export function getUsersDB() {
  return JSON.parse(fs.readFileSync(FILE_USERS, "utf-8"));
}

export function saveUsersDB(data) {
  fs.writeFileSync(FILE_USERS, JSON.stringify(data, null, 2));
}

export function addWarn(userJid, groupJid) {
  const db = getUsersDB();
  if (!db[userJid]) db[userJid] = { warns: {} };
  if (!db[userJid].warns[groupJid]) db[userJid].warns[groupJid] = 0;
  db[userJid].warns[groupJid] += 1;
  saveUsersDB(db);
  return db[userJid].warns[groupJid];
}

export function resetWarn(userJid, groupJid) {
  const db = getUsersDB();
  if (db[userJid] && db[userJid].warns[groupJid]) {
    db[userJid].warns[groupJid] = 0;
    saveUsersDB(db);
  }
}