import axios from 'axios';
import * as cheerio from 'cheerio';

export async function fbdown(url) {
    try {
        const { data } = await axios.post(
            'https://getmyfb.com/process',
            new URLSearchParams({ id: url, locale: 'en' }),
            {
                headers: {
                    'HX-Request': 'true',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Origin': 'https://getmyfb.com',
                    'Referer': 'https://getmyfb.com/'
                }
            }
        );

        const $ = cheerio.load(data);
        const hd = $('a[href*="dl="]:contains("HD")').attr('href');
        const sd = $('a[href*="dl="]:contains("SD")').attr('href');

        if (!hd && !sd) {
            return { status: false };
        }

        return {
            status: true,
            HD: hd || null,
            Normal_video: sd || null,
            developer: '@prm2.0'
        };
    } catch (e) {
        return { status: false, msg: e.message };
    }
}