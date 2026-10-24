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
│   │   │   ├── components/            # Reusable UI (Two-tier TopBar, NavigationDock, ProductCard, ErrorState, etc.)
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
│   │   └── vite.config.ts             # Includes social crawler Open Graph tag injector
│   │
│   └── admin/                         # Protected Merchant Admin Panel (Vite + React 19)
│       ├── public/                    # Admin assets (logo.png, favicon.ico, favicon.png)
│       ├── src/
│       │   ├── components/            # AdminNavigationDock (Mobile floating capsule dock)
│       │   ├── features/
│       │   │   ├── auth/              # Admin login with username mapping (Sjainthelegend) & role check
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
│       │   ├── keywords.ts            # Keyword normalization, deduplication & validation engine (normalizeKeywords)
│       │   ├── keywords.test.ts       # 15 unit tests covering normalization, trimming, limits & separators
│       │   ├── pricing.ts             # B2B volume pricing calculator & tier matching
│       │   ├── pricing.test.ts        # Unit test suite for pricing engine
│       │   └── index.ts               # Barrel export
│       ├── package.json
│       └── tsconfig.json
│
├── supabase/
│   ├── functions/
│   │   └── order-og/                  # Deno Edge Function for dynamic WhatsApp link previews
│   ├── migrations/
│   │   ├── 001_init.sql               # Core tables, RLS, functions, triggers, and storage
│   │   ├── 002_orders.sql             # Custom order schema (URT-YYMMDD-XXXX) & public order view
│   │   ├── 003_pricing_and_content.sql# Volume tiers, store settings, banners, pages, reviews, audit logs
│   │   ├── 004_pricing_functions.sql  # Real-time analytics, daily sales, RPC order metrics & stock adjust
│   │   ├── 005_create_verified_order.sql # Atomic verified order creation RPC with stock locking
│   │   ├── 007_policies_and_dealers.sql # Store policies, dealer applications, audit events & RPCs
│   │   ├── 008_catalog_uploads.sql    # Catalog upload batches, items & recursive get_category_descendant_ids
│   │   ├── 009_category_attributes.sql# Category specification schemas & attribute inheritance
│   │   ├── 009_catalog_keywords.sql   # Products keywords text[], GIN index, normalize_keywords_array & search RPC
│   │   ├── 010_catalog_images.sql     # Catalog images bucket, metadata table & RLS
│   │   ├── 016_admin_submit_catalog_images.sql # Image validation for bulk upload batches
│   │   └── 019_bulk_product_ops.sql   # Bulk product operations auditing, dry-run RPCs, and 1-click undo
│   └── seed.sql                       # 12 categories, 18 subcategories, products & volume tiers
│
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

### 2. Light Theme Only
- Crisp, clean, high-contrast light theme with `#F8F9FB` canvas (and `#ECEEED` soft slate backdrop for the admin panel).
- Dark mode toggles and dark styles are deliberately excluded to preserve brand identity.

### 3. Brand Signature Gradient
Runs vertically **Top → Bottom**:
| Token | Hex Code | Purpose |
| :--- | :--- | :--- |
| `--color-brand-light` | `#5ADBE5` | Gradient start, active pill highlights |
| `--color-brand` | `#1EAFC7` | Intermediate accent, focus rings |
| `--color-brand-dark` | `#0A82A8` | Gradient end, primary CTA buttons, badges |

### 4. Official Brand Logo
- Icon: Cyan circular badge with stylized black bunny/rat mark with 'x' and 'o' eyes.
- Uniformly deployed as:
  - Web Favicons (`favicon.ico`, `favicon.png`, `apple-touch-icon`).
  - Store Topbar logo capsule & Mobile Bottom Capsule Navigation.
  - Admin Left Sidebar header & Admin Portal Login.
  - "Urbanrat Original" product collection badges.

### 5. Tailwind CSS v4 Canonical Token Architecture
The styling architecture across both apps is powered by Tailwind CSS v4 with unified design tokens declared via `@theme` in `index.css`:
- **Theme Color Tokens**:
  - `--color-brand-light: #5ADBE5` (Cyan highlight / gradient start)
  - `--color-brand: #1EAFC7` (Primary intermediate cyan accent / focus rings)
  - `--color-brand-dark: #0A82A8` (Deep cyan gradient stop / primary CTA buttons)
  - `--color-surface: #F8F9FB` (Light theme canvas backdrop)
- **Token Standardization & Cleansing**: Arbitrary color brackets (`bg-[#...]`, `text-[#...]`) and ad-hoc styling were systematically refactored across 22+ files in favor of standard tokens:
  - `bg-brand-dark`, `text-brand-dark`, `border-brand-dark`
  - `focus:ring-brand-light`, `focus:border-brand`
  - `bg-surface`
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

3. **B2B Wholesale Volume Pricing**:
   - Volume tier discounts configured per product (e.g. 10–49 units, 50–99 units, 100+ units).
   - Interactive tiered savings preview directly on product pages and in the cart.
   - Server-side verification via Supabase Postgres RPC prevents client-side price tampering.

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
     - Generates standard alphanumeric order code (`URT-YYMMDD-XXXX`).
   - One-click WhatsApp message generation pre-formatted with order details, lines, and delivery address.

6. **Order Tracking & Social Sharing (`/order/:orderId`)**:
   - Real-time order timeline (*Pending → Confirmed → Processing → Shipped → Delivered*).
   - Edge Function `order-og` provides rich link preview cards when sharing orders on WhatsApp.

7. **Dedicated Orders & Invoices Portal (`/orders`, `/my-orders`)**:
   - Independent customer management page listing authenticated wholesale orders.
   - Status filters (*All*, *In Progress*, *Delivered*, *Cancelled*).
   - One-click copy for Order IDs (`URT-YYMMDD-XXXX`), line-item breakdowns with savings highlights.
   - Guest quick tracking search with instant jump to `/order/:orderId`.
   - Direct depot WhatsApp escalation button.

8. **Authorized Dealer Network Application (`/dealers`, `/become-a-dealer`)**:
   - B2B distributor/retailer partnership portal.
   - Multi-step validated application (Business name, owner name, 10-digit mobile, GSTIN validation regex, address, pincode, estimated monthly wholesale volume, product category interest chips).
   - Submits directly to `submit_dealer_application` RPC and generates a persistent tracking code (`DLR-YYMMDD-XXXX`).
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
   - **Admin Profile Card**: Displays admin avatar (`SJ`), username (`Sjainthelegend`), role badge (`Super Admin`), and 1-click **Sign Out**.

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
    - **Supplier-Grade Catalog Workflow**: Complete catalog upload experience inspired by modern wholesale supplier platforms, styled to Urbanrat's brand identity (Tailwind v4 tokens: `brand-light`, `brand`, `brand-dark`, `surface`; light theme only; 390px mobile-first; LeaseFlow sidebar on desktop; `AdminNavigationDock` on mobile; Web Vibration API haptics; Lucide icons).
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
| `001_init.sql` | Core schema & auth | `profiles`, `categories`, `products`, `cart_items`, RLS policies, role protection trigger. |
| `002_orders.sql` | Custom order format | `orders`, `order_items`, order number generator (`URT-YYMMDD-XXXX`), public view. |
| `003_pricing_and_content.sql` | B2B & content expansion | `price_tiers`, `store_settings`, `banners`, `store_pages`, `product_reviews`, `stock_movements`, `customer_addresses`, storage buckets (`banners`, `avatars`). |
| `004_pricing_functions.sql` | Analytics & Admin RPCs | `get_cart_pricing`, `admin_dashboard_stats`, `admin_sales_by_day`, `admin_orders_by_status`, `admin_top_selling_products`, `admin_adjust_stock`, `admin_save_product_tiers`. |
| `005_create_verified_order.sql` | Atomic order verification | `create_verified_order` transactional function verifying stock and volume tier pricing. |
| `006_custom_order_id.sql` | Alphanumeric order sequencing | Standardizes `URT-YYMMDD-XXXX` sequential format and public order lookup policy. |
| `007_policies_and_dealers.sql` | Policy metadata & Dealer B2B portal | `store_pages` publishing columns (`is_published`, `sort_order`, `show_in_footer`, `meta_description`), `dealer_applications` table, and `submit_dealer_application` RPC. |
| `008_catalog_uploads.sql` | Catalog upload batches & recursive hierarchy | `catalog_uploads`, `catalog_upload_items`, `get_category_descendant_ids` recursive function, RLS policies. |
| `009_category_attributes.sql` | Dynamic category attribute schemas | `category_attributes` table, options JSONB array, RLS policies, indexing. |
| `009_catalog_keywords.sql` | Search keywords, GIN index & search RPC | `alter table products add column keywords text[] not null default '{}'`, `idx_products_keywords` GIN index, `normalize_keywords_array(p_raw jsonb)`, `admin_submit_catalog`, and `search_products(p_query text)`. |
| `010_catalog_images.sql` | Catalog Image Library & storage policies | Storage bucket `catalog-images`, `catalog_images` table with RLS, indexes on `(created_at desc)`, `batch_id`, `sku_hint`, and `admin_delete_catalog_image` RPC with product usage protection. |
| `010_customer_auth_and_addresses.sql` | Customer verification & Address book | `profiles` customer fields, `customer_addresses` table with default address trigger and RLS. |
| `011_order_events_and_details.sql` | Order auditing & event log | `order_events` timeline table, RLS, status change audit trigger. |
| `012_returns_backend.sql` | Full returns & reverse logistics | `return_requests`, `return_items`, `return_events`, `return-evidence` storage bucket, `create_customer_return`, and `admin_update_return_status` RPCs. |
| `013_seller_hub_orders.sql` | Seller Hub order logistics & tracking | Orders `on_hold` status, courier tracking fields (`courier_name`, `awb_number`), `admin_update_order_shipping` RPC, customer stats. |
| `014_admin_returns_and_claims.sql` | Admin claims & return performance | Claims columns, `admin_update_return_claim` RPC, `get_product_return_performance` RPC, and pending counters. |
| `016_admin_submit_catalog_images.sql` | Catalog upload image validation | Enforces "at least 1 image" per product in `admin_submit_catalog`, accepts `catalog-images` URLs, and recomputes upload stats. |

