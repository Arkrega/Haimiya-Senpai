import { igdl } from "../../scrape/instagram.js";

export default {
  name: "Instagram Downloader",
  command: ["ig", "igdl", "instagram"],
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Download video/reels/photo dari Instagram",
  category: "downloader",
  async run(conn, m, { jid, args, usedPrefix, command }) {
    const url = args[0];
    if (!url || !url.includes("instagram.com")) {
      return await m.reply(`Masukkan URL Instagram yang valid!\nContoh: ${usedPrefix}${command} https://www.instagram.com/p/xxx/`);
    }

    await m.react("⏳");
    try {
      const res = await igdl(url);
      if (!res || !res.status || !res.result || res.result.downloadUrl.length === 0) {
        await m.react("❌");
        return await m.reply(`Gagal mengunduh media: ${res.message || "Tidak ditemukan"}`);
      }

      for (const mediaUrl of res.result.downloadUrl) {
        if (mediaUrl.includes(".mp4")) {
          await conn.sendMessage(jid, { video: { url: mediaUrl }, caption: res.result.metadata.caption }, { quoted: m });
        } else {
          await conn.sendMessage(jid, { image: { url: mediaUrl }, caption: res.result.metadata.caption }, { quoted: m });
        }
      }
      await m.react("✅");
    } catch (err) {
      console.error(err);
      await m.react("❌");
      await m.reply(`Terjadi kesalahan sistem:\n${err.message}`);
    }
  }
};