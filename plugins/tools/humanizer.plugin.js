/**
 * PROJECT     : ZeroGPT Humanizer
 * AUTHOR      : BINTANG
 * CREATOR     : BINTANG
 * DESCRIPTION : Humanize AI text using ZeroGPT 
 * BASE_URL    : https://api.zerogpt.com
 * 
 * CARA PAKAI:
 * node aihumanizer.js "teks anda disini minimal 50 karakter"
 * 
 * CONTOH:
 * node aihumanizer.js "Berdasarkan analisis yang mendalam, dapat disimpulkan bahwa implementasi teknologi artificial intelligence memberikan kontribusi signifikan terhadap peningkatan efisiensi operasional perusahaan."
 */

import axios from 'axios';

export default {
    name: "ZeroGPT Humanizer",
    command: ["humanize", "humanizer"],
    owner_only: false,
    private_only: false,
    group_only: false,
    description: "Humanize AI text using ZeroGPT",
    category: "tools",
    async run(conn, m, { args, usedPrefix, command, quotedText }) {
        const teks = quotedText || args.join(' ');

        if (!teks) {
            let msg = `Format Salah!\n\n`;
            msg += `CARA PAKAI: ${usedPrefix}${command} teks anda\n\n`;
            msg += `CONTOH: ${usedPrefix}${command} Halo, ini adalah teks percobaan untuk menguji Humanizer kami. Saya ingin melihat apakah teks ini bisa di-humanize dengan baik oleh sistem`;
            return await m.reply(msg);
        }

        if (teks.length < 50) {
            return await m.reply(`❌ Teks terlalu pendek: ${teks.length} karakter (minimal 50)`);
        }

        await m.reply(`📝 Input: ${teks.length} karakter\n🔄 Memproses...`);

        try {
            const response = await axios.post('https://api.zerogpt.com/api/transform/humanize', {
                string: teks,
                skipRealtime: 1,
                humanizerReadability: 'High School',
                humanizerPurpose: 'General Writing',
                humanizerStrength: 'Balanced',
                humanizerModel: 'v11'
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/plain, */*',
                    'Origin': 'https://www.zerogpt.com',
                    'Referer': 'https://www.zerogpt.com/ai-humanizer',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36'
                }
            });

            const res = response.data;

            if (res.success) {
                await m.reply(`✅ HASIL:\n\n${res.data.output}`);
            } else {
                await m.reply(`❌ Gagal: ${res.message}`);
            }
        } catch (err) {
            await m.reply(`❌ Error: ${err.message}`);
        }
    }
};