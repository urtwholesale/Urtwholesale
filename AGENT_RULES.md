# AGENT_RULES.md — Urbanrat Store

These rules **must** be followed in every task on this project.

---

## 1. Mobile-First Design

Design at **390 px** first, then add breakpoints for tablet (**768 px**) and
desktop (**1280 px**). All layouts, spacing, and typography start from the
smallest viewport.

## 2. Theme Architecture

- **Customer Storefront (`apps/store`)**: Dual-Theme (Light & Dark).
  - Uses `ThemeContext` with reactive Sun/Moon toggle in the top bar and menu drawer.
  - Supports `dark:` Tailwind classes and dark glassmorphic surfaces.
  - Light mode uses solid teal brand tokens (`#087799`) on `#F8F9FB` canvas.
  - Dark mode retains the **same teal hue family** (`#2BBFD9`) on obsidian `#0B0F17` canvas (no orange).
- **Admin Management Portal (`apps/admin`)**: Light Theme Only.
  - Standardized enterprise light operations theme with `#ECEEED` soft slate canvas and primary teal.
  - Dark-mode styles, toggles, and dark variants are excluded from the admin suite.

## 3. Color Rules & Semantic Tokens

Both applications follow a strict, cohesive semantic color system defined in `@theme` / `index.css`:

### Semantic Tokens
- **`--color-primary`** (`#087799` light / `#2BBFD9` dark): Primary interactive controls, price text, active indicators.
- **`--color-primary-hover`** (`#066785` light / `#4FD0E6` dark): Hover state for primary buttons.
- **`--color-primary-active`** (`#055670` light / `#1FA8C2` dark): Active/pressed state for controls.
- **`--color-on-primary`** (`#FFFFFF` light / `#04222B` dark): Text/icons on primary button fills.
- **`--color-primary-soft`** (`#EDF8FA` light / `rgba(43, 191, 217, 0.14)` dark): Tinted backgrounds, secondary buttons, selected tabs, brand badges.
- **`--color-primary-border`** (`#B5E4EC` light / `rgba(43, 191, 217, 0.35)` dark): Borders for badges & secondary buttons.
- **`--color-ring`** (`#1EAFC7` light / `#2BBFD9` dark): Focus rings (`focus-visible:ring-2 ring-ring ring-offset-2`).

### Color Usage Rules
1. **Primary = Actions**: Solid teal (`bg-primary text-on-primary`). Use for CTA buttons, Add to Cart, Checkout, Save, active tabs, and link hover states.
2. **Primary-Soft = Selected & Tint**: `bg-primary-soft text-primary border border-primary-border`. Use for secondary buttons, selected filter pills, and brand badges.
3. **No Gradients for Interactive Controls**: Buttons, inputs, selects, tabs, and pills must **never** use gradients. Gradients are only permitted for (a) hero promotional banners/photo overlays and (b) the official logo badge.
4. **Status Colors = State Only**:
   - `success` (`#16A34A` / `#4ADE80`): Order delivered, in-stock pills, payment verified.
   - `warning` (`#D97706` / `#FBBF24`): Low stock, pending verification, return requested.
   - `danger` (`#DC2626` / `#F87171`): Out of stock, cancelled orders, delete actions. Never use teal for danger.
   - `info` (`#2563EB` / `#60A5FA`): In transit, dispatch tracking, informational notices.
   - **Never** use teal for status or lifecycle badges.
5. **Form Controls**: `border-surface-border focus:border-primary focus:ring-2 focus:ring-ring/30 placeholder:text-text-subtle`.
6. **WCAG AA Compliance**: All text/fill combinations must meet WCAG AA standards (>= 4.5:1 for body text, >= 3.0:1 for large text/UI).

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