### Storage Buckets

1. **`product-images`** (Public: `true`): High-resolution product photography.
2. **`banners`** (Public: `true`): Hero banners and promotional media.
3. **`avatars`** (Public: `true`): Customer and administrator profile pictures.
4. **`catalog-images`** (Public: `true`): High-performance WebP catalog photography and Image Library assets.
5. **`return-evidence`** (Public: `false`): Private bucket for customer return dispute photos and unboxing videos.

### Default Admin Credentials

- **Username**: `Sjainthelegend`
- **Default Auth Email**: `sjainthelegend@urtwholesale.com`
- **Initial Master Password**: `URTshubham@1`
- *Note*: Credentials can be updated at any time by navigating to **Store Settings → Admin Credentials & Master Password**.

---

## 6. Technology Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Language** | TypeScript | ~5.8 | Strict type safety across apps and shared models |
| **UI Framework** | React | 19.3 | Modern component-driven reactive architecture |
| **Bundler & Server** | Vite | 6.3 | Ultra-fast HMR and optimized production bundling |
| **Styling** | Tailwind CSS | 4.1 | Utility-first styling with custom design tokens |
| **Spreadsheet Engine**| SheetJS (`xlsx`) | 0.18.5 | Universal Excel (`.xlsx`, `.xls`) & CSV parsing and multi-sheet template generation |
| **Routing** | React Router | 7.5 | Client-side routing with deep link support |
| **Icons** | Lucide React | 1.16 | Cohesive modern icon system |
| **Backend & DB** | Supabase JS | 2.106 | Realtime PostgreSQL, RLS security, and storage |
| **Monorepo Manager** | npm workspaces | 10+ / 11+ | Clean multi-package dependency management |
| **Testing** | Vitest | 3.0 | Unit tests across shared pricing, order creation, validation, keyword normalization, and catalog image parsing/validation (88 tests) |

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
VITE_SUPABASE_URL=https://mmuuqzgclrdhcvrcavgi.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
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

### Option A: Unified Monorepo Deployment (Recommended)
Deploy the entire monorepo as a single unified Vercel deployment where the storefront is served at `/` and the admin panel is served at `/admin`:

1. **Import Git Repository**: Select `urtwholesale/Urtwholesale`.
2. **Framework Preset**: Select **`Vite`**.
3. **Root Directory**: `.` (monorepo root).
4. **Build Command**: `npm run build` *(executes store & admin builds and merges dist artifacts into `dist/` and `dist/admin/`)*.
5. **Output Directory**: `dist`.
6. **Environment Variables**: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
7. **Routing (`vercel.json`)**:
   - `/admin/:path*` → `/admin/index.html` (Admin deep links)
   - `/admin` → `/admin/index.html` (Admin entry point)
   - `/(.*)` → `/index.html` (Storefront SPA fallback)

### Option B: Standalone Multi-Project Deployment (Alternative)
Deploy each application as an independent Vercel project on separate subdomains (e.g. `store.urbanrat.in` and `admin.urbanrat.in`):

#### Deploying the Storefront (`apps/store`)
1. **Import Git Repository**: Select `urtwholesale/Urtwholesale`.
2. **Framework Preset**: Select **`Vite`**.
3. **Root Directory**: Select **`apps/store`**.
4. **Build Command**: `tsc -p tsconfig.json && vite build` (or `npm run build:store`).
5. **Output Directory**: `dist`.
6. **Environment Variables**: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

#### Deploying the Admin Panel (`apps/admin`)
1. **Import Git Repository**: Import `urtwholesale/Urtwholesale` as a second project (e.g., `urbanrat-admin`).
2. **Framework Preset**: Select **`Vite`**.
3. **Root Directory**: Select **`apps/admin`**.
4. **Build Command**: `tsc -p tsconfig.json && vite build` (or `npm run build:admin`).
5. **Output Directory**: `dist`.
6. **Environment Variables**: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

---

## 9. Recent Changelog

- **Search Keywords System & Reusable `KeywordsInput` Across All Catalog Touchpoints (`apps/admin/src/features/catalog/components/KeywordsInput.tsx`)**: Built a complete manual "Search Keywords" feature to boost catalog product discovery across admin workflows and the customer storefront:
  - **Reusable Chip Component (`KeywordsInput.tsx`)**: Mobile-first tag input with brand design tokens (`bg-brand-light/20`, `text-brand-dark`), live counter (`"X / 30"`), dynamic red inline error alerts, keyboard navigation, `aria-label`, remove buttons, and Web Vibration API haptics (`triggerHaptic("heavy")` on error/duplicate, `"selection"` on add/remove).
  - **Delimited & Pasted Text Parsing**: Adds keywords on `Enter`, comma (`,`), or `blur`. Pasting comma, semicolon, pipe, or newline-delimited strings automatically parses and distributes them into distinct chips.
  - **Domain Validation & Normalization Engine (`@urbanrat/shared`)**: `normalizeKeywords` function in `packages/shared/src/keywords.ts` automatically trims whitespace, converts to lowercase, collapses inner whitespace, removes duplicate entries, and enforces strict limits (max 30 keywords per product, max 50 characters each). Backed by 15 passing Vitest unit tests (`packages/shared/src/keywords.test.ts`).
  - **Touchpoint 1 — SingleCatalogWizard (Step 2: Search & Discovery)**: Product tabs store per-product keyword lists in draft state. "Copy input details to all products" preserves independent keywords unless the "Apply keywords to all products" toggle is explicitly enabled. Supports local storage autosave (`urbanrat_catalog_single_draft`) and submission summary logging.
  - **Touchpoint 2 — Universal Bulk Template & Ingestion (SheetJS `xlsx`)**: Integrated SheetJS (`xlsx`) to generate 2-sheet workbooks (`Products Template` + `Instructions`) with a "Keywords" column. Universal spreadsheet parser (`catalogParser.ts`) reads `.xlsx`, `.xls`, and `.csv` files, flags keyword limit violations with `qc_error`, and allows inline chip editing directly in the bulk preview table (`BulkCatalogModal.tsx`).
  - **Touchpoint 3 — QC Error-Fix Drawer (`UploadDetailModal.tsx`)**: Slide-over drawer for flagged items, integrating `KeywordsInput` in the inline fix form to edit keywords and re-verify items into `qc_pass`.
  - **Touchpoint 4 — ProductEditor (`ProductEditor.tsx`)**: Added `KeywordsInput` to edit keywords post-publishing, persisting directly to `products.keywords`.
  - **Touchpoint 5 — Catalog Upload History Search (`UploadHistoryList.tsx`)**: Extended search filter to match keywords and notes inside upload batches.
  - **Database Migration (`009_catalog_keywords.sql`)**: Non-destructive migration adding `keywords text[] NOT NULL DEFAULT '{}'` to `products`, creating a GIN index `idx_products_keywords`, adding the `normalize_keywords_array(p_raw jsonb)` helper, updating `admin_submit_catalog`, and updating storefront `search_products(p_query text)` to match keywords alongside title, SKU, and brand.

