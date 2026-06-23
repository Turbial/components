#!/usr/bin/env node
// mirror.mjs — Pre-download component registry entries into a local cache
// directory so that fetch.mjs --cachedir can work from sandboxed runtimes.
//
// Usage:
//   node mirror.mjs --source shadcn --names button,card,input,label --cachedir ./registry-cache
//   node mirror.mjs --source hyperui --names marketing/ctas/1,dashboard/01 --cachedir ./registry-cache
//   node mirror.mjs --source magicui --names marquee,meteors --cachedir ./registry-cache
//
// The cache dir mirrors the fetch.mjs --cachedir layout:
//   <cachedir>/<source>/<name>.json   (registries)
//   <cachedir>/<source>/<name>.html   (hyperui)

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULTS = {
  shadcn: { type: 'registry', urlTemplate: 'https://ui.shadcn.com/r/styles/default/{name}.json' },
  magicui: { type: 'registry', urlTemplate: 'https://magicui.design/r/{name}.json' },
  '21st': { type: 'registry', urlTemplate: 'https://21st.dev/r/{name}' },
  hyperui: { type: 'hyperui', urlTemplate: 'https://www.hyperui.dev/examples/{name}.html' },
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { args[key] = next; i++; }
      else { args[key] = true; }
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { source, names, cachedir } = args;
  if (!source || !names || !cachedir) {
    console.error('Usage: node mirror.mjs --source <source> --names <comma,sep> --cachedir <dir>');
    process.exit(2);
  }
  const cfg = DEFAULTS[source];
  if (!cfg) { console.error(`Unknown source. Valid: ${Object.keys(DEFAULTS).join(', ')}`); process.exit(2); }

  const outDir = path.resolve(cachedir, source);
  await mkdir(outDir, { recursive: true });
  const ext = source === 'hyperui' ? '.html' : '.json';

  const nameList = names.split(',').map(n => n.trim()).filter(Boolean);
  let ok = 0, fail = 0;
  for (const name of nameList) {
    const url = cfg.urlTemplate.replace('{name}', name);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'component-fetch-mirror/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const body = await res.text();
      const outPath = path.join(outDir, name + ext);
      await writeFile(outPath, body, 'utf8');
      console.error(`  ✓ ${source}/${name} → ${outPath} (${body.length} bytes)`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${source}/${name}: ${e.message}`);
      fail++;
    }
  }
  console.log(`Mirror complete: ${ok} ok, ${fail} failed, ${nameList.length} total`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
