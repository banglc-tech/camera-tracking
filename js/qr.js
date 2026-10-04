/* Mã QR cá nhân: tạo (qrcode-generator) và quét (BarcodeDetector, dự phòng jsQR). */
const QR = (() => {
  const GEN = ['https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', 'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js'];
  const SCAN = ['https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js', 'https://unpkg.com/jsqr@1.4.0/dist/jsQR.js'];
  const PREFIX = 'CT1:';

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = resolve; s.onerror = () => reject(new Error('Không tải được ' + src));
      document.head.appendChild(s);
    });
  }
  async function loadAny(list, ready) {
    if (ready()) return;
    let err = null;
    for (const src of list) { try { await loadScript(src); if (ready()) return; } catch (e) { err = e; } }
    throw err || new Error('Không tải được thư viện QR');
  }

  async function ensureGenerator() { await loadAny(GEN, () => typeof window.qrcode === 'function'); }

  let detector = null, scanReady = false, scanning = false;
  async function ensureScanner() {
    if (scanReady) return;
    if ('BarcodeDetector' in window) {
      try {
        const fmts = await window.BarcodeDetector.getSupportedFormats();
        if (fmts.includes('qr_code')) { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); scanReady = true; return; }
      } catch (e) { /* dùng jsQR */ }
    }
    await loadAny(SCAN, () => typeof window.jsQR === 'function');
    scanReady = true;
  }

  const work = document.createElement('canvas');
  const wctx = work.getContext('2d', { willReadFrequently: true });
  /** Quét một khung hình; trả về chuỗi QR hoặc null. Không chạy chồng. */
  async function scan(video) {
    if (!scanReady || scanning || !video.videoWidth) return null;
    scanning = true;
    try {
      if (detector) {
        const codes = await detector.detect(video);
        return codes.length ? codes[0].rawValue : null;
      }
      const scale = Math.min(1, 640 / video.videoWidth);
      work.width = Math.round(video.videoWidth * scale); work.height = Math.round(video.videoHeight * scale);
      wctx.drawImage(video, 0, 0, work.width, work.height);
      const img = wctx.getImageData(0, 0, work.width, work.height);
      const r = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      return r ? r.data : null;
    } catch (e) { return null; }
    finally { scanning = false; }
  }

  /** Nội dung QR của nhân viên. */
  const encode = (emp) => `${PREFIX}${emp.id}:${emp.qrKey}`;
  /** Giải mã; trả về {id, key} hoặc null. */
  function decode(text) {
    if (!text || !text.startsWith(PREFIX)) return null;
    const [id, key] = text.slice(PREFIX.length).split(':');
    return id && key ? { id, key } : null;
  }

  /** Vẽ QR ra ảnh PNG (data URL). */
  function toDataURL(text, size = 360) {
    const q = window.qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), margin = 24;
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
    const cell = (size - margin * 2) / n;
    ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
      if (q.isDark(r, col)) ctx.fillRect(margin + col * cell, margin + r * cell, Math.ceil(cell), Math.ceil(cell));
    }
    return c.toDataURL('image/png');
  }

  return { ensureGenerator, ensureScanner, scan, encode, decode, toDataURL, get scanReady() { return scanReady; } };
})();
