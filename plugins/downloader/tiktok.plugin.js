import { tiktokDl } from "../../scrape/tiktok.js";
import { Carousel, Button } from "../../utils/MessageBuilderV4.7.js";

export default {
  name: "TikTok Downloader",
  command: ["tt", "tiktok", "ttdl"],
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Download video atau foto slide TikTok",
  category: "downloader",
  async run(conn, m, { jid, args, usedPrefix, command }) {
    const url = args[0];
    if (!url) {
      return await m.reply(`Format salah!\n\nContoh penggunaan:\n> ${usedPrefix + command} https://vt.tiktok.com/xxxx/`);
    }

    await m.react("⏳");

    try {
      const res = await tiktokDl(url);
      
      if (!res.status) {
        await m.react("❌");
        return await m.reply(res.msg || "Gagal mengunduh media dari tautan tersebut.");
      }

      const isPhotoSlide = res.data.some(v => v.type === 'photo');
      const captionText = res.title || "TikTok Media";

      if (isPhotoSlide) {
        const slides = res.data.filter(v => v.type === 'photo');
        
        for (let i = 0; i < slides.length; i += 10) {
          const chunk = slides.slice(i, i + 10);
          const carousel = new Carousel(conn)
            .setBody(i === 0 ? captionText : "Lanjutan slide TikTok...")
            .setFooter("Swipe untuk melihat foto ➡️");

          for (const [index, slide] of chunk.entries()) {
            const card = await new Button(conn)
              .setImage(slide.url)
              .setBody(`Slide ${i + index + 1} dari ${slides.length}`)
              .addUrl("Buka Original", slide.url)
              .toCard();

            carousel.addCard(card);
          }

          await carousel.send(jid, { quoted: m });
        }

      } else {
        const videoData = res.data.find(v => v.type === 'nowatermark_hd') || 
                          res.data.find(v => v.type === 'nowatermark') || 
                          res.data[0];

        await conn.sendMessage(jid, { 
          video: { url: videoData.url }, 
          caption: captionText 
        }, { quoted: m });
      }

      if (res.music_info?.url) {
        await conn.sendMessage(jid, { 
          audio: { url: res.music_info.url }, 
          mimetype: "audio/mp4" 
        }, { quoted: m });
      }

      await m.react("✅");

    } catch (err) {
      await m.react("❌");
      await m.reply("Terjadi kesalahan sistem saat memproses tautan TikTok.");
    }
  }
};