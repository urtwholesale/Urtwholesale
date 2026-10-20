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
│       │   ├── features/
│       │   │   ├── auth/              # Admin login with username mapping (Sjainthelegend) & role check
│       │   │   ├── dashboard/         # Executive Analytics & RPC KPI cards (DashboardOverview)
│       │   │   ├── products/          # Catalog & inventory management (ProductList, ProductEditor)
│       │   │   ├── orders/            # Order pipeline & GST invoice generation (OrderList, OrderDetailModal)
│       │   │   ├── content/           # Interactive banner uploader, policy pages & search keywords (ContentEditor)
│       │   │   └── settings/          # Store settings & admin password self-service (SettingsEditor)
│       │   ├── lib/
│       │   │   ├── adminService.ts    # Admin database operations, storage uploads & analytics RPC callers
│       │   │   └── supabase.ts        # Admin Supabase client
│       │   ├── App.tsx                # Left sidebar navigation layout (LeaseFlow inspired UI)
│       │   ├── index.css              # Design tokens and custom scrollbars
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
│   │   └── 005_create_verified_order.sql # Atomic verified order creation RPC with stock locking
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

---

### Admin Panel (`apps/admin`)

1. **Redesigned Sidebar Layout (LeaseFlow Inspired UI)**:
   - **Rounded Sidebar Card**: High-contrast white card container with rounded aesthetics (`rounded-3xl`) set against a soft slate `#ECEEED` backdrop.
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
   - Live banner preview thumbnails with instant **Replace / Upload New** and **Remove Image** controls.
   - Support for multiple banner placements (`home_hero`, `home_brand`, `urbanrat_hero`).
   - Policy pages editor (About Us, Terms & Conditions, Privacy Policy).
   - Trending search keyword manager.

6. **Admin Credentials & Store Settings (`SettingsEditor.tsx`)**:
   - **Self-Service Admin Credentials**: Change Master Password and Full Name directly from the settings panel.
   - Store metadata (Business Name, WhatsApp support number, support email, warehouse address).
   - Wholesale Minimum Order Quantity (MOQ) and Free Shipping thresholds.
   - GST tax percentage configuration.

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

Deploy each application as an independent Vercel project:

### Deploying the Storefront (`apps/store`)
1. **Import Git Repository**: Select `urtwholesale/Urtwholesale`.
2. **Framework Preset**: Select **`Vite`**.
3. **Root Directory**: Select **`apps/store`**.
4. **Build Command**: `tsc -p tsconfig.json && vite build` (or `npm run build:store`).
5. **Output Directory**: `dist`.
6. **Environment Variables**: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Deploying the Admin Panel (`apps/admin`)
1. **Import Git Repository**: Import `urtwholesale/Urtwholesale` as a second project (e.g., `urbanrat-admin`).
2. **Framework Preset**: Select **`Vite`**.
3. **Root Directory**: Select **`apps/admin`**.
4. **Build Command**: `tsc -p tsconfig.json && vite build` (or `npm run build:admin`).
5. **Output Directory**: `dist`.
6. **Environment Variables**: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

---

## 9. Recent Changelog

- **Interactive Store Menu Drawer & Auth Action**: Implemented a slide-up bottom sheet / desktop modal (`StoreMenuDrawer.tsx`) triggered from the navigation dock and sub-topbar. Includes structured storefront links, category quick-jump, WhatsApp wholesale desk, company policies, and a prominent **Login** (guest toggle into `CustomerAuth`) or **Logout** button (`supabase.auth.signOut()`) at the very bottom.
- **Enlarged Centerpiece Logo Navigation Dock**: Scaled up the center Urbanrat logo button in `NavigationDock.tsx` to `w-14 h-14` / `w-15 h-15` with an elevated centerpiece ring and glow shadow, establishing a bold focal hierarchy over the standard navigation icons.
- **Admin Sidebar Redesign**: Replaced the top horizontal tab row with a modern left sidebar inspired by LeaseFlow (hub switcher, active pill treatment, grouped sections, live sync toggle, and admin user card).
- **Banner Image Uploader**: Added direct file uploader, live thumbnail preview, and image removal buttons in `ContentEditor.tsx` connected to the `banners` bucket.
- **Official Brand Logo & Favicons**: Integrated the official Urbanrat logo across favicons, app headers, docks, product cards, login portals, and footers.
- **Centered Sub-Topbar**: Relocated desktop storefront navigation into a centered sub-topbar directly beneath the logo capsule.
- **Admin Authentication & Self-Service**: Added username login mapping (`Sjainthelegend`) and in-app master password management.
- **Atomic Verified Orders**: Implemented `create_verified_order` RPC with transactional stock locking and volume tier verification.
