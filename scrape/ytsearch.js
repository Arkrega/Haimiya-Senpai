/**
 * YouTube Search + Downloader
 * Creator: IzzXd
 * Base: https://www.youtube.com
 * Saluran: https://whatsapp.com/channel/0029VbCv97v9Bb5tC5cZFl0K
 * Note: req scrape bawa url
 */
import axios from "axios";

const YT = "https://www.youtube.com";
const CNV = "https://cnv.cx/v2";
const FRAME = "https://frame.y2meta-uk.com";
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const FALLBACK = {
  key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
  version: "2.20261002.10.00",
};
const META = {
  Creator: "IzzXd",
  Saluran: "https://whatsapp.com/channel/0029VbCv97v9Bb5tC5cZFl0K",
};

const yt = axios.create({
  timeout: 30000,
  headers: {
    "User-Agent": UA,
    "Content-Type": "application/json",
    Origin: YT,
    Referer: YT + "/",
  },
});

const cnv = axios.create({
  timeout: 30000,
  headers: {
    "User-Agent": UA,
    Referer: FRAME + "/",
    Origin: FRAME,
  },
});

async function getConfig() {
  try {
    const res = await axios.get(YT + "/?hl=en", {
      timeout: 10000,
      headers: { "User-Agent": UA, Cookie: "CONSENT=YES+1; SOCS=CAI" },
    });
    const html = String(res.data);
    const key = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
    const version = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/);
    return {
      key: key ? key[1] : FALLBACK.key,
      version: version ? version[1] : FALLBACK.version,
    };
  } catch {
    return FALLBACK;
  }
}

const text = (o) => (o ? o.simpleText || (o.runs ? o.runs.map((r) => r.text).join("") : null) : null) || null;

function collect(node, out) {
  if (Array.isArray(node)) {
    for (const n of node) collect(n, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  if (node.videoRenderer) out.push(node.videoRenderer);
  for (const k in node) {
    if (k !== "videoRenderer") collect(node[k], out);
  }
}

function mapVideo(v) {
  const owner = v.ownerText && v.ownerText.runs ? v.ownerText.runs[0] : null;
  const path = owner && owner.navigationEndpoint && owner.navigationEndpoint.browseEndpoint
    ? owner.navigationEndpoint.browseEndpoint.canonicalBaseUrl
    : null;
  const snippet = v.detailedMetadataSnippets && v.detailedMetadataSnippets[0]
    ? text(v.detailedMetadataSnippets[0].snippetText)
    : null;
  return {
    videoId: v.videoId,
    title: text(v.title),
    url: `https://www.youtube.com/watch?v=${v.videoId}`,
    duration: text(v.lengthText),
    views: text(v.viewCountText),
    published: text(v.publishedTimeText),
    description: snippet || text(v.descriptionSnippet),
    channel: {
      name: text(v.ownerText),
      url: path ? YT + path : null,
      verified: (v.ownerBadges || []).some((b) => /VERIFIED/i.test((b.metadataBadgeRenderer || {}).style || "")),
    },
    thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
  };
}

export async function search(query) {
  const cfg = await getConfig();
  const res = await yt.post(
    `${YT}/youtubei/v1/search?key=${cfg.key}&prettyPrint=false`,
    {
      context: {
        client: {
          clientName: "WEB",
          clientVersion: cfg.version,
          hl: "id",
          gl: "ID",
        },
      },
      query,
      params: "EgIQAQ==",
    },
    {
      headers: {
        "X-Youtube-Client-Name": "1",
        "X-Youtube-Client-Version": cfg.version,
      },
    }
  );
  const found = [];
  collect(res.data, found);
  const seen = new Set();
  const results = [];
  for (const v of found) {
    if (!v.videoId || seen.has(v.videoId)) continue;
    seen.add(v.videoId);
    results.push(mapVideo(v));
  }
  if (!results.length) throw new Error("Hasil tidak ditemukan");
  return { query, total: results.length, results };
}

function extractVideoId(input) {
  const s = String(input).trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function getKey(videoId) {
  const res = await cnv.get(`${CNV}/sanity/key?id=${videoId}`);
  return res.data.key;
}

async function convert(key, videoId, format, videoQuality, audioBitrate) {
  const res = await cnv.post(
    `${CNV}/converter`,
    new URLSearchParams({
      link: `https://youtu.be/${videoId}`,
      format,
      audioBitrate: String(audioBitrate),
      videoQuality: String(videoQuality),
      filenameStyle: "pretty",
      vCodec: "h264",
    }).toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        accept: "*/*",
        key,
      },
    }
  );
  return { url: (res.data && res.data.url) || null, filename: (res.data && res.data.filename) || null };
}

async function getTitle(videoId) {
  try {
    const res = await axios.get(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    return res.data.title;
  } catch {
    return "Unknown";
  }
}

export async function download(input) {
  const videoId = extractVideoId(input);
  if (!videoId) throw new Error("Video ID tidak valid");

  const [title, key] = await Promise.all([getTitle(videoId), getKey(videoId)]);

  const mp4Qualities = [1080, 720, 360, 240, 144];
  const mp3Qualities = [320, 256, 128];

  const [mp4, mp3] = await Promise.all([
    Promise.all(
      mp4Qualities.map(async (q) => {
        const { url, filename } = await convert(key, videoId, "mp4", q, 128).catch(() => ({ url: null, filename: null }));
        return { quality: `${q}p`, format: "mp4", url, filename };
      })
    ),
    Promise.all(
      mp3Qualities.map(async (q) => {
        const { url, filename } = await convert(key, videoId, "mp3", 720, q).catch(() => ({ url: null, filename: null }));
        return { quality: `${q}kbps`, format: "mp3", url, filename };
      })
    ),
  ]);

  return { videoId, title, url: `https://www.youtube.com/watch?v=${videoId}`, mp4, mp3, meta: META };
}