- **Direct Quantity Selection via Interactive Volume Tier Buttons (`ProductDetailPage.tsx`)**:
  - Converted static volume tier cards (`1-9 pcs`, `10-49 pcs`, `50+ pcs`) in `ProductDetailPage.tsx` into fully interactive `<button>` elements with `handleSelectTier`.
  - Clicking any tier card immediately updates the order quantity to that tier's minimum requirement, respecting wholesale `min_order_qty`, stepping by `order_qty_step`, and clamping to available `stock`.
  - Real-time visual feedback: active highlight ring (`ring-2 ring-brand-light/40 shadow-xs`), active badge, live unit price update, and estimated line subtotal math.
  - Interactive "Add N more to get tier price" nudge helper below the stepper with an "Apply" shortcut to jump directly to the next volume tier.
  - Full keyboard accessibility (`Enter` / `Space`) and native Web Vibration API haptics (`triggerHaptic("selection")`).

- **Tailwind CSS v4 Canonical Token Standardization & Warning Clean-up (`@[current_problems]`)**:
  - Replaced legacy arbitrary pixel brackets and gradient syntax across catalog components with standard Tailwind CSS v4 tokens:
    - `bg-gradient-to-r` → `bg-linear-to-r` in `CatalogUploadHome.tsx`.
    - `min-w-[260px]`, `max-w-[340px]`, `max-w-[200px]`, `min-h-[360px]`, `max-h-[640px]` → `min-w-65`, `max-w-85`, `max-w-50`, `min-h-90`, `max-h-160` in `CategoryColumn.tsx`.
    - `max-w-[220px]` → `max-w-55` in `CategoryDeleteModal.tsx`.
    - `after:top-[2px] after:left-[2px]` → `after:top-0.5 after:left-0.5` in `CategoryEditModal.tsx`.
    - `max-h-[460px]` → `max-h-115` in `CategoryManagerModal.tsx`.
    - `min-h-[320px]`, `h-[280px] sm:h-[320px]` → `min-h-80`, `h-70 sm:h-80` in `CategoryCascader.tsx`.
    - `min-h-[46px]` → `min-h-11.5` in `KeywordsInput.tsx`.

- **Category Manager, Multi-Column Finder Browser & Attribute Schemas (`apps/admin/src/features/catalog/categories/`)**: Built a full-featured category management system with 4-level nesting (L1 Main Category | L2 Subcategory | L3 Product Group | L4 Item Variety) and dynamic product specification schemas:
  - **Finder-Style Column Browser**: 4-column drill-down browser on desktop with dark pill active highlighting and right chevrons; collapses to stacked drill-down list on mobile with breadcrumb navigation.
  - **Category Lifecycle Controls**: Create, rename, parent reassignment, active/inactive toggle, up/down sibling reordering, and WebP thumbnail upload.
  - **Safe Deletion Pre-Flight Engine**: Blocks category deletion if subcategories or assigned products exist, showing detailed diagnostic reasons.
  - **Dynamic Attribute Engine (`category_attributes`)**: Dynamic specification builder (`text`, `number`, `select`, `multiselect`, `boolean`) with option tag chips, required toggle, and tree inheritance (inherited attributes displayed as read-only chips).
  - **Top Search Box**: Live search query ("Try Chargers, Earphones, Cables…") that filters across all 4 levels and automatically jumps and opens the column tree to matching items.
  - **Navigation Integration**: Grouped "Catalog" item under *Commerce & Sales* with sub-items "Categories" and "Upload Catalog", mirrored in mobile `AdminNavigationDock` menu drawer.
  - **Database Migration (`009_category_attributes.sql`)**: Applied and verified live in Supabase.
- **Category-Wise Catalog Upload System & QC Verification Workflow (`apps/admin/src/features/catalog/`)**: Built a complete supplier-inspired catalog upload and multi-level hierarchy management system tailored to Urbanrat's brand design system (Tailwind v4 tokens: `brand-light`, `brand`, `brand-dark`, `surface`; light theme only; 390px mobile-first; LeaseFlow sidebar on desktop; `AdminNavigationDock` on mobile; Web Vibration API haptics; Lucide icons). Key highlights:
  - **4-Level Nested Category Tree & Manager (`CategoryCascader.tsx` & `CategoryManagerModal.tsx`)**: Enforces up to 4 levels of depth (L1 Main Category → L2 Subcategory → L3 Product Group → L4 Leaf Item Variety) with recursive depth constraint checks, live search filtering, parent reassignment, and WebP thumbnail upload.
  - **Single Catalog Upload Wizard (`SingleCatalogWizard.tsx`)**: 2-step guided wizard for single product creation. Step 1 selects category via 4-column cascader and captures front image with automated client-side WebP compression. Step 2 configures product details, SKU, specifications, stock, and B2B volume pricing tiers with validation.
  - **Bulk Catalog CSV Upload Flow (`BulkCatalogModal.tsx`)**: Category-wise bulk upload with dynamic CSV template generator (`templateGenerator.ts`), client-side CSV parsing and validation (`catalogParser.ts`), row-level error diagnostic table, and atomic batch insertion with audit logging.
  - **Upload History & QC Verification Dashboard (`UploadHistoryList.tsx`, `UploadDetailModal.tsx`)**: Tabbed history tracking (Bulk Uploads vs Single Uploads) with QC status pills (*All*, *Action Required*, *QC in Progress*, *QC Error*, *QC Pass*), summary statistics cards (*Total Uploads Done*, *Using Bulk Uploads*, *Using Single Uploads*), category filtering, file ID search, and item-by-item verification log inspector.
  - **Storefront Backward Compatibility (`apps/store/src/services/storeService.ts`)**: Recursive category descendant resolution (`get_category_descendant_ids` RPC with fallback) ensuring products assigned to deeper L3/L4 nodes seamlessly appear when customers browse parent L1/L2 categories.
  - **Database Migration (`008_catalog_uploads.sql`)**: Created `catalog_uploads` and `catalog_upload_items` tables with RLS policies, indexing, and the recursive `get_category_descendant_ids` Postgres function.
