// lib/colors.mjs — Extract brand color palette from a URL
//
// Crawls the page CSS and returns the most prominent brand-appropriate colors
// as { primary, accent, background, text }. No API key, no LLM — pure heuristics.

import * as cheerio from 'cheerio';

const JUNK_PREFIXES = /^(logo|icon|badge|sprite|pixel|avatar|thumb)/i;
const GRAY_RE = /^#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3$/i;
const GRAY6_RE = /^#([0-9a-f]{2})\1([0-9a-f]{2})\2([0-9a-f]{3})\3|^#([0-9a-f])\4([0-9a-f])\5([0-9a-f])\6$/i;

function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return (max - min) / (1 - Math.abs(2 * l - 1));
}

function isGray(hex) {
  return hex.length === 4 ? GRAY_RE.test(hex) : GRAY6_RE.test(hex);
}

function isBrandColor(hex) {
  const sat = saturation(hex);
  const lum = luminance(hex);
  if (isGray(hex)) return false;            // pure grey — skip
  if (sat < 0.15) return false;             // near-grey — skip
  if (lum < 0.06 || lum > 0.94) return false; // near-black or near-white — skip
  return true;
}

function pickBackgroundColor(cssText, bodyBg) {
  // If body/background explicitly set, use it
  const bgMatch = cssText.match(/body\s*\{[^}]*background(?:-color)?\s*:\s*(#[0-9a-f]{3,6})\b/i)
    || cssText.match(/background(?:-color)?\s*:\s*(#[0-9a-f]{3,6})\b/i);
  if (bgMatch) {
    const h = expandHex(bgMatch[1]);
    if (luminance(h) > 0.85) return h;
  }
  return '#ffffff';
}

function expandHex(hex) {
  if (hex.length === 4) {
    return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  return hex.toLowerCase();
}

/**
 * Extract brand color palette from an HTML page.
 * @param {string} html - Full page HTML
 * @param {string} baseUrl - The page URL (for resolving relative paths, not used directly)
 * @returns {{ primary: string|null, accent: string|null, background: string|null }} or null
 */
export function extractColors(html) {
  const $ = cheerio.load(html);
  const cssBlocks = [];

  $('style').each((_, el) => {
    const text = $(el).text().trim();
    if (text) cssBlocks.push(text);
  });

  $('[style]').each((_, el) => {
    const text = $(el).attr('style').trim();
    if (text) cssBlocks.push(text);
  });

  const all = [];
  const hexRe = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;
  const rgbRe = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi;
  const cssText = cssBlocks.join('\n');

  for (const block of cssBlocks) {
    for (const m of block.matchAll(hexRe)) {
      all.push(expandHex(m[0]));
    }
    for (const m of block.matchAll(rgbRe)) {
      const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
      const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
      all.push(hex);
    }
  }

  // Filter to brand colors only
  const brand = all.filter(isBrandColor);

  // Frequency sort (most common first)
  const freq = new Map();
  for (const c of brand) freq.set(c, (freq.get(c) || 0) + 1);
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);

  if (!sorted.length) return null;

  // Primary = darkest brand color (nav/header)
  const byLum = [...sorted].sort((a, b) => luminance(a) - luminance(b));
  const primary = byLum[0];
  const accent = sorted.find(c => c !== primary && saturation(c) > 0.3) || byLum[byLum.length - 1] || null;
  const background = pickBackgroundColor(cssText);

  return { primary, accent, background };
}

/**
 * Quick one-shot: fetch a URL and extract colors.
 * @param {string} url
 * @returns {Promise<{ primary, accent, background }|null>}
 */
export async function extractColorsFromUrl(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; web-components/1.0)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const html = await res.text();
  const colors = extractColors(html);
  if (colors) colors.url = url;
  return colors;
}
