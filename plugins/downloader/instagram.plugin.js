import { scrapeInstagram } from "../../scrape/instagram.js";

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
      const { data } = await scrapeInstagram(url);
      
      if (!data || !data.media || data.media.length === 0) {
        await m.react("❌");
        return await m.reply("Gagal mengunduh media: Data tidak ditemukan atau akun di-private.");
      }

      const captionText = data.caption || `Instagram Post by @${data.owner?.username || 'Unknown'}`;

      for (let i = 0; i < data.media.length; i++) {
        const media = data.media[i];
        const isVideo = media.type === "video";
        
        const content = isVideo 
          ? { video: { url: media.url } } 
          : { image: { url: media.url } };

        if (i === 0) {
          content.caption = captionText;
        }

        await conn.sendMessage(jid, content, { quoted: m });
      }
      
      await m.react("✅");
    } catch (err) {
      await m.react("❌");
      await m.reply(`Terjadi kesalahan sistem:\n${err.message}`);
    }
  }
};