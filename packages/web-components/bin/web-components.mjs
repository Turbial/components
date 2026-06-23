#!/usr/bin/env node
// bin/web-components.mjs — CLI entrypoint
//
// Usage:
//   npx github:Turbial/web-components --source https://example.com
//   npx github:Turbial/web-components --source https://example.com --out result.json
//   npx github:Turbial/web-components --source https://example.com --name "Biz Name" --out result.json
//
// Options:
//   --source   URL to extract (required)
//   --name     Business/entity name (optional, injected into output)
//   --out      Output JSON path (default: stdout)
//   --colors   Only extract color palette (skip full extraction)

import { extractPage } from '../lib/extract.mjs';
import { extractColorsFromUrl } from '../lib/colors.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? true : arr[i + 1]]);
    return acc;
  }, [])
);

async function main() {
  const source = args.source || args.url || args.src;
  if (!source || source === true) {
    console.error('Usage: web-components --source <url> [--name "Biz Name"] [--out result.json] [--colors]');
    process.exit(2);
  }

  const outPath = args.out;
  const businessName = args.name || null;
  const colorsOnly = !!args.colors;

  try {
    let result;

    if (colorsOnly) {
      const colors = await extractColorsFromUrl(source);
      result = {
        source: source,
        name: businessName,
        colors,
        extractedAt: new Date().toISOString(),
        note: 'Colors only mode',
      };
    } else {
      const page = await extractPage(source);
      result = {
        source: source,
        name: businessName || page.title,
        title: page.title,
        description: page.description,
        url: page.url,
        canonical: page.canonical,
        favicon: page.favicon,
        ogImage: page.ogImage,
        colors: page.colors,
        webFonts: page.webFonts,
        hero: page.hero,
        images: page.images,
        headings: page.headings,
        snippets: page.snippets,
        blockCount: page.blockCount,
        extractedAt: page.extractedAt,
      };
    }

    const json = JSON.stringify(result, null, 2);

    if (outPath && outPath !== true) {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(outPath, json);
      console.error(`Written ${outPath} (${json.length} bytes)`);
    } else {
      console.log(json);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
