# Shared Partials Library

> **Drop-in Handlebars partials for common app sections** — login/signup, account management, billing/pricing, support/contact forms, notification banners, status badges, and email capture. Built with the [`component-fetch`](https://github.com/Turbial/component-fetch) workflow, then hand-adapted to CSS custom properties.

## Quick Reference

| Partial | What it renders | Data you provide |
|---|---|---|
| `account-auth` | Login + sign-up card | `account.title`, `account.subtitle`, `account.loginAction`, `account.forgotPasswordUrl`, `account.signupUrl` |
| `account-management` | Profile/settings form | `account.title`, `account.subtitle`, `account.name`, `account.email`, `account.phone`, `account.updateAction`, `account.deleteAccountUrl` |
| `billing` | Pricing/plan cards | `billing.title`, `billing.subtitle`, `billing.plans[]` — each plan: `{name, price, period, features[], checkoutUrl, featured}` |
| `support` | Contact/help form | `support.title`, `support.subtitle`, `support.submitAction`, `support.email` |
| `notice` | Alert/notification banner | `notice.title`, `notice.body`, `notice.destructive` (boolean) |
| `status-badge` | Small status pill | `status.ok` (boolean), `status.label` |
| `lead-capture` | Email capture / newsletter signup | `lead.title`, `lead.subtitle`, `lead.submitAction`, `lead.cta` |

## How to use

1. **Extract brand identity** from an existing site with this tool:
   ```bash
   npx github:Turbial/web-components --source https://client-site.com --out brand.json
   ```
2. **Fetch any missing UI components** from shadcn/magicui/21st.dev/hyperui:
   ```bash
   npx github:Turbial/component-fetch --source shadcn --name login-01 --out /tmp/cf-login
   ```
3. **Reference a shared partial** in your Handlebars template:
   ```hbs
   {{> account-auth}}
   ```
   Fill the data slots with values from `brand.json` and your app state.

## Styling

All partials use only CSS custom properties — no Tailwind, no JS framework. Every template wrapper defines these:

```
--accent    --bg       --surface    --text
--muted     --border   --radius     --radius-lg
--shadow
```

A template can override any shared partial by defining its own with the same name.

## Source files

The canonical `.hbs` partial files live in this repo under `partials/`:
```
partials/account-auth.hbs
partials/account-management.hbs
partials/billing.hbs
partials/lead-capture.hbs
partials/notice.hbs
partials/status-badge.hbs
partials/support.hbs
```

## License

MIT — free to use, modify, and distribute.
