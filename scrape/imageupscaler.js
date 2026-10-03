import axios from "axios";

const _base = "https://imageupscaler.com";
const _ajax = `${_base}/wp-admin/admin-ajax.php`;

const _hdrs = (extra = {}) => ({
  "accept": "*/*",
  "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "cache-control": "no-cache",
  "pragma": "no-cache",
  "priority": "u=1, i",
  "sec-ch-ua": "\"Mises\";v=\"141\", \"Not?A_Brand\";v=\"8\", \"Chromium\";v=\"141\"",
  "sec-ch-ua-mobile": "?1",
  "sec-ch-ua-platform": "\"Android\"",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
  ...extra,
});

const _session = async () => {
  const res = await axios.get(`${_base}/upscale-image-4x/`, {
    headers: _hdrs({ referer: _base }),
  });
  const m = res.data.match(/name="process_nonce"\s+value="([^"]+)"/);
  if (!m) throw new Error("nonce not found");

  const pidMatch = res.data.match(/["\s]pid["']?\s*[:=]\s*["']?([0-9]{20,35})/);
  const pid = pidMatch ? pidMatch[1] : null;

  const cookies = res.headers["set-cookie"]?.map(c => c.split(";")[0]).join("; ") ?? "";
  return { nonce: m[1], cookies, pid };
};

const _pid = () => {
  const a = Date.now().toString();
  const b = Math.random().toString().slice(2).padEnd(20, "0");
  return (a + b).slice(0, 30);
};

export async function upscaleImage(buffer, mimeType = "image/jpeg", scale = "4x", filename = "image.jpg") {
  const increase = (scale === "2" || scale === "2x") ? "2" : "4";
  const fileId = `${Date.now()}_${filename}`;
  
  const { nonce, cookies, pid: pagePid } = await _session();
  const pid = pagePid ?? _pid();

  const b64Data = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const mediaData = JSON.stringify([{
    fileSrc: b64Data,
    fileName: filename,
    fileId,
  }]);

  const parameters = JSON.stringify({
    "upscale-type": "standard",
    increase,
    "save-format": "auto",
  });

  const body = new URLSearchParams({
    action: "processing_images_adv",
    nonce,
    pid,
    function: "upscale-image-4x",
    batch_number: "1",
    total_batches: "1",
    mediaData,
    parameters,
  });

  const { data } = await axios.post(_ajax, body.toString(), {
    headers: _hdrs({
      "content-type": "application/x-www-form-urlencoded",
      "referer": `${_base}/upscale-image-4x/`,
      ...(cookies ? { cookie: cookies } : {}),
    }),
  });

  if (!data.success || !data.data?.items?.length) {
    throw new Error(data.message || "Failed to upscale image");
  }

  const item = data.data.items[0];
  const { data: imgBuffer } = await axios.get(item.url, { responseType: "arraybuffer" });
  
  return {
    buffer: Buffer.from(imgBuffer),
    url: item.url,
    name: item.name,
    credits: data.data.remainingCredits
  };
}