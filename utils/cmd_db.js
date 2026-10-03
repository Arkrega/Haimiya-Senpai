import fs from "fs";
import path from "path";

const DIR = "./database";
const FILE_STICKER = path.join(DIR, "cmdsticker.json");
const FILE_REACT = path.join(DIR, "cmdreact.json");

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
if (!fs.existsSync(FILE_STICKER)) fs.writeFileSync(FILE_STICKER, "{}", "utf-8");
if (!fs.existsSync(FILE_REACT)) fs.writeFileSync(FILE_REACT, "{}", "utf-8");

export function getStickerDB() {
  return JSON.parse(fs.readFileSync(FILE_STICKER, "utf-8"));
}

export function saveStickerDB(data) {
  fs.writeFileSync(FILE_STICKER, JSON.stringify(data, null, 2));
}

export function getReactDB() {
  return JSON.parse(fs.readFileSync(FILE_REACT, "utf-8"));
}

export function saveReactDB(data) {
  fs.writeFileSync(FILE_REACT, JSON.stringify(data, null, 2));
}