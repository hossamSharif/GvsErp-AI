/**
 * Invoice PDF blob
 *
 * Turns a rendered invoice template (the same DOM used for printing) into a
 * real PDF file in the browser, for sharing. The node is rasterized with
 * html-to-image, which draws through the browser's own text engine — Arabic
 * shaping and RTL come out exactly as on screen (html2canvas breaks letter
 * joining) — and the image is laid onto A4 pages with jsPDF.
 *
 * Pages break at table-row / `.avoid-break` boundaries where possible so a
 * line item is never cut in half.
 */

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
/** Top/bottom margin on continuation pages (page 1 is full-bleed like print). */
const CONTINUATION_MARGIN_MM = 10;
const PIXEL_RATIO = 2;
const JPEG_QUALITY = 0.88;

// Font CSS is expensive to build (fetches every @font-face) — do it once.
let fontEmbedCssPromise: Promise<string> | null = null;

/** 1×1 transparent GIF; used when an image (e.g. logo) can't be fetched. */
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * Offsets (CSS px from the node's top) where a page may break without
 * cutting content: the bottom edge of every row and avoid-break block.
 */
function breakCandidates(node: HTMLElement): number[] {
  const top = node.getBoundingClientRect().top;
  const offsets = new Set<number>();
  node.querySelectorAll('tr, .avoid-break, header, footer, section').forEach((el) => {
    const rect = el.getBoundingClientRect();
    offsets.add(Math.round(rect.bottom - top));
  });
  return Array.from(offsets).sort((a, b) => a - b);
}

/** Pick slice ranges (CSS px) that fit each page, preferring clean breaks. */
function planSlices(totalHeight: number, pxPerMm: number, candidates: number[]) {
  const slices: Array<{ start: number; end: number }> = [];
  let start = 0;
  let first = true;
  // Ignore a sub-2mm remainder (rounding past min-height) instead of adding a blank page.
  while (start < totalHeight - 2 * pxPerMm) {
    const capacityMm = first ? A4_HEIGHT_MM : A4_HEIGHT_MM - CONTINUATION_MARGIN_MM * 2;
    const limit = start + capacityMm * pxPerMm;
    let end = Math.min(limit, totalHeight);
    if (end < totalHeight) {
      // Last clean break that still leaves the page at least half full.
      const clean = candidates.filter((c) => c > start + (limit - start) / 2 && c <= limit);
      if (clean.length) end = clean[clean.length - 1];
    }
    slices.push({ start, end });
    start = end;
    first = false;
  }
  return slices;
}

export async function renderInvoicePdfBlob(node: HTMLElement): Promise<Blob> {
  const [{ toCanvas, getFontEmbedCSS }, { jsPDF }] = await Promise.all([
    import('html-to-image'),
    import('jspdf'),
  ]);

  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready;
  }

  fontEmbedCssPromise ??= getFontEmbedCSS(node).catch(() => '');
  const fontEmbedCSS = await fontEmbedCssPromise;

  const width = node.offsetWidth;
  const height = node.scrollHeight;
  const candidates = breakCandidates(node);

  const canvas = await toCanvas(node, {
    pixelRatio: PIXEL_RATIO,
    backgroundColor: '#ffffff',
    width,
    height,
    fontEmbedCSS,
    imagePlaceholder: TRANSPARENT_PIXEL,
    cacheBust: false,
    // The capture host is positioned off-screen; render the clone in place.
    style: { margin: '0', boxShadow: 'none' },
  });

  const pxPerMm = width / A4_WIDTH_MM;
  const scale = canvas.width / width;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });

  planSlices(height, pxPerMm, candidates).forEach((slice, index) => {
    const sliceHeightPx = Math.round((slice.end - slice.start) * scale);
    if (sliceHeightPx <= 0) return;

    const page = document.createElement('canvas');
    page.width = canvas.width;
    page.height = sliceHeightPx;
    const ctx = page.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, page.width, page.height);
    ctx.drawImage(
      canvas,
      0, Math.round(slice.start * scale), canvas.width, sliceHeightPx,
      0, 0, canvas.width, sliceHeightPx
    );

    if (index > 0) pdf.addPage();
    const y = index === 0 ? 0 : CONTINUATION_MARGIN_MM;
    const heightMm = (slice.end - slice.start) / pxPerMm;
    pdf.addImage(page.toDataURL('image/jpeg', JPEG_QUALITY), 'JPEG', 0, y, A4_WIDTH_MM, heightMm);
  });

  return pdf.output('blob');
}

/** Base64 payload (no data: prefix) for uploading a blob as JSON. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
