// lib/extract.mjs — Core extraction engine
//
// Crawls a URL and extracts:
//   - Brand colors (primary, accent, background)
//   - Page title, description, favicon
//   - Image components (hero/feature images)
//   - Text blocks (headings, paragraphs, lists)
//   - CSS fonts and design tokens (first-pass)
//
// No API key required. No LLM calls. Pure headless extraction.

import * as cheerio from 'cheerio';
import { extractColors } from './colors.mjs';

const UA = 'Mozilla/5.0 (compatible; web-components/1.0)';

function cleanTitle(t) {
  return String(t || '').replace(/\s*[|–—:].*$/, '').replace(/\s*-\s+.*$/, '').trim();
}

function pickMeta($, names) {
  for (const name of names) {
    const v = $(`meta[name="${name}"], meta[property="${name}"]`).attr('content');
    if (v) return v;
  }
  return null;
}

/**
 * Extract visual components and metadata from a URL.
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.maxBlocks=60] - Max content blocks to extract
 * @param {number} [opts.maxImages=15] - Max images to extract
 * @returns {Promise<object>} Extracted components
 */
export async function extractPage(url, opts = {}) {
  const maxBlocks = opts.maxBlocks ?? 60;
  const maxImages = opts.maxImages ?? 15;

  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  // ── Metadata ──
  const title = $('title').first().text().trim();
  const description = pickMeta($, ['description', 'og:description']);
  const ogImage = pickMeta($, ['og:image']);
  const favicon = $('link[rel="icon"], link[rel="shortcut icon"]').attr('href');
  const canonical = $('link[rel="canonical"]').attr('href');

  // ── Colors ──
  const colors = extractColors(html);

  // ── Fonts ──
  const webFonts = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && /fonts?(\.googleapis|\.gstatic|\.net)/i.test(href)) {
      webFonts.push(href);
    }
  });
  // Also check @import in style blocks
  const cssText = [];
  $('style').each((_, el) => cssText.push($(el).text()));
  for (const block of cssText) {
    for (const m of block.matchAll(/@import\s+url\(['"]?(https?:\/\/[^'")\s]+fonts[^'")\s]+)['"]?\)/gi)) {
      webFonts.push(m[1]);
    }
  }

  // ── Content blocks ──
  // Remove chrome before walking the DOM
  $('script, style, noscript, nav, header, footer, iframe, form, .nav, .footer, .header').remove();

  const blocks = [];
  const seen = new Set();
  let textCount = 0, imgCount = 0;

  $('h1, h2, h3, p, li, blockquote, img[src]').each((_, el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'img') {
      if (imgCount >= maxImages) return;
      const src = cleanSrc($(el).attr('src'), url);
      const alt = $(el).attr('alt') || '';
      if (src) {
        const key = src;
        if (!seen.has(key)) {
          seen.add(key);
          blocks.push({ kind: 'image', src, alt });
          imgCount++;
        }
      }
      return;
    }

    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length < 8 || text.length > 1500) return;
    const key = tag + ':' + text;
    if (seen.has(key)) return;
    seen.add(key);

    blocks.push({
      kind: tag.startsWith('h') ? 'heading' : tag === 'li' ? 'list-item' : tag === 'blockquote' ? 'quote' : 'paragraph',
      tag,
      text,
    });
    textCount++;
    return textCount < maxBlocks;
  });

  // ── Hero image (first meaningful large image) ──
  const heroImage = blocks.find(b => b.kind === 'image');

  // ── Structure summary ──
  const headings = blocks.filter(b => b.kind === 'heading').map(b => ({ tag: b.tag, text: b.text }));
  const paragraphs = blocks.filter(b => b.kind === 'paragraph').map(b => b.text).slice(0, 10);
  const images = blocks.filter(b => b.kind === 'image').map(b => ({ src: b.src, alt: b.alt }));

  return {
    url,
    title: cleanTitle(title),
    description,
    canonical,
    favicon: favicon ? resolveUrl(favicon, url) : null,
    ogImage: ogImage || null,
    colors,
    webFonts: [...new Set(webFonts)],
    hero: heroImage ? { src: resolveUrl(heroImage.src, url), alt: heroImage.alt } : null,
    images,
    headings,
    snippets: paragraphs.slice(0, 5),
    blockCount: blocks.length,
    extractedAt: new Date().toISOString(),
  };
}

function cleanSrc(src, base) {
  if (!src) return null;
  if (src.startsWith('data:')) return null;
  try {
    return resolveUrl(src, base);
  } catch {
    return null;
  }
}

function resolveUrl(src, base) {
  if (src.startsWith('//')) return 'https:' + src;
  if (src.startsWith('http')) return src;
  const baseUrl = new URL(base);
  if (src.startsWith('/')) return baseUrl.origin + src;
  return new URL(src, base).href;
}

export default { extractPage, extractColors };