- **Client-Side WebP Image Compressor Engine (`ImageCompressorTool.tsx` & `imageCompressor.ts`)**: Added a browser-native image compression engine utilizing HTML5 Canvas WebP encoding with dimension clamping (1200px for products, 1920px for hero banners) and visual quality optimization (82%–84%). Reduces banner and catalog image sizes by **65%–85%** before uploading to Supabase Storage, dramatically accelerating mobile storefront Largest Contentful Paint (LCP). Features an interactive standalone tool with live side-by-side preview comparisons, dimension sliders, and automated in-flight compression inside `adminService.ts`.
- **Mobile Admin Navigation Dock (`AdminNavigationDock.tsx`) & Customer UI Parity**: Implemented an ergonomic floating frosted glass bottom capsule dock for the Admin Panel on mobile viewports (`< 768px`). Features 5 quick-switch tabs (Dashboard, Products, Orders, Content, Menu) and a slide-up bottom sheet drawer with quick access to Settings, Standalone Image Compressor, Live Sync toggle, and Super Admin Sign Out, while preserving the LeaseFlow sidebar on desktop (`>= 768px`).
- **Standardized 5:4 Fixed Aspect Ratio Hero Media (`aspect-5/4`)**: Locked all promotional hero banners in the customer storefront (`HomePage.tsx`) and admin preview (`ContentEditor.tsx`) to a fixed 5:4 aspect ratio (`aspect-5/4`) with smooth rounded corners and `object-cover` focal rendering, eliminating layout shifts and image squishing.
- **Desktop Topbar Clearance Spacing (`pt-20 md:pt-36`)**: Adjusted main content container padding to `md:pt-36` on desktop viewports in `apps/store/src/App.tsx`, completely resolving hero banner clipping underneath the sticky two-tier glassmorphic header.
- **Tailwind CSS v4 Canonical Token Standardization**: Systematically refactored styling across 22+ components in store and admin apps to replace arbitrary styles with canonical `@theme` tokens (`--color-brand-light`, `--color-brand`, `--color-brand-dark`, `--color-surface`), modern Tailwind v4 gradient syntax (`bg-linear-to-b`, `bg-linear-to-r`), and standard utilities (`stroke-2`, `stroke-3`, `max-w-90`, `rounded-t-4xl`).
- **Products Feature Barrel Export Architecture (`apps/admin/src/features/products/index.ts`)**: Introduced a modular barrel export pattern for product catalog management, simplifying imports across the admin application.
- **Unified Production Deployment Pipeline (`vercel.json` & Root Build)**: Configured a unified monorepo build script (`npm run build`) and Vercel routing rules enabling both customer storefront (`/`) and admin dashboard (`/admin`) to run seamlessly from a single unified deployment with deep linking support.
- **Direct Quantity Numeric Input & Steppers**: Implemented a responsive `QuantityInput.tsx` component used across product detail views (`ProductDetailPage.tsx`) and the shopping cart (`CartPage.tsx`). B2B buyers can directly type bulk volume numbers (e.g. 50, 100, 250) or use `+` / `-` buttons, with real-time recalculation of volume pricing tiers, line subtotals, and cart totals.
- **Interactive Store Menu Drawer & Auth Action**: Implemented a slide-up bottom sheet / desktop modal (`StoreMenuDrawer.tsx`) triggered from the navigation dock and sub-topbar. Includes structured storefront links, category quick-jump, WhatsApp wholesale desk, company policies, and a prominent **Login** (guest toggle into `CustomerAuth`) or **Logout** button (`supabase.auth.signOut()`) at the very bottom.
- **Enlarged Centerpiece Logo Navigation Dock**: Scaled up the center Urbanrat logo button in `NavigationDock.tsx` to `w-14 h-14` / `w-15 h-15` with an elevated centerpiece ring and glow shadow, establishing a bold focal hierarchy over the standard navigation icons.
- **Admin Sidebar Redesign**: Replaced the top horizontal tab row with a modern left sidebar inspired by LeaseFlow (hub switcher, active pill treatment, grouped sections, live sync toggle, and admin user card).
- **Banner Image Uploader**: Added direct file uploader, live thumbnail preview, and image removal buttons in `ContentEditor.tsx` connected to the `banners` bucket.
- **Official Brand Logo & Favicons**: Integrated the official Urbanrat logo across favicons, app headers, docks, product cards, login portals, and footers.
- **Centered Sub-Topbar**: Relocated desktop storefront navigation into a centered sub-topbar directly beneath the logo capsule.
- **Admin Authentication & Self-Service**: Added username login mapping (`Sjainthelegend`) and in-app master password management.
- **Atomic Verified Orders**: Implemented `create_verified_order` RPC with transactional stock locking and volume tier verification.
- **Manual "Search Keywords" Catalog Upload & Storefront Search System (`009_catalog_keywords.sql`)**:
  - Added `keywords text[] NOT NULL DEFAULT '{}'` column to `products` with a Postgres GIN index (`idx_products_keywords_gin`) for fast array containment and trigram matching.
  - Built `KeywordsInput.tsx` reusable chip component for catalog product editors and wizards with brand styling (`bg-brand-light/20`, `text-brand-dark`), live limits ("X / 30"), inline validation, keyboard/paste splitting, and helpful guidance text.
  - Implemented `normalizeKeywords()` in `packages/shared/src/keywords.ts` (trim, lowercase, duplicate removal, max 30 keywords, 50 chars each) backed by comprehensive Vitest unit tests.
  - Updated `admin_submit_catalog` RPC to normalize keywords and transfer them from `payload.keywords` to `products.keywords`.
  - Updated storefront search function `search_products()` to search across `keywords` alongside title, SKU, and brand.
- **Saved Address Book & Customer Authentication System (`010_customer_auth_and_addresses.sql`)**:
  - **Wholesale Customer Authentication (`AuthContext.tsx`, `CustomerAuth.tsx`, `LoginPage.tsx`)**:
    - Sign up with Full Name, 10-digit Indian Mobile (`^[6-9]\d{9}$`), Email, Password, and optional Wholesale business details (Business/Store Name and 15-character GSTIN with regex format validation).
    - Email + Password login, "Forgot password" Supabase reset email delivery, and "Continue as guest" workflow.
    - App-wide `AuthContext` managing reactive session persistence, profile caching, login, signup, profile updates, and logout.
    - Protected route guards (`<ProtectedRoute />`) for `/account`, `/addresses`, `/orders`, and `/my-orders` redirecting unauthorized users to `/login` with clean return-to-destination redirect.
    - Cart survival on login: automatically merges guest cart (`localStorage`) with database `cart_items` upon authentication so items are never lost.
  - **Saved Address Book (`AddressesPage.tsx`, `AddressFormModal.tsx`, `AddressPicker.tsx`, `addressService.ts`)**:
    - Full address domain model: `label` (Shop / Warehouse / Home / Other), `full_name` (contact person), `phone`, optional `business_name`, optional `gstin`, `line1`, `line2`, `landmark`, `city`, `state` (dropdown of 36 Indian States and UTs), `pincode` (6-digit validated), and `is_default`.
    - Database single-default guarantee: enforced with a `BEFORE INSERT OR UPDATE` trigger (`handle_address_default_toggle`) and partial unique index (`idx_addresses_single_default` on `addresses(user_id) WHERE is_default = true`).
    - Row-Level Security (RLS): customers manage exclusively their own addresses; admins manage all.
    - Bottom sheet on mobile (390px) and modal on desktop (`AddressFormModal.tsx`) for adding and editing addresses.
    - Dedicated `/addresses` page with address cards, default badges, edit modal, delete with safety confirmation dialog, and "Set as default" action.
    - Reusable `<AddressPicker />` component integrated into the checkout flow (`CartPage.tsx`), featuring selectable cards, preselected default address, and a 1-tap "Add new address" sheet.
    - Customer Account screen (`/account`) with profile viewing, inline modal edit, address count preview, order tracking shortcuts, and sign out.
    - Comprehensive shared validation engine (`packages/shared/src/validation.ts`) and Vitest test suite (`packages/shared/src/validation.test.ts`).
- **Wholesale-Aware Marketplace Orders Rebuild (`/my-orders` & `/order/:orderId`) (`011_order_events_and_details.sql`)**:
  - **Marketplace "My Orders" Dashboard (`apps/store/src/pages/MyOrdersPage.tsx`)**:
    - Modeled on a clean, premium marketplace layout with a 2-column desktop view and responsive mobile-first (390px) bottom-sheet filters.
    - **Live Multi-Criteria Search & Filtering**: Instant search across Order Codes (`id`), Product Titles, and SKUs. Filter sidebar with Order Status (*All*, *On the way / In Progress*, *Delivered*, *Cancelled*, *Returned / Replaced*) and Time Period (*Last 30 days*, *Past 6 months*, *This Year*, *Older Orders*), featuring active filter chips and 1-tap "Clear all".
    - **Wholesale-Aware Order Cards**: First product thumbnail with `+N more` counter badge, 1-click Order ID copy button, date and item count, line items preview showing quantity, unit price, and applied wholesale volume tiers, and colored status indicator with the latest operational message from `order_events`.
    - **Integrated Actions**:
      - *View details*: navigates directly to `/order/:orderId`.
      - *Reorder*: 1-tap reorders all items directly into the cart with haptic feedback and cart sync.
      - *Download Invoice*: generates and prints a formal GST Wholesale Tax Invoice.
      - *Return / Report Issue*: opens the issue resolution modal for delivered or in-transit consignments.
    - **Pagination & Empty States**: Clean 6-orders-per-page pagination, empty state with an embedded quick-track search input for guests or offline orders.
  - **Wholesale Order Tracking & Detail View (`apps/store/src/pages/OrderPage.tsx`)**:
    - **Interactive Vertical Timeline**: Renders chronological progression (`Placed` → `Confirmed` → `Processing` → `Shipped` → `Delivered` or special `Cancelled` / `Returned` branches) with checkmark icons, active pulsing rings, timestamps, and carrier tracking notes. Includes an expandable "See All Updates" full audit log.
    - **Collapsible Delivery & Price Cards**:
      - *Delivery Details*: Expandable accordion displaying delivery recipient snapshot, contact phone, complete address line, pincode, and wholesale buyer entity (Business Name and GSTIN).
      - *Price Details*: Breakdown including Items Subtotal, Wholesale Volume Tier Savings (highlighted in emerald), Taxable Base Value, CGST (9%), SGST (9%), Shipping Logistics (Free or calculated), and Grand Total.
    - **Line Items Inspection**: Primary product hero card with unit price, volume tier badge, and quantity, plus a dedicated list for other order items with individual "+ Reorder Item" buttons.
    - **Wholesale Support & Deep Links**: "Chat with us on WhatsApp" deep-link banner prefilled with the Order ID and customer inquiry, plus 1-Year URT Wholesale Warranty resolution desk link.
    - **Access Control & Guest Tracking**: Authenticated customers view their own orders via RLS (`user_id = auth.uid()`). Direct order lookup is accessible to guests via the order code (`/order/:orderId` and `/order`), while mismatched authenticated user accounts are prevented from accessing other customers' orders.
  - **GST Wholesale Tax Invoice Generator (`apps/store/src/utils/invoiceGenerator.ts`)**:
    - Generates a print-ready and PDF-downloadable GST Wholesale Tax Invoice featuring Urbanrat Technologies' registered GSTIN (`27AAPFU0939F1ZV`), customer billing/shipping details, line items table with HSN/SAC, wholesale tier badges, taxable value breakdown, 9% CGST + 9% SGST breakdown, and authorized signature block.
  - **Return & Report Issue Modal (`apps/store/src/components/ReturnReportIssueModal.tsx`)**:
    - Allows wholesale customers to report DOA, transit damage, wrong dispatch, or quantity shortages under the 1-Year Warranty, with item selection, problem descriptions, and direct WhatsApp routing prefilled with order details.
  - **Database Migration (`011_order_events_and_details.sql`)**:
    - Extended `orders_status_check` to support `'returned'` status.
    - Enhanced `get_order_by_id` RPC function to return complete order data with embedded chronological `events` array from `order_events`.
