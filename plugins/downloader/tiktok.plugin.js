import axios from "axios";
import { tiktokDl } from "../../scrape/tiktok.js";
import { Carousel, Button } from "../../utils/MessageBuilderV4.7.js";

export default {
  name: "TikTok Downloader",
  command: ["tt", "tiktok", "ttdl", "ttaudio"],
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Download video, foto slide, atau audio TikTok",
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

      if (command === "ttaudio") {
        if (!res.music_info?.url) {
            await m.react("❌");
            return await m.reply("Audio tidak ditemukan untuk tautan ini.");
        }
        const { data: audioBuffer } = await axios.get(res.music_info.url, { responseType: "arraybuffer" });
        await conn.sendMessage(jid, { audio: audioBuffer, mimetype: "audio/mp4" }, { quoted: m });
        await m.react("✅");
        return;
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
              .addReply("Ambil Musik", `${usedPrefix}ttaudio ${url}`)
              .toCard();

            carousel.addCard(card);
          }

          await carousel.send(jid, { quoted: m });
        }

      } else {
        const videoData = res.data.find(v => v.type === 'nowatermark_hd') || 
                          res.data.find(v => v.type === 'nowatermark') || 
                          res.data[0];

        const { data: videoBuffer } = await axios.get(videoData.url, {
            responseType: "arraybuffer",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        await new Button(conn)
          .setMedia({ video: videoBuffer })
          .setBody(captionText)
          .addReply("Ambil Musik", `${usedPrefix}ttaudio ${url}`)
          .send(jid, { quoted: m });
      }

      await m.react("✅");

    } catch (err) {
      await m.react("❌");
      await m.reply("Terjadi kesalahan sistem saat memproses tautan TikTok.");
    }
  }
};