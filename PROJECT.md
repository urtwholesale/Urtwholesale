# Urbanrat Store — Comprehensive Project Documentation

A modern, mobile-first, B2B & single-vendor wholesale e-commerce web platform for premium mobile accessories and electronics, supplied by **URP / URT Wholesale**.

---

## 1. Executive Summary

**Urbanrat Store** is designed to provide a premium, app-like mobile and desktop shopping experience for wholesale mobile accessories, chargers, cables, audio gear, and protective accessories. 

The platform features:
- **Customer Storefront (`apps/store`)**: High-performance mobile-first web app with lightning-fast catalog navigation, real-time search, B2B wholesale volume price tiers, persistent cart management, verified server-side orders, and seamless WhatsApp order dispatch.
- **Admin Management Panel (`apps/admin`)**: Separately isolated back-office dashboard featuring an ultra-modern left sidebar layout (inspired by LeaseFlow), executive RPC analytics, catalog/inventory control, order pipeline with GST invoicing, interactive hero banner media management, and self-service admin credentials.
- **Shared Architecture (`packages/shared`)**: Shared TypeScript domain models, volume tier calculation engine, and schemas ensuring 100% type safety across both frontend applications and Postgres database models.
- **Supabase Cloud Backend (`supabase/`)**: PostgreSQL database with Row Level Security (RLS), Supabase Auth, Storage buckets (`product-images`, `banners`, `avatars`), atomic verified order creation RPCs (`create_verified_order`), and real-time analytical functions.

---

## 2. Monorepo Architecture

The project is structured as an **npm workspace** monorepo:

```
urbanrat-store/
├── apps/
│   ├── store/                         # Customer-facing Storefront (Vite + React 19)
│   │   ├── public/                    # Static assets (official logo.png, favicons, hero banners)
│   │   │   ├── favicon.ico
│   │   │   ├── favicon.png
│   │   │   ├── logo.png               # Official Urbanrat bunny logo
│   │   │   └── hero-accessories.jpg
│   │   ├── src/
│   │   │   ├── components/            # Reusable UI (Two-tier TopBar, NavigationDock, WholesaleMarquee, Footer, TurnstileWidget, ProductCard, ErrorState, etc.)
│   │   │   ├── context/               # Global contexts (SettingsContext for store_settings)
│   │   │   ├── features/auth/         # Customer authentication & profile modal (CustomerAuth)
│   │   │   ├── lib/                   # Supabase client instantiation
│   │   │   ├── pages/                 # Route views (Home, Marketplace, Categories, Urbanrat, Cart, Order, Menu, ProductDetail)
│   │   │   ├── services/              # Pure live Supabase data service layer (no mock fallbacks)
│   │   │   ├── utils/                 # WhatsApp message generator, currency & haptic helpers
│   │   │   ├── App.tsx                # Main application layout, two-tier header clearance & cart state
│   │   │   ├── index.css              # Tailwind CSS v4 design tokens & theme classes
│   │   │   └── main.tsx               # React DOM root
│   │   ├── index.html                 # Configured with favicon.ico, logo.png & apple-touch-icon
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vercel.json                # Production deployment configuration & security headers for store.urbanrat.in
│   │   └── vite.config.ts             # Includes social crawler Open Graph tag injector
│   │
│   └── admin/                         # Protected Merchant Admin Panel (Vite + React 19)
│       ├── public/                    # Admin assets (logo.png, favicon.ico, favicon.png)
│       ├── src/
│       │   ├── components/            # AdminNavigationDock (Mobile floating capsule dock)
│       │   ├── features/
│       │   │   ├── auth/              # Admin login with username mapping (the admin username) & role check
│       │   │   ├── catalog/           # Category-wise Single & Bulk Catalog Uploads, QC Verification, Keywords & Multi-Level Category Manager
│       │   │   │   ├── components/    # Reusable UI (KeywordsInput, CategoryCascader, BulkCatalogModal, SingleCatalogWizard, UploadDetailModal, UploadHistoryList)
│       │   │   │   ├── categories/    # 4-Level multi-column Category Manager & dynamic attribute schemas
│       │   │   │   ├── utils/         # SheetJS (xlsx) multi-sheet template generator (templateGenerator.ts) & spreadsheet parser (catalogParser.ts)
│       │   │   │   ├── types.ts       # Upload batch, item, and QC verification interfaces
│       │   │   │   └── index.ts       # Catalog feature barrel export
│       │   │   ├── dashboard/         # Executive Analytics & RPC KPI cards (DashboardOverview)
│       │   │   ├── products/          # Catalog & inventory management (ProductList, ProductEditor with KeywordsInput, index.ts barrel)
│       │   │   ├── orders/            # Order pipeline & GST invoice generation (OrderList, OrderDetailModal)
│       │   │   ├── content/           # Hero banners, ImageCompressorTool, policies & keywords (ContentEditor)
│       │   │   └── settings/          # Store settings & admin password self-service (SettingsEditor)
│       │   ├── lib/
│       │   │   ├── adminService.ts    # Admin database operations, storage uploads with auto-WebP compression & analytics RPCs
│       │   │   └── supabase.ts        # Admin Supabase client
│       │   ├── utils/                 # imageCompressor.ts (Client-side WebP converter & dimension optimizer), haptics.ts
│       │   ├── App.tsx                # Dual-layout responsive design (Sidebar on desktop, Navigation Dock on mobile)
│       │   ├── index.css              # Design tokens, custom scrollbars & Tailwind v4 theme
│       │   └── main.tsx
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       ├── vercel.json                # Production deployment configuration & security headers for admin.urbanrat.in
│       └── vite.config.ts
│
├── packages/
│   └── shared/                        # Shared Domain Package
│       ├── src/
│       │   ├── types/
│       │   │   ├── address.ts         # Customer delivery address schema
│       │   │   ├── cart.ts            # CartItem & CartSummary definitions
│       │   │   ├── catalog.ts         # Catalog batch & QC verification types
│       │   │   ├── category.ts        # Category hierarchy models
│       │   │   ├── order.ts           # Order status, line items, and customer schema
│       │   │   ├── pricing.ts         # Volume price tiers & price breakdown models
│       │   │   ├── product.ts         # Product, keywords text[], pricing, specs, and stock models
│       │   │   ├── profile.ts         # User & Admin profile types
│       │   │   ├── review.ts          # Product review and rating models
│       │   │   ├── stockMovement.ts   # Stock audit trail models
│       │   │   └── storeSettings.ts   # B2B settings, banners, and policy pages
│       │   ├── adminAuth.ts           # Admin authorization logic & AAL2 MFA enforcement checks
│       │   ├── adminAuth.test.ts      # Unit tests for AAL1 rejection, AAL2 approval, role validation & safe rollout
│       │   ├── keywords.ts            # Keyword normalization, deduplication & validation engine (normalizeKeywords)
│       │   ├── keywords.test.ts       # Unit tests covering normalization, trimming, limits & separators
│       │   ├── pricing.ts             # B2B volume pricing calculator & tier matching
│       │   ├── pricing.test.ts        # Unit test suite for pricing engine
│       │   ├── returns.ts             # Private return-evidence signed URL helpers & TTL constants
│       │   ├── returns.test.ts        # Unit test suite for returns domain, claim guards & signed URL TTL
│       │   └── index.ts               # Barrel export
│       ├── package.json
│       └── tsconfig.json
│
├── supabase/
│   ├── functions/
│   │   ├── checkout-gate/             # Deno Edge Function for Turnstile bot-gated guest checkout
│   │   └── order-og/                  # Deno Edge Function for dynamic WhatsApp link previews
│   ├── migrations/
│   │   ├── 001_init.sql               # Core tables, RLS, functions, triggers, and storage
│   │   ├── 002_orders.sql             # Custom order schema (URT-YYMMDD-XXXX) & public order view
│   │   ├── 003_pricing_and_content.sql# Volume tiers, store settings, banners, pages, reviews, audit logs
│   │   ├── 004_pricing_functions.sql  # Real-time analytics, daily sales, RPC order metrics & stock adjust
│   │   ├── 005_create_verified_order.sql # Atomic verified order creation RPC with stock locking
│   │   ├── 006_category_attributes.sql# Dynamic category attribute schemas, options JSONB & validation
│   │   ├── 007_policies_and_dealers.sql # Store policies, dealer applications, audit events & RPCs
│   │   ├── 008_catalog_uploads.sql    # Catalog upload batches, items & recursive get_category_descendant_ids
│   │   ├── 009_catalog_keywords.sql   # Products keywords text[], GIN index, normalize_keywords_array & search RPC
│   │   ├── 010_customer_auth_and_addresses.sql # Customer wholesale verification, addresses & default address trigger
│   │   ├── 011_order_events_and_details.sql # Order status checks ('returned'), timeline events & get_order_by_id
│   │   ├── 012_returns_backend.sql    # Return requests, return items, dispute evidence bucket & status RPCs
│   │   ├── 013_seller_hub_orders.sql  # Seller Hub orders 'on_hold', courier tracking, AWB & customer stats
│   │   ├── 014_admin_returns_and_claims.sql # Supplier claims management, audit logging & return performance RPCs
│   │   ├── 015_catalog_images.sql     # Image Library storage bucket, catalog_images table & RLS policies
│   │   ├── 016_admin_submit_catalog_images.sql # Catalog upload image validation & QC error tracking
│   │   ├── 017_product_brand_attributes.sql # Product brand & attributes JSONB column persistence
│   │   ├── 018_product_category_browse.sql # Server-side category browsing, product counts & bulk move RPCs
│   │   ├── 019_bulk_product_ops.sql   # Bulk product operations auditing, dry-run RPCs, and 1-click undo
│   │   ├── 020_search_engine_v2.sql   # Trigram typo tolerance, synonym expansion, vocab harvesting & search logs
│   │   ├── 021_banners_rating.sql     # Customizable rating column for hero promotional banners
│   │   ├── 022_review_approval_system.sql # Rating threshold trigger (>=4 auto-approve, <4 admin moderation)
│   │   ├── 023_diverse_new_arrivals.sql # Window-partitioned round-robin category product selection RPC
│   │   ├── 024_security_hardening.sql # Role immutability, products_public view, stock isolation, order bounds & RPC privilege revocation
│   │   ├── 025_security_gaps_closure.sql # Tracking tokens, execute revokes, bounded search, safe MFA rollout & anti-abuse (superseded by 026a/b)
│   │   ├── 026a_storefront_additive.sql # Stored generated in_stock, products_public view, public_tokens, guest order RPC, checkout rate limits
│   │   ├── 026b_storefront_tightening.sql # Overload drops, column SELECT on products, sensitive table revokes, anon allowlist
│   │   ├── 026_rollback.sql           # Emergency rollback migration restoring table-wide SELECT on products
│   │   ├── 027_admin_mfa_enforcement.sql # Safe TOTP MFA audit RPC, JSONB is_admin() hardening, reversible enforcement commands
│   │   ├── 028_marquee_announcements.sql # Continuous marquee announcements table, RLS policies, trigger & default wholesale seeds
│   │   └── 029_dealership_program.sql # Dynamic Dealership Program: margins, branded vs copy showcase, differentiation & articles
│   └── seed.sql                       # 12 categories, 18 subcategories, products & volume tiers
│
├── scripts/                           # Penetration testing & database verification scripts
│   ├── run_rest_pentest.js            # Automated 15-probe PostgREST RLS penetration test runner
│   ├── audit_database_security.js     # Schema and function privilege auditing script
│   ├── check_anon_functions.sql       # Diagnostic SQL for functions executable by anon role
│   └── rls_penetration_test.sql       # Direct SQL RLS penetration and isolation probe suite
│
├── .github/
│   └── workflows/
│       └── gitleaks.yml               # Automated secret scanning CI workflow on push & PR (fetch-depth: 0)
├── .gitleaks.toml                     # Gitleaks rule configuration allowlisting .env.example placeholders
├── .env.example                       # Template for Supabase credentials
├── AGENT_RULES.md                     # Core UI/UX and architectural constraints
├── package.json                       # Monorepo root scripts & dev dependencies
└── tsconfig.json                      # Root TypeScript configuration
```

---

## 3. Design System & Brand Identity

The application strictly follows the guidelines codified in [`AGENT_RULES.md`](./AGENT_RULES.md):

### 1. Mobile-First Standard
- Base layouts and typography start at **390 px** (standard modern smartphone viewport).
- Progressive enhancement breakpoints:
  - **Tablet**: `768 px` (`md:`)
  - **Desktop**: `1280 px` (`lg:`) and `1536 px+` (`2xl:`)

### 2. Theme Architecture (Storefront: Dual Theme | Admin: Light Theme Only)
- **Storefront (`apps/store`) — Dual-Theme (Light & Dark)**:
  - Supported natively via `ThemeContext` (`apps/store/src/context/ThemeContext.tsx`), syncing `.dark` class, `data-theme="dark"` attribute, and `style.colorScheme` on the root `<html>` element.
  - Interactive theme toggles (Sun/Moon icons with selection haptic feedback) are integrated into both the sticky desktop topbar (`TopBar.tsx`) and the mobile navigation drawer (`StoreMenuDrawer.tsx`).
  - Automatically queries and listens to system OS preferences (`prefers-color-scheme: dark`) with manual user override persisted in `localStorage` (`urt_theme`).
  - Class-based Tailwind CSS v4 dark variant activated via `@custom-variant dark (&:where(.dark, .dark *));`.
  - Employs dual-theme 3D commercial studio renders across all 13 categories (`/categories/light/{slug}.jpg` vs `/categories/dark/{slug}.jpg` resolved dynamically via `categoryTheme.ts`).
- **Admin Panel (`apps/admin`) — Light Theme Only**:
  - Deliberately built as an enterprise operations console utilizing a crisp light theme with an `#ECEEED` soft slate canvas backdrop, pure-white card surfaces, and `#1a1a1a` typography.
  - Dark mode styles, dark variants, and theme toggles are intentionally excluded from the admin suite to maintain uniform operational clarity and high-contrast supplier catalog workflows.

### 3. Brand Signature Gradients & Design Tokens
Urbanrat employs adaptive CSS variables in the storefront that shift seamlessly between light (electric cyan/teal) and dark (vibrant cyber orange/amber) brand accents, while the admin portal standardizes on the cyan brand gradient:

| Token | Light Theme (Store & Admin) | Dark Theme (Storefront Variant) | Purpose & Usage |
| :--- | :--- | :--- | :--- |
| `--color-brand-light` | `#5ADBE5` | `#FFA033` | Gradient start, active pill highlights, warm glow |
| `--color-brand` | `#1EAFC7` | `#FF7700` | Intermediate accent, focus rings, vibrant orange |
| `--color-brand-dark` | `#0A82A8` | `#E64A00` | Gradient end, primary CTA buttons, badges |

#### Surface & Canvas Tokens
| Token | Light Storefront | Dark Storefront | Admin Panel | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `--color-surface` | `#F8F9FB` | `#0B0F17` | `#ECEEED` | Main application canvas backdrop |
| `--color-surface-card` | `#FFFFFF` | `#131B26` | `#FFFFFF` | Elevated cards, dialogs, and slide-overs |
| `--color-surface-card-subtle` | `#F1F5F9` | `#192333` | `#F8FAFC` | Secondary surfaces, nested wells & table zebra rows |
| `--color-surface-border` | `#E2E8F0` | `#1E2D40` | `#E2E8F0` | Specular card borders, dividers & inputs |
| `--color-slate-750` | — | `#1A2436` | — | Dark navigation dock and sheet nuance |
| `--color-slate-850` | — | `#0E1624` | — | Ultra-deep dark mode contrast backdrop |

#### Brand Gradients & Visual Effects
- **Light Theme**:
  - Vertical: `linear-gradient(180deg, #5ADBE5 0%, #0A82A8 100%)` (electric cyan to deep teal)
  - Horizontal: `linear-gradient(90deg, #5ADBE5 0%, #1EAFC7 50%, #0A82A8 100%)`
  - Shadow & Glow: `0 4px 16px rgba(10, 130, 168, 0.35)` / `0 0 20px rgba(90, 219, 229, 0.4)`
- **Dark Theme**:
  - Vertical: `linear-gradient(180deg, #FFA033 0%, #FF6B00 50%, #E64A00 100%)` (vibrant cyber orange to deep amber)
  - Horizontal: `linear-gradient(90deg, #FFA033 0%, #FF7700 50%, #E64A00 100%)`
  - Shadow & Glow: `0 4px 18px rgba(255, 107, 0, 0.45)` / `0 0 24px rgba(255, 122, 0, 0.45)`

### 4. Official Brand Logo
- Icon: Cyan circular badge with stylized black bunny/rat mark with 'x' and 'o' eyes.
- Uniformly deployed as:
  - Web Favicons (`favicon.ico`, `favicon.png`, `apple-touch-icon`).
  - Store Topbar logo capsule & Mobile Bottom Capsule Navigation.
  - Admin Left Sidebar header & Admin Portal Login.
  - "Urbanrat Original" product collection badges.

### 5. Tailwind CSS v4 Canonical Token Architecture
The styling architecture across both apps is powered by Tailwind CSS v4 with unified design tokens declared via `@theme` in `index.css`:
- **Theme Color & Surface Tokens**:
  - Storefront binds `@theme` tokens dynamically to root CSS variables (`var(--color-brand-*)`, `var(--color-surface-*)`), enabling instant reactive mode switching without page reloads.
  - Admin portal declares canonical light tokens directly (`--color-brand-light: #5ADBE5`, `--color-brand: #1EAFC7`, `--color-brand-dark: #0A82A8`) with specialized `@utility brand-gradient` and `@utility glass`.
- **Token Standardization & Cleansing**: Arbitrary color brackets (`bg-[#...]`, `text-[#...]`) and ad-hoc styling were systematically refactored across 22+ files in favor of standard tokens:
  - `bg-brand-dark`, `text-brand-dark`, `border-brand-dark`
  - `focus:ring-brand-light`, `focus:border-brand`
  - `bg-surface`, `bg-surface-card`, `border-surface-border`
  - Dual-theme pairing: `bg-white dark:bg-surface-card`, `border-slate-200 dark:border-white/10`, `text-slate-900 dark:text-white`
  - Glassmorphic variants: `.dark .glass-top`, `.dark .glass-dock`, `.dark .glass-card`, `.dark .liquid-glass-slab`
  - Canonical directional gradients: `bg-linear-to-b`, `bg-linear-to-r`
  - Strict utility classes: `stroke-2`, `stroke-3`, `max-w-90`, `rounded-t-4xl`

### 6. Media Standards & Viewport Spacing
- **Standardized 5:4 Aspect Ratio (`aspect-5/4`)**: All promotional hero banners in the customer storefront (`HomePage.tsx`) and admin preview cards (`ContentEditor.tsx`) adhere to a fixed 5:4 aspect ratio. Paired with `object-cover` and rounded squircle framing, this guarantees zero cumulative layout shifts (CLS) and prevents image squishing across mobile, tablet, and ultra-wide screens.
- **Desktop Topbar Clearance (`pt-20 md:pt-36`)**: Main content containers in `apps/store/src/App.tsx` enforce generous top padding (`pt-20` on mobile, `md:pt-36` on desktop), ensuring sticky glassmorphic two-tiered navigation headers never obscure hero promotional banners or primary headlines.

---

## 4. Key Features & Workflows

### Customer Storefront (`apps/store`)

1. **Two-Tiered Desktop Topbar**:
   - **Primary Bar**: Left-aligned search/back navigation, centered official Urbanrat logo & brand capsule (`URT Wholesale`), and right-aligned circular Cart button with animated quantity badge.
   - **Centered Sub-Topbar**: Positioned directly beneath the logo with a clean divider, containing desktop navigation pills (**Home**, **Marketplace**, **Urbanrat**, **Categories**, **Menu**).
   - **Mobile View**: Automatically collapses to a sleek top row while delegating navigation to the floating bottom capsule dock.

2. **Floating Bottom Capsule Dock (Mobile)**:
   - Fixed capsule dock with glassmorphism blur and smooth haptic feedback:
     - 🏠 **Home**: Hero banners, category shortcuts, new arrivals.
     - 🛍️ **Marketplace**: Complete wholesale catalog with live filters and sorting.
     - ⚡ **Urbanrat**: Flagship private-label collection with embedded official logo.
     - 📂 **Categories**: Hierarchical category browser.
     - ☰ **Menu**: Profile, order lookup, policies, and WhatsApp direct support.

3. **B2B Wholesale Volume Pricing & Catalog Stock Display**:
   - Volume tier discounts configured per product (e.g. 10–49 units, 50–99 units, 100+ units).
   - Interactive tiered savings preview directly on product pages and in the cart.
   - **Catalog Stock Isolation & Stored Generated `in_stock` Column**: Rather than calculating stock availability on-the-fly via functions or exposing raw counts, `in_stock` is implemented as an indexed stored generated column on `public.products` (`in_stock boolean GENERATED ALWAYS AS (stock > 0) STORED`, added in `026a_storefront_additive.sql`, superseding the initial view-level helper in `024_security_hardening.sql`). Both the storefront catalog view `public.products_public` (with `security_invoker = on`) and column-level SELECT grants in `026b_storefront_tightening.sql` expose `in_stock` while revoking `anon` access to internal warehouse stock counts (`stock`), cost prices, and supplier data. Storefront client queries (`storeService.ts`) retrieve `PRODUCT_SAFE_COLUMNS` including `in_stock`, completely eliminating warehouse inventory intelligence leakage.
   - Server-side verification via Supabase Postgres RPCs (`create_verified_order` for authenticated checkouts, and service-role-only `create_verified_order_guest` via the `checkout-gate` Edge Function for guests) prevents client-side price tampering.

4. **Real-Time Instant Search**:
   - Debounced search modal with live query against Supabase PostgreSQL.
   - Popular search suggestions managed dynamically from the admin panel.
   - Instant search dropdown displaying product thumbnail, price, and brand badge.

5. **Cart & Atomic Order Verification**:
   - Persistent reactive cart with real-time tier recalculation.
   - Verified via `create_verified_order` RPC:
     - Atomically locks and checks stock availability.
     - Re-verifies tier pricing directly against database records.
     - Decrements inventory and creates an audit entry in `stock_movements`.
     - Generates standard alphanumeric order code (`URT-YYMMDD-XXXX`) and 128-bit unguessable `public_token`.
     - Enforces bot honeypot validation and caps pending orders per phone per 24 hours.
   - One-click WhatsApp message generation pre-formatted with order details, lines, delivery address, and token-protected tracking link.

6. **Order Tracking & Social Sharing (`/order/:orderId`)**:
   - Real-time order timeline (*Pending → Confirmed → Processing → Shipped → Delivered*).
   - **Token-Based Guest Access**: Guest order tracking strictly requires the unguessable public tracking token (`/order/:orderId?t=<token>`). Authenticated order owners and administrators receive the full order record; unauthenticated guest callers supplying a valid token receive only status, chronological timeline events, item names/quantities, and masked phone numbers (`**** 1234`) with no address lines, GSTIN, or emails. Requests with missing or invalid tokens return a generic 404/not found to eliminate order enumeration.
   - Edge Function `order-og` requires the verification token, HTML-escapes all parameters, and outputs only the order code and generic status.

7. **Dedicated Orders & Invoices Portal (`/orders`, `/my-orders`)**:
   - Independent customer management page listing authenticated wholesale orders.
   - Status filters (*All*, *In Progress*, *Delivered*, *Cancelled*).
   - One-click copy for Order IDs (`URT-YYMMDD-XXXX`), line-item breakdowns with savings highlights.
   - Guest tracking requires both the Order Code and Security Token (code-only jumping removed).
   - Direct depot WhatsApp escalation button.

8. **Authorized Dealer Network Application (`/dealers`, `/become-a-dealer`)**:
   - B2B distributor/retailer partnership portal.
   - Multi-step validated application (Business name, owner name, 10-digit mobile, GSTIN validation regex, address, pincode, estimated monthly wholesale volume, product category interest chips, honeypot).
   - Submits directly to `submit_dealer_application` RPC and generates a persistent tracking code (`DLR-YYMMDD-XXXX`) and `public_token`.
   - Token-protected dealer tracking (`/dealers?code=DLR-...&t=<token>`) preventing unauthenticated enumeration of dealer applications.
   - Fast-track WhatsApp verification link.

9. **Independent Legal & Store Policy Pages (`/about`, `/terms`, `/privacy`, `/shipping`, `/returns`, `/warranty`, `/wholesale-terms`, `/contact`, `/page/:slug`)**:
   - High-performance, SEO-friendly policy viewer with markdown formatting.
   - Resilient multi-tier fallback copy ensuring 100% uptime even if database rows are being edited.
   - Cross-policy quick navigation matrix and direct WhatsApp inquiry CTA.

10. **Standardized 5:4 Hero Carousel & Mobile Visual Hierarchy**:
    - Promotional hero banner slider locked to `aspect-5/4` ratio with `object-cover` focal rendering.
    - Mobile layout renders hero imagery immediately above the title, badge, and CTA for instant visual impact.
    - Generous `pt-20 md:pt-36` page top clearance completely prevents header occlusion behind the sticky two-tier desktop topbar.

