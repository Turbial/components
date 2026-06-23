# @turbial/web-components

**Headless brand component extractor.** Pass a URL, get back colors, fonts, images, heading structure, and content blocks. Zero config, zero API keys.

```bash
npx github:Turbial/web-components --source https://example.com
```

## Usage

### CLI

```bash
# Full extraction → stdout
npx github:Turbial/web-components --source https://example.com

# Save to file
npx github:Turbial/web-components --source https://example.com --out components.json

# Inject a business name
npx github:Turbial/web-components --source https://example.com --name "Acme Plumbing" --out components.json

# Colors only (no full crawl)
npx github:Turbial/web-components --source https://example.com --colors
```

### Programmatic

```js
import { extractPage } from '@turbial/web-components';
import { extractColorsFromUrl } from '@turbial/web-components/colors';

const page = await extractPage('https://example.com');
console.log(page.colors);   // { primary, accent, background }

const colors = await extractColorsFromUrl('https://example.com');
```

### npx (zero auth)

```bash
npx github:Turbial/web-components --source https://example.com --out components.json
```

No GitHub token needed. Works from any machine or CI.

## Output

```json
{
  "source": "https://example.com",
  "name": "Acme Plumbing",
  "title": "Acme Plumbing & Rooter",
  "description": "24/7 plumbing in Phoenix",
  "colors": { "primary": "#1a365d", "accent": "#e53e3e", "background": "#ffffff" },
  "webFonts": ["https://fonts.googleapis.com/..."],
  "hero": { "src": "https://example.com/images/hero.jpg", "alt": "Plumber at work" },
  "images": [ ... ],
  "headings": [ ... ],
  "snippets": [ ... ]
}
```

## Shared Partials Library

Once you've extracted a client's brand, use the **shared partials** to build common app sections:

| Partial | What it renders |
|---|---|
| `account-auth` | Login + sign-up card |
| `account-management` | Profile/settings form |
| `billing` | Pricing/plan cards |
| `support` | Contact/help form |
| `notice` | Alert/notification banner |
| `status-badge` | Small status pill |
| `lead-capture` | Email capture / newsletter signup |

See [`docs-partials/README.md`](docs-partials/README.md) for full docs and data slot reference. The source `.hbs` files are in [`partials/`](partials/).

## Install

```bash
npm install -g @turbial/web-components
# or
npm install @turbial/web-components
```
