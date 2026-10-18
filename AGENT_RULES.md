# AGENT_RULES.md — Urbanrat Store

These rules **must** be followed in every task on this project.

---

## 1. Mobile-First Design

Design at **390 px** first, then add breakpoints for tablet (**768 px**) and
desktop (**1280 px**). All layouts, spacing, and typography start from the
smallest viewport.

## 2. Light Theme Only

The app uses a **light theme**. Do not add dark-mode styles or toggles.

## 3. Brand Gradient

| Token               | Value     |
| -------------------- | --------- |
| `--color-brand-light` | `#5ADBE5` |
| `--color-brand`       | `#1EAFC7` |
| `--color-brand-dark`  | `#0A82A8` |

The gradient runs **top → bottom** (`from #5ADBE5 to #0A82A8`).

Use it for:
- Primary buttons
- Active / selected states
- Highlights and accents

These are defined as Tailwind v4 `@theme` tokens and the `brand-gradient`
utility class in each app's `index.css`.

## 4. Glassmorphism Bars

The fixed **top bar** and fixed **bottom bar** must use glassmorphism:

```css
background: rgba(255, 255, 255, 0.72);
backdrop-filter: blur(16px);
border-bottom: 1px solid rgba(255, 255, 255, 0.3);
box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
```

A `glass` utility class is pre-defined in `index.css`.

## 5. Store ↔ Admin Separation

`apps/store` must **never** link to, mention, or route to `apps/admin`. The
admin panel is deployed separately and is invisible to customers.

## 6. Supabase for All Data

All data must flow through **Supabase** (Database, Auth, Storage, Edge
Functions). No API keys or secrets may be committed to the repo — use
environment variables prefixed with `VITE_`.

## 7. Small, Reusable Components

Keep components focused and reusable. Do **not** refactor files outside the
scope of the current task.

## 8. Post-Task Summary

After each task, list:
1. Files created or changed
2. How to run / test the change
