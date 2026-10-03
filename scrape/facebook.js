import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

class FBDownloader {
  constructor() {
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
      'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
    };
  }

  async getVideoInfo(url) {
    try {
      console.log('🔍 Mengambil data dari Facebook...');
      let requestUrl = url;
      const response = await axios.get(requestUrl, { 
        headers: this.headers,
        maxRedirects: 10,
        validateStatus: (status) => status < 500
      });

      const html = response.data;
      const $ = cheerio.load(html);

      let title = $('title').first().text().trim() || 
            $('meta[property="og:title"]').attr('content') || 
            'Facebook Video';

      title = title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100);

      let hdUrl = $('meta[property="og:video"]').attr('content') || 
                  $('meta[property="og:video:secure_url"]').attr('content');
      let sdUrl = null;

      $('script').each((_, el) => {
        const scriptContent = $(el).html() || '';
        if (scriptContent.includes('hd_src') || scriptContent.includes('sd_src')) {
          const hdMatch = scriptContent.match(/"hd_src":"([^"]+)"/) || scriptContent.match(/"hd_src_no_rtt":"([^"]+)"/);
          const sdMatch = scriptContent.match(/"sd_src":"([^"]+)"/) || scriptContent.match(/"sd_src_no_rtt":"([^"]+)"/);
          
          if (hdMatch) hdUrl = hdMatch[1].replace(/\\u0026/g, '&');
          if (sdMatch) sdUrl = sdMatch[1].replace(/\\u0026/g, '&');
        }
      });

      if (!hdUrl && !sdUrl) {
        const videoMatch = html.match(/"(https?:\/\/[^"]+\.mp4[^"]*)"/i);
        if (videoMatch) hdUrl = videoMatch[1];
      }

      const downloadUrl = hdUrl || sdUrl;
      const quality = hdUrl ? 'HD' : (sdUrl ? 'SD' : null);

      const result = {
        success: true,
        title: title,
        hd: hdUrl,
        sd: sdUrl,
        downloadUrl: downloadUrl,
        quality: quality,
        originalUrl: url,
        timestamp: new Date().toISOString()
      };

      console.log('\n📊 INFO VIDEO:');
      console.log(JSON.stringify(result, null, 2));

      return result;
    } catch (error) {
      console.error('❌ Error scrape:', error.message);
      const errorResult = { success: false, error: error.message };
      console.log('\n📊 INFO VIDEO:');
      console.log(JSON.stringify(errorResult, null, 2));
      return errorResult;
    }
  }

  async download(url) {
    const info = await this.getVideoInfo(url);
    
    if (!info.success || !info.downloadUrl) {
      console.log('❌ Gagal mendapatkan link download.');
      return;
    }

    const outputDir = './downloads';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const cleanTitle = info.title.replace(/[^a-zA-Z0-9\s]/g, '').trim().substring(0, 60);
    const fileName = `${cleanTitle}_${info.quality}.mp4`;
    const outputPath = path.join(outputDir, fileName);

    console.log(`\n⬇️  Downloading ${info.quality} quality...`);
    console.log(`📁 ${outputPath}`);

    try {
      const response = await axios({
        method: 'GET',
        url: info.downloadUrl,
        responseType: 'stream',
        headers: { 'User-Agent': this.headers['User-Agent'] }
      });

      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log('✅ Download selesai!');
          resolve();
        });
        writer.on('error', reject);
      });
    } catch (err) {
      console.error('❌ Download gagal:', err.message);
    }
  }
}

export const fbdown = async (url) => {
  const downloader = new FBDownloader();
  return await downloader.getVideoInfo(url);
};

export { FBDownloader };