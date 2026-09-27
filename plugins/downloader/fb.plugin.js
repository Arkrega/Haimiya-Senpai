import axios from 'axios';
import { fbdown } from "../../scrape/facebook.js";

export default {
  name: "Facebook Downloader",
  command: ["fb", "fbdl", "facebook", "facebookdl"],
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Download video dari Facebook",
  category: "downloader",
  async run(conn, m, { jid, args, usedPrefix, command }) {
    const text = args.join(" ");
    
    if (!text) {
      return await m.reply(`Contoh: ${usedPrefix}${command} https://www.facebook.com/watch?v=1234567890`);
    }

    if (!text.includes('facebook.com') && !text.includes('fb.watch')) {
      return await m.reply('✳️ Link Facebook tidak valid');
    }

    await conn.sendMessage(jid, {
      react: {
        text: '🔍',
        key: m.key
      }
    });

    try {
      const fbData = await fbdown(text);

      if (!fbData || !fbData.status) {
        return await m.reply('❌ Gagal mengunduh video Facebook');
      }

      const hdUrl = fbData.HD;
      const normalUrl = fbData.Normal_video;
      const videoUrl = hdUrl || normalUrl;

      if (!videoUrl) {
        return await m.reply('❌ URL video tidak ditemukan');
      }

      await conn.sendMessage(jid, {
        react: {
          text: '⏬',
          key: m.key
        }
      });

      const videoRes = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.facebook.com/'
        }
      });

      const videoBuffer = Buffer.from(videoRes.data);
      const kualitas = hdUrl ? 'HD' : 'Normal';

      const caption = `✅ *Facebook Video Downloader*\n\n` +
                     `🎥 *Kualitas:* ${kualitas}\n` +
                     `📦 *Ukuran:* ${(videoBuffer.length / (1024 * 1024)).toFixed(2)} MB\n` +
                     `👨‍💻 *Developer:* ${fbData.developer || '@prm2.0'}\n\n` +
                     `📌 *Note:* Jika video tidak bisa diputar, coba download ulang`;

      await conn.sendMessage(jid, {
        video: videoBuffer,
        caption: caption,
        contextInfo: {
          externalAdReply: {
            title: "Facebook Video",
            body: `Kualitas: ${kualitas}`,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: m });

      if (hdUrl && normalUrl) {
        await conn.sendMessage(jid, {
          text: `📌 *Info:* Tersedia juga video kualitas *Normal*\nKetik *${usedPrefix}fbnorm ${text}* untuk download kualitas normal`
        }, { quoted: m });
      }

      await conn.sendMessage(jid, {
        react: {
          text: '✅',
          key: m.key
        }
      });

    } catch (error) {
      console.error('Error:', error);
      await conn.sendMessage(jid, {
        react: {
          text: '❌',
          key: m.key
        }
      });
      await m.reply('❌ Terjadi kesalahan: ' + error.message);
    }
  }
};