- **Wholesale Returns, Replacements & Refunds Backend (`012_returns_backend.sql`)**:
  - **Database Architecture**:
    - `return_requests`: Return request master table featuring unique human-readable code `return_code` (`RET-YYMMDD-XXXX` generated with collision retry), `order_id` (cascading), `user_id` (cascading), `type` (`return`, `replacement`, `refund`), `status` (11 standard statuses), `reason_code` (6 standard wholesale reasons), `description`, `evidence_paths` (text array), `requested_at`, `resolved_at`, `refund_amount`, `admin_note`, and timestamps with automatic `handle_updated_at` trigger.
    - `return_items`: Line-item breakdown per return request tracking `return_id`, `order_item_id`, `product_id` (foreign key to `products`), `quantity`, `reason_code`, `condition` (`unopened`, `opened`, `damaged`, `defective`), and timestamps.
    - `return_events`: Append-only audit trail logging every return status transition, operational notes, `actor_id` (customer or admin user ID), and timestamps.
    - Storage bucket `return-evidence`: Private storage bucket (`public = false`) with 20 MB limit supporting images and videos (`image/jpeg`, `image/png`, `image/webp`, `image/avif`, `video/mp4`, `video/quicktime`, `video/webm`).
    - Configurable return window: Seeded `return_window_days` (`7` days default) into `store_settings`.
  - **Validated Security Definer RPCs**:
    - `create_return_request(p_order_id text, p_items jsonb, p_type text, p_reason text, p_description text, p_evidence_paths text[])`: Validates caller authentication, verifies order ownership (`order.user_id = auth.uid()`), enforces that only `delivered` orders are returnable, checks that the delivery date is within `return_window_days`, groups and validates that requested product quantities do not exceed delivered minus already requested/returned quantities, generates the unique `RET-YYMMDD-XXXX` code, inserts return request and line items, logs initial audit trail event to `return_events`, and adds a notification event to `order_events`.
    - `admin_update_return_status(p_return_id uuid, p_new_status text, p_note text, p_refund_amount numeric)`: Enforces `is_admin()`, validates allowed state transitions across the 11 statuses, updates `refund_amount` and `resolved_at`, automatically restocks catalog inventory via `admin_adjust_stock` when moving to `qc_passed` for return type (guaranteed idempotency), writes to `return_events`, and syncs major milestones to `order_events`.
    - `get_return_stats(p_days integer)`: Admin-only analytics RPC computing total returns, delivered orders count, return rate percentage, total refunds value, status counts breakdown, reason code breakdown with percentages, and top returned products list with returned quantities.
  - **Row Level Security (RLS)**:
    - Customers can SELECT only their own return requests, return items, and return audit events (`auth.uid() = user_id` or join check).
    - Admins have full access (`public.is_admin()`) to read, update, and manage all return tables.
    - Storage RLS: Customers can upload and view evidence only in their designated user folders (`{auth.uid()}/...`); admins have full access across the entire bucket.
  - **Shared Types & Unit Tests (`packages/shared`)**:
    - Created `packages/shared/src/types/return.ts` with TypeScript interfaces (`ReturnType`, `ReturnStatus`, `ReturnReasonCode`, `ReturnItem`, `ReturnEvent`, `ReturnRequest`, `ReturnStats`, input payloads, labels, and type guards).
    - Added unit test suite in `packages/shared/src/returns.test.ts` with 100% passing tests.
- **Wholesale Returns & Customer Portal UI (`apps/store`)**:
  - **Return / Replace Action on Delivered Orders (`MyOrdersPage.tsx` & `OrderPage.tsx`)**:
    - Evaluates order delivery status and return window (`store_settings.return_window_days`, default 7 days from the delivery event timestamp).
    - If within window, displays an active "Return / Replace (Nd left)" button with haptic feedback that launches the 3-step return request modal.
    - If expired, cleanly renders a muted "Return window closed" indicator.
  - **3-Step Return Request Flow (`ReturnRequestModal.tsx`)**:
    - Bottom sheet on mobile (390px) and modal on desktop:
      - **Step 1 (Items & Quantities)**: Select items and adjust return quantity using steppers, strictly capped at eligible delivered quantity.
      - **Step 2 (Type & Reason)**: Select resolution type (`return` with refund, `replacement` under wholesale warranty, `refund`) and reason code (`damaged`, `defective`, `wrong_item`, `short_quantity`, `quality_issue`, `other`) with detailed description.
      - **Step 3 (Evidence & Review)**: Upload 1–5 photos or videos with browser-native WebP compression before uploading to private `return-evidence` bucket, live review summary, and submission via `create_return_request` RPC.
      - **Step 4 (Success)**: Confirmed return code pill, direct link to track return, and return list shortcut.
  - **Dedicated Returns Portal (`apps/store/src/pages/ReturnsPage.tsx`)**:
    - Accessible at `/returns` with status filter tabs (*All*, *Active*, *Completed*, *Rejected*) and live item counts.
    - Search input supporting search by return code (`RET-YYMMDD-XXXX`), order ID, or reason.
    - Return cards displaying status pills, order code, request date, reason label, items summary, and refund amount.
  - **Return Detail View (`apps/store/src/pages/ReturnDetailPage.tsx`)**:
    - Accessible at `/returns/:returnId` with breadcrumbs and 1-click return code copy button.
    - Chronological vertical timeline rendered from `return_events` with timestamps, notes, and actor labels.
    - Resolution card with refund amount (highlighted in emerald), replacement information, and admin notes when present.
    - Return items list showing product thumbnails, SKUs, and return quantities.
    - Evidence gallery rendering signed URLs from private `return-evidence` storage with full-screen lightbox image preview.
    - Direct WhatsApp resolution link prefilled with the return code.
  - **Orders Integration & Cross-Linking**:
    - `MyOrdersPage.tsx`: Order cards display status badge on affected orders (*Return Requested*, *Replacement Completed*, *Refunded*, *Return Rejected*) and 1-tap "View Return (RET-...)" button.
    - `OrderPage.tsx`: Prominent top banner linking to the return details page with live status, return code, and request date.
  - **Account & Drawer Navigation**:
    - Added "Returns & Replacements" card to `AccountPage.tsx` quick navigation.
    - Added "Returns & Replacements" button to `StoreMenuDrawer.tsx` for logged-in customers.
    - Added protected routes `/returns` and `/returns/:returnId` in `App.tsx`.
