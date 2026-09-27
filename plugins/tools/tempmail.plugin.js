import axios from "axios";
import crypto from "crypto";
import { Button } from "../../utils/MessageBuilderV4.7.js";

const APIS = ["https://api.mail.gw", "https://api.mail.tm"];

const randomPassword = () => Math.random().toString(36).slice(-10);

const stripHTML = (html) => {
  if (!html) return "";
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
};

async function createTempMail() {
  let lastError;
  for (const api of APIS) {
    try {
      const domains = await axios.get(`${api}/domains`);
      const domain = domains.data["hydra:member"][0].domain;
      const email = `user_${Math.floor(Math.random() * 9999)}@${domain}`;
      const password = randomPassword();
      await axios.post(`${api}/accounts`, { address: email, password });
      return { api, email, password };
    } catch (err) {
      lastError = err?.response?.data?.message || err.message;
    }
  }
  throw new Error(lastError || "Semua API gagal");
}

async function getTokenAndApi(email, password) {
  let lastError;
  for (const api of APIS) {
    try {
      const tokenRes = await axios.post(`${api}/token`, { address: email, password });
      return { api, token: tokenRes.data.token };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export default {
  name: "TempMail",
  command: ["tempmail", "tm", "inbox"],
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Temporary email dengan deteksi otomatis OTP dan fallback API",
  category: "tools",
  async run(conn, m, { args, usedPrefix, command, jid }) {
    if (command === "tempmail" || command === "tm") {
      await m.react("⏳");
      try {
        const account = await createTempMail();
        const credentials = `${account.email}|${account.password}`;

        await new Button(conn)
          .setTitle("Email Berhasil Dibuat!")
          .setBody(`📧 *Email:* ${account.email}\n🔐 *Password:* ${account.password}`)
          .addReply("📬 Cek Inbox", `${usedPrefix}inbox ${credentials}`)
          .send(jid, { quoted: m });

        await m.react("✅");
      } catch (error) {
        console.error("Error Gen:", error.message);
        await m.reply(`Gagal membuat email: ${error.message}`);
        await m.react("❌");
      }
    }

    if (command === "inbox") {
      const rawData = args.join(" ");
      if (!rawData || !rawData.includes("|")) {
        return await m.reply(
          `Format salah! Gunakan tombol *Cek Inbox* dari pesan pembuatan email.`
        );
      }

      const [email, password] = rawData.split("|");
      if (!email || !password) {
        return await m.reply("Data email rusak.");
      }

      await m.react("⏳");

      try {
        const { api, token } = await getTokenAndApi(email, password);

        const res = await axios.get(`${api}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const messages = res.data["hydra:member"];

        if (messages.length === 0) {
          await m.react("✅");
          return await m.reply("📬 Inbox masih kosong.");
        }

        const messagePromises = messages.map(async (msg, i) => {
          try {
            const detailRes = await axios.get(`${api}/messages/${msg.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            let fullText = detailRes.data.text;
            if (!fullText || fullText.trim() === "") {
              fullText = stripHTML(detailRes.data.html) || "Kosong/Hanya Gambar";
            }

            const combinedText = msg.subject + " " + fullText;
            const otpPattern = /\b\d[\d\s\-]*\d\b/g;
            const potentialMatches = combinedText.match(otpPattern) || [];
            const otpCodes = [];

            for (let match of potentialMatches) {
              const digits = match.replace(/\D/g, "");
              if (digits.length >= 4 && digits.length <= 6) {
                otpCodes.push(digits);
              }
            }

            const uniqueOTP = [...new Set(otpCodes)];

            let messageText = `━━━━━━━━━━\n`;
            messageText += `*${i + 1}. Dari:* ${msg.from.address}\n`;

            if (uniqueOTP.length > 0) {
              messageText += `🔑 *OTP:* ${uniqueOTP.join(", ")}\n`;
            } else {
              messageText += `🔑 *OTP:* ❌ _Tidak ditemukan OTP_\n`;
            }

            messageText += `📝 *Subjek:* ${msg.subject}\n`;
            messageText += `📄 *Isi:*\n${fullText}\n`;

            return { text: messageText, otps: uniqueOTP };
          } catch (err) {
            let messageText = `━━━━━━━━━━\n`;
            messageText += `*${i + 1}. Dari:* ${msg.from.address}\n`;
            messageText += `📝 *Subjek:* ${msg.subject}\n`;
            messageText += `📄 _(Gagal mengambil isi pesan)_\n\n`;

            return { text: messageText, otps: [] };
          }
        });

        const allMessages = await Promise.all(messagePromises);

        let teksInbox = "📩 *Pesan Masuk:*\n\n";
        const allOTPs = [];

        allMessages.forEach((msgObj) => {
          teksInbox += msgObj.text;
          allOTPs.push(...msgObj.otps);
        });

        if (teksInbox.length > 4000) {
          teksInbox = teksInbox.substring(0, 4000) + "\n...(dipotong)";
        }

        const uniqueAllOTPs = [...new Set(allOTPs)];
        const builder = new Button(conn).setBody(teksInbox);

        uniqueAllOTPs.slice(0, 2).forEach((otp) => {
          builder.addCopy(`📋 Salin OTP: ${otp}`, otp);
        });

        builder.addReply("🔄 Refresh Inbox", `${usedPrefix}inbox ${email}|${password}`);

        await builder.send(jid, { quoted: m });

        await m.react("✅");
      } catch (error) {
        await m.react("❌");
        if (error.response && error.response.status === 401) {
          await m.reply("Akun mati/dihapus server.");
        } else {
          console.error("Error inbox:", error.message);
          await m.reply("Gagal mengambil pesan.");
        }
      }
    }
  },
};