11. **Direct Quantity Selection via Interactive Volume Tier Buttons (`ProductDetailPage.tsx`)**:
    - **One-Tap Tier Selection**: Each volume tier card (`1-9 pcs`, `10-49 pcs`, `50+ pcs`) is an interactive button that immediately updates order quantity to that tier's minimum requirement upon click/tap.
    - **Strict Order Constraints**: Automatically aligns with wholesale `min_order_qty`, steps with `order_qty_step`, and caps at available warehouse stock (`stock`).
    - **Real-Time Visual Hierarchy**: Instantly applies active styling (`ring-2 ring-brand-light/40 shadow-xs`), active badge, live unit price update, and estimated line subtotal math.
    - **Accessible & Tactile**: Full keyboard navigation support (`Enter` / `Space`), `aria-pressed`, `aria-label`, and native Web Vibration API haptics (`triggerHaptic("selection")`).
    - **Quick-Apply Next-Tier Nudge**: The "Add N more to get tier price" helper below the stepper is also interactive with an "Apply" shortcut to jump directly to the next volume tier.

---

### Admin Panel (`apps/admin`)

1. **Redesigned Sidebar Layout (LeaseFlow Inspired UI)**:
   - **Rounded Sidebar Card**: High-contrast white card container with rounded aesthetics (`rounded-3xl`) set against a soft slate `#ECEEED` backdrop (active on tablet/desktop viewports).
   - **Brand Squircle Header**: Displays official Urbanrat logo with brand typography.
   - **Hub Selector Card**: "Main Wholesale Hub • Pan-India Central" depot switcher.
   - **Grouped Navigation**:
     - **Dashboard**: Layout grid icon with high-contrast dark active pill styling.
     - **Commerce & Sales**: *Products* (with live product count badge) & *Orders* (with new pending order count badge).
     - **Storefront & Workspace**: *Content* (media & pages) & *Store Settings*.
   - **Live Cloud Sync Card**: "Urbanrat Cloud • Supabase Live" with pulsing indicator and interactive toggle.
   - **Admin Profile Card**: Displays admin avatar (the admin's initials), the admin username, role badge (`Super Admin`), and 1-click **Sign Out**.

2. **Executive Analytics Dashboard (`DashboardOverview.tsx`)**:
   - Real-time analytical KPI cards (Revenue, Orders, Average Order Value, Pending Orders, Low Stock Alert, New Customers).
   - Analytical timeframes (7 days, 30 days, 90 days).
   - Daily sales trend chart, order status distribution breakdown, and top 5 revenue-generating products computed via PostgreSQL RPCs.

3. **Product Catalog & Volume Tier Editor (`ProductList.tsx` & `ProductEditor.tsx`)**:
   - Full search, category filter, Urbanrat brand filter, and low-stock filter.
   - Product Editor modal:
     - General product information (Title, SKU, URL Slug, Category).
     - Multi-image manager uploading to Supabase Storage (`product-images`).
     - Volume Price Tiers manager via `admin_save_product_tiers`.
     - Direct stock adjustment via `admin_adjust_stock` with audit notes.

4. **Order Pipeline & Invoicing (`OrderList.tsx` & `OrderDetailModal.tsx`)**:
   - Filter orders by status (*All, Pending, Confirmed, Processing, Shipped, Delivered, Cancelled, Refunded*).
   - Strict status transition controls logged to `order_events`.
   - Browser-native **Print / Download GST Tax Invoice** formatted with customer shipping details, itemized tax rates, and wholesale totals.

5. **Promotional Banners & Content Management (`ContentEditor.tsx`)**:
   - **Interactive Banner Image Uploader**: Direct upload to Supabase storage (`banners` bucket with automatic fallback to `product-images`).
   - **Automatic In-Flight WebP Compression**: Images are automatically converted and compressed in-browser before upload, with live bandwidth savings badges (e.g. `WebP • 214 KB (78% saved)`).
   - Live banner preview thumbnails with instant **Replace / Upload New** and **Remove Image** controls.
   - Support for multiple banner placements (`home_hero`, `home_brand`, `urbanrat_hero`).
   - Policy pages editor (About Us, Terms & Conditions, Privacy Policy).
   - Trending search keyword manager.

6. **Admin Credentials & Store Settings (`SettingsEditor.tsx`)**:
   - **Self-Service Admin Credentials**: Change Master Password and Full Name directly from the settings panel.
   - Store metadata (Business Name, WhatsApp support number, support email, warehouse address).
   - Wholesale Minimum Order Quantity (MOQ) and Free Shipping thresholds.
   - GST tax percentage configuration.

7. **Mobile Admin Navigation Dock (`AdminNavigationDock.tsx`)**:
   - **Floating Frosted Glass Dock**: When viewed on mobile screens (`< 768px`), the desktop sidebar is hidden and replaced by a responsive bottom capsule navigation dock (`glass-dock`), achieving complete UX parity with the customer storefront.
   - **5 Core Tabs**: *Dashboard*, *Products* (with live product count badge), *Orders* (with new pending order count badge), *Content*, and *Menu*.
   - **Interactive Bottom Sheet Drawer**: Tapping the Menu tab slides open a frosted bottom drawer with instant shortcuts to:
     - Store Settings & Admin Password Management.
     - Standalone Image Compressor tool.
     - Supabase Cloud Live sync toggle.
     - Super Admin user badge and one-click Sign Out.
   - **Ergonomic Haptic Feedback**: Every navigation tap triggers instant haptic feedback via the Web Vibration API.

8. **Browser-Side WebP Image Compressor & Optimization Engine (`ImageCompressorTool.tsx` & `imageCompressor.ts`)**:
   - **Client-Side Optimization Engine**: Encodes images directly inside the browser using HTML5 Canvas WebP encoding, eliminating server-side image processing bottlenecks.
   - **Automatic Bandwidth Savings**: Shrinks image payloads by **65% to 85%** before transmitting to Supabase Storage, dramatically cutting storage usage and speeding up mobile storefront Largest Contentful Paint (LCP).
   - **In-Flight Upload Pipeline (`adminService.ts`)**: Banners and product catalog images uploaded via `uploadBannerImage` or `uploadProductImage` are automatically clamped to max dimensions (1920px for hero banners, 1200px for products) and visually lossless quality (0.84) before cloud upload.
   - **Standalone Interactive Compression Studio (`ImageCompressorTool.tsx`)**: Dedicated workspace available in the Content section and Mobile Menu drawer. Features drag-and-drop file staging, real-time side-by-side original vs. compressed preview comparison, adjustable quality/dimension sliders, instant WebP download, and one-click upload to Supabase Storage with automatic public URL generation.

9. **Modular Products Barrel Architecture (`apps/admin/src/features/products/index.ts`)**:
   - Encapsulates `ProductList`, `ProductEditor`, and associated catalog components through a standardized barrel export, ensuring clean imports and maintainable architectural boundaries.

10. **Category-Wise Catalog Upload System & QC Engine (`apps/admin/src/features/catalog/`)**:
    - **Supplier-Grade Catalog Workflow**: Complete catalog upload experience inspired by modern wholesale supplier platforms, styled to Urbanrat's brand identity (Tailwind v4 tokens: `brand-light`, `brand`, `brand-dark`, `surface`; admin light theme only; 390px mobile-first; LeaseFlow sidebar on desktop; `AdminNavigationDock` on mobile; Web Vibration API haptics; Lucide icons).
    - **Multi-Level Category Hierarchy & Manager (`CategoryCascader.tsx` & `CategoryManagerModal.tsx`)**: Up to 4 hierarchical levels (L1 Main Category → L2 Subcategory → L3 Product Group → L4 Item Variety) with recursive depth enforcement (depth ≤ 4), parent re-assignment, live filter search, and WebP thumbnail upload.
    - **Single Catalog Upload Flow (`SingleCatalogWizard.tsx`)**: 2-step guided wizard. Step 1: 4-level category selection drill-down with visual validation + front image upload with automated WebP compression. Step 2: Product details, SKU, specifications, stock, and B2B volume pricing tier configuration with validation.
    - **Bulk Catalog CSV Upload Flow (`BulkCatalogModal.tsx`)**: Select target category, download dynamic category-tailored CSV template with prefilled column definitions and volume discount headers, client-side CSV parsing with instant error feedback (MOQ, price, tiers), and automated batch insertion with audit logging.
    - **Upload History & QC Verification Dashboard (`UploadHistoryList.tsx`, `UploadDetailModal.tsx`)**: Tabbed history tracking (Bulk Uploads vs Single Uploads) with QC status pills (*All*, *Action Required*, *QC in Progress*, *QC Error*, *QC Pass*), summary statistics cards (*Total Uploads Done*, *Using Bulk Uploads*, *Using Single Uploads*), category filtering, file ID search, and item-by-item verification log inspector.
    - **Storefront Compatibility (`apps/store/src/services/storeService.ts`)**: Recursive category descendant resolution (`get_category_descendant_ids` RPC with fallback) ensuring products assigned to deeper L3/L4 nodes seamlessly appear when customers browse parent L1/L2 categories.

11. **Category Manager & Dynamic Specification Schemas (`apps/admin/src/features/catalog/categories/`)**:
    - **Multi-Column Finder Browser**: 4-column drill-down browser (Level 1 | Level 2 | Level 3 | Level 4) on desktop with dark pill active selection and directional arrows (`ChevronRight`), and stacked drill-down list on mobile with breadcrumb trail and back navigation.
    - **Full Category Lifecycle Controls**: Small modal dialog for add, rename, parent reassignment, active/inactive toggle, and up/down reordering within siblings.
    - **Safe Deletion Pre-Flight Engine**: Automatically checks for nested subcategories and assigned products; blocks deletion if dependencies exist and displays clear explanatory diagnostic reasons.
    - **Client-Side WebP Category Image Compressor**: Converts category media to WebP format via Canvas compression before uploading to `product-images` storage bucket.
    - **Dynamic Attributes Schema Engine**: Configures custom product specifications per category (`text`, `number`, `select`, `multiselect`, `boolean`) with option tag builders, required toggles, and subcategory inheritance. Displays inherited attributes as read-only chips with source category breadcrumbs.
    - **Live Category Search**: Instant query filtering matching across all 4 tiers with automatic tree expansion and column jump.

12. **Search Keywords System & Reusable `KeywordsInput` Across All Catalog Touchpoints (`apps/admin/src/features/catalog/components/KeywordsInput.tsx`)**:
    - **Reusable Tag Input Component**: Mobile-first chip manager styled with canonical brand tokens (`bg-brand-light/20`, `text-brand-dark`), supporting tag addition via `Enter`, comma (`,`), or `blur`, with full paste splitting (comma, semicolon, pipe, or line breaks).
    - **Domain Validation & Normalization (`normalizeKeywords` in `@urbanrat/shared`)**: Automatically trims, lowercases, collapses internal whitespace, removes duplicates, and enforces strict limits (max 30 keywords per product, max 50 characters per keyword). Features live counter (`"X / 30"`), dynamic red inline error alerts, and haptic feedback (`triggerHaptic("heavy")` on limit/duplicate rejection, `"selection"` on add/remove).
    - **Touchpoint 1 — SingleCatalogWizard (Step 2: Search & Discovery)**: Independent per-product keyword lists stored in draft payloads. The 'Copy input details to all products' feature preserves per-product keyword lists unless an explicit 'Apply keywords to all products' toggle is activated. Includes local storage draft autosave (`urbanrat_catalog_single_draft`) and submit result summary notes.
    - **Touchpoint 2 — Universal Bulk Template & Preview Table (SheetJS `xlsx`)**: Generates 2-sheet workbooks (`Products Template` + `Instructions`) with a dedicated 'Keywords' column. Parses `.xlsx`, `.xls`, and `.csv` files, validates limits with row-level error diagnostic tags (`qc_error`), and allows inline keyword editing directly in the bulk preview table modal.
    - **Touchpoint 3 — QC Error-Fix Drawer (`UploadDetailModal.tsx`)**: Slide-over drawer for flagged items, integrating `KeywordsInput` directly in the inline fix form to update keywords, revalidate payload, and transition status to `qc_pass`.
    - **Touchpoint 4 — ProductEditor (`ProductEditor.tsx`)**: Embeds `KeywordsInput` under Search & Discovery to edit keywords post-publishing, saved directly to `products.keywords`.
    - **Touchpoint 5 — Catalog Upload Search (`UploadHistoryList.tsx`)**: Search query filter matches keywords and notes inside upload batches.

---

## 5. Database Schema & Security (Supabase)

### Migrations

| Migration | Purpose | Key Components |
| :--- | :--- | :--- |
| `001_init.sql` | Core schema & auth | `profiles`, `categories`, `products`, `orders`, `cart_items`, RLS policies, role protection trigger (`trigger_prevent_role_tampering`), and `product-images` storage bucket. |
| `002_orders.sql` | Custom order format & public tracking | Custom order ID format (`URT-YYMMDD-XXXX`), `orders` table updates, delivery details, and single-order public access policy via `get_order_by_id`. |
| `003_pricing_and_content.sql` | B2B pricing & content expansion | `product_price_tiers`, `store_settings`, `banners`, `store_pages`, `reviews`, `stock_movements`, `addresses`, `wishlist_items`, storage buckets (`banners`, `avatars`). |
| `004_pricing_functions.sql` | Analytics & Admin RPCs | `get_unit_price`, `admin_dashboard_stats`, `admin_sales_by_day`, `admin_orders_by_status`, `admin_top_products`, `admin_adjust_stock`, `admin_save_product_tiers`, review sync triggers. |
| `005_create_verified_order.sql` | Atomic order verification | `create_verified_order` transactional function verifying inventory locking, volume tier pricing, and direct-insert revocation. |
| `006_category_attributes.sql` | Dynamic category attribute schemas | `category_attributes` table, options JSONB array, RLS policies, and attribute inheritance indexing. *(Header carries a legacy internal comment `-- Migration: 009_category_attributes.sql`)*. |
| `007_policies_and_dealers.sql` | Policy metadata & Dealer B2B portal | `store_pages` publishing columns, `dealer_applications` table, `dealer_events`, and `submit_dealer_application` RPC. |
| `008_catalog_uploads.sql` | Catalog upload batches & recursive hierarchy | `catalog_uploads`, `catalog_upload_items`, `get_category_descendant_ids` recursive function, and batch verification tracking. |
| `009_catalog_keywords.sql` | Search keywords, GIN index & search RPC | `alter table products add column keywords text[] not null default '{}'`, `idx_products_keywords` GIN index, `normalize_keywords_array(p_raw jsonb)`, and `search_products(p_query text, p_max_results integer default 20)`. |
| `010_customer_auth_and_addresses.sql` | Customer verification & Address book | `profiles` customer wholesale business fields (`business_name`, `gstin`), `addresses` table with default address trigger and RLS. |
| `011_order_events_and_details.sql` | Order auditing & event log | Extended `orders_status_check` supporting `'returned'`, enhanced `get_order_by_id` RPC with chronological `events` array from `order_events`. |
| `012_returns_backend.sql` | Full returns & reverse logistics | `return_requests`, `return_items`, `return_events`, `return-evidence` private storage bucket, `create_return_request`, and `admin_update_return_status` RPCs. |
| `013_seller_hub_orders.sql` | Seller Hub order logistics & tracking | Orders `on_hold` status, courier tracking fields (`courier_name`, `awb_number`), `admin_update_order_shipping` RPC, and `get_customer_lifetime_stats`. |
| `014_admin_returns_and_claims.sql` | Admin claims & return performance | Claims tracking columns on `return_requests`, `admin_update_return_claim` RPC, `get_product_return_performance` RPC, and `admin_get_returns_pending_count`. |
| `015_catalog_images.sql` | Catalog Image Library & storage policies | Storage bucket `catalog-images`, `catalog_images` table with RLS, indexes on `(created_at desc)`, `batch_id`, `sku_hint`, and `admin_delete_catalog_image` RPC. *(Previously misdocumented as `010_catalog_images.sql`)*. |
| `016_admin_submit_catalog_images.sql` | Catalog upload image validation | Enforces at least 1 image per product in `admin_submit_catalog`, accepts `catalog-images` URLs, flags `qc_error`, and recomputes upload stats. |
| `017_product_brand_attributes.sql` | Product brand & attributes persistence | Adds `brand` and `attributes` (JSONB) columns to `products` table; updates `admin_submit_catalog` to persist full catalog specifications, warranties, and tiers. |
| `018_product_category_browse.sql` | Server-side category browse & bulk move | `admin_list_products` flexible filtering and pagination RPC, `admin_category_product_counts` recursive counter, and `admin_bulk_move_products`. |
| `019_bulk_product_ops.sql` | Bulk product operations engine & undo | `bulk_operations` audit table, `admin_bulk_update_products`, `admin_bulk_adjust_stock`, `admin_bulk_save_tiers`, `admin_bulk_update_images`, and `admin_undo_bulk_operation` with transactional dry-run. |
| `020_search_engine_v2.sql` | Typo-tolerant search engine & logs | `search_synonyms`, `search_vocabulary`, `search_logs`, trigram `pg_trgm` extension, `search_products_v2` with vocabulary harvesting and fallback ladder. |
| `021_banners_rating.sql` | Banner promotional ratings | Adds customizable `rating text default '4.9'` column to `banners` table; triggers PostgREST schema cache reload. |
| `022_review_approval_system.sql` | Review rating approval automation | Review approval workflow with `auto_moderate_review` trigger function enforcing automatic approval for $\ge 4$ stars and admin moderation for $< 4$ stars. |
| `023_diverse_new_arrivals.sql` | Category-diverse new arrivals showcase | Window-partitioned recursive CTE function `get_new_arrivals_by_category(items_per_category)` ensuring home page new arrivals represent all product families. |
| `024_security_hardening.sql` | Comprehensive Security Hardening & Least Privilege | Strict role immutability trigger (`check_profile_role_update`), `handle_new_user` role lockdown (hardcodes `'customer'`), storefront `products_public` view with `security_invoker = on` and `product_is_in_stock` helper, direct anon SELECT revoked on `products.stock`, hardened `create_verified_order` (quantity bounds, active status, duplicate line rejection), `create_return_request` path validation (`auth.uid() || '/'`), server-side bounds on `search_products_v2` (60-char query cap, 50-row limit), `get_order_by_id` phone masking and `admin_note` stripping, and enforced `is_admin()` checks and `SET search_path = public, pg_temp` across all admin/bulk/stats functions with EXECUTE revoked from PUBLIC/anon. |
| `025_security_gaps_closure.sql` | Evidence Audit Security Gaps Closure (Superseded/Extended) | Initial proposal for unguessable `public_token` on `orders` and `dealer_applications`, token-gated `get_order_by_id` & `get_dealer_application_by_code`, bounds on legacy `search_products` (60 chars, 50 rows), safe TOTP MFA rollout via `enforce_admin_mfa` and `is_admin()`, storage bucket enumeration prevention, content-based review moderation, and rate limits tracking with honeypot bot trap. *(Note: Tracking token generation, order lookup signatures, and guest RPCs were superseded and extended by the authoritative migrations `026a_storefront_additive.sql` and `026b_storefront_tightening.sql`)*. |
| `026a_storefront_additive.sql` | Two-Phase Storefront Hardening (Phase 1: Additive) | Authoritative stored generated column `products.in_stock` (`stock > 0`), safe storefront catalog view `public.products_public` (with embedded price tiers and `security_invoker = on`), admin view `public.products_admin`, authoritative 128-bit `public_token` on `orders` and `dealer_applications` with unique indexes, `order_events.customer_visible` column & RLS filter, authoritative token-gated `get_order_by_id(text, text)` with minimal guest masking and `get_dealer_application_by_code(text, text)`, service-role-only `create_verified_order_guest` RPC, table-backed `checkout_rate_limits` sliding window counter, and `max_order_qty` store setting. |
| `026b_storefront_tightening.sql` | Two-Phase Storefront Hardening (Phase 2: Tightening) | Drops legacy single-param `get_order_by_id(text)` and 3-param `create_verified_order(jsonb, jsonb, text)` to eliminate PostgREST overload ambiguity (PGRST203); revokes table-wide `SELECT` on `products` from `anon` while granting column-level `SELECT` on 27 safe columns matching `products_public`; revokes direct `SELECT` on `orders`, `order_events`, `dealer_applications`, `dealer_events`, and `addresses` from `anon`; permanently drops insecure `customer_addresses` view; tightens `reviews` RLS and `auto_moderate_review`; and restricts `anon` execute privileges to an explicit allowlist. |
| `026_rollback.sql` | Storefront Hardening Emergency Rollback | Emergency recovery script for 026a/026b that restores table-wide `SELECT` on `products`, `orders`, and sensitive tables, reverts view definitions, and restores legacy single-arg `get_order_by_id(text)` while preserving existing `public_token` column values to prevent data loss. *(Not applied)*. |
| `027_admin_mfa_enforcement.sql` | Admin Multi-Factor Authentication (MFA) Safe Rollout & Enforcement | Administrative audit RPC `public.admin_get_mfa_enrollment_status()` for inspecting cross-admin TOTP verification status before enforcement; hardened `public.is_admin()` handling JSONB boolean and string variants of `enforce_admin_mfa`; includes explicit, commented-out reversible statements to enable (`true`) or roll back (`false`) strict AAL2 enforcement. *(Pending manual execution after all admins enroll)*. |
| `028_marquee_announcements.sql` | Continuous Marquee Announcements & Dynamic Offers | Database table `public.marquee_announcements` with RLS policies, `set_updated_at` trigger, public read access, admin management access, and 8 seed wholesale promotional announcements. |
| `029_dealership_program.sql` | Dealership Program Dynamic Content & Differentiation | Database tables for `public.dealership_tier_margins`, `public.dealership_item_showcase` (Branded vs Copy image comparisons), `public.dealership_benefits_comparison` (Authorized Dealer vs Normal Customer benefits), and `public.dealership_articles` (Branded & Copy dealership guide articles) with RLS policies, `set_updated_at` triggers, public read access, and admin full write access. Pre-seeded with production-grade data. |

#### Referenced Migrations Not Found in Repository
| Migration Reference | Status | Details & Resolution |
| :--- | :--- | :--- |
| `006_custom_order_id.sql` | **Referenced but not found in repo** | Listed in early documentation as an alphanumeric sequencing migration. In the codebase, sequential `URT-YYMMDD-XXXX` order generation and public lookup policies are already implemented in `002_orders.sql`. No separate file was ever created on disk. |
| `009_category_attributes.sql` | **Referenced but not found in repo** (documentation typo) | Referenced in early documentation and changelog. The physical migration file on disk is `006_category_attributes.sql` (which contains a legacy comment `-- Migration: 009_category_attributes.sql`). |
| `010_catalog_images.sql` | **Referenced but not found in repo** (documentation typo) | Referenced in early documentation and changelog alongside `010_customer_auth_and_addresses.sql`. The physical migration file on disk is `015_catalog_images.sql`. |

### Storage Buckets & Policies

1. **`product-images`** (Public: `true`): High-resolution product photography (5 MB max, JPEG/PNG/WebP). Writes (INSERT/UPDATE/DELETE) restricted to `public.is_admin()`. Broad public SELECT policies dropped in `025_security_gaps_closure.sql` to block bucket enumeration; object listing restricted to `public.is_admin()`. (Defined in `001_init.sql:295-325`, `025_security_gaps_closure.sql`).
2. **`banners`** (Public: `true`): Hero banners and promotional media (10 MB max, JPEG/PNG/WebP/GIF). Writes restricted to `public.is_admin()`. Broad public listing dropped in `025_security_gaps_closure.sql`. (Defined in `003_pricing_and_content.sql:600-634`, `025_security_gaps_closure.sql`).
3. **`avatars`** (Public: `true`): Profile avatars (2 MB max, JPEG/PNG/WebP). Writes and listing restricted to authenticated user matching folder `(storage.foldername(name))[1] = auth.uid()::text` or `public.is_admin()`. (Defined in `003_pricing_and_content.sql:635-690`, `025_security_gaps_closure.sql`).
4. **`catalog-images`** (Public: `true`): High-performance WebP catalog photography and Image Library assets (10 MB max, JPEG/PNG/WebP/AVIF). Writes and listing restricted to `public.is_admin()`. (Defined in `015_catalog_images.sql:10-33`, limits enforced in `025_security_gaps_closure.sql`).
5. **`return-evidence`** (Public: `false`): Private bucket for customer return dispute photos and unboxing videos (25 MB max, JPEG/PNG/WebP/MP4/QuickTime/WebM). Writes and reads strictly restricted to `(storage.foldername(name))[1] = auth.uid()::text` for customers; full access for `public.is_admin()`. (Defined in `012_returns_backend.sql:200-255`).

### Admin Access & Authorization

Admin authorization is enforced at the database layer via `public.is_admin()`, never solely by UI routing. The first admin is created in Supabase Auth and assigned `role = 'admin'` in `profiles`.

Verified (date: 2026-11-02): `handle_new_user()` hardcodes `role = 'customer'` (`024_security_hardening.sql:59-91`); `check_profile_role_update()` blocks non-admin role changes (`024_security_hardening.sql:38-57`); Current-password re-authentication enforced on password change (`SettingsEditor.tsx:260-280`); Two-factor authentication (TOTP MFA) enrollment and challenge implemented (`SettingsEditor.tsx:40-120`, `AdminLogin.tsx:40-145`); `is_admin()` supports safe rollout via `enforce_admin_mfa` (`025_security_gaps_closure.sql`).

### Security Requirements (verify each before launch)

#### Authentication & authorization
- [ ] Admin accounts use TOTP MFA; `is_admin()` requires `role = 'admin'` and an MFA-verified session (`aal2`).
  - **Prerequisite / Audit Step**: Open Admin Settings (`SettingsEditor.tsx`) to inspect the **Admin MFA Rollout & Enrollment Audit** card, or run `SELECT * FROM public.admin_get_mfa_enrollment_status();` in the Supabase SQL editor. Confirm that `unenrolledCount = 0` and every administrator has `has_mfa = true`.
  - **Enforcement Activation**: Execute migration `027_admin_mfa_enforcement.sql`, then activate the database enforcement flag:
    ```sql
    UPDATE public.store_settings SET value = 'true'::jsonb, updated_at = now() WHERE key = 'enforce_admin_mfa';
    ```
  - **Verification**: Sign in as an administrator. At `aal1` (pre-TOTP), admin RPCs and tables are rejected (`is_admin() = false`). Upon entering the 6-digit TOTP code (`aal2`), full administrator privileges are granted (`is_admin() = true`). Tested in `packages/shared/src/adminAuth.test.ts`.
  - **Emergency Rollback Plan**: If an administrator is locked out or enrollment needs to be paused, run the reversal command in the Supabase SQL editor:
    ```sql
    UPDATE public.store_settings SET value = 'false'::jsonb, updated_at = now() WHERE key = 'enforce_admin_mfa';
    ```
    This immediately reverts `public.is_admin()` to safe rollout mode without service interruption or schema rollback.
- [x] Admin authentication strictly enforces master credentials with TOTP MFA; third-party Google OAuth entry point removed from Admin Login to eliminate external OAuth vulnerability surface. *(Verified on 2026-11-03: Touchpoint 41, AdminLogin.tsx)*
- [x] `role` can never be set from signup metadata or by the user's own profile update. *(Verified on 2026-11-02: `024_security_hardening.sql:38-91`)*
- [x] Changing the admin password requires the current password. *(Verified on 2026-11-02: `SettingsEditor.tsx:260-280`)*

#### Database
- [x] RLS enabled on every table; no `using (true)` policies on sensitive tables. *(Verified on 2026-11-03: `001_init.sql` through `026b_storefront_tightening.sql`)*
- [x] Every `SECURITY DEFINER` function sets `search_path`, checks `is_admin()` or `auth.uid()` first, and has EXECUTE revoked from `public`/`anon` unless it is intentionally public. *(Verified on 2026-11-03: `024_security_hardening.sql`, `026a_storefront_additive.sql`, `026b_storefront_tightening.sql`)*
- [x] The storefront reads products through stored generated `in_stock` boolean and `products_public` view excluding warehouse stock quantities, cost, and supplier fields. *(Verified on 2026-11-03: `026a_storefront_additive.sql`, `026b_storefront_tightening.sql`, `PRODUCT_SAFE_COLUMNS` in `storeService.ts:61`)*
- [x] Order inputs are validated server-side (quantity bounds, active products, line limits). *(Verified on 2026-11-03: `024_security_hardening.sql`, `026a_storefront_additive.sql:185-509` in `create_verified_order`, and `create_verified_order_guest`)*

#### Public endpoints
- [x] Guest order tracking requires an unguessable token; responses are minimal and masked. *(Verified on 2026-11-03: `orders.public_token` & `get_order_by_id` in `026a_storefront_additive.sql`, `OrderPage.tsx:48-95`)*
- [x] Guest checkout, dealer form, reviews and search logging are rate-limited, length-capped and CAPTCHA/honeypot-protected. *(Verified on 2026-11-03: `checkout-gate` Edge Function, Cloudflare Turnstile, `checkout_rate_limits`, honeypot in `026a/b`)*
- [x] Review moderation is content-based, and no ratings are generated or scaled. *(Verified on 2026-11-03: `auto_moderate_review` in `026b_storefront_tightening.sql`, `HeroStackedCarousel.tsx:20-175`)*

#### Frontend
- [x] All interpolated values in invoices, packing slips and OG tags are HTML-escaped; print views do not run in the admin origin. *(Verified on 2026-11-02: `order-og/index.ts:18-80`, `printHtmlSafely` in `OrderDetailModal.tsx:264, 377`)*
- [x] Markdown is rendered without raw HTML; `from`/`redirect` parameters accept same-origin relative paths only. *(Verified on 2026-11-02: `PolicyPage.tsx`, `sanitizeRedirectPath` in `packages/shared/src/sanitize.ts`)*

#### Storage
- [x] Bucket writes are admin-only (except per-user `avatars` and `return-evidence` folders); MIME and size limits set; broad listing blocked. *(Verified on 2026-11-02: `025_security_gaps_closure.sql`)*
- [x] Return-evidence signed URLs expire in 15 minutes or less. *(Verified on 2026-11-04: Capped at `RETURN_EVIDENCE_URL_TTL_SECONDS = 900` via centralized `getReturnEvidenceSignedUrl` in `packages/shared/src/returns.ts:47`, called on-demand in `apps/store/src/services/returnService.ts:202` and `apps/admin/src/lib/adminService.ts:2865`)*

#### Deployment
- [x] Admin and storefront are on separate subdomains; security headers set in `vercel.json`. *(Verified on 2026-11-04: Created production configs `apps/store/vercel.json` for store.urbanrat.in and `apps/admin/vercel.json` for admin.urbanrat.in with strict CSP, HSTS, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy, and frame-ancestors 'none')*
- [ ] Supabase redirect allowlist lists exact URLs only, with no wildcards.
- [x] Gitleaks/secret scanning runs in CI. *(Verified on 2026-11-04: Workflow `.github/workflows/gitleaks.yml` configured on push & PR with fetch-depth: 0, custom `.gitleaks.toml` allowlisting only `.env.example`, scanned 110 commits with 0 leaks found)*

---

## 6. Technology Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Language** | TypeScript | ~5.8 | Strict type safety across apps and shared models |
| **UI Framework** | React | 19.3 | Modern component-driven reactive architecture |
| **Bundler & Server** | Vite | 6.3 | Ultra-fast HMR and optimized production bundling |
| **Styling** | Tailwind CSS | 4.1 | Utility-first styling with custom design tokens |
| **Spreadsheet Engine** | SheetJS (`xlsx`) | 0.20.x, installed from the SheetJS CDN tarball (not the npm registry copy) | Excel/CSV parsing and template generation. Older registry versions (≤0.18.5) have known vulnerabilities. |
| **Routing** | React Router | 7.5 | Client-side routing with deep link support |
| **Icons** | Lucide React | 1.16 | Cohesive modern icon system |
| **Backend & DB** | Supabase JS | 2.106 | Realtime PostgreSQL, RLS security, and storage |
| **Monorepo Manager** | npm workspaces | 10+ / 11+ | Clean multi-package dependency management |
| **Testing** | Vitest | 5.0 | Complete test suite across shared pricing, order verification, validation, keyword normalization, catalog image parsing, returns domain & signed URL TTL, HTML sanitization, admin MFA authorization, catalog parser, marquee announcements, dealership domain, and English & Hindi translations (257 tests across 18 suites as of 2026-11-04) |

---

## 7. Local Development Guide

### Prerequisites
- Node.js ≥ 20.x (Recommended: LTS v24.x)
- npm ≥ 10.x

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the project root:
```bash
cp .env.example .env
```

Ensure `.env` contains your active Supabase parameters:
```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

### 3. Launch Development Servers
```bash
# Run both Storefront (port 5173) and Admin Panel (port 5174) concurrently
npm run dev

# Or run individual applications
npm run dev:store  # Customer storefront on http://localhost:5173
npm run dev:admin  # Admin dashboard on http://localhost:5174
```

### 4. Build for Production
```bash
# Builds store and admin applications and checks TypeScript types
npm run build

# Or build individually
npm run build:store
npm run build:admin
```

---

## 8. Deployment Guide (Vercel)

The platform supports two deployment topologies:

### Option A: Unified Monorepo Deployment (Not recommended for production)
Serves the storefront and admin from one origin. Both apps then share the same browser storage, so a vulnerability in the storefront can expose an admin session. Use only for local previews.

1. **Import Git Repository**: Select the Git repository.
2. **Framework Preset**: Select **`Vite`**.
3. **Root Directory**: `.` (monorepo root).
4. **Build Command**: `npm run build` *(executes store & admin builds and merges dist artifacts into `dist/`, `dist/sjain/`, and `dist/admin/`)*.
5. **Output Directory**: `dist`.
6. **Environment Variables**: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
7. **Routing (`vercel.json`)**:
   - `/sjain/:path*` → `/sjain/index.html` (Admin deep links)
   - `/sjain` → `/sjain/index.html` (Admin entry point)
   - `/admin` → Redirects to `/sjain`
   - `/(.*)` → `/index.html` (Storefront SPA fallback)

### Option B: Standalone Multi-Project Deployment (Recommended)
Deploy the storefront and admin as separate Vercel projects on separate subdomains (e.g. `store.urbanrat.in` and `admin.urbanrat.in`), so they never share an origin:

#### Deploying the Storefront (`apps/store`)
1. **Import Git Repository**: Select the Git repository.
2. **Framework Preset**: Select **`Vite`**.
3. **Root Directory**: Select **`apps/store`**.
4. **Build Command**: `tsc -p tsconfig.json && vite build` (or `npm run build:store`).
5. **Output Directory**: `dist`.
6. **Environment Variables**: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

#### Deploying the Admin Panel (`apps/admin`)
1. **Import Git Repository**: Import the Git repository as a second project (e.g., `urbanrat-admin`).
2. **Framework Preset**: Select **`Vite`**.
3. **Root Directory**: Select **`apps/admin`**.
4. **Build Command**: `tsc -p tsconfig.json && vite build` (or `npm run build:admin`).
5. **Output Directory**: `dist`.
6. **Environment Variables**: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.


---

## 9. Changelog & Release History

The complete technical implementation history, schema migration milestones, and touchpoint logs (Touchpoints 01 through 39) have been migrated to [`CHANGELOG.md`](./CHANGELOG.md).

### Milestone Overview
- **Touchpoints 01–09 (Core Architecture & Backend Systems)**: Monorepo setup, canonical Tailwind CSS v4 design tokens, atomic verified orders RPC (`005_create_verified_order.sql`), 4-level category manager & dynamic attribute schemas (`006_category_attributes.sql`), supplier catalog upload & QC verification (`008_catalog_uploads.sql`), search keywords with GIN indexing (`009_catalog_keywords.sql`), wholesale customer authentication & saved address book (`010_customer_auth_and_addresses.sql`), marketplace orders dashboard (`011_order_events_and_details.sql`), customer returns portal (`012_returns_backend.sql`), and seller-hub admin order logistics & image bulk upload (`013_seller_hub_orders.sql`–`016_admin_submit_catalog_images.sql`).
- **Touchpoints 10–22 (Wholesale Operations & Design Evolution)**: Bulk product operations engine with 1-click undo (`019_bulk_product_ops.sql`), marketplace subcategories navigation & category count parity, single product direct link uploads, universal bulk catalog header aliasing & JSON tier ingestion, selective color variants management, dynamic per-color column recognition, storefront search resiliency & live schema alignment, inline auto-suggest search dropdown, multi-category catalog shuffling, flat glassmorphic top bar, high-key commercial 3D studio category renders, 3D stacked hero carousel, and comprehensive storefront dark mode adoption.
- **Touchpoints 23–32 (Storefront Polish & Wholesale Reviews)**: Admin menu link removal from storefront drawer, hero stacked carousel tab-switching synchronization, left-column hero headline descriptions, minimalist 3D card title capsule, tuned brisk autoplay frequency, dynamic category filtering for brand showcase, compact wholesale review form, on-demand form expansion, symmetrical 2-column reviews layout, and strict on-demand display for rating breakdown.
- **Touchpoints 33–39 (Merchandising, Auth & Quality Automation)**: Live customer review publishing with local fallback, category-specific related accessories engine, automated $\ge 4$-star review approvals and admin moderation queue ($< 4$ stars) (`022_review_approval_system.sql`), Google OAuth sign-in integration, balanced multi-category new arrivals showcase (`023_diverse_new_arrivals.sql`), premium glassmorphic carousel navigation controls, and administrative bestsellers homepage merchandising.
- **Touchpoint 40 (Security Hardening, Catalog Isolation & Defensive Integrity)**: Comprehensive database least-privilege migration (`024_security_hardening.sql`) locking role tampering to administrators, hardcoding 'customer' role on sign-up, isolating storefront stock queries via `products_public` view (security_invoker = on) and revoking anon SELECT on sensitive columns, atomic order bounds & active validation in `create_verified_order`, return evidence path validation, `search_products_v2` query caps, phone masking and admin note stripping in `get_order_by_id`, search_path lockdown across all admin functions, HTML escaping across invoice & print views, and strict same-origin relative path sanitization for authentication redirects.
- **Touchpoint 41 (Two-Phase Storefront Security Hardening, Edge Checkout Gate & 15-Point Penetration Verification)**:
  - **Phase 1 Additive Migration (`026a_storefront_additive.sql`)**: Stored generated column `products.in_stock` (`stock > 0`), safe storefront catalog view `products_public` with embedded `price_tiers`, admin-only view `products_admin`, 128-bit unguessable `public_token` on `orders` and `dealer_applications`, guest RPC `create_verified_order_guest` (service_role only), token-gated `get_order_by_id(text, text)` and `get_dealer_application_by_code(text, text)`, table-backed `checkout_rate_limits` with automatic sliding window IP cleanup, and `max_order_qty` store setting.
  - **Phase 2 Tightening Migration (`026b_storefront_tightening.sql`)**: Dropped legacy overloads (`get_order_by_id(text)` and `create_verified_order(jsonb, jsonb, text)`) eliminating PostgREST ambiguity (PGRST203). Revoked table-wide `SELECT` on `products` from `anon` while granting column-level `SELECT` on safe columns (`products.stock` warehouse counts strictly blocked with HTTP 401). Revoked direct `SELECT` on `orders`, `order_events`, `dealer_applications`, `dealer_events`, and `addresses`. Permanently dropped insecure `customer_addresses` view (SEC-02). Enforced review moderation with `auto_moderate_review`. Restricted `anon` execute privileges to an explicit allowlist of public functions.
  - **Edge Functions Deployed**:
    - `checkout-gate`: Dedicated guest checkout gateway enforcing proxy-appended client IP extraction, table-backed rate limiting (5 checkouts / 10 minutes), Cloudflare Turnstile cryptographic bot verification, honeypot traps, and isolated `service_role` execution.
    - `order-og`: Server-side Open Graph social crawler preview generator for WhatsApp, Facebook, and Twitter crawlers with sanitized order tags, performing HTTP 302 redirects to client SPA tracking routes for real browsers.
  - **Client Applications Hardening**: Dual checkout path in `apps/store` (authenticated customers directly invoke `create_verified_order`, guest customers route through `checkout-gate`), Cloudflare Turnstile challenge widget (`TurnstileWidget.tsx`), Google OAuth button removal from Admin Login (`apps/admin`) enforcing master credentials + TOTP MFA, and referrer policy protection.
  - **Automated Penetration Suite**: 15/15 automated REST penetration tests (`scripts/run_rest_pentest.js`) verified and passing with 100% security compliance against live Supabase backend.
- **Touchpoint 42 (Wholesale Continuous Marquee, Dealership Program, Hindi Localization, `/sjain` Admin Path & Hero Category Visual Linking)**:
  - **Wholesale Marquee (`WholesaleMarquee.tsx`)**: Full-width edge-to-edge seamless marquee displaying real-time wholesale offers and trust badges, backed by Supabase `marquee_announcements` with admin panel controls (`MarqueeManager.tsx`).
  - **Dealership Program & Differentiation (`DealershipProgramPage.tsx` & `DealershipManager.tsx`)**: Interactive margins and tiers table, comparison tree of URT Authorized Dealer vs. Normal Retailer, branded vs. copy item visual showcase, and dual articles backed by `dealership_*` tables.
  - **Hindi Language Localization (`LanguageContext.tsx`)**: Full multi-language support (English / Hindi) with dictionary fallback, persistent user preference, and one-click toggle across top bar, drawer, and footer.
  - **Storefront Footer (`Footer.tsx`)**: Trust badges, express wholesale ordering link, contact information, and directory columns with mobile dock clearance.
  - **Admin Panel URL Path (`/sjain`)**: Configured Vite base and Vercel routing to serve admin application under `/sjain` with automatic redirect from `/admin`.
  - **Hero Category Linking & Visual Picker (`ContentEditor.tsx` & `HeroStackedCarousel.tsx`)**:
    - **Category Routing**: Dropdown to connect any hero banner directly to a specific category route (`/marketplace?category=${slug}`).
    - **Official 3D Studio Visuals**: 1-click buttons to apply high-res dark or light 3D tech renders (`/categories/dark/${slug}.jpg` and `/categories/light/${slug}.jpg`).
    - **Category Product Image Gallery**: Live thumbnail picker fetching products from the selected category to link high-res product photos directly to the banner.
    - **Storefront Carousel Sync**: Dynamically renders custom CTA text (`activeCard.ctaText`) and category deep links.

