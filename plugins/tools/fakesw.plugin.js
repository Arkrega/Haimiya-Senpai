
import axios from "axios";
import FormData from "form-data";
import { downloadMediaMessage } from "@itsliaaa/baileys";

async function uploadImageBuffer(buffer) {
  try {
    const form = new FormData();
    form.append("file", buffer, { filename: "image.jpg" });
    const res = await axios.post("https://tmpfiles.org/api/v1/upload", form, {
      headers: form.getHeaders(),
      timeout: 30000,
    });
    if (res.data?.data?.url) {
      return res.data.data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
    }
  } catch {}

  try {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", buffer, { filename: "image.jpg" });
    const res = await axios.post("https://catbox.moe/user/api.php", form, {
      headers: form.getHeaders(),
      timeout: 30000,
    });
    if (typeof res.data === "string" && res.data.startsWith("http")) {
      return res.data.trim();
    }
  } catch {}

  throw new Error("Semua server uploader gagal merespons.");
}

function getTargetMessage(m) {
  if (m.hasQuoted && m.quotedMessage) {
    return { key: m.quotedKey || m.key, message: m.quotedMessage };
  }
  if (m.message) {
    return { key: m.key, message: m.message };
  }
  return null;
}

export default {
  name: "Fake SW",
  command: ["fakesw", "fsw", "swfake"],
  category: "tools",

  async run(conn, m, { jid, args, usedPrefix, command }) {
    const text = args.join(" ").trim();

    if (!text.includes("|")) {
      return m.reply(
        `⚠️ *Format Salah*\n\n` +
        `Reply gambar:\n> ${usedPrefix}${command} Nama|Views|Caption\n\n` +
        `Atau URL gambar:\n> ${usedPrefix}${command} Nama|URL_Gambar|Views|Caption`
      );
    }

    const parts = text.split("|").map((v) => v.trim());
    let sw, img, views, caption;

    try {
      await m.react("⏳");

      const target = getTargetMessage(m);
      const targetImage =
        m.isImage ||
        Boolean(m.quotedMessage?.imageMessage) ||
        Boolean(m.quotedMessage?.viewOnceMessage?.message?.imageMessage);

      if (targetImage && parts.length >= 3) {
        const buffer = await downloadMediaMessage(
          target,
          "buffer",
          {},
          { reuploadRequest: conn.updateMediaMessage }
        );

        if (!buffer?.length) throw new Error("Gagal mendownload gambar.");

        img = await uploadImageBuffer(buffer);
        sw = parts[0];
        views = parts[1];
        caption = parts.slice(2).join("|");
      } else {
        if (parts.length < 4) {
          return m.reply(
            `⚠️ *Parameter Kurang*\nFormat:\n> ${usedPrefix}${command} Nama|URL_Gambar|Views|Caption`
          );
        }
        sw = parts[0];
        img = parts[1];
        views = parts[2];
        caption = parts.slice(3).join("|");
      }

      const apiUrl =
        `https://app.kyzznekoo.zone.id/api/canvas/fakesw` +
        `?sw=${encodeURIComponent(sw)}` +
        `&img=${encodeURIComponent(img)}` +
        `&views=${encodeURIComponent(views)}` +
        `&caption=${encodeURIComponent(caption)}`;

      const response = await axios.get(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "image/*",
        },
        responseType: "arraybuffer",
        timeout: 60000,
      });

      const imageBuffer = Buffer.from(response.data);

      await conn.sendMessage(
        jid,
        {
          image: imageBuffer,
          mimetype: "image/png",
          caption:
            `✅ *Fake SW Canvas Result*\n\n` +
            `👤 *Nama:* ${sw}\n` +
            `👁️ *Views:* ${views}\n` +
            `💬 *Caption:* ${caption}`,
        },
        { quoted: m.raw }
      );

      await m.react("✅");
    } catch (error) {
      console.error("[FAKE SW ERROR]", error);
      await m.react("❌");
      await m.reply(`❌ Gagal membuat Fake SW:\n> ${error.message}`);
    }
  },
};
