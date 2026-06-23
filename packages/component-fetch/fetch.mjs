#!/usr/bin/env node
// Universal component fetcher: pulls a component/block from a registry-style
// source (shadcn, magicui, 21st.dev) or a plain-HTML source (hyperui) and
// writes the raw source + a manifest.json to disk. Adapting the fetched
// code to a target site's stack (Handlebars, React, plain HTML, etc.) is a
// separate step performed by whoever calls this tool.
//
// Supports offline/local mode via --cachedir and --registry for sandboxed
// runtimes that can't reach component CDNs directly.
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';

// Retryable fetch with browser-ish User-Agent and exponential backoff.
// Some registries sit behind Vercel/Cloudflare bot protection that 403s
// bare requests, so we pretend to be a real-ish browser and retry.
const UA = 'Mozilla/5.0 (compatible; component-fetch/1.0; +https://github.com/Turbial/component-fetch)';
const MAX_RETRIES = 4;
const BACKOFF_MS = [500, 1000, 2000, 4000];

async function fetchWithRetry(url, opts, attempt = 0) {
  const res = await fetch(url, opts);
  if (res.ok) return res;
  // Retry on 403, 429, or any 5xx
  if ((res.status === 403 || res.status === 429 || (res.status >= 500 && res.status < 600)) && attempt < MAX_RETRIES - 1) {
    const wait = BACKOFF_MS[attempt];
    console.error(`  fetch ${res.status} ${url} — retrying in ${wait}ms (attempt ${attempt + 2}/${MAX_RETRIES})`);
    await new Promise(r => setTimeout(r, wait));
    return fetchWithRetry(url, opts, attempt + 1);
  }
  // On final failure, grab a snippet of the response body for debugging
  let bodySnippet = '';
  try {
    const text = await res.text();
    bodySnippet = text.slice(0, 300);
  } catch {}
  const indented = bodySnippet.replace(/\n/g, '\n  ');
  throw new Error('fetch failed ' + res.status + ': ' + url + '\n  Response: ' + indented);
}

const DEFAULTS = {
  shadcn: { type: 'registry', urlTemplate: 'https://ui.shadcn.com/r/styles/default/{name}.json' },
  magicui: { type: 'registry', urlTemplate: 'https://magicui.design/r/{name}.json' },
  '21st': { type: 'registry', urlTemplate: 'https://21st.dev/r/{name}' },
  hyperui: { type: 'hyperui', urlTemplate: 'https://www.hyperui.dev/examples/{name}.html' },
};

// Allow overriding source URL templates via --registry so the tool works
// from sandboxed runtimes that can reach GitHub raw but not shadcn.
const REGISTRY_OVERRIDES = { shadcn: null, magicui: null, '21st': null, hyperui: null };

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

const FETCH_JSON_OPTS = { headers: { 'User-Agent': UA, Accept: 'application/json' } };
const FETCH_TEXT_OPTS = { headers: { 'User-Agent': UA } };

async function fetchJson(url) {
  const res = await fetchWithRetry(url, FETCH_JSON_OPTS);
  return res.json();
}

async function fetchText(url) {
  const res = await fetchWithRetry(url, FETCH_TEXT_OPTS);
  return res.text();
}

function sourceUrl(source, name) {
  if (name.startsWith('http')) return name;
  const template = REGISTRY_OVERRIDES[source] || DEFAULTS[source].urlTemplate;
  return template.replace('{name}', name);
}

async function writeRegistryFiles(item, outDir) {
  for (const file of item.files || []) {
    const dest = path.join(outDir, 'files', file.path.replace(/^\//, ''));
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, file.content ?? '', 'utf8');
  }
}

async function resolveRegistry(source, name, visited, outDir) {
  if (visited.has(name)) return null;
  visited.add(name);
  const url = sourceUrl(source, name);
  const item = await fetchJson(url);
  await writeRegistryFiles(item, outDir);

  const dependencies = item.dependencies || [];
  const registryDependencies = item.registryDependencies || [];
  const children = [];
  for (const dep of registryDependencies) {
    const child = await resolveRegistry(source, dep, visited, outDir);
    if (child) children.push(child);
  }

  return {
    name: item.name ?? name,
    type: item.type,
    description: item.description,
    dependencies,
    registryDependencies,
    files: (item.files || []).map(f => f.path),
    children,
  };
}

async function runRegistry(source, name, outDir) {
  const visited = new Set();
  const tree = await resolveRegistry(source, name, visited, outDir);

  const npmDependencies = new Set();
  (function collect(node) {
    if (!node) return;
    for (const d of node.dependencies) npmDependencies.add(d);
    for (const c of node.children) collect(c);
  })(tree);

  const manifest = {
    source,
    name,
    fetchedAt: new Date().toISOString(),
    npmDependencies: [...npmDependencies].sort(),
    componentsFetched: [...visited],
    tree,
    integrationNote:
      'Files are raw React/TSX as returned by the registry, written under files/. Adapt markup and CSS classes to the target stack before use.',
  };
  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return manifest;
}

async function runHyperui(name, outDir) {
  const url = sourceUrl('hyperui', name);
  const html = await fetchText(url);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'component.html'), html, 'utf8');

  const manifest = {
    source: 'hyperui',
    name,
    fetchedAt: new Date().toISOString(),
    npmDependencies: [],
    files: ['component.html'],
    integrationNote:
      'Plain HTML + Tailwind utility classes, no JS framework. Drop directly into any static or server-rendered template; only Tailwind (or equivalent CSS) is required.',
  };
  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return manifest;
}