- **Seller-Hub Admin Orders Management System (`apps/admin/src/features/orders/`) (`013_seller_hub_orders.sql`)**:
  - **Seller-Hub Tab Navigation with Live Badges (`OrderList.tsx`)**:
    - Tabs matching marketplace seller hubs: *Pending*, *Ready to Ship* (combines `confirmed` + `processing`), *Shipped*, *Delivered*, *Cancelled* (combines `cancelled` + `refunded`), *On Hold*, and *All Orders*.
    - Each tab features a dynamic real-time count badge reflecting database counts.
  - **Multi-Criteria Filter Engine**:
    - **Date Range Presets**: *All Time*, *Today*, *Yesterday*, *Last 7 Days*, *Last 30 Days*, *This Month*, and *Custom Range* with start/end date selectors.
    - **Order Source**: *All Sources*, *Website*, *WhatsApp Direct*.
    - **Payment Status**: *All*, *Paid*, *Pending Verification*, *Cash on Delivery (COD)*, *Refunded*.
    - **Universal Instant Search**: Searches across Order Code (`id`), Customer Name, Phone number, Business Name, and item SKUs with debounce and 1-tap "Clear".
  - **Dynamic Dismissible Notices Strip (`OrderNoticesStrip.tsx`)**:
    - Real-time alert cards driven by live database queries:
      - *Delayed Pending Orders (>24h SLA)*: High-priority warning with direct quick-action to switch to Pending tab.
      - *Orders Ready to Ship*: Actionable dispatch queue counter jumping directly to Ready to Ship tab.
      - *On-Hold Flagged Consignments*: Verification required banner linking to On Hold tab.
      - *Catalog Low-Stock Warnings*: Inventory safety notification showing items with stock <= 10.
    - Client-side dismissibility per notice type with session persistence (`localStorage`).
  - **Desktop Data Grid & Mobile Seller Cards**:
    - Checkbox selection for individual and bulk actions with "Select All" toggle.
    - Desktop Table: Order ID with 1-click copy, formatted order date, multi-line customer entity (Name, Business Name pill, Phone link), items count with thumbnail hover/preview, total value, channel tag (Website/WhatsApp), color-coded status badge, and "Manage" button.
    - Mobile View (`< 768px`): Ergonomic seller cards displaying item thumbnail badges, recipient details, date, order amount, and status tag.
  - **Bulk Operations & Instant Client-Side Exports (SheetJS)**:
    - Multi-select actions bar: *Mark Confirmed*, *Mark Shipped*, *Export Selected to Excel (.xlsx)*, *Export Selected to CSV*.
    - "Download Orders Data" header dropdown supporting single-click export of current filtered view or all consignments with complete metadata (Order ID, Date, Source, Customer Name, Business, Phone, Address, Items Count, Subtotal, Tier Savings, Shipping, Total, Status, Payment Status, Courier, AWB).
  - **Comprehensive Order Detail Modal (`OrderDetailModal.tsx`)**:
    - **Customer Lifetime Stats Banner**: Displays buyer's total orders count, cumulative lifetime wholesale spend (excluding cancellations/refunds), delivered count, and customer tenure / first order date.
    - **Customer & Destination Snapshot**: Full name, business entity, GSTIN tag, phone number with direct dial and WhatsApp link, complete address with 1-click "Copy Address" clipboard helper.
    - **Wholesale Line Items Inspection**: Product image, title, SKU, applied wholesale volume tier badge, quantity, unit rate, and total line price.
    - **Logistics & Courier Tracking**: Carrier selector (Delhivery, BlueDart, DTDC, Ekart, Shadowfax, Xpressbees, Other) and AWB Tracking Number field with dedicated "Save Tracking" action logging audit events.
    - **Validated Status Transition Controls**: Pre-configured status change controls (`pending` -> `confirmed` / `processing` -> `shipped` -> `delivered` / `on_hold` / `cancelled`) with note modal and transactional stock restoration on cancellation/refund.
    - **Audit Log Timeline (`order_events`)**: Chronological event progression showing state changes, carrier updates, admin operational notes, and timestamps.
    - **Internal Operational Notes**: Dedicated admin notes textarea saved atomically to `orders.admin_note`.
    - **Print GST Wholesale Invoice**: Generates a formatted tax invoice pop-up with CGST/SGST tax breakdown, tier savings line, and print trigger.
    - **Print Warehouse Packing Slip (`generatePackingSlipHtml`)**: Clean warehouse manifest with item check-boxes `[ ]`, SKU reference, quantity, shipping destination, package weight notes, and warehouse verification sign-off block.
    - **Direct WhatsApp Messaging**: Pre-fills wholesale communication templates with customer name, order code, and current consignment status.
  - **Database Migration (`013_seller_hub_orders.sql`)**:
    - Added `'on_hold'` status to `orders_status_check`.
    - Added `source`, `payment_status`, `courier_name`, and `awb_number` columns to `public.orders` with performance indexes.
    - Updated `admin_update_order_status` RPC to support `on_hold` and `returned`, with automated inventory restoration for cancelled/refunded.
    - Added `admin_update_order_shipping` RPC for courier tracking and audit logging.
    - Added `get_customer_lifetime_stats` RPC.
    - Added `admin_get_order_notice_counts` RPC for delayed SLA orders and low inventory warnings.
    - Updated `get_order_by_id` RPC with tracking and source attributes.
- **Seller-Hub Admin Returns, Claims & Quality Management System (`apps/admin/src/features/returns/`) (`014_admin_returns_and_claims.sql`)**:
  - **Navigation & Badging Parity (`App.tsx` & `AdminNavigationDock.tsx`)**:
    - Added dedicated **Returns** navigation link in desktop sidebar under *Commerce & Sales* with live pending actions count badge.
    - Added **Returns & Quality** item in mobile menu drawer with live count pill and visual indicator dot on mobile bottom navigation dock.
  - **Overview Dashboard (`ReturnsOverview.tsx`)**:
    - **Date Presets**: 7 Days, 30 Days, 90 Days reactive period switcher.
    - **KPI Metrics Cards**: Total Returns count, Customer Return Rate percentage (with health indicator vs target 3.5% benchmark), Total Refunds Value, Pending Actions count (linked directly to pending queue), and QC Fail Count (linked to claims queue).
    - **Seller-Hub Banner**: "High returns ka tension? Save Return Shipping Fees with Return Assurance" banner matching supplier hub aesthetic, with dual pricing defective return benchmarks and RTO claims information modal.
    - **Root-Cause Reason Breakdown**: Interactive distribution progress bars for all 6 reason codes (`damaged`, `defective`, `wrong_item`, `short_quantity`, `quality_issue`, `other`) with unit counts and percentages.
    - **Product Return Performance Table**:
      - Drill-down across delivered vs returned units per catalog product.
      - Category filter, performance filter (*All*, *High Returns $\ge 5\%$*, *Low Returns $< 2\%$*, *Zero Returns*), sort controls, and instant search.
      - "High Returns" hazard flag for products exceeding the 5% defect/return threshold.
      - "View Details" modal for root-cause quality recommendations and 1-tap jump to tracking that specific SKU.
      - Client-side export to Excel (`.xlsx`).
  - **Return Tracking System (`ReturnTrackingList.tsx`)**:
    - Filter tabs with live counters: *All Returns*, *Pending Verification*, *Approved / Reverse Pickup*, *In Transit*, *Warehouse QC*, *Refunded / Replaced*, *Closed / Rejected*.
    - Search across return code (`RET-...`), order code, customer name, phone, business entity, and product SKU.
    - Desktop data grid with checkboxes, 1-click code copy, customer preview, type, reason, status, and "Inspect" button; stacked responsive cards on mobile.
    - Bulk and filtered export to Excel (`.xlsx`).
  - **Inspection & Reverse Logistics Drawer (`ReturnDetailDrawer.tsx`)**:
    - Slide-over inspection drawer on desktop and mobile bottom sheet.
    - High-resolution customer evidence gallery powered by signed URLs from private `return-evidence` Supabase Storage bucket with full-screen lightbox preview.
    - Line items inspection with thumbnails, SKUs, requested quantities, reason codes, and conditions.
    - Validated lifecycle status transition controls (`admin_update_return_status`):
      - **Mandatory audit note validation enforced when rejecting returns**.
      - Automatic catalog inventory restoration notice when transitioning to `qc_passed`.
      - Settled refund amount editor for payout processing.
    - Pre-filled WhatsApp customer communication action.
    - Comprehensive chronological audit trail rendered from `return_events`.
  - **Supplier & Courier Claim Tracking (`ClaimTrackingList.tsx` & `ClaimModal.tsx`)**:
    - Dedicated workflow tracking damaged, disputed, or QC-failed consignments requiring courier reimbursement or supplier warranty settlement.
    - KPI Cards: Total Claims Filed, Total Claim Amount, Settled / Reimbursed Value, Pending Approval Count.
    - Modal for recording Claim Status (`pending`, `approved`, `rejected`, `settled`), Claim Category (`courier`, `supplier`, `transit_damage`, `customer_fraud`, `other`), Claim Amount in INR, carrier ticket / RMA reference number, and dispute notes.
    - Appends audit events to `return_events` upon claim status change.
    - Client-side claim records export to Excel (`.xlsx`).
  - **Database Migration (`014_admin_returns_and_claims.sql`)**:
    - Added `claim_status`, `claim_type`, `claim_amount`, `claim_reference`, `claim_notes`, `claim_filed_at`, and `claim_settled_at` columns to `public.return_requests` with indexes.
    - Added `admin_update_return_claim` RPC with security checks and automatic event audit logging.
    - Added `get_product_return_performance` RPC computing delivered orders vs returns per product with high-return flags.
    - Added `admin_get_returns_pending_count` RPC for live badge counts.
    - Enhanced `get_return_stats` RPC with pending actions count, QC failed count, and claims value.
