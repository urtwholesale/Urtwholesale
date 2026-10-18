# Urbanrat Store — Comprehensive Project Documentation

A modern, mobile-first, single-vendor e-commerce web platform for premium mobile accessories and electronics, supplied by **URP / URT Wholesale**.

---

## 1. Executive Summary

**Urbanrat Store** is designed to provide a premium, app-like mobile shopping experience for consumer electronics, chargers, cables, audio gear, and protective accessories. 

The platform features:
- **Customer Storefront (`apps/store`)**: High-performance mobile-first web app with lightning-fast catalog navigation, real-time search, cart management, and seamless WhatsApp order dispatch.
- **Admin Management Panel (`apps/admin`)**: Separately isolated back-office dashboard for inventory control, category management, order monitoring, and image uploads.
- **Shared Architecture (`packages/shared`)**: Shared TypeScript domain types ensuring 100% type safety across both frontend applications and backend data models.
- **Supabase Cloud Backend (`supabase/`)**: PostgreSQL database with Row Level Security (RLS), Supabase Auth, Storage buckets, and Edge Functions.

---

## 2. Monorepo Architecture

The project is structured as an **npm workspace** monorepo:

```
urbanrat-store/
├── apps/
│   ├── store/                     # Customer-facing Storefront (Vite + React 19)
│   │   ├── public/                # Static assets (favicons, banners)
│   │   ├── src/
│   │   │   ├── components/        # Reusable UI (TopBar, NavigationDock, ProductCard, etc.)
│   │   │   ├── data/              # Resilient fallback mock data (MOCK_PRODUCTS, etc.)
│   │   │   ├── features/auth/     # Customer authentication & profile modal
│   │   │   ├── lib/               # Supabase client instantiation
│   │   │   ├── pages/             # Route views (Home, Marketplace, Cart, Order, etc.)
│   │   │   ├── services/          # Data service layer with live Supabase + fallback logic
│   │   │   ├── utils/             # WhatsApp message generator, currency formatters
│   │   │   ├── App.tsx            # Main application layout, routing & cart state
│   │   │   ├── index.css          # Tailwind CSS v4 design tokens & theme classes
│   │   │   └── main.tsx           # React DOM root
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts         # Includes social crawler Open Graph tag injector
│   │
│   └── admin/                     # Protected Merchant Admin Panel (Vite + React 19)
│       ├── src/
│       │   ├── features/auth/     # Admin login with role verification
│       │   ├── lib/               # Admin Supabase client
│       │   ├── App.tsx            # Admin dashboard, metric overviews, and controls
│       │   ├── index.css          # Design system matching store theme
│       │   └── main.tsx
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
│
├── packages/
│   └── shared/                    # Shared Domain Package
│       ├── src/
│       │   ├── types/
│       │   │   ├── cart.ts        # CartItem & CartSummary definitions
│       │   │   ├── category.ts    # Category hierarchy models
│       │   │   ├── order.ts       # Order status, line items, and customer schema
│       │   │   ├── product.ts     # Product, pricing, and stock models
│       │   │   └── profile.ts     # User & Admin profile types
│       │   └── index.ts           # Barrel export
│       ├── package.json
│       └── tsconfig.json
│
├── supabase/
│   ├── functions/
│   │   └── order-og/              # Deno Edge Function for dynamic WhatsApp link previews
│   ├── migrations/
│   │   ├── 001_init.sql           # Core tables, RLS, functions, triggers, and storage
│   │   └── 002_orders.sql         # Custom order schema (URT-YYMMDD-XXXX) & public order view
│   └── seed.sql                   # Initial catalog: 6 categories, 18 subcategories, products
│
├── .env.example                   # Template for Supabase credentials
├── AGENT_RULES.md                 # Core UI/UX and architectural constraints
├── package.json                   # Monorepo root scripts & dev dependencies
└── tsconfig.json                  # Root TypeScript configuration
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
- Crisp, clean, high-contrast light theme with `#F8F9FB` background.
- Dark mode toggles and dark styles are deliberately excluded to preserve brand identity.

### 3. Brand Signature Gradient
Runs vertically **Top → Bottom**:
| Token | Hex Code | Purpose |
| :--- | :--- | :--- |
| `--color-brand-light` | `#5ADBE5` | Gradient start, active pill highlights |
| `--color-brand` | `#1EAFC7` | Intermediate accent, focus rings |
| `--color-brand-dark` | `#0A82A8` | Gradient end, primary CTA buttons, badges |

### 4. Glassmorphism Chrome
Fixed navigation bars incorporate modern backdrop blurs:
```css
background: rgba(255, 255, 255, 0.72);
backdrop-filter: blur(16px);
border-bottom: 1px solid rgba(255, 255, 255, 0.3);
box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
```

---

## 4. Key Features & Workflows

### Storefront Application (`apps/store`)

1. **Floating Navigation Dock**:
   - Fixed bottom dock on mobile devices with quick access to:
     - 🏠 **Home**: Hero banners, category shortcuts, trending items.
     - 🛍️ **Marketplace**: Complete catalog with live filters and sorting.
     - 📂 **Categories**: Nested view of primary and subcategories.
     - ⚡ **Urbanrat**: Curated showcase of private-label flagship gear.
     - ☰ **Menu**: Customer account, policies, support, and order lookup.

2. **Real-Time Instant Search**:
   - Debounced search modal with live query against Supabase PostgreSQL.
   - Popular search suggestions (e.g., *"iPhone 16 Glass"*, *"65W GaN"*, *"100W Cable"*).
   - Instant search dropdown displaying product thumbnail, price, and brand badge.

