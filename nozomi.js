process.on("warning", (warning) => {
  if (
    warning.name === "DeprecationWarning" &&
    warning.message.includes("punycode")
  ) {
    return;
  }
  console.warn(warning);
});

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

const stdoutFilters = [
  "Closing session",
  "(node:",
  "[DEP0040]",
  "SessionEntry",
  "currentRatchet",
  "pendingPreKey",
  "[LOG] Emoji",
  "EmojiDB loaded",
  "EmojiDB saved",
  "trace-deprecation",
];

const stderrFilters = ["[DEP0040]", "punycode", "trace-deprecation"];

process.stdout.write = (chunk, encoding, callback) => {
  const text = chunk?.toString?.() || "";
  if (stdoutFilters.some((filter) => text.includes(filter))) {
    return true;
  }
  return originalStdoutWrite(chunk, encoding, callback);
};

process.stderr.write = (chunk, encoding, callback) => {
  const text = chunk?.toString?.() || "";
  if (stderrFilters.some((filter) => text.includes(filter))) {
    return true;
  }
  return originalStderrWrite(chunk, encoding, callback);
};

import {
  makeWASocket,
  useMultiFileAuthState,
  Browsers,
  delay
} from "@itsliaaa/baileys";
import Pino from "pino";
import fs from "fs/promises";
import chalk from "chalk";
import packageFile from "./package.json" with { type: "json" };
import QRCode from "qrcode-terminal";
import validator from "validator";
import config from "./config.js";
import { handleMessage } from "./handlers/message.js";
import { loadPlugins } from "./plugins/index.js";
import { getRuntimeValue } from "./utils/runtime.js";

const sessionDir = config.sessionDir || "nozomi_sessions";
let reconnectTimer = null;
let connecting = false;

function validatePhoneNumber(input) {
  const cleaned = input.replace(/[^0-9]/g, "");
  if (!cleaned) {
    throw new Error("Phone number cannot be empty.");
  }
  if (!validator.isMobilePhone(cleaned, "any")) {
    throw new Error(
      "Phone number format not recognized. Use full country code.",
    );
  }
  if (cleaned.startsWith("0")) {
    return "62" + cleaned.slice(1);
  }
  return cleaned;
}

async function checkForUpdates() {
  try {
    if (!config.checkForUpdates) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 5000);
    const response = await fetch(
      "https://raw.githubusercontent.com/dev-ryusei-hoshino/Nozomi-Base/refs/heads/main/package.json",
      {
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);
    if (!response.ok) {
      return;
    }
    const remotePackage = await response.json();
    const currentVersion = packageFile.version;
    const latestVersion = remotePackage.version;
    if (currentVersion === latestVersion) {
      console.log(
        chalk.green(`You are using the latest version: v${currentVersion}`),
      );
      return;
    }
    console.log(chalk.yellow("A new version of Nozomi-Base is available."));
    console.log(
      `  ${chalk.gray("Current version:")} ${chalk.red(`v${currentVersion}`)}`,
    );
    console.log(
      `  ${chalk.gray("Latest version:")}  ${chalk.green(`v${latestVersion}`)}`,
    );
    console.log(
      `  ${chalk.gray("Repository:")} ${chalk.underline(
        "https://github.com/dev-ryusei-hoshino/Nozomi-Base",
      )}`,
    );
  } catch {}
}

async function connectToWhatsApp() {
  if (connecting) {
    return;
  }
  connecting = true;
  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const conn = makeWASocket({
      auth: state,
      printQRInTerminal: Boolean(config.pairingWithQr),
      browser: Browsers.ubuntu("Chrome"),
      logger: Pino({ level: "silent" }),
      markOnlineOnConnect: config.bot.markOnlineOnConnect,
      syncFullHistory: config.syncFullHistory,
    });

    conn.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (connection === "connecting" && !config.pairingWithQr && !state.creds.registered) {
        try {
          if (!config.bot.number) {
            console.log(chalk.red("Nomor bot tidak ditemukan di config.js! Tambahkan config.bot.number"));
            process.exit(1);
          }
          const phoneNumber = validatePhoneNumber(config.bot.number);
          await delay(1500);
          const code = await conn.requestPairingCode(phoneNumber, config.customPairingCode);
          console.log(`HAIMIYA PAIRING CODE: ${chalk.yellow(code)}`);
          console.log(
            chalk.gray(
              "Buka WhatsApp > Perangkat Tertaut > Tautkan dengan Nomor Telepon > Masukkan kode di atas.",
            ),
          );
        } catch (error) {
          console.error("Failed to request pairing code:", error.message);
        }
      }

      if (qr && config.pairingWithQr) {
        QRCode.generate(qr, { small: true });
        console.log(
          "Scan the QR code above with WhatsApp > Link Devices > Link Devices",
        );
      }
      if (connection === "open") {
        connecting = false;
        console.log(
          `${chalk.green("Connected")} ${config.bot.name} successfully connected to WhatsApp!`,
        );
        return;
      }
      if (connection === "close") {
        connecting = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== 401;
        if (!shouldReconnect) {
          console.log(
            `Invalid session. Deleting folder "${chalk.yellow(sessionDir)}"...`,
          );
          try {
            await fs.rm(sessionDir, {
              recursive: true,
              force: true,
            });
          } catch (error) {
            console.error("Failed to delete session folder:", error.message);
          }
        }
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connectToWhatsApp();
        }, 3000);
      }
    });

    conn.ev.on("creds.update", saveCreds);

    conn.ev.on("call", async (calls) => {
      const isAnticall = getRuntimeValue("anticall");
      if (isAnticall) {
        for (const call of calls) {
          if (call.status === "offer") {
            await conn.rejectCall(call.id, call.from);
            await conn.sendMessage(call.from, { text: "Anti-Call aktif! Panggilan otomatis ditolak. Silakan hubungi melalui chat!" });
          }
        }
      }
    });

    conn.ev.on("messages.upsert", async ({ messages }) => {
      for (const msg of messages) {
        try {
          await handleMessage(conn, msg);
        } catch (error) {
          console.error("Message handler error:", error);
        }
      }
    });
  } catch (error) {
    connecting = false;
    console.error("WhatsApp connection error:", error);
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectToWhatsApp();
    }, 3000);
  }
}

async function start() {
  console.log(chalk.cyan(`Starting ${config.bot.name}...`));
  const pluginPromise = loadPlugins();
  connectToWhatsApp();
  await pluginPromise
    .then(() => {
      console.log(chalk.green("Plugins loaded successfully."));
    })
    .catch((error) => {
      console.error(chalk.red("Failed to load plugins:"), error);
    });
  checkForUpdates();
}

start();