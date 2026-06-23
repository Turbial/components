# component-fetch

A source-agnostic CLI for pulling a single UI component or block out of an
external library and onto disk, with a manifest describing what it depends
on. It is meant to be invoked by an agent (Claude or otherwise), not typed
by hand — the output is raw source, not a finished integration. Whoever
calls it is responsible for adapting the markup/CSS to the target site's
stack (Handlebars, plain HTML, React, etc.).

It is plain Node (no extra deps), so it can be copied into any project, not
just this one.

## Usage

### Live (from any machine with internet)

```bash
npx github:Turbial/component-fetch --source shadcn --name button --out ./out
npx github:Turbial/component-fetch --source magicui --name marquee --out ./out
npx github:Turbial/component-fetch --source 21st --name shadcn/accordion --out ./out
npx github:Turbial/component-fetch --source hyperui --name marketing/ctas/1 --out ./out
```

### Offline / sandboxed runtime (Vercel, OpenClaw agents, etc.)

Component registries block outbound from sandboxed environments. Use `--cachedir`
to work from a pre-fetched mirror:

```bash
# Step 1 — on a machine with internet, mirror what you need:
npx github:Turbial/component-fetch --source shadcn --name button --out ./out --cachedir ./registry-cache
# ^ this caches the fetched file, next run from cache hits only

# Or pre-populate via the mirror script:
npm explore -g component-fetch -- node mirror.mjs \
  --source shadcn --names button,card,input,label,login-01 --cachedir ./registry-cache

# Step 2 — from any (sandboxed) runtime:
npx github:Turbial/component-fetch --source shadcn --name login-01 --out ./out \
  --cachedir ./registry-cache
# Dependencies (button, card, input, label) are also resolved from cache.
```

You can also override the registry URL with `--registry` to point at a GitHub
raw mirror or any other accessible proxy.

### Direct (local install)

```bash
node tools/component-fetch/fetch.mjs --source <source> --name <component-name> --out <output-dir>
```

### Direct (local install)

```bash
node tools/component-fetch/fetch.mjs --source <source> --name <component-name> --out <output-dir>
```

| Source    | `--name` format             | Example                          | Notes                                                     |
|-----------|------------------------------|----------------------------------|-----------------------------------------------------------|
| `shadcn`  | component or block id        | `--source shadcn --name login-01` | Official registry. Recursively pulls `registryDependencies`. |
| `magicui` | component id                 | `--source magicui --name marquee` | Same registry schema as shadcn.                           |
| `21st`    | `author/component`           | `--source 21st --name shadcn/accordion` | Community marketplace; quality varies.                |
| `hyperui` | `category/subcategory/index` | `--source hyperui --name marketing/ctas/1` | Plain HTML + Tailwind, no framework.                  |

Browse names first:
- shadcn/magicui: browse https://ui.shadcn.com or https://magicui.design, the slug in the docs URL is the `--name`.
- 21st.dev: browse https://21st.dev, copy the `author/component-slug` from the component page URL.
- hyperui: browse https://www.hyperui.dev/components/<category>/<subcategory>, each example has a numbered index (1, 2, 3...) shown on its card.

## Output

```
<output-dir>/
  manifest.json       # what was fetched, npm deps, dependency tree
  files/...           # raw source files (registry sources: .tsx)
  component.html      # hyperui only: a single static HTML file
```

`manifest.json` always includes `npmDependencies` (flattened, deduped) and
an `integrationNote` describing what kind of adaptation is needed:
- registry sources (shadcn/magicui/21st) return React + Tailwind (`.tsx`); expect to rewrite JSX into the target template language and resolve the npm packages listed.
- hyperui returns plain HTML + Tailwind classes; usually no rewrite is needed beyond wrapping it in the target templating syntax.

## Adding a source

Sources are declared in the `SOURCES` map at the top of `fetch.mjs`. Any
registry that implements the [shadcn registry-item schema](https://ui.shadcn.com/schema/registry-item.json)
(shadcnblocks, Preline's registry if/when they ship one, etc.) can be added
as a one-line `{ type: 'registry', urlTemplate: '...{name}...' }` entry.
Plain-HTML sources follow the `hyperui` pattern.