- **Catalog Image Library & Image Bulk Upload System (`apps/admin/src/features/catalog/images/`) (`010_catalog_images.sql`, `016_admin_submit_catalog_images.sql`)**:
  - **Navigation & Mobile Dock Integration (`App.tsx` & `AdminNavigationDock.tsx`)**:
    - Added dedicated **"Image Bulk Upload"** navigation item under the **Catalog** group in desktop persistent sidebar.
    - Added **"Image Bulk Upload"** in the mobile slide-up navigation drawer with active state pills.
    - Updated `NavTab` union type in `AdminNavigationDock.tsx` and `App.tsx` with haptic feedback transitions.
  - **Image Bulk Upload Hub (`ImageBulkUploadPage.tsx`)**:
    - **Header & Views**: Header with *New Upload* and *Image Library* tabs, active counts, and dismissible onboarding banner with "Get Started" how-to modal.
    - **Large Dashed Drop Zone**: Styled using Urbanrat tokens (`brand-light`, `brand`, `brand-dark`, `surface`), drag-and-drop hover visual states, file picker (`.jpg, .jpeg, .png, .webp`), and global clipboard paste listener (`Ctrl+V` / `Cmd+V`).
    - **Technical Client-Side Pre-Upload Checks**:
      - Dimensions validation: minimum 500×500 px (yellow warning chip if smaller).
      - Aspect ratio validation: between 4:5 and 5:4 (yellow warning chip if outside range).
      - Duplicate file detection in queue (same file name and byte size).
      - Rejection of unsupported MIME types and files > 10 MB with dismissible error alerts.
    - **Staged Thumbnails Grid**:
      - Individual removal `X` button with haptics.
      - Status badges: `queued`, `compressing`, `uploading` (with SVG circular progress ring), `done` (green checkmark), and `failed` (red badge with individual retry).
      - Yellow technical warning chips rendered over thumbnail previews without blocking upload.
    - **High-Throughput Compression & Parallel Upload**:
      - Concurrency pool uploading 3 files in parallel (up to 50 files per batch).
      - Client-side WebP compression via `imageCompressor.ts` (max 1200px, quality 0.84) saving ~80-90% bandwidth.
      - Overall batch progress bar with remaining file counts.
    - **"Image Links" Output Table & Mobile Cards**:
      - Columns: Image thumbnail, Title (original file name), Public URL (truncated with full tooltip), SKU hint (inline editable with optimistic sync), Size savings (e.g. `1.8 MB -> 210 KB, 88% saved`), and Actions.
      - Quick "Copy Link" action with temporary "Copied!" feedback and haptic vibration.
      - "Remove Image" action protected with deletion confirmation modal; blocks deletion and displays referencing product titles if the RPC reports the image is actively used.
    - **Links Action Toolbar**:
      - "Copy all links" (newline-separated).
      - "Copy as comma-separated" (suitable for single Excel cells).
      - "Download links sheet (.xlsx)" using SheetJS with columns: `File Name`, `SKU Hint`, `Image Index`, `Link`.
    - **Image Library Browser Tab**:
      - Paginated browse and search across all previously uploaded catalog images.
      - Multi-select checkbox mode to batch copy selected links.
      - Search by original file name or SKU hint.
    - **Illustrated Image Guidelines (Sidebar / Mobile Accordion)**:
      - Small illustrated cards rendered with pure CSS/SVG shapes (no external media) detailing disallowed images: watermark, text or price overlay, pixelated, blurred, inverted/stretched, incomplete/cropped product, and props or multiple products.
      - Plain background photography tip banner.
  - **Shared Reusable Image Picker Modal (`ImagePickerModal.tsx`)**:
    - Mobile-friendly thumbnail grid (2 to 6 columns) with search by filename or SKU hint.
    - Multi-select and single-select modes with *Select All / Deselect All* toggle.
    - Quick "Copy Links" action with temporary visual feedback.
    - Integrated "Prefill Template (N)" action button when opened in bulk catalog workflow.
  - **Catalog Upload Integration (`BulkCatalogModal.tsx` & `SingleCatalogWizard.tsx`)**:
    - **Bulk Catalog Wizard (`BulkCatalogModal.tsx`)**:
      - "Open Image Library" button next to "Blank Template" and "Prefilled Template".
      - "Download Prefilled Template": groups images by `sku_hint` (using `parseSkuFromFilename`), orders Image URL 1–5 by index, and places unmatched images in a separate "Unmatched Images" sheet.
      - Deep Image URL validation on template upload (`validateUploadedImageLinks` in `catalogParser.ts`):
        - Enforces HTTPS and recognized image extensions (or `catalog-images` bucket).
        - Queries `catalog_images` to verify existence for links from our own bucket and flags missing images.
        - Concurrently probes external image URLs for reachability and valid headers.
      - One-click "Auto-attach matched images" action in the preview table when products have empty image cells but matching SKU hints exist in the library.
    - **Single Catalog Wizard (`SingleCatalogWizard.tsx`)**:
      - Step 1 (Front Image) and Step 2 (Gallery Images) include an "Add from Library" button opening `ImagePickerModal`.
      - Newly uploaded images through the wizard automatically compress to WebP, upload to `catalog-images` bucket, and save to `catalog_images` table via `uploadCatalogImage`.
  - **Database Migrations (`010_catalog_images.sql`, `016_admin_submit_catalog_images.sql`)**:
    - `010_catalog_images.sql`: Created `catalog-images` public storage bucket, `catalog_images` table with RLS, indexes on `(created_at desc)`, `batch_id`, and `sku_hint`, and `admin_delete_catalog_image` RPC with product usage protection.
    - `016_admin_submit_catalog_images.sql`: Upgraded `admin_submit_catalog` RPC to validate that each catalog item contains at least 1 valid product image, accepts image URLs from the `catalog-images` bucket, flags missing images as `qc_error`, and recalculates upload stats.
  - **Shared Helpers & Vitest Unit Tests (`packages/shared/src/catalogImages.ts` & `catalogImages.test.ts`)**:
    - `parseSkuFromFilename(filename)`: extracts SKU and index from `_N`, `-N`, and `(N)` patterns.
    - `sanitizeFileName(filename)`: produces safe, lowercase, hyphenated filenames.
    - `parseImageIndex(filename)`: extracts numeric image order.
    - `validateCatalogImageUrl(url, supabaseUrl)`: validates protocol, extensions, and bucket paths.
    - **32 unit tests** in `catalogImages.test.ts` (all 88 tests passing across workspace).

### Touchpoint 10 — Bulk Product Operations & Drawer (`019_bulk_product_ops.sql`)
- **Category Counts Rollup Engine (`categoryTree.ts`)**:
  - Implemented post-order hierarchical rollup in `buildCategoryTree`, attributing both direct product counts and recursive descendant category counts to parent/root cards.
  - Corrected catalog header and sidebar badge alignment across 1195+ catalog products.
- **Sticky Bulk Actions Bar & Scope Selection (`ProductList.tsx`)**:
  - Selection banner: "Select all N products in this category" querying `admin_list_product_ids` (capped at 5,000 with user-facing warning).
  - Sticky bottom action bar (`N selected | Clear | Bulk Edit | Move to category | Activate | Deactivate | Delete`).
  - Active scope banner dynamically displayed in drawer header (e.g. *"Applying to 202 products in Tempered Glass & UV GLASS > membrane"*).
- **Bulk Edit Drawer Shell (`BulkEditDrawer.tsx`)**:
  - Mobile full-screen sheet with bottom clearance (`pb-32`) ensuring zero overlap with `AdminNavigationDock`.
  - Desktop right drawer (max width 672px / `max-w-2xl`) with backdrop blur and fluid tab transitions.
  - Four operational tabs: **Details**, **Price Tiers**, **Stock**, **Images**.
- **Details Management Tab (`BulkDetailsTab.tsx`)**:
  - Selective field-level checkboxes with tri-state status toggles (`Active`, `Featured`, `Trending`, `Urbanrat`).
  - Dual-mode description editing: *Replace completely* vs *Append text with newline*.
  - Dual-mode MRP updates: *Set exact value* vs *Percentage/Flat delta calculations* with MRP $\ge$ Price validation.
  - Interactive Keywords management: Add keywords, Remove keywords, or Replace all.
- **Price Tiers Management Tab (`BulkTiersTab.tsx`)**:
  - 5 operational tier modes: *Replace with new tiers*, *Adjust existing tiers (+/- % or flat ₹)*, *Generate from base wholesale price*, *Copy from existing product*, and *Clear all tiers*.
  - Strict volume tier validations: strictly increasing quantities, non-increasing prices, prices $\le$ MRP, and tier 1 vs wholesale price warnings.
- **Stock Management Tab (`BulkStockTab.tsx`)**:
  - 4 stock modes: *Add (+)*, *Subtract (-)*, *Set exact quantity*, *Set to zero (destructive out-of-stock)*.
  - Required "Adjustment Reason" input (placeholder `"e.g. Warehouse batch arrival #402"`) with quick chips (*Restock*, *Damaged*, *Audit correction*).
  - Negative stock prevention (skips with error message) and low stock threshold alerts.
  - **Spreadsheet Batch Ingestion (`SheetJS`)**:
    - Download pre-filled template (`.xlsx`) for selected scope: `SKU`, `Product Name`, `Current Stock`, `New Stock`, `Reason`.
    - Upload spreadsheet (`.xlsx`, `.xls`, `.csv`, max 5 MB, up to 5,000 rows): matches rows by SKU, accepts `New Stock` or `Delta` columns, diagnoses unmatched/invalid/duplicate SKUs.
    - Every change writes individual audit records to `stock_movements` linked to the bulk operation UUID.
- **Images Management Tab (`BulkImagesTab.tsx`)**:
  - Image sourcing: centralized Image Library (`ImagePickerModal`) or direct file upload (auto-compressed to WebP via `imageCompressor.ts` and indexed in library).
  - 6 action modes: *Add to end*, *Add as primary (first)*, *Replace all images*, *Make existing image primary*, *Remove one image URL*, *Remove all images (destructive)*.
  - **Match Images by SKU**: scans catalog library for images matching product SKU (using `parseSkuFromFilename` order `_1, _2...`), with preview showing matched thumbnails and list of unmatched products.
  - Thumbnail strips in preview showing before $\rightarrow$ after thumbnail states.
  - Non-destructive image handling: removing images unlinks them from products but never deletes files from storage.
  - Selection $>100$ products safety advisory when applying direct uploads.
- **Unified Dry-Run Preview & Chunked Apply Panel (`BulkPreviewPanel.tsx`)**:
  - Non-destructive server-side dry run simulation with summary chips (*Will Change*, *Skipped Errors*).
  - Preview table displaying first 50 rows with expandable error/warning diagnostic pills.
  - Export dry-run preview to Excel (`.xlsx`).
  - Resilient 200-ID batch chunking with real-time progress bar, individual chunk retry, and confirmation modal requiring typing `APPLY` for destructive operations.
- **Bulk History & Rollback Modal (`BulkHistoryModal.tsx`)**:
  - "Bulk history" button in the Products catalog header.
  - History log table: timestamp, operation type, summary, affected product count, status, and Undo action.
  - Interactive Undo preview dialog showing proposed rollback values and identifying unrestorable products (e.g. subsequent stock movements after operation timestamp).
  - 1-click Undo restoring previous attribute snapshots and generating reversal stock audit movements.
- **Vitest Suite**:
  - 140 automated tests across 11 test suites passing cleanly (`bulkOps.test.ts`, `keywords.test.ts`, `catalogImages.test.ts`, `orders.test.ts`, `returns.test.ts`, `pricing.test.ts`, `categoryTree.test.ts`, etc.).

---

### Touchpoint 11 — Marketplace Subcategories, Categories Department Overhaul & Catalog Product Count Alignment

- **Marketplace Subcategory Quick-Access Navigation (`MarketplacePage.tsx`)**:
  - **Dedicated Subcategory Strip**: Added a second horizontal scrolling chip row directly beneath the parent category strip. Appears dynamically when browsing a parent category (or displays all subcategories across the store when "All Products" is active), styled with the Urbanrat cyan-blue gradient (`linear-gradient(to bottom, #5ADBE5, #0A82A8)`), haptic feedback, and an "All in Category" reset pill.
  - **Desktop Controls Bar Subcategory Dropdown**: Integrated a `<select>` dropdown with a `Layers` icon into the desktop search & filter bar alongside Search, Sort, and Price Range. Automatically groups subcategories into parent category `<optgroup>` tags when browsing all categories, or shows direct subcategories when a parent is selected.
  - **Active Filters Bar**: Displays individual dismissible pills for both `Category` and `Subcategory` with `(X)` buttons and a `Reset All` button. Fully synchronizes with URL query parameters (`?category=<slug>&subcategory=<sub_slug>`).
  - **Mobile Slide-Up Filter Drawer**: Embedded an interactive Subcategories chip section in the mobile filter drawer with instant active state updates and a quick clear trigger.
  - **Tailwind CSS v4 Token Standardization**: Refactored all arbitrary hex color classes and bracket dimensions to `@theme` design tokens (`bg-surface/90`, `text-brand-dark`, `bg-brand-light/20`, `border-brand-light/30`, `text-brand-light`, `focus:border-brand-dark`, `max-w-35`, `min-w-4.5`, `h-4.5`).

- **Categories Page Overhaul (`CategoriesPage.tsx`)**:
  - **Recursive Parent Product Loading**: Resolved catalog loading behavior where selecting a parent category previously left the product array empty. The page now automatically queries all products under the active category and all its descendant subcategories recursively via `getCategoryAndDescendantIds` (e.g., all 1,195 items under *Tempered Glass & UV GLASS*).
  - **Interactive Subcategory Filter Strip**: Added an interactive subcategory pill strip at the top of the right pane (`All Products ({totalCount})`, `super x`, `UV GLASS`, `membrane`), allowing shoppers to switch between all category products and specific subcategories in 1 tap without leaving the two-pane view.
  - **Pagination & "Load More Products"**: Replaced hardcoded `limit: 20` with full pagination (`PAGE_SIZE = 24`) and an interactive `Load More Products (Showing X of Y items)` button, unlocking seamless browsing of large subcategories (e.g. 820+ products).
  - **Marketplace Deep Link**: Enhanced `Open in Marketplace →` link to preserve active category and subcategory slugs.
  - **Design Token & Layout Polish**: Upgraded container heights to standard Tailwind v4 utilities (`min-h-145 sm:min-h-160`) and brand tokens throughout.

- **Admin PostgREST Range Pagination & Category Count Parity (`adminService.ts`)**:
  - **Discrepancy Identification**: Identified the root cause of the count mismatch where `membrane` displayed `8` products in the left Category sidebar badge while the table breadcrumb displayed `202 products`, and the parent category was capped at `1000`.
  - **Root Cause Analysis**: Supabase PostgREST default maximum limit of 1,000 rows truncated unpaginated queries in the `fetchCategoryCounts` client fallback at row 1,000 (`super x` [820] + `UV GLASS` [172] + `membrane` [8] = 1,000), omitting rows 1,001–1,195. Meanwhile, the table header breadcrumb queried with `{ count: "exact" }`, correctly displaying all 202 items.
  - **Chunked Range Fetch**: Upgraded `fetchCategoryCounts()` in `adminService.ts` to fetch all products across all chunks using an automated `.range(from, from + CHUNK_SIZE - 1)` loop, ensuring 100% count accuracy and parity across all sidebar badges and breadcrumb headers regardless of catalog size.

- **Validation & Build Stability**:
  - **Unit Tests**: 140/140 unit tests passing across 11 test suites (`npm test`).
  - **Build**: Both `apps/store` and `apps/admin` compile with 0 TypeScript/CSS errors (`npm run build`).

