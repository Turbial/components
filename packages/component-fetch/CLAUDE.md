# component-fetch — Agent Instructions

Pull named UI components from external registries (shadcn, magicui, 21st.dev, hyperui). Zero auth.

## How it works

The tool normally fetches live from registry CDNs — but those CDNs are often
unreachable from sandboxed runtimes (Vercel serverless, OpenClaw agents, etc.).
There are **two workarounds** for offline/sandboxed use:

### Option A: `--cachedir` (recommended for agents)

Pre-fetch components on a machine with internet, then reuse the cache anywhere:

```bash
# Step 1 (on your local machine): mirror components into a cache dir
node mirror.mjs --source shadcn --names button,card,input,label --cachedir ./registry-cache
node mirror.mjs --source shadcn --names login-01 --cachedir ./registry-cache
node mirror.mjs --source hyperui --names marketing/ctas/1 --cachedir ./registry-cache

# Step 2 (anywhere): run from cache
npx github:Turbial/component-fetch --source shadcn --name button --out ./out --cachedir ./registry-cache
npx github:Turbial/component-fetch --source shadcn --name login-01 --out ./out --cachedir ./registry-cache
# Dependencies (button, card, input, label) are also resolved from cache
```

### Option B: `--registry` (point at a proxy)

Override the base URL to redirect through a proxy/GitHub raw:

```bash
npx github:Turbial/component-fetch --source shadcn --name button --out ./out \
  --registry https://raw.githubusercontent.com/my-org/my-registry-mirror/main
```

## Quick ref (live, from any machine with internet)

```bash
npx github:Turbial/component-fetch --source shadcn --name button --out ./out
npx github:Turbial/component-fetch --source magicui --name marquee --out ./out
npx github:Turbial/component-fetch --source 21st --name shadcn/accordion --out ./out
npx github:Turbial/component-fetch --source hyperui --name marketing/ctas/1 --out ./out
```

## Supported sources

| Source    | `--name` format             | Example                          |
|-----------|-----------------------------|----------------------------------|
| `shadcn`  | component/block slug        | `--name login-01`                |
| `magicui` | component slug              | `--name marquee`                 |
| `21st`    | `author/component`          | `--name shadcn/accordion`        |
| `hyperui` | `category/subcategory/n`    | `--name marketing/ctas/1`        |

## Output

```
<out>/
  manifest.json    # npm deps + fetched tree + integration notes
  files/           # .tsx sources (registry) or component.html (hyperui)
```

## Browse first

- shadcn: https://ui.shadcn.com/docs/components
- magicui: https://magicui.design/docs/components
- 21st.dev: https://21st.dev
- hyperui: https://www.hyperui.dev/components

## Bin aliases

- `npx github:Turbial/component-fetch` (primary)
- `npx cfetch` (short alias, if installed globally)

## Adaptation

Registry sources (shadcn/magicui/21st) return React + Tailwind `.tsx` — rewrite JSX into target template language. HyperUI returns plain HTML + Tailwind classes, usually drop-in ready.