// Resolve a single cached registry item (used by --cachedir fast path)
async function resolveCached(source, item, outDir, cacheDir) {
  await writeRegistryFiles(item, outDir);
  const deps = item.registryDependencies || [];
  const children = [];
  for (const dep of deps) {
    const childPath = path.join(cacheDir, source, dep + '.json');
    try {
      await access(childPath);
      const childData = await readFile(childPath, 'utf8');
      const childItem = JSON.parse(childData);
      await writeRegistryFiles(childItem, outDir);
      children.push({
        name: childItem.name ?? dep,
        type: childItem.type,
        dependencies: childItem.dependencies || [],
        registryDependencies: childItem.registryDependencies || [],
        files: (childItem.files || []).map(f => f.path),
        children: [],
      });
    } catch {
      console.error(`  cache MISS for dependency ${dep} — skipping`);
    }
  }
  const npmDeps = new Set(item.dependencies || []);
  for (const c of children) for (const d of c.dependencies) npmDeps.add(d);
  return {
    name: item.name ?? name,
    npmDependencies: [...npmDeps].sort(),
    componentsFetched: [item.name ?? name, ...deps],
    tree: {
      name: item.name ?? name,
      type: item.type,
      dependencies: item.dependencies || [],
      registryDependencies: deps,
      files: (item.files || []).map(f => f.path),
      children,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { source, name, out, registry, cachedir } = args;

  if (!source || !name || !out) {
    console.error('Usage: node fetch.mjs --source <shadcn|magicui|21st|hyperui> --name <component-name> --out <output-dir> [--registry <base-url>] [--cachedir <dir>]');
    process.exit(1);
  }
  if (!DEFAULTS[source]) {
    console.error(`Unknown source "${source}". Valid sources: ${Object.keys(DEFAULTS).join(', ')}`);
    process.exit(1);
  }

  // Apply optional --registry override for the selected source
  if (registry && DEFAULTS[source]) {
    const suffix = source === 'hyperui' ? '{name}.html' : '{name}.json';
    REGISTRY_OVERRIDES[source] = registry.replace(/\/?$/, '/') + suffix;
  }

  const cacheDir = cachedir ? path.resolve(cachedir) : null;
  const outDir = path.resolve(out);
  await mkdir(outDir, { recursive: true });

  // ── --cachedir fast path ──
  if (cacheDir) {
    const ext = source === 'hyperui' ? '.html' : '.json';
    const cachePath = path.join(cacheDir, source, name + ext);
    try {
      await access(cachePath);
      console.error(`  cache HIT ${source}/${name} → ${cachePath}`);

      if (source === 'hyperui') {
        const html = await readFile(cachePath, 'utf8');
        await writeFile(path.join(outDir, 'component.html'), html, 'utf8');
        const manifest = {
          source, name,
          fetchedAt: new Date().toISOString(),
          cached: true,
          npmDependencies: [],
          files: ['component.html'],
          integrationNote: 'Cached — Plain HTML + Tailwind utility classes.',
        };
        await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
        console.log(JSON.stringify({ ok: true, outDir, manifest }, null, 2));
        return;
      }

      const item = JSON.parse(await readFile(cachePath, 'utf8'));
      const result = await resolveCached(source, item, outDir, cacheDir);
      const manifest = {
        source, name,
        fetchedAt: new Date().toISOString(),
        cached: true,
        ...result,
        integrationNote: 'Files are raw React/TSX as returned by the registry, written under files/.',
      };
      await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
      console.log(JSON.stringify({ ok: true, outDir, manifest }, null, 2));
      return;
    } catch { /* cache miss — fall through to live fetch */ }
  }

  // ── Live fetch path ──
  const manifest =
    DEFAULTS[source].type === 'registry'
      ? await runRegistry(source, name, outDir)
      : await runHyperui(name, outDir);

  console.log(JSON.stringify({ ok: true, outDir, manifest }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }));
  process.exit(1);
});
