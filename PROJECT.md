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
│       │   │   ├── catalog/           # Category-wise Single & Bulk Catalog Uploads, QC Verification & Multi-Level Category Manager
│       │   │   ├── dashboard/         # Executive Analytics & RPC KPI cards (DashboardOverview)
│       │   │   ├── products/          # Catalog & inventory management (ProductList, ProductEditor, index.ts barrel)
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
│       │   │   ├── category.ts        # Category hierarchy models
│       │   │   ├── order.ts           # Order status, line items, and customer schema
│       │   │   ├── pricing.ts         # Volume price tiers & price breakdown models
│       │   │   ├── product.ts         # Product, pricing, specs, and stock models
│       │   │   ├── profile.ts         # User & Admin profile types
│       │   │   ├── review.ts          # Product review and rating models
│       │   │   ├── stockMovement.ts   # Stock audit trail models
│       │   │   └── storeSettings.ts   # B2B settings, banners, and policy pages
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
│   │   └── 007_policies_and_dealers.sql # Store policies, dealer applications, audit events & RPCs
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

### Storage Buckets

1. **`product-images`** (Public: `true`): High-resolution product photography.
2. **`banners`** (Public: `true`): Hero banners and promotional media.
3. **`avatars`** (Public: `true`): Customer and administrator profile pictures.

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
| **Routing** | React Router | 7.5 | Client-side routing with deep link support |
| **Icons** | Lucide React | 1.16 | Cohesive modern icon system |
| **Backend & DB** | Supabase JS | 2.106 | Realtime PostgreSQL, RLS security, and storage |
| **Monorepo Manager** | npm workspaces | 10+ / 11+ | Clean multi-package dependency management |
| **Testing** | Vitest | 3.0 | Unit tests for volume pricing calculation engine |

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
