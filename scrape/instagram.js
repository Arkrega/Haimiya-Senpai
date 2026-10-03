/**
 * instagram.js — Instagram Scraper & Downloader
 *
 * @author  Shann
 * @version 1.0.0
 *
 * Hits Instagram's internal API directly — no browser required.
 * Supports photo, video, carousel, and reels.
 *
 * DO NOT REMOVE THIS HEADER — keep credit intact when forking or modifying.
 */
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import axiosRetry from 'axios-retry';
import { fileURLToPath } from 'url';

const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');
const log = (...a) => { if (VERBOSE) process.stderr.write(a.join(' ') + '\n'); };

const _AUTHOR = 'Shann';
const _REPO   = 'code.vyrgo.cyou/shanmolvyr/instagram';

const UA_WEB = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function createClient() {
  const jar = new CookieJar();
  const client = wrapper(axios.create({
    jar,
    withCredentials: true,
    timeout: 20000,
    maxRedirects: 10,
  }));

  (axiosRetry.default ?? axiosRetry)(client, {
    retries: 3,
    retryDelay: (n) => n * 1500,
    retryCondition: (e) => !e.response || e.response.status === 429 || e.response.status >= 500,
  });

  return client;
}

function extractShortcode(input) {
  input = input.trim();
  if (!input.includes('/')) return input;
  const m = input.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

async function fetchViaHtml(client, shortcode) {
  log('⏳ Trying HTML scrape...');
  const res = await client.get(`https://www.instagram.com/p/${shortcode}/`, {
    headers: {
      'User-Agent': UA_WEB,
      'Accept': 'text/html,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
    },
    responseType: 'text',
    validateStatus: (s) => s < 500,
  });

  const html = res.data;
  log(`  → status: ${res.status}, size: ${(html.length/1024).toFixed(1)} KB`);
  if (VERBOSE) fs.writeFileSync('debug_ig.html', html);

  const blocks = [...html.matchAll(/<script[^>]*data-sjs[^>]*>({"require":\[\[.+?)<\/script>/gs)]
    .map(m => m[1]);

  log(`  → script blocks: ${blocks.length}`);

  for (const block of blocks) {
    if (!block.includes('RelayPrefetchedStreamCache')) continue;
    if (!block.includes('xig_polaris')) continue;

    try {
      const json  = JSON.parse(block);
      const bbox  = json?.require?.[0]?.[3]?.[0]?.__bbox;
      if (!bbox?.require) continue;

      for (const req of bbox.require) {
        if (req[0] !== 'RelayPrefetchedStreamCache') continue;

        const inner = req[3]?.[1]?.__bbox;
        if (!inner) continue;

        const media = inner?.result?.data?.xig_polaris_media
          || inner?.data?.xig_polaris_media;
        if (!media) continue;

        const item = media.if_not_gated_logged_out || media;
        if (!item.pk && !item.code) continue;

        log('✅ HTML scrape berhasil');
        return { item, source: 'html' };
      }
    } catch (e) {
      log(`  → parse error: ${e.message.slice(0, 60)}`);
    }
  }

  throw new Error('Tidak ada data di HTML response');
}

function normalizeItem(item) {
  const isVideo    = item.is_video || item.media_type === 2
    || item.__typename === 'GraphVideo'
    || item.__typename === 'XIGPolarisVideoMedia';
  const isCarousel = item.media_type === 8
    || item.__typename === 'GraphSidecar'
    || item.__typename === 'XIGPolarisCarouselMedia'
    || !!item.carousel_media
    || !!item.edge_sidecar_to_children;

  const owner  = item.owner || item.user || {};
  const caption = item.edge_media_to_caption?.edges?.[0]?.node?.text
    || item.caption?.text
    || item.caption
    || item.accessibility_caption
    || '';

  const takenAt = item.taken_at || item.taken_at_timestamp || null;

  const likeCount    = item.like_count    ?? item.edge_media_preview_like?.count    ?? null;
  const commentCount = item.comment_count ?? item.edge_media_to_comment?.count      ?? null;
  const viewCount    = item.view_count
    ?? item.video_view_count
    ?? item.clips_metadata?.views_count
    ?? null;

  const pad = n => String(n).padStart(2, '0');
  const postedAt = takenAt ? (() => {
    const d = new Date(Number(takenAt) * 1000);
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}.${pad(d.getMinutes())}`;
  })() : null;

  let media = [];
  if (isCarousel) {
    const children = item.carousel_media
      || item.edge_sidecar_to_children?.edges?.map(e => e.node)
      || [];
    for (const child of children) media.push(extractMedia(child));
  } else {
    media.push(extractMedia(item));
  }

  return {
    id:        item.pk || item.id || null,
    shortcode: item.code || item.shortcode || null,
    type:      isCarousel ? 'carousel' : isVideo ? 'video' : 'photo',
    caption:   typeof caption === 'string' ? caption : '',
    postedAt,
    owner: {
      id:       owner.pk || owner.id || null,
      username: owner.username || null,
      fullName: owner.full_name || null,
      avatar:   owner.profile_pic_url || null,
      verified: !!(owner.is_verified || owner.verified || owner.is_verified_by_mv4b || owner.transparency_product_enabled),
    },
    stats: { likeCount, commentCount, viewCount },
    media,
    location: item.location ? {
      name: item.location.name || null,
      id:   item.location.pk  || item.location.id || null,
    } : null,
    _author: `${_AUTHOR} — ${_REPO}`,
  };
}

function extractMedia(item) {
  const isVideo = item.is_video || item.media_type === 2 || item.__typename === 'GraphVideo';

  if (isVideo) {
    const versions = item.video_versions || [];
    const best = versions.sort((a, b) => (a.type || 0) - (b.type || 0))[0];
    const videoUrl = best?.url || item.video_url || null;
    const imgCandidates = item.image_versions2?.candidates || [];
    const bestThumb = imgCandidates.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    const thumbnail = bestThumb?.url || item.display_url || item.thumbnail_url || null;
    return {
      type:      'video',
      url:       videoUrl,
      thumbnail,
      width:     item.original_width  || item.dimensions?.width  || null,
      height:    item.original_height || item.dimensions?.height || null,
      duration:  item.video_duration  || null,
    };
  } else {
    const candidates = item.image_versions2?.candidates || [];
    const best = candidates.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    const imageUrl = best?.url || item.display_url || item.thumbnail_url || null;
    return {
      type:   'photo',
      url:    imageUrl,
      width:  best?.width  || item.original_width  || item.dimensions?.width  || null,
      height: best?.height || item.original_height || item.dimensions?.height || null,
    };
  }
}

async function scrapeInstagram(inputUrl) {
  const shortcode = extractShortcode(inputUrl);
  if (!shortcode) throw new Error('Shortcode tidak ditemukan dari URL: ' + inputUrl);
  log(`📸 Shortcode: ${shortcode}`);
  const client = createClient();
  const { item } = await fetchViaHtml(client, shortcode);
  const result = normalizeItem(item);
  return { data: result, client };
}

async function streamToFile(client, url, outputPath, label) {
  const res = await client.get(url, {
    responseType: 'stream',
    headers: { 'User-Agent': UA_WEB, 'Referer': 'https://www.instagram.com/', 'Accept': '*/*' },
    timeout: 120000,
    validateStatus: (s) => s === 200 || s === 206,
  });

  const total = parseInt(res.headers['content-length'] || '0', 10);
  let downloaded = 0, lastLog = 0;
  const writer = fs.createWriteStream(outputPath);

  await new Promise((resolve, reject) => {
    res.data.on('data', (chunk) => {
      downloaded += chunk.length;
      if (downloaded - lastLog > 512 * 1024) {
        const pct = total ? ` (${((downloaded / total) * 100).toFixed(0)}%)` : '';
        process.stderr.write(`📥 ${label} — ${(downloaded / 1024 / 1024).toFixed(1)} MB${pct}\n`);
        lastLog = downloaded;
      }
    });
    res.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
    res.data.on('error', reject);
  });

  return downloaded;
}

async function downloadMedia(data, outputArg, client) {
  if (data.type === 'carousel' || data.media.length > 1) {
    const dir = outputArg || data.shortcode;
    fs.mkdirSync(dir, { recursive: true });
    process.stderr.write(`📁 Carousel: ${data.media.length} item → ${dir}/\n`);
    for (let i = 0; i < data.media.length; i++) {
      const m    = data.media[i];
      const ext  = m.type === 'video' ? 'mp4' : 'jpg';
      const fname = `${String(i + 1).padStart(3, '0')}.${ext}`;
      const dest  = path.join(dir, fname);
      try {
        const bytes = await streamToFile(client, m.url, dest, `${i + 1}/${data.media.length}`);
        process.stderr.write(`✅ ${fname} (${(bytes / 1024).toFixed(0)} KB)\n`);
      } catch (e) {
        process.stderr.write(`⚠️  ${fname} gagal: ${e.message}\n`);
      }
    }
    return dir;
  } else {
    const m   = data.media[0];
    const ext = m.type === 'video' ? 'mp4' : 'jpg';
    const out = outputArg || `${data.shortcode}.${ext}`;
    process.stderr.write(`⬇️  Download: ${out}\n`);
    const bytes = await streamToFile(client, m.url, out, path.basename(out));
    process.stderr.write(`✅ ${out} (${(bytes / 1024 / 1024).toFixed(2)} MB)\n`);
    return out;
  }
}

function printHelp() {
  console.log(`
instagram.js — Instagram Scraper & Downloader by Shann (${_REPO})

Usage:
  node instagram.js <url>              metadata only (JSON output)
  node instagram.js <url> -d           download media
  node instagram.js <url> -d <output>  download to custom name/path
  node instagram.js <url> -v           verbose logging
`.trim());
}

async function main() {
  const args = process.argv.slice(2).filter(a => a !== '-v' && a !== '--verbose');
  if (!args[0] || args[0] === '--help') { printHelp(); process.exit(0); }

  const inputUrl   = args[0];
  const doDownload = args.includes('-d') || args.includes('--download');
  const dIdx       = args.findIndex(a => a === '-d' || a === '--download');
  const outputArg  = (dIdx !== -1 && args[dIdx + 1] && !args[dIdx + 1].startsWith('-'))
    ? args[dIdx + 1] : null;

  try {
    const { data, client } = await scrapeInstagram(inputUrl);
    if (doDownload) data.downloadedTo = await downloadMedia(data, outputArg, client);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

export { scrapeInstagram, downloadMedia };
if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) main();