import axios from "axios";
import util from "util";

export default {
  name: "Get URL",
  command: ["get", "fetch"],
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Mengambil data JSON, teks, atau media dari URL",
  category: "tools",
  async run(conn, m, { jid, args, usedPrefix, command }) {
    const url = args[0];

    if (!url) {
      return await m.reply(`Format salah!\nContoh: ${usedPrefix}${command} https://api.github.com/users/github`);
    }

    if (!/^https?:\/\//.test(url)) {
      return await m.reply("URL harus diawali dengan http:// atau https://");
    }

    await m.react("⏳");

    try {
      const res = await axios.get(url, { responseType: "arraybuffer" });
      const contentType = res.headers["content-type"];

      if (/json/i.test(contentType)) {
        const text = JSON.parse(res.data.toString("utf-8"));
        await m.reply(util.format(text));
      } else if (/text/i.test(contentType)) {
        await m.reply(res.data.toString("utf-8"));
      } else if (/image/i.test(contentType)) {
        await conn.sendMessage(jid, { image: res.data, caption: url }, { quoted: m });
      } else if (/video/i.test(contentType)) {
        await conn.sendMessage(jid, { video: res.data, caption: url }, { quoted: m });
      } else if (/audio/i.test(contentType)) {
        await conn.sendMessage(jid, { audio: res.data, mimetype: contentType }, { quoted: m });
      } else {
        const extMatch = contentType.match(/\/([a-zA-Z0-9]+)/);
        const ext = extMatch ? extMatch[1] : "bin";
        await conn.sendMessage(jid, { document: res.data, mimetype: contentType, fileName: `download.${ext}` }, { quoted: m });
      }

      await m.react("✅");
    } catch (error) {
      await m.react("❌");
      await m.reply(`Error: ${error.message}`);
    }
  }
};