import { fbdown } from "../../scrape/facebook.js";

export default {
  name: "Facebook Downloader",
  command: ["fb", "fbdl", "facebook"],
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Download video dari Facebook",
  category: "downloader",
  async run(conn, m, { jid, args, usedPrefix, command }) {
    const url = args[0];
    if (!url || (!url.includes("facebook.com") && !url.includes("fb.watch"))) {
      return await m.reply(`Masukkan URL Facebook yang valid!\nContoh: ${usedPrefix}${command} https://www.facebook.com/xxx/videos/xxx`);
    }

    await m.react("⏳");
    try {
      const res = await fbdown(url);
      
      if (!res || !res.success || !res.downloadUrl) {
        await m.react("❌");
        return await m.reply(`Gagal mengunduh media: ${res.error || "Video tidak ditemukan atau bersifat private."}`);
      }

      const captionText = res.title || "Facebook Downloader";

      await conn.sendMessage(
        jid, 
        { 
          video: { url: res.downloadUrl }, 
          caption: `*${captionText}*\nKualitas: ${res.quality}` 
        }, 
        { quoted: m }
      );
      
      await m.react("✅");
    } catch (err) {
      await m.react("❌");
      await m.reply(`Terjadi kesalahan sistem:\n${err.message}`);
    }
  }
};