3. **Dynamic Filtering & Sorting**:
   - Filter by parent category, subcategory, Urbanrat brand, and price brackets.
   - Sort by Newest, Price: Low to High, and Price: High to Low.

4. **Product Detail View (`/product/:slug`)**:
   - Image gallery with thumbnail selection.
   - Live stock indicator (*"In Stock"* / *"Low Stock"* / *"Out of Stock"*).
   - MRP and instant savings calculation (e.g., *"Save ₹500 (45% OFF)"*).
   - Technical specifications grid and warranty information.

5. **Cart & WhatsApp Order Dispatch**:
   - Persistent reactive cart with item counters and badges.
   - Customer checkout details: Name, Mobile, Shipping Address, Pincode.
   - **One-Click WhatsApp Dispatch**: Formats a WhatsApp message containing line items, totals, delivery address, and order ID, and launches `https://wa.me/...` directly to the business owner.
   - Simultaneously creates an order record in the Supabase `orders` table.

6. **Order Confirmation & Social Sharing (`/order/:orderId`)**:
   - Unique alphanumeric order codes (`URT-YYMMDD-XXXX`).
   - Order timeline tracker (*Pending → Confirmed → Shipped → Delivered*).
   - Built-in social crawler Open Graph support for rich WhatsApp link previews with image and price summary.

---

### Admin Panel (`apps/admin`)

- **Strict Separation**: Admin app is deployed separately and completely isolated from customers.
- **Admin Authentication**: Verified via Supabase Auth + `profiles.role = 'admin'` database check.
- **Security Guard Triggers**: Database trigger `prevent_role_tampering` prevents unauthorized escalation to admin.
- **Inventory & Order Management**: Real-time monitoring of customer orders, product catalog status, and storage buckets.

---

## 5. Database Schema & Security (Supabase)

### Core Tables

| Table | Description | Security / RLS |
| :--- | :--- | :--- |
| `profiles` | Extended user profiles linked to `auth.users(id)` with `role` (`customer` \| `admin`). | Customers can read/update own profile; admins read all. Role change protected by trigger. |
| `categories` | Product hierarchy supporting `parent_id` foreign keys, slugs, and sort orders. | Public read-only; admin write. |
| `products` | Catalog items with price, MRP, SKU, inventory count, and image array. | Public read for active items; admin full CRUD. |
| `orders` | Customer orders with custom ID (`URT-YYMMDD-XXXX`), JSONB customer info, items, and status. | Anyone can insert orders; customers can view own orders; admins can view/update all. |
| `cart_items` | Database-backed cart persistence for authenticated users. | Users can manage only their own cart items. |

### Storage Bucket
- **`product-images`**: Public bucket for high-resolution product photography.
  - Public read access for all visitors.
  - Upload/Delete restricted to users with `role = 'admin'`.

### Resilient Data Layer
The storefront implements a dual-mode service architecture in `storeService.ts`:
- **When Supabase is connected**: Queries live PostgreSQL tables with full filtering, sorting, and pagination.
- **When offline / unconfigured**: Gracefully falls back to comprehensive mock data in `mockData.ts` with zero crashes or broken layouts.

---

## 6. Technology Stack

| Layer | Technology | Version |
| :--- | :--- | :--- |
| **Language** | TypeScript | ~5.8 |
| **UI Framework** | React | 19.3 |
| **Bundler & Dev Server** | Vite | 6.3 |
| **Styling** | Tailwind CSS | 4.1 |
| **Routing** | React Router | 7.5 |
| **Icons** | Lucide React | 1.16 |
| **Database & Auth** | Supabase JS | 2.106 |
| **Monorepo Manager** | npm workspaces | 10+ / 11+ |
| **Dev Concurrency** | Concurrently | 10.0 |

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
Fill in your Supabase project parameters:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
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
# Builds both applications and checks TypeScript types
npm run build
```

---

## 8. Deployment Guide (Vercel)

Because this is a multi-app monorepo, each application should be deployed as its own Vercel project:

### Deploying the Storefront (Customer App)
1. **Import Git Repository**: Select `urtwholesale/Urtwholesale`.
2. **Framework Preset**: Select **`Vite`**.
3. **Root Directory**: Click *Edit* and select **`apps/store`**.
4. **Build & Output Settings**:
   - Build Command: `tsc -b && vite build` (or leave default).
   - Output Directory: `dist`.
5. **Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Click **Deploy**.

### Deploying the Admin Panel
1. **Import Git Repository** again into a new Vercel project (e.g. `urbanrat-admin`).
2. **Framework Preset**: Select **`Vite`**.
3. **Root Directory**: Select **`apps/admin`**.
4. **Environment Variables**: Add Supabase credentials.
5. Click **Deploy**.

---

## 9. Supabase Database Initialization

To set up a fresh Supabase project:
1. Open the **SQL Editor** in your Supabase dashboard.
2. Execute `supabase/migrations/001_init.sql` (Creates profiles, categories, products, RLS, storage).
3. Execute `supabase/migrations/002_orders.sql` (Creates order schema and policies).
4. Execute `supabase/seed.sql` (Populates parent categories, subcategories, and sample inventory).
5. To designate your first administrator user, update the profile role:
   ```sql
   update public.profiles 
   set role = 'admin' 
   where id = '<your-user-uuid>';
   ```
