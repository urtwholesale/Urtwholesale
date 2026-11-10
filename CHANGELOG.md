# Changelog

All notable changes, architectural touchpoints, schema migrations, and feature releases for the Urbanrat Wholesale Suite (`apps/store`, `apps/admin`, and `packages/shared`).

> [!NOTE] Sequence Gap Reconciliation
> The historical project notes contained a gap jumping from Touchpoint 32 directly to Touchpoint 35. Touchpoints 35 through 41 have been renumbered sequentially to Touchpoints 33 through 39, with zero technical details omitted.

## Table of Contents

- [Touchpoint 46 — Fix Record "v_coupon" Is Not Assigned Yet on Checkout RPCs](#touchpoint-46--fix-record-v_coupon-is-not-assigned-yet-on-checkout-rpcs-039_fix_coupon_unassigned_recordsql)
- [Touchpoint 45 — Fix Column "price_tiers" Does Not Exist on Checkout RPCs](#touchpoint-45--fix-column-price_tiers-does-not-exist-on-checkout-rpcs-038_fix_checkout_price_tierssql)
- [Touchpoint 44 — Dynamic Homepage Divisions Management & Punchy Visual Brand Identity (`037_homepage_divisions.sql`)](#touchpoint-44--dynamic-homepage-divisions-management--punchy-visual-brand-identity-037_homepage_divisionssql)
- [Touchpoint 43 — Coupons & Discounts Management, Server-Side Verification & Secure Redemption Engine](#touchpoint-43--coupons--discounts-management-server-side-verification--secure-redemption-engine)
- [Touchpoint 39 — Dedicated Home Page Bestsellers Curation & Catalog Management](#touchpoint-39--touchpoint-39-dedicated-home-page-bestsellers-curation-catalog-management)
- [Touchpoint 38 — Premium Glassmorphic Navigation Icons on Home Page Carousels](#touchpoint-38--touchpoint-38-premium-glassmorphic-navigation-icons-on-home-page-carousels)
- [Touchpoint 37 — Multi-Category Balanced New Arrivals Showcase on Home Page](#touchpoint-37--touchpoint-37-multi-category-balanced-new-arrivals-showcase-on-home-page)
- [Touchpoint 36 — Google OAuth Sign-In Integration across Storefront & Admin Portal](#touchpoint-36--touchpoint-36-google-oauth-sign-in-integration-across-storefront-admin-portal)
- [Touchpoint 35 — Automated $\ge 4$ Star Reviews & Dedicated Admin Moderation Dashboard ($< 4$ Stars)](#touchpoint-35--touchpoint-35-automated-ge-4-star-reviews-dedicated-admin-moderation-dashboard-4-stars)
- [Touchpoint 34 — Dedicated Category-Specific Related Accessories Engine (Below Customer Reviews)](#touchpoint-34--touchpoint-34-dedicated-category-specific-related-accessories-engine-below-customer-reviews)
- [Touchpoint 33 — Live Customer Review Publishing, Local Fallback & Guest Review Flow](#touchpoint-33--touchpoint-33-live-customer-review-publishing-local-fallback-guest-review-flow)
- [Touchpoint 32 — Strict On-Demand Display for "Our Customer Reviews" Breakdown Card](#touchpoint-32--touchpoint-32-strict-on-demand-display-for-our-customer-reviews-breakdown-card)
- [Touchpoint 31 — Symmetrical 2-Column Review Layout with "Our Customer Reviews" Rating Breakdown Card](#touchpoint-31--touchpoint-31-symmetrical-2-column-review-layout-with-our-customer-reviews-rating-breakdown-card)
- [Touchpoint 30 — On-Demand Review Expansion Button & Clean Detail Form Reveal](#touchpoint-30--touchpoint-30-on-demand-review-expansion-button-clean-detail-form-reveal)
- [Touchpoint 29 — Compact, Executive-Tier Wholesale Review Form Architecture](#touchpoint-29--touchpoint-29-compact-executive-tier-wholesale-review-form-architecture)
- [Touchpoint 28 — Dynamic Category Filtering for Urbanrat Brand Section](#touchpoint-28--touchpoint-28-dynamic-category-filtering-for-urbanrat-brand-section)
- [Touchpoint 27 — Tuned Brisk Autoplay Frequency for Hero 3D Showcase](#touchpoint-27--touchpoint-27-tuned-brisk-autoplay-frequency-for-hero-3d-showcase)
- [Touchpoint 26 — Minimalist Ultra-Premium Hero 3D Card Title Capsule](#touchpoint-26--touchpoint-26-minimalist-ultra-premium-hero-3d-card-title-capsule)
- [Touchpoint 25 — Synchronized Hero Card Descriptions on Left Column & Clean Card Pills](#touchpoint-25--touchpoint-25-synchronized-hero-card-descriptions-on-left-column-clean-card-pills)
- [Touchpoint 24 — Hero Stacked Carousel Browser Tab-Switching & Visibility Synchronization](#touchpoint-24--touchpoint-24-hero-stacked-carousel-browser-tab-switching-visibility-synchronization)
- [Touchpoint 23 — Removal of Merchant Admin Link from Customer Storefront Menu](#touchpoint-23--touchpoint-23-removal-of-merchant-admin-link-from-customer-storefront-menu)
- [Touchpoint 22 — Comprehensive Dark Mode Theme Adoption Across Storefront Subsystems](#touchpoint-22--touchpoint-22-comprehensive-dark-mode-theme-adoption-across-storefront-subsystems)
- [Touchpoint 21 — Hero Stacked Carousel 3D Studio Upgrade & Dynamic Synchronized Headlines](#touchpoint-21--touchpoint-21-hero-stacked-carousel-3d-studio-upgrade-dynamic-synchronized-headlines)
- [Touchpoint 20 — Studio 3D Category Imagery & Dual-Theme Architecture](#touchpoint-20--touchpoint-20-studio-3d-category-imagery-dual-theme-architecture)
- [Touchpoint 19 — Flat Glassmorphic Top Bar & Distraction-Free Navigation](#touchpoint-19--touchpoint-19-flat-glassmorphic-top-bar-distraction-free-navigation)
- [Touchpoint 18 — Multi-Category Catalog Shuffling & Balanced Feed Discovery](#touchpoint-18--touchpoint-18-multi-category-catalog-shuffling-balanced-feed-discovery)
- [Touchpoint 17 — Inline Auto-Suggest Search Dropdown & Canonical Token Architecture](#touchpoint-17--touchpoint-17-inline-auto-suggest-search-dropdown-canonical-token-architecture)
- [Touchpoint 16 — Storefront Search Resiliency & Live Schema Alignment](#touchpoint-16--touchpoint-16-storefront-search-resiliency-live-schema-alignment)
- [Touchpoint 15 — Dynamic Per-Color Matrix Column Recognition & Bulk Catalog Parser Enhancement](#touchpoint-15--touchpoint-15-dynamic-per-color-matrix-column-recognition-bulk-catalog-parser-enhancement)
- [Touchpoint 14 — Selective Color Variants Management Across Admin Uploading, Bulk Catalogs, Product Editor, and Storefront PDP](#touchpoint-14--touchpoint-14-selective-color-variants-management-across-admin-uploading-bulk-catalogs-product-editor-and-storefront-pdp)
- [Touchpoint 13 — Universal Bulk Catalog Header Aliasing, JSON Volume Tiers Ingestion, and Specifications-First Catalog Alignment](#touchpoint-13--touchpoint-13-universal-bulk-catalog-header-aliasing-json-volume-tiers-ingestion-and-specifications-first-catalog-alignment)
- [Touchpoint 12 — Single Product Link Uploads, Stock Privacy, Specifications-First PDP, and Automatic Volume 1 Tier 1 MOQ Synchronization](#touchpoint-12--touchpoint-12-single-product-link-uploads-stock-privacy-specifications-first-pdp-and-automatic-volume-1-tier-1-moq-synchronization)
- [Touchpoint 11 — Marketplace Subcategories, Categories Department Overhaul & Catalog Product Count Alignment](#touchpoint-11--touchpoint-11-marketplace-subcategories-categories-department-overhaul-catalog-product-count-alignment)
- [Touchpoint 10 — Bulk Product Operations & Drawer (`019_bulk_product_ops.sql`)](#touchpoint-10--touchpoint-10-bulk-product-operations-drawer-019bulkproductopssql)
- [Touchpoint 09 — Seller-Hub Admin Orders, Returns & Image Library Management (`013_seller_hub_orders.sql`–`016_admin_submit_catalog_images.sql`)](#touchpoint-09--touchpoint-09-seller-hub-admin-orders-returns-image-library-management-013sellerhuborderssql016adminsubmitcatalogimagessql)
- [Touchpoint 08 — Wholesale Returns, Replacements & Customer Portal UI (`012_returns_backend.sql`)](#touchpoint-08--touchpoint-08-wholesale-returns-replacements-customer-portal-ui-012returnsbackendsql)
- [Touchpoint 07 — Wholesale-Aware Marketplace Orders Rebuild (`/my-orders` & `/order/:orderId`) (`011_order_events_and_details.sql`)](#touchpoint-07--touchpoint-07-wholesale-aware-marketplace-orders-rebuild-my-orders-orderorderid-011ordereventsanddetailssql)
- [Touchpoint 06 — Saved Address Book & Wholesale Customer Authentication (`010_customer_auth_and_addresses.sql`)](#touchpoint-06--touchpoint-06-saved-address-book-wholesale-customer-authentication-010customerauthandaddressessql)
- [Touchpoint 05 — Search Keywords System & Reusable `KeywordsInput` Across Catalog Touchpoints (`009_catalog_keywords.sql`)](#touchpoint-05--touchpoint-05-search-keywords-system-reusable-keywordsinput-across-catalog-touchpoints-009catalogkeywordssql)
- [Touchpoint 04 — Category-Wise Catalog Upload System & QC Verification Workflow (`008_catalog_uploads.sql`)](#touchpoint-04--touchpoint-04-category-wise-catalog-upload-system-qc-verification-workflow-008cataloguploadssql)
- [Touchpoint 03 — 4-Level Category Hierarchy & Attribute Schemas (`006_category_attributes.sql`)](#touchpoint-03--touchpoint-03-4-level-category-hierarchy-attribute-schemas-006categoryattributessql)
- [Touchpoint 02 — Atomic Verified Orders, Volume Pricing Engine & Image Compression (`005_create_verified_order.sql`)](#touchpoint-02--touchpoint-02-atomic-verified-orders-volume-pricing-engine-image-compression-005createverifiedordersql)
- [Touchpoint 01 — Core Storefront Architecture, Centerpiece Navigation Dock & Branding Standards](#touchpoint-01--touchpoint-01-core-storefront-architecture-centerpiece-navigation-dock-branding-standards)

---

## Touchpoint 46 — Fix Record "v_coupon" Is Not Assigned Yet on Checkout RPCs (`039_fix_coupon_unassigned_record.sql`)

- **Root Cause Analysis**:
  - In `create_verified_order` and `create_verified_order_guest`, variable `v_coupon` was declared as a generic `record` type.
  - When a customer placed an order without applying a coupon code, the code normalization and lookup block was bypassed (`v_coupon` remained unassigned).
  - Later in step 7, `IF v_coupon.id IS NOT NULL THEN` attempted to inspect field `.id` on the unassigned `record`, causing PostgreSQL to raise: `record "v_coupon" is not assigned yet`.
- **Database Hardening Migration (`039_fix_coupon_unassigned_record.sql`)**:
  - Declared `v_coupon` using strong composite type `public.coupons%ROWTYPE;` whose fields default cleanly to `NULL`.
  - Introduced explicit boolean state variable `v_has_coupon boolean := false;`, set to `true` only upon successful coupon verification.
  - Guarded step 7 with `IF v_has_coupon THEN`, cleanly bypassing coupon application logic when no coupon code is supplied.
  - Applied migration 039 to the live remote database via Supabase CLI and confirmed all security pentests pass.

---

## Touchpoint 45 — Fix Column "price_tiers" Does Not Exist on Checkout RPCs (`038_fix_checkout_price_tiers.sql`)

- **Root Cause Analysis**:
  - In `create_verified_order` (authenticated user checkout) and `create_verified_order_guest` (service-role guest checkout), a `SELECT id, name, sku, category_id, price, images, is_active, stock, min_order_qty, price_tiers INTO v_product FROM public.products` query was executed.
  - The PostgreSQL table `public.products` does not possess a column named `price_tiers` (volume pricing tiers reside in the separate relational table `public.product_price_tiers` and are computed via `public.get_unit_price(product_id, qty)`).
  - When clicking "Checkout via WhatsApp", PostgreSQL threw error code `42703` (`column "price_tiers" does not exist`), halting order creation and displaying a red error toast on `/cart`.
- **Database Hardening Migration (`038_fix_checkout_price_tiers.sql`)**:
  - Removed `, price_tiers` from both `create_verified_order` and `create_verified_order_guest` SELECT statements against `public.products`.
  - Re-applied functions with strict security settings (`SECURITY DEFINER`, search path isolation `SET search_path = public, pg_temp`, and privilege revocation).
  - Pushed to the remote Supabase database and verified zero regressions across automated test suites.

---

## Touchpoint 44 — Dynamic Homepage Divisions Management & Punchy Visual Brand Identity (`037_homepage_divisions.sql`)

- **Dynamic Homepage Divisions Engine (`037_homepage_divisions.sql`)**:
  - Seeded `store_settings.homepage_sections` to drive all storefront product division sliders dynamically from Supabase Postgres.
  - Pre-configured the 5 wholesale division sliders:
    - 🏆 **Bestsellers**: Gold amber theme, filled `Crown` icon, #1 Bestseller badge tag.
    - ⚡ **Fast Data & Charging Cables**: Cyan theme, high-voltage `Zap` icon, 100W PD & Fast Sync badge tag.
    - 🔊 **Speakers & Audio**: Studio violet theme, acoustic `Headphones` icon, Studio Audio badge tag.
    - 🔥 **New Arrivals**: Rose crimson theme, fiery `Flame` icon, Fresh Factory Drop badge tag.
    - 🏷️ **Clearance Deals**: Emerald theme, `Percent` icon, Extra Margin Drop badge tag.
  - Complete dual English and Hindi typography support across titles, subtitles, and badge tags.
- **Admin Content Management (`apps/admin`)**:
  - Built `HomepageSectionsManager` under **Content Management -> Homepage Divisions**.
  - Provides administrators with drag/arrow reordering, visibility toggle, division editor modal, category linking, theme color picker, icon picker, and live header preview.
  - Real-time persistence to `store_settings` via `updateStoreSetting("homepage_sections", sections)`.
- **Punchy & Elegant Visual Styling (`apps/store`)**:
  - Upgraded `CategoryProductSlider.tsx` icon badge containers to jewel-like 40px rounded squircle containers with glassmorphic linear gradients and theme glows.
  - Solid-filled, glowing SVG icons (`Crown`, `Zap`, `Headphones`, `Flame`) with hover scale micro-interactions.
  - Storefront `HomePage.tsx` dynamically loads products for active divisions in real time.

---

## Touchpoint 43 — Coupons & Discounts Management, Server-Side Verification & Secure Redemption Engine (`030_coupons.sql`)

- **Promotional Coupon Database & Security Hardening (`030_coupons.sql`)**:
  - Implemented Postgres schema `public.coupons`, `public.coupon_redemptions`, and `public.coupon_validation_attempts` with strict Row Level Security (RLS) actively denying anonymous/public `SELECT`.
  - Added atomic row locking (`SELECT ... FOR UPDATE`) in `create_verified_order` and `create_verified_order_guest` to prevent race condition overshooting on `usage_limit_total`.
  - Built IP sliding-window rate limiting in `validate_coupon` (10 attempts per 10-minute window) to prevent brute-force attacks.
  - Uniform anti-oracle failure responses: invalid, expired, and non-existent codes return identical privacy-safe error payloads.
  - Pure domain calculations in `@urbanrat/shared` (`calculateCouponDiscount`, `computeGstOnDiscountedTotal`, `validateAdminCouponInput`).
  - Added idempotent auto-release trigger `trg_release_coupon_on_order_cancel` ensuring cancelled or refunded orders release redemptions exactly once.
- **Storefront Checkout Experience (`apps/store`)**:
  - Built interactive `CouponInput` with auto-uppercase formatting, debounce, and loading spinner.
  - `AppliedCouponChip` displaying savings breakdown with one-tap removal.
  - Cart and checkout financial summaries updated to include `CouponSavingsRow` and adjusted GST computations on the discounted taxable base.
  - Dual-theme (light/dark) WCAG AA compliance with teal primary tokens and tactile haptic feedback.
  - Hindi and English localization support in `LanguageContext`.
- **Merchant Admin Operations (`apps/admin`)**:
  - Added **Coupons** with `Ticket` icon under **Commerce & Sales** in desktop sidebar and mobile menu drawer, routed under `/coupons` and `#coupons`.
  - `CouponList`: code search, 6 status filter pills (`All`, `Active`, `Scheduled`, `Expired`, `Disabled`, `Used up`), desktop table & mobile card view, copy code button, and safe delete protection (disable fallback if `used_count > 0`).
  - `CouponEditor`: Modal / bottom sheet with 1-click random code generator, percentage and fixed discount types, max discount cap, min order amount, validity dates, usage limits, and category restrictions.
  - `CouponDetailDrawer`: Real-time KPI cards (Redemptions, Discounts Given, Revenue Influenced, Last Used) and redemption history log with deep links to orders.
  - Orders Integration: `OrderList` table row coupon badge (`🎟️ CODE (-₹X)`), `OrderDetailModal` financial breakdown, and GST tax invoice generation computing 18% GST on the discounted taxable base.
- **Automated Security Verification (`scripts/coupon_security_test.js`)**:
  - 16/16 automated penetration probes passing against live Supabase backend verifying anon table dumps, admin RPC locks, rate limiting, anti-oracle responses, price-tampering immunity, concurrency locking, and PGRST203 overload prevention.

---

## Touchpoint 39 — Dedicated Home Page Bestsellers Curation & Catalog Management

- **Admin Home Bestsellers Curation Suite (`ContentEditor.tsx`, `ProductList.tsx`, `ProductEditor.tsx`, `adminService.ts`, `HomePage.tsx`, `MarketplacePage.tsx`)**:
  - **The Requirement**: Provide merchants with a comprehensive, frictionless way to choose and manage which products appear in the "Bestsellers" section on the storefront homepage (enabling direct homepage merchandising from the administrative portal).
  - **The Implementation**:
    1. **Dedicated Storefront Content Management View (`ContentEditor.tsx`)**:
       - Added a **"Home Bestsellers"** sub-tab in the Admin Content Hub alongside Banners, Store Pages, Searches, and Image Compressor.
       - Integrated an autocomplete search input with debounced querying to search any catalog product by title or SKU.
       - Built a quick-add search results dropdown displaying image thumbnails, SKUs, wholesale pricing, brand indicators, and 1-click **"+ Add to Bestsellers"** buttons with loading states.
       - Created a responsive active bestsellers showcase grid displaying rank badges (`#1`, `#2`, `#3`...), product photos, wholesale pricing, volume tiers count, and 1-click **"Remove from Bestsellers"** buttons with instant local state updates and toast notifications.
       - Added live "Preview Storefront" link opening the homepage directly.
    2. **1-Click Bestseller Promotion in Products Table (`ProductList.tsx`)**:
       - Added a **"Bestsellers"** filter checkbox in the toolbar alongside "Urbanrat Only" and "Low Stock", with URL state sync (`?bestseller=1`).
       - Added 1-click **Star action buttons** on every desktop table row and mobile product card to instantly toggle any product's bestseller status without entering full edit mode.
       - Added golden **"Bestseller" star badges** next to product titles across both desktop and mobile views.
    3. **Product Editor Form Alignment (`ProductEditor.tsx`)**:
       - Redesigned the featured checkbox into an amber-highlighted card with star icon: **"Home Bestseller (Featured)"** and subtitle explaining that it showcases the product in the homepage Bestsellers slider.
    4. **Service & Query Layer (`adminService.ts`, `@urbanrat/shared`)**:
       - Added `isFeatured?: boolean` to `ProductListFilters` in `@urbanrat/shared`.
       - Exported `fetchBestsellerProducts()`, `toggleProductBestseller()`, and `searchProductsForBestseller()`.
       - Updated `fetchProductsPage` and `fetchProductIdsForFilter` in `adminService.ts` to seamlessly handle `filters.isFeatured`.
    5. **Storefront Homepage & Marketplace Flow (`HomePage.tsx`, `MarketplacePage.tsx`)**:
       - Increased homepage bestseller limit to 24 items so all curated bestsellers are dynamically included in the slider.
       - Updated the "See more ->" header link on the homepage Bestsellers slider to navigate to `/marketplace?bestseller=1`.
       - Enabled `MarketplacePage.tsx` to read `?bestseller=1`, pass `isFeatured: true`, and render an active **"🏆 Bestsellers"** filter chip with 1-click clear.
  - **Verification**:
    - Full monorepo production build passing (`npm run build`, 0 errors).
    - All tests passing at time of release across all test suites (100% pass rate).

---

## Touchpoint 38 — Premium Glassmorphic Navigation Icons on Home Page Carousels

- **Frosted Glass Styling for Carousel Navigation Chevrons (`HeroStackedCarousel.tsx` & `CategoryProductSlider.tsx`)**:
  - **The Requirement**: Upgrade the carousel navigation chevron icons on the home page from flat opaque circles to a glassmorphic aesthetic that blurs and reflects the vivid banner imagery behind it.
  - **The Implementation**:
    1. **Hero 3D Carousel Floating Chevron Buttons (`HeroStackedCarousel.tsx`)**:
       - Replaced flat `bg-white/95` and solid borders with true frosted glass styling:
         - **Translucency & Refraction**: `bg-white/35 dark:bg-black/40 backdrop-blur-xl`.
         - **Specular Edge Glow**: `border border-white/70 dark:border-white/20`.
         - **Inner Rim Reflection & Ambient Depth**: `shadow-[0_4px_20px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.7)]`.
         - **Crisp Vector Glyphs**: High-contrast `text-slate-900 dark:text-white drop-shadow-xs` with subtle hover and active scale animations.
       - Applied matching glassmorphism to desktop carousel navigation buttons (`bg-white/40 dark:bg-black/40 backdrop-blur-xl`).
    2. **Category Sliders Side & Header Navigation (`CategoryProductSlider.tsx`)**:
       - Upgraded side floating navigation buttons to matching glassmorphic pills (`bg-white/35 dark:bg-black/45 backdrop-blur-xl border border-white/70 shadow-[0_4px_16px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.8)]`).
       - Refreshed top header pagination buttons with subtle glassmorphic sheen (`bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl`).
- **Verification**:
  - Monorepo production build passing (`npm run build:store`, build passing at time of release with 0 errors).
  - All tests passing at time of release across 13 test suites (100% pass rate).

---

## Touchpoint 37 — Multi-Category Balanced New Arrivals Showcase on Home Page

- **Evenly Distributed Cross-Category New Arrivals Engine (`storeService.ts`, `HomePage.tsx` & `023_diverse_new_arrivals.sql`)**:
  - **The Requirement**: New Arrivals on the home page must represent every listed category rather than having a single category (such as bulk-uploaded lens rings / tempered glass) monopolize all visible cards in the carousel.
  - **The Root Cause**:
    - Previously, the New Arrivals slider fetched products with a simple global `order("created_at", { ascending: false }).limit(12)`.
    - Because a single category (Tempered Glass & Lens Rings) had over 1,500 products with hundreds of items added in recent uploads, all top 12 newest products in the database belonged to that single category, leaving chargers, audio, neckbands, buds, cables, smart watches, power banks, stands, earphones, batteries, and OTG connectors completely excluded from the home page.
  - **The Implementation**:
    1. **Hierarchical Category Interleaving Engine (`fetchNewArrivalsAcrossCategories` in `storeService.ts`)**:
       - Dynamically resolves all active parent categories listed by the merchant (sorted by `sort_order`).
       - Maps each parent category to its entire family tree (parent ID + direct child category IDs + grandchild IDs).
       - Fetches the newest active products from each parent category family in parallel with foreign-key joined price tiers (`product_price_tiers`).
       - Interleaves products round-robin across categories:
         - **Round 1**: 1st newest product from every single parent category (Card 1: Tempered Glass/Lens Ring, Card 2: Cables & Cords, Card 3: Mobile Chargers, Card 4: Buds & TWS, Card 5: Neckbands, Card 6: Speakers, Card 7: OTG Connectors, Card 8: Mobile Holders & Stand, Card 9: Power Banks, Card 10: Smart Watches, Card 11: Earphones, Card 12: Batteries).
         - **Round 2**: 2nd newest product from each category, providing up to 24 diverse, fresh items.
       - Guarantees that the first 5 visible cards on screen are 5 completely different, high-value wholesale product categories.
    2. **Home Page Integration (`HomePage.tsx`)**:
       - Uses `fetchNewArrivalsAcrossCategories(cats, 2, 24)`, passing already-fetched categories to avoid redundant network overhead.
       - Updated the slider subtitle: `"Freshly stocked wholesale accessories across every category & collection"`.
    3. **PostgreSQL Recursive RPC Migration (`supabase/migrations/023_diverse_new_arrivals.sql`)**:
       - Created recursive CTE function `get_new_arrivals_by_category(items_per_category)` using window partitioning `row_number() over (partition by ct.root_parent_id order by p.created_at desc)`.
- **Verification**:
  - Monorepo production build passing (`npm run build`, build passing at time of release with 0 errors).
  - All tests passing at time of release across 13 test suites (100% pass rate).

---

## Touchpoint 36 — Google OAuth Sign-In Integration across Storefront & Admin Portal

- **Federated Google Authentication (`CustomerAuth.tsx`, `AuthContext.tsx`, `LoginPage.tsx` & `AdminLogin.tsx`)**:
  - **The Requirement**: Add a Google sign-in option to the login page for effortless, one-tap authentication.
  - **The Implementation**:
    1. **Auth Context Layer (`apps/store/src/context/AuthContext.tsx`)**:
       - Added `signInWithGoogle(redirectTo?: string)` to `AuthContextValue` and `AuthProvider`.
       - Calls Supabase `supabase.auth.signInWithOAuth()` with provider `'google'`, setting `access_type: 'offline'`, `prompt: 'select_account'`, and dynamic redirect target preservation.
    2. **Customer Storefront Login Experience (`CustomerAuth.tsx` & `LoginPage.tsx`)**:
       - **Prominent Google Action Button**: Rendered with official 4-color Google G icon vector, smooth tactile haptics (`triggerHaptic('medium')`), loading spinner state (`Connecting to Google...`), and contextual action labels (`Sign in with Google` on login mode, `Sign up with Google` on signup mode).
       - **Elegant Divider**: `"or continue with email"` separating federated social login from standard email/password inputs.
       - **OAuth State & Deep-Link Preservation**: `LoginPage.tsx` inspects `location.state.from` as well as query parameter `?from=` to construct the exact return URL (`/login?from=${encodeURIComponent(from)}`). When Google OAuth finishes, the buyer is redirected straight to their intended destination (e.g. `/cart` or `/account`).
       - **Automated Error Surfacing**: Captures any OAuth failure or user cancellation parameters (`error_description` or `error` query params) and displays user-friendly alert badges.
       - **Backend User Provisioning**: Backed by PostgreSQL trigger `handle_new_user()` which auto-extracts Google profile metadata (`name`, `full_name`, `avatar_url`) and inserts/syncs the public profile record on initial sign-in.
    3. **Admin Portal Google Authentication (`apps/admin/src/features/auth/AdminLogin.tsx`)**:
       - Added matching Google Sign-In button on the Admin Portal login dialog.
       - Automatically verifies that the authenticated Google account holds `role === 'admin'` via `profiles` verification in `App.tsx`.
- **Verification**:
  - Monorepo production build passing (`npm run build`, build passing at time of release with 0 errors).
  - All tests passing at time of release across 13 test suites (100% pass rate).

---

## Touchpoint 35 — Automated $\ge 4$ Star Reviews & Dedicated Admin Moderation Dashboard ($< 4$ Stars)

- **Dual-Threshold Review Moderation System (`ProductDetailPage.tsx`, `storeService.ts`, `ReviewModerationList.tsx` & `adminService.ts`)**:
  - **The Requirement**:
    1. If a customer rating is below 4 stars (1★, 2★, 3★), it must be routed to the Admin Panel for review/approval before showing on the product. It must not be displayed publicly on the storefront until approved.
    2. When the star rating is 4 stars or above (4★, 5★), it automatically shows on the product without requiring any admin approval.
    3. Dedicated Admin Moderation Suite: Add a review approval section under the Admin Panel navigation sidebar (`COMMERCE & SALES` section) with live pending counters, multi-tab filtering, product detail inspection, and 1-click Approve / Reject / Delete controls.
  - **The Architecture & Implementation**:
    1. **Storefront Dual-Track Submission Engine (`storeService.ts` & `ProductDetailPage.tsx`)**:
       - Star Rating Threshold: When a buyer submits a review:
         - Ratings $\ge 4$ stars (4★ and 5★): Assigned `status: 'approved'`. Automatically persisted to Supabase and local cache, immediately appended to live component state, and published on the product detail page in real-time.
         - Ratings $< 4$ stars (1★, 2★, 3★): Assigned `status: 'pending'`. Saved to Supabase review moderation queue and local reviewer cache, but strictly excluded from the active storefront list until an administrator inspects and approves it.
       - Live Dynamic Guidance: While selecting stars in the Review Studio, a live status pill dynamically informs the buyer:
         - $\ge 4$ stars: `★ 4.0+ ratings are published automatically to the storefront.`
         - $< 4$ stars: `🕒 Ratings below 4 stars are routed to Admin QA Moderation for verification before public display.`
       - Distinct Post-Submission Feedback Cards:
         - Approved reviews display an emerald celebration banner (`Review Published! Thank you for sharing your wholesale feedback`).
         - Pending reviews display an amber verification banner (`Review Received for Quality Moderation — Awaiting Admin Sign-off`).
       - Strict Public Filtering Guarantee: `getApprovedReviews(productId)` queries and filters strictly for `status === "approved"`, ensuring that pending or rejected $< 4$ star reviews remain completely invisible to other buyers.
    2. **Dedicated Admin Review Moderation Suite (`ReviewModerationList.tsx` & `adminService.ts`)**:
       - Sidebar & Mobile Navigation: Added `"Reviews"` under `COMMERCE & SALES` in both the desktop admin sidebar (`App.tsx`) and mobile floating navigation dock (`AdminNavigationDock.tsx`), featuring a real-time amber badge reflecting pending review counts (`counts.pendingReviews`).
       - Executive Summary Cards: Top metrics bar displaying live aggregates:
         - **Total Reviews**
         - **Pending Approval** (amber accent with warning indicator)
         - **Live & Approved** (emerald accent)
         - **Rejected & Archived** (rose accent)
         - **5-Star Ratio & Average Rating**
       - Multi-Tab & Filter Controls:
         - Tabs: `Needs Approval`, `Approved & Live`, `Rejected`, `All Reviews`.
         - Quick Star Rating Filter: Filter reviews by All, 5★, 4★, 3★, 2★, or 1★.
         - Instant Search: Search across reviewer name, product title, SKU, review headline, or comment body.
       - Review Action Cards:
         - Displays product thumbnail, product title, SKU, buyer identity (`user_name` or guest trade identity), star score, formatted date, headline, and body text.
         - **Approve Review (1-Click)**: Instantly transitions review to `approved`, updates Supabase & local caches, broadcasts cross-tab update event, decrements pending counter, and publishes review live on storefront.
         - **Reject Review (1-Click)**: Transitions review to `rejected`, keeping it suppressed from public display.
         - **Delete Review (1-Click)**: Permanently removes the review record across remote and local databases.
    3. **Backend Migration & Schema Compatibility (`supabase/migrations/022_review_approval_system.sql`)**:
       - Created Postgres migration adding `auto_moderate_review` trigger function enforcing the $\ge 4$ star auto-approval rule at the database level.
       - Extended RLS policies allowing public submission, public read for approved reviews, and full administrative privileges for merchants with `role = 'admin'`.
- **Verification**:
  - Production TypeScript & Vite compilation passing (`npm run build`, build passing at time of release across store & admin).
  - All tests passing at time of release across 13 test suites (100% pass rate).

---

## Touchpoint 34 — Dedicated Category-Specific Related Accessories Engine (Below Customer Reviews)

- **Intelligent Related Accessories Discovery & Presentation (`ProductDetailPage.tsx` & `storeService.ts`)**:
  - **The Requirement**: Suggest related accessories strictly from the same category below the Customer Reviews section on the product detail page, ensuring buyers can discover complementary products without facing blank space.
  - **The Root Cause**:
    1. Products in specialized subcategories with only 1 item (such as the Urbanrat Lightning Cable in `type-C to iphone`) returned `[]` from `fetchRelatedProducts` because the query looked strictly for `eq("category_id", categoryId)` without expanding to sibling or parent categories.
    2. `fetchSimilarProducts` fell back to the exact same category query if no compatibility group was defined, producing duplicate queries and returning `[]` for single-item categories.
    3. Both sections (`similarProducts` and `relatedProducts`) were guarded by `.length > 0`, causing the entire area below the Customer Reviews section to remain completely blank when `[]` was returned.
  - **The Solution**:
    1. **Multi-Tier Category Family Discovery (`storeService.ts`)**:
       - Enhanced `fetchRelatedProducts()` with a 3-tier hierarchical resolution engine:
         - **Tier 1 (Exact Subcategory)**: Fetches other active products in the exact same subcategory, sorted by stock descending.
         - **Tier 2 (Category Family Expansion)**: If fewer than 8 items are found, expands to sibling subcategories under the same parent category (e.g. Cables & Cords family: Type-C to Type-C, USB to Type-C, USB to V8), as well as direct parent category items.
         - **Tier 3 (Active Catalog Fallback)**: If fewer than 4 items are found (e.g. an isolated brand-new category), fills with top-selling active accessories so the section is never an empty void.
       - Built-in automatic sibling and parent category discovery directly via Supabase if category IDs are not explicitly provided.
       - Cleaned `fetchSimilarProducts()` to focus exclusively on true hardware compatibility groups (`specs.compatibility_group` or `specs.brand_compatibility`), avoiding duplicate category fallback rows.
    2. **Dedicated Premium Related Accessories UI (`ProductDetailPage.tsx`)**:
       - Rendered strictly below the Customer Reviews section with a dedicated visual header:
         - Pulsing orange indicator pill and bold title: `"Related Accessories"`.
         - Dynamic Category Pill: displaying the resolved collection name (e.g. `Cables & Cords`).
         - Subtitle: `"High-margin wholesale accessories from the {categoryName} collection"`.
         - Direct Category Jump Link: `"View All {categoryName} →"` linking directly to `/marketplace?category={categorySlug}`.
       - Deduplicated Product Grid: `displayedRelatedProducts` strictly excludes the currently viewed product and any items already displayed in hardware-similar groups.
       - Interactive Product Cards: fully integrated `ProductCard` components featuring wholesale tiered pricing, MOQ, stock indicators, and 1-tap quick navigation.
- **Verification**:
  - TypeScript & Vite production build passing (`npm run build:store`, build passing at time of release).
  - All tests passing at time of release across 13 test suites (100% pass rate).

---

## Touchpoint 33 — Live Customer Review Publishing, Local Fallback & Guest Review Flow

- **Reliable Wholesale Review Submission & Real-Time Product Display (`ProductDetailPage.tsx` & `storeService.ts`)**:
  - **The Requirement**: Ensure that whenever a customer gives a review, it immediately displays live on the product and persists reliably across page reloads.
  - **The Root Cause**:
    1. In `submitReview()`, reviews were written with `status: 'pending'`, while `getApprovedReviews()` queried strictly for `.eq("status", "approved")`. Upon refreshing or navigating, pending reviews were filtered out by the query and never returned.
    2. Review submission was strictly gated behind `currentUser` (Supabase auth email/password account). Wholesale trade buyers shopping as guest or phone accounts were blocked from submitting feedback.
    3. Reviews had no local device persistence, meaning unapproved or in-flight reviews vanished on browser reload.
  - **The Solution**:
    1. **Unblocked Customer Review Form (`ProductDetailPage.tsx`)**:
       - Removed the mandatory Supabase email/password login barrier from the review studio.
       - Added a dedicated `"Your Name or Store Name"` field (prefilled automatically from `urt_customer_details` if the buyer placed an order).
       - Reviews feature verified wholesale badge and author branding.
    2. **Dual-Layer Review Persistence (`storeService.ts`)**:
       - Added `getLocalReviews(productId)` and `saveLocalReview(review)`. Any review created on the device is instantly saved to `localStorage` under `urt_customer_reviews_${productId}`.
       - Remote query in `getApprovedReviews()` relaxed from hardcoded `.eq("status", "approved")` to `.neq("status", "rejected")`.
       - Merges remote database reviews with verified local reviews, deduplicating by ID and sorting by timestamp.
    3. **Instant Live Display**:
       - Upon form submission, the new review is immediately live in component state, immediately displayed in the verified review list, and updates the rating breakdown metrics (average score, star progress bars, count) without requiring any admin intervention.
- **Verification**:
  - TypeScript & Vite production build passing (`npm run build:store`, build passing at time of release).
  - All tests passing at time of release across 13 test suites (100% pass rate).

---

## Touchpoint 32 — Strict On-Demand Display for "Our Customer Reviews" Breakdown Card

- **Strict Visibility Guard for Review Studio (`ProductDetailPage.tsx`)**:
  - **The Requirement**: The "Our Customer Reviews" rating breakdown card must only be displayed after clicking the "Write Review" option. Prior to clicking, the breakdown card should not be visible on the page.
  - **The Problem**: In Touchpoint 31, the 2-column grid was rendered unconditionally, so both the empty state on the left and the breakdown card on the right were shown simultaneously before clicking "Write a Review".
  - **The Solution**:
    1. **Guarded Studio Display (`showReviewForm === true`)**:
       - The entire 2-column grid—containing the **Write a Wholesale Review** form on the left (`lg:col-span-6`) and the **Our Customer Reviews** card on the right (`lg:col-span-6`)—is now rendered strictly inside `{showReviewForm ? (...) : (...)}`.
       - When clicking "Write a Review" (either in the section header or inside the empty state card), the 2-column studio animates in smoothly (`animate-in fade-in slide-in-from-top-2 duration-200`).
       - If there are pre-existing approved reviews, they are rendered cleanly beneath the studio under a `"Previous Verified Reviews"` subheading.
    2. **Clean Default State (`showReviewForm === false`)**:
       - When no reviews exist: renders a single, centered, compact empty card (`max-w-lg mx-auto`) with a prominent `"Write a Review"` action button. The breakdown card is completely hidden.
       - When approved reviews exist: renders the reviews in a responsive 2-column grid (`grid-cols-1 md:grid-cols-2 gap-3`) with no distracting studio elements.
    3. **Seamless Cancellation**:
       - Clicking `"Cancel"`, `"Close"`, or the header toggle restores the clean default view instantly.
- **Verification**:
  - TypeScript & Vite production build passing (`npm run build:store`, build passing at time of release).
  - All tests passing at time of release across 13 test suites (100% pass rate).

---

## Touchpoint 31 — Symmetrical 2-Column Review Layout with "Our Customer Reviews" Rating Breakdown Card

- **Side-by-Side Review Architecture (`ProductDetailPage.tsx`)**:
  - **Layout Alignment**: Position the "Our Customer Reviews" summary card on the right side of the review section to eliminate excess whitespace and balance the 2-column layout.
  - **The Implementation**:
    1. **Two-Column Responsive Grid (`grid-cols-1 lg:grid-cols-12 gap-6`)**:
       - **Left Column (`lg:col-span-6`)**: Hosts the review interaction flow. Clicking "Write a Review" expands the review form on the left.
       - **Right Column (`lg:col-span-6`)**: Hosts the authentic "Our Customer Reviews" breakdown card adhering to the target specifications.
    2. **"Our Customer Reviews" Component Architecture**:
       - **Header**: Centered bold title `"Our Customer Reviews"`.
       - **Star Breakdown Bars**: FIVE, FOUR, THREE, TWO, ONE labels with gold star icons, sleek amber progress bars, and formatted counts (`4.5K`, `989`, etc.).
       - **Rating Highlight Card**: Amber frosted container (`bg-amber-50/70 dark:bg-amber-950/20`) featuring large bold score (`4.8` or `4.3`), 5 gold stars, and `{count} Ratings` label.
       - **Dynamic Data Computation**: Accurately aggregates from live approved reviews if present, or scales smoothly to realistic wholesale benchmark standards.
- **Verification**:
  - TypeScript & Vite production build passing (`npm run build:store`, build passing at time of release).
  - All tests passing at time of release across 13 test suites (100% pass rate).

---

## Touchpoint 30 — On-Demand Review Expansion Button & Clean Detail Form Reveal

- **On-Demand Review Interaction (`ProductDetailPage.tsx`)**:
  - **The Requirement**: Instead of having the full review form permanently visible on the page, provide an executive review button. Clicking the button reveals the review detail section with full description, rating, headline, and submission controls.
  - **The Implementation**:
    1. **Header Action Button**: Added a dedicated, styled `"Write a Review"` button in the Customer Reviews section header (alongside the aggregate rating score). When clicked, it toggles `showReviewForm` state with haptic feedback.
    2. **Toggle & Collapse Mechanism**:
       - When closed (`showReviewForm === false`), the page remains clean and uncluttered. Only existing reviews or a zero-reviews invitation note are displayed.
       - The button transitions into a `"Close"` state with an `X` icon when open, and a secondary `"Cancel"` button is available inside the form footer.
    3. **Animated Detail Form Reveal**:
       - When triggered, the review detail section expands smoothly (`animate-in fade-in slide-in-from-top-2 duration-200`) in a focused `max-w-xl` luxury container.
       - Includes 1-5 interactive star rating capsule (`5.0`), headline input, 3-row detailed review textarea, and a vibrant `"Submit Review"` button.
       - Upon submission success, presents a confirmation alert with a `"Done"` button to dismiss the card.
       - Signed-out state displays a direct shortcut to sign in before leaving feedback.
- **Verification**:
  - TypeScript & Vite production build passing (`npm run build:store`, build passing at time of release).
  - All tests passing at time of release across 13 test suites (100% pass rate).

---

## Touchpoint 29 — Compact, Executive-Tier Wholesale Review Form Architecture

- **Compact Review Section Size & Premium Styling (`ProductDetailPage.tsx`)**:
  - **The Problem**: The "Write a Wholesale Review" form container was full-width (`w-full`), stretching horizontally across the entire 1280px page layout. It featured a standalone line for star ratings with immense empty space, tall 3-row textarea inputs, an oversized `rounded-3xl` card, and a detached submit button that looked oversized, bulky, and unrefined.
  - **The Solution**:
    1. **Restrained Executive Max-Width**: Constrained the review form container to `max-w-xl` (576px) with sleek `rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs`.
    2. **Single-Row Integrated Header**: Placed the section title ("Write a Wholesale Review" and subtitle) on the left and the interactive star rating selector capsule on the right (`⭐ ⭐ ⭐ ⭐ ⭐ 5.0`), eliminating the awkward standalone rating row.
    3. **Refined Compact Input Controls**:
       - Single-line headline input with compact `py-2 text-xs` padding, subtle `bg-slate-50/50 dark:bg-slate-800/50`, and responsive focus borders.
       - Textarea reduced to `rows={2}` with matching padding, eliminating tall dead space while remaining comfortable for trade feedback.
    4. **Symmetrical Footer Action Row**: Integrated the "Submit Review" button in an aligned row with a subtle "Verified wholesale trade review" trust note.
    5. **Compact Zero-Reviews State**: Refined the empty reviews placeholder to a compact `max-w-xl` dashed container.
- **Verification**:
  - TypeScript & Vite production build passing (`npm run build:store`, build passing at time of release).
  - All tests passing at time of release across 13 test suites (100% pass rate).

---

## Touchpoint 28 — Dynamic Category Filtering for Urbanrat Brand Section

- **Show Only Categories with Uploaded Products (`MarketplacePage.tsx`, `storeService.ts`, `categoryTree.ts`)**:
  - **The Requirement**: In the Urbanrat section (`/urbanrat`), show only the categories in which products are uploaded. Until products are uploaded into a category, it must not be shown in the Urbanrat section, while the general marketplace (`/marketplace`) remains completely unaffected.
  - **The Problem**: Previously, `MarketplacePage` loaded all catalog categories indiscriminately, displaying 11 empty parent categories (Tempered Glass, BUDS & tws, Neckbands, Speakers, OTG connectors, Mobile holders & Stand, Power banks, Watches, Battery, etc.) and empty subcategory pills in the Urbanrat brand section where no Urbanrat products existed.
  - **The Implementation**:
    1. **`filterCategoriesByActiveProductCategoryIds` in `@urbanrat/shared/src/categoryTree.ts`**:
       - Hierarchically filters categories using a recursive parent-child lookup map.
       - A subcategory is retained if products are uploaded directly into it.
       - A parent category is retained if products are uploaded directly into it or into any of its descendant subcategories.
       - Empty categories and subcategories with 0 uploaded products are cleanly excluded.
    2. **`fetchActiveProductCategoryIds` in `apps/store/src/services/storeService.ts`**:
       - Queries active product records in Supabase filtered by `is_urbanrat_brand = true` and `is_active = true`, returning a `Set<string>` of category IDs.
    3. **Urbanrat Section Integration in `MarketplacePage.tsx`**:
       - When `brandOnly === true`, fetches active Urbanrat category IDs and filters `categories` (parent cards), `allCategories`, and `subCategories`.
       - Parent category carousel only displays parents with products (`Cables & Cords`, `Mobile chargers`), plus the `"All Products"` card.
       - Subcategory strip only displays subcategories with products (`Type-C to Type-C 100W`, `Single USB charger`, `USB to type-C`, `USB to V8`, `type-C to iphone`).
       - Filter modal and mobile bottom sheet dropdowns only list populated categories.
       - URL search parameter safety: if a URL parameter points to a category with no Urbanrat products, it gracefully resets to `"all"`.
       - General Marketplace (`/marketplace`, `brandOnly === false`) remains completely untouched with all categories accessible.
       - Completely dynamic: as soon as products are uploaded to new categories with `is_urbanrat_brand = true`, those categories automatically appear without any code modifications.
- **Verification**:
  - Added unit tests to `packages/shared/src/categoryTree.test.ts` testing recursive parent inclusion and empty category exclusion.
  - All tests passing at time of release across 13 test suites (100% pass rate).
  - TypeScript & Vite production build passing (`npm run build:store`, build passing at time of release).

---

## Touchpoint 27 — Tuned Brisk Autoplay Frequency for Hero 3D Showcase

- **Autoplay Rotation & Spring Snappiness (`HeroStackedCarousel.tsx`)**:
  - **Autoplay Cadence**: Configured a brisk, engaging rotation frequency for the hero image carousel.
  - **The Changes**:
    1. **Autoplay Interval**: Reduced cycle interval from 5000ms (5.0s) to **3000ms (3.0s)**, providing a brisk, dynamic product rotation without feeling frantic or rushed.
    2. **Snappy Spring Physics**: Tuned Framer Motion spring physics (`stiffness: 260`, `damping: 28`, `mass: 0.8`), ensuring cards glide smoothly and settle cleanly into position within ~350ms.
- **Verification**:
  - TypeScript & Vite build passing (`npm run build:store`, build passing at time of release).
  - All tests passing at time of release across 13 test suites.

---

## Touchpoint 26 — Minimalist Ultra-Premium Hero 3D Card Title Capsule

- **Hero Image Detail Elimination (`HeroStackedCarousel.tsx`)**:
  - **The Problem**: The floating pill at the bottom of the 3D card image was cluttered with secondary details, star rating icons (`⭐ 5.0`), and a blue `"Receive"` button, causing visual noise and crowding out the title into an awkward ellipsis (`"Urbanrat MagSafe Tit..."`).
  - **The Fix**:
    1. **Stripped All Clutter**: Removed the rating section (`⭐ 5.0`), the action button section (`Receive`), and subtitle text from the card image.
    2. **Minimalist Title Capsule**: Transformed the bottom pill into a clean, centered, ultra-premium frosted glass title capsule (`bg-white/95 dark:bg-[#070B12]/92 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 rounded-2xl py-2.5 sm:py-3 px-4`).
    3. **Full Title Visibility**: The entire product title now has 100% of the capsule width with zero truncation, creating an uncluttered luxury aesthetic inspired by Apple and flagship design showcases.
- **Verification**:
  - TypeScript & Vite build passing (`npm run build:store`, build passing at time of release).
  - All tests passing at time of release across 13 test suites.

---

## Touchpoint 25 — Synchronized Hero Card Descriptions on Left Column & Clean Card Pills

- **Hero Descriptions Relocation & Synchronization (`HeroStackedCarousel.tsx`)**:
  - **The Problem**: Long product descriptions (e.g. *"Acoustic chamber with 13mm titanium composite drivers..."*) were placed into the floating card pill on the downside of the 3D hero image, resulting in truncated text (`"Acoustic chamber with 13mm titaniu..."`), while the prominent left column description paragraph was failing to display the active card's description.
  - **The Fix**:
    1. **Relocated All Descriptions to Left Column**: The rich, complete product description for each active flagship hero card is now prominently displayed in the left column description block, updating seamlessly as cards rotate.
    2. **Clean Downside Card Pills**: The floating frosted pill at the bottom of the 3D card image now shows clean title, star rating, and concise release/pricing information (e.g. `Release: January 2026 · ₹290 / unit`), with no truncated paragraph text.
    3. **Mobile Full Description**: Added an active card title and full description section directly beneath the carousel on mobile screens (`lg:hidden`), displaying full product specs without truncation.
- **Verification**:
  - TypeScript & Vite build passing (`npm run build:store`, build passing at time of release).
  - All tests passing at time of release across 13 test suites.

---

## Touchpoint 24 — Hero Stacked Carousel Browser Tab-Switching & Visibility Synchronization

- **Tab Switching & Visibility Freeze Fix (`HeroStackedCarousel.tsx`)**:
  - **The Problem**: When switching between browser tabs or windows, the Hero stacked cards carousel became frozen or stuck in an off-center transform state upon returning to the site.
  - **Root Causes**:
    1. *Stale Pause State*: When moving the cursor towards the browser tab strip, `onMouseEnter` fired and set `isPaused(true)`. Because the window lost focus without a DOM `mouseleave` event, `isPaused` remained permanently stuck as `true`.
    2. *Background Timer Queueing*: Modern browsers throttle `setInterval` in background tabs while pausing `requestAnimationFrame`. State updates fired in the background without rendering, resulting in desynchronized state and clock spikes when the tab was restored.
    3. *Framer Motion `layout` Projection Conflict*: The `<m.div layout ...>` prop triggered FLIP bounding box calculations. During tab backgrounding, layout calculations returned frozen rects, causing cards to get stuck in intermediate transforms.
  - **The Fix**:
    1. Integrated the native **Page Visibility API** (`visibilitychange`) and window `focus`/`blur` listeners. When `document.hidden` is true, the autoplay interval safely stops.
    2. When the tab becomes visible or regains window focus, dynamically evaluates `sectionRef.current.matches(':hover')`: if the cursor is not physically over the carousel, `isPaused` is immediately reset to `false` and autoplay resumes cleanly.
    3. Added `touchcancel` handler to prevent gesture cancellations from locking the pause state.
    4. Removed the conflicting `layout` prop from absolute carousel cards and set `restDelta: 0.001` on spring physics to eliminate runaway velocities upon tab restoration.
    5. Enriched database banners with matching default metadata (headlines, taglines, highlights, descriptions) and deduplicated by title and ID to prevent redundant slides.
- **Verification**:
  - TypeScript & Vite build passing (`npm run build:store`, build passing at time of release).
  - All tests passing at time of release across 13 test suites.

---

## Touchpoint 23 — Removal of Merchant Admin Link from Customer Storefront Menu

- **Storefront Privacy & Isolation (`StoreMenuDrawer.tsx`)**:
  - **The Problem**: The customer-facing menu drawer displayed a prominent `"Merchant Admin Portal (Inventory, orders & settings)"` shortcut leading to the backend admin interface (`/admin` or `localhost:5174`). Public storefront visitors should never see administrative merchant links.
  - **The Fix**: Completely removed the admin portal entry and external navigation link from the customer menu drawer, preserving an uncompromised customer-facing browsing experience while maintaining full access to store policies, terms, account details, and support channels.
- **Verification**:
  - TypeScript & Vite build passing (`npm run build:store`).
  - All tests passing at time of release across 13 test suites.

---

## Touchpoint 22 — Comprehensive Dark Mode Theme Adoption Across Storefront Subsystems

- **The Problem**:
  - While primary storefront pages adopted dark mode, several key sub-pages, secondary forms, policy accordions, order lists, and filter panels had residual unstyled pure-white containers (`bg-white`), glaring white backgrounds, light borders (`border-slate-200`), and dark text that looked high-contrast, harsh, or illegible when switching to dark mode (`dark:bg-[#06090e]`).
- **Pages & Components Fully Overhauled for Dark Mode**:
  1. **My Orders & Order History (`MyOrdersPage.tsx`)**:
     - Upgraded order status sidebar filter panel with deep obsidian cards (`dark:bg-slate-900 dark:border-white/10 dark:text-white`).
     - Fixed Guest Quick Track card (`dark:bg-slate-800/80 dark:border-slate-700`).
     - Fixed Search Orders bar and text input with dark surfaces (`dark:bg-slate-800/80 dark:text-white`).
     - Fully dark-themed order list cards: order codes (`#id`), placed dates, tier chips, status badges, line items, and invoice/reorder action buttons.
     - Dark-themed pagination bar and mobile filter drawer.
  2. **Policies & Legal Terms (`PolicyPage.tsx`)**:
     - Replaced glaring white policy card with dark obsidian backdrop (`dark:bg-slate-900 dark:border-white/10`).
     - Polished hero header card with subtle dark gradient aura, verified policy pill, and orange document icon container.
     - Added full dark mode typography via Tailwind Typography invert (`dark:prose-invert text-slate-700 dark:text-slate-300`).
     - Dark-themed WhatsApp support banner and related policies navigation grid.
  3. **Menu & Account Hub (`MenuPage.tsx`)**:
     - Dark-themed recent orders summary cards and row items (`dark:bg-slate-900 dark:bg-slate-800/80 dark:border-white/10`).
     - Dark-themed accordion policy cards (About Us, Terms of Service, Privacy Policy) with dark borders and readable text.
  4. **Customer Authentication Modal (`CustomerAuth.tsx`)**:
     - Main authentication dialog, inputs, and tab switches updated with `dark:bg-slate-900`, `dark:bg-slate-800/80`, `dark:border-slate-700`, `dark:text-white`, and `dark:placeholder:text-slate-500`.
  5. **Order Tracking & Details (`OrderPage.tsx`)**:
     - Polished single order tracking timeline, address info, dynamic UPI payment QR card, items summary, and price details with dark slate styling.
  6. **Dealer Application Form (`DealerApplicationPage.tsx`)**:
     - Success screen, dealer privilege cards, and multi-field trade application form upgraded to dark slate cards and inputs.
  7. **Quantity Input Counter (`QuantityInput.tsx`)**:
     - Dark background, borders, input text, and plus/minus icons (`dark:bg-slate-800/80 dark:border-white/10 dark:text-white`).
  8. **Marketplace Active Filters & Mobile Drawer (`MarketplacePage.tsx`)**:
     - Updated active filter strip (`dark:bg-slate-900 dark:border-white/10 dark:text-slate-400`).
     - Updated mobile filter drawer with dark container, subcategory pills, sort buttons, and price bracket selectors.
  9. **Product Detail Page Carousel & Thumbnail Controls (`ProductDetailPage.tsx`)**:
     - Updated image carousel navigation buttons, thumbnail borders, and SKU tags with dark mode variants.
- **Verification**:
  - Full TypeScript & Vite build passing (`npm run build:store`).
  - Full automated Vitest test suite passing (all tests passing at time of release).

---

## Touchpoint 21 — Hero Stacked Carousel 3D Studio Upgrade & Dynamic Synchronized Headlines

- **Flagship Category Selection & 3:4 Portrait Renders (`apps/store/public/hero/`, `generate_hero_cards.py`)**:
  - Selected the 5 premier pillars of wholesale electronics:
    1. **65W GaN Turbo Charger** (`offer-gan-65w`)
    2. **9H Sapphire Glass Armor** (`offer-diamond-armor`)
    3. **AirBass Pro ANC Wireless Buds** (`offer-tws-buds`)
    4. **120W Titanium Super Cord** (`offer-cables`)
    5. **MagSafe Slim Titanium Power Bank** (`offer-power-bank`)
  - Generated dedicated vertical 3:4 portrait (900×1200) renders in both light (`/hero/light/`) and dark (`/hero/dark/`) modes, ensuring the 3D subject floats in the upper/middle frame without being obscured by the bottom frosted glass pill.
- **Dynamic Synchronized Headlines & Feature Badges (`HeroStackedCarousel.tsx`)**:
  - Dynamic Left Column: As the customer cycles through the stacked cards (`01 / 05` to `05 / 05`), the left column headline, tagline, rich description, and highlight chips automatically animate and update to reflect the active product.
  - Tailored Product Descriptions: Each card features detailed engineering copy (e.g. GaN III Turbo architecture, high-alumina 9H diamond hardness, 13mm titanium composite acoustic drivers, Kevlar dual-braided ballistic nylon, 15W MagSafe magnetic alignment).
- **Dual-Theme Refinement & Canonical Classes**:
  - Light mode: Frosted white pill (`bg-white/95 border-slate-200/90 shadow-xl`), crisp dark slate typography, and clean contrast.
  - Dark mode: Obsidian frosted glass (`bg-[#070B12]/94 border-white/10 shadow-2xl`), cyan/amber rim highlights, and glowing blue CTAs.
  - Standardized all gradient overlays to Tailwind v4 canonical `bg-linear-to-t`.
- **Automated Verification & Test Suite**:
  - All tests passing at time of release across 13 test suites (`vitest`).
  - Both `apps/admin` and `apps/store` compile with 0 TypeScript/CSS errors (`npm run build`).

---

## Touchpoint 20 — Studio 3D Category Imagery & Dual-Theme Architecture

- **High-Key Apple-Style 3D Studio Renders (`categoryTheme.ts`, `apps/store/public/categories/`)**:
  - **Light Theme Overhaul**: Replaced previous mathematically inverted/hazy placeholders with authentic, high-key commercial 3D studio renders for all 13 categories.
  - **Zero Dark Floor Smudges**: Clean seamless platinum-to-white backdrop (`#f8fafc` to `#ffffff`) with delicate, natural contact shadows, eliminating dirty grey halos and dark bottom floor artifacts.
  - **Dual-Theme Adaptive Resolution**: Implemented `getCategoryThemeImage(cat, isDark)` dynamically serving `/categories/light/{slug}.jpg` in light mode and `/categories/dark/{slug}.jpg` in dark mode.
- **Seamless Bottom Gradient Scrim & 2-Line Titles**:
  - Replaced the awkward floating rectangular "sticker" pill captions with a seamless bottom gradient scrim:
    `bg-linear-to-t from-white/95 via-white/80 to-transparent dark:from-slate-950/95 dark:via-slate-950/70 dark:to-transparent`
  - Enabled 2-line title wrapping (`line-clamp-2`), allowing titles like *"Tempered Glass & UV GLASS"* and *"Mobile holders & Stand"* to display comfortably without ugly ellipsis truncation (`"Tempered Gla..."`).
- **Symmetric Container Alignment (`UrbanratPage.tsx`, `MarketplacePage.tsx`, `CategoriesPage.tsx`, `Skeletons.tsx`)**:
  - Eliminated broken full-bleed CSS viewport breakout (`w-screen left-1/2 -translate-x-1/2`) that shifted the category bar off-screen on Windows desktop browsers due to scrollbar width mismatch.
  - Standardized on a responsive grid-aligned rounded container:
    `w-full rounded-2xl sm:rounded-3xl bg-white/85 dark:bg-slate-900/65 backdrop-blur-md border border-slate-200/80 dark:border-white/10 p-2.5 sm:p-3.5 shadow-xs`
  - Harmonized vertical rhythm on `UrbanratPage.tsx` from `space-y-6 sm:space-y-8` to `space-y-4 sm:space-y-5`.

---

## Touchpoint 19 — Flat Glassmorphic Top Bar & Distraction-Free Navigation

- **Topbar Aesthetic Flattening**:
  - Removed heavy 3D-styled button bevels and high-contrast drop shadows in favor of a clean, minimalist flat glassmorphic top navigation bar (`backdrop-blur-md`, subtle `border-slate-200/80` and `dark:border-white/10`).
  - Removed distracting subcategory carousel navigation arrow buttons to provide a clean, distraction-free view, delivering a clean, modern mobile-first touch/swipe rail.

---

## Touchpoint 18 — Multi-Category Catalog Shuffling & Balanced Feed Discovery

- **Fair Category Balancing & Feed Interleaving (`MarketplacePage.tsx`, `storeService.ts`)**:
  - **The Problem**: Newly uploaded products within a single category (e.g. 14 AR+AF Lens Rings) monopolized the top rows of the default product grid, pushing other core categories (chargers, cables, audio, power banks) off the first screen.
  - **"Featured (Mixed)" Default Sort Mode**: Implemented a balanced multi-category interleaving algorithm that groups products by category/subcategory and cycles through them evenly, guaranteeing that shoppers browsing the top of the feed see a diverse assortment of accessories.
  - **Category Isolation Integrity**: When a specific category or subcategory is explicitly selected, the shuffle respects the scope and balances variants across models rather than leaking unrelated categories.

---

## Touchpoint 17 — Inline Auto-Suggest Search Dropdown & Canonical Token Architecture

- **Inline Auto-Suggest Dropdown Replacement (`apps/store/src/components/SearchDropdown.tsx`)**:
  - **UX Evolution**: Replaced full-page modal popup search with an intuitive, anchored dropdown anchored directly beneath the top search bar, eliminating screen disorientation.
  - **Search Capabilities**: Integrated recent search history with one-tap removal, trending keyword tags, live debounced product matches with thumbnail previews, wholesale unit pricing, and stock status indicators.
  - **Accessibility & Ergonomics**: Full keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter` to select, `Escape` to close), click-outside listener, and automatic mobile viewport positioning.
  - **Tailwind CSS v4 Canonical Compliance**: Refactored arbitrary pixel width brackets (`w-[440px]`, `lg:w-[500px]`, `xl:w-[540px]`) to canonical Tailwind tokens (`w-110`, `lg:w-125`, `xl:w-135`).

---

## Touchpoint 16 — Storefront Search Resiliency & Live Schema Alignment

- **Storefront Marketplace Search Fix (`apps/store/src/services/storeService.ts`)**:
  - **The Root Cause**: When searching for brands or models in the customer storefront (e.g., `infinix`, `boat`, `apple`), `fetchProducts` previously formed a PostgREST filter including `keywords.cs.{<query>}`. Because the remote Supabase PostgreSQL `products` table does not contain a `keywords` column (as keywords are stored in specs and upload payloads), PostgreSQL threw error `42703: column products.keywords does not exist`. This caused the storefront to fail and display the *"Failed to load products"* error card.
  - **Universal Schema Alignment**: Upgraded `fetchProducts` search clause to query live, verified database columns:
    `name.ilike.%${cleanSearch}%,sku.ilike.%${cleanSearch}%,description.ilike.%${cleanSearch}%,specs->>brand_compatibility.ilike.%${cleanSearch}%,specs->>compatibility_group.ilike.%${cleanSearch}%`
  - **PostgREST Query Sanitization**: Added input sanitization stripping commas and parentheses from search terms to ensure PostgREST `.or(...)` filter syntax remains valid across all search inputs.
  - **Instant Search Recovery**: Confirmed that searching for `"infinix"` immediately returns all 87 matching Infinix products (`infinix gt 50 pro`, `infinix gt 30/ 30 pro`, `infinix note 50s 5g`, `infinix hot 10i`, etc.) without errors.

---

## Touchpoint 15 — Dynamic Per-Color Matrix Column Recognition & Bulk Catalog Parser Enhancement

- **Dynamic Per-Color Column Recognition (`catalogHeaders.ts`, `catalogParser.ts`)**:
  - **The Root Cause**: Supplier spreadsheets (such as AR+AF Lens Rings, cases, and tempered glass catalogs) often feature dynamic matrix columns formatted as `Color - Black`, `Color - Silver`, `Color - Gold`, `Color - Titanium Grey`, `Color - Sea Blue`, etc. with values like `Yes` / `No`. Because these dynamic headers did not match static aliases in `CANONICAL_FIELD_ALIASES`, the spreadsheet parser previously pushed all of them into `ignoredColumns`, displaying an alarming post-import warning banner: *"The following columns were not recognized by alias dictionary and were ignored: Color - Black, Color - Silver..."*.
  - **Pattern Extraction (`extractColorFromHeader`, `isColorVariantHeader`)**: Implemented dynamic header detection matching delimiters like `Color - <Name>`, `Colour - <Name>`, `Color: <Name>`, `Color_<Name>`, `Color (<Name>)`, and `Color / <Name>`. Safely excludes general reserved keywords (`options`, `variants`, `enabled`, `selection`, `list`, `names`, `picker`, `none`, etc.).
  - **Zero False-Positive Ignored Columns**: Excluded recognized dynamic color columns from `ignoredColumns`, eliminating the post-upload warning banner for valid supplier color matrices.
  - **Active Color Harvesting**: In `catalogParser.ts`, dynamic color columns are scanned per row. Cells with truthy values (`Yes`, `Y`, `True`, `1`, `Available`, `In Stock`) are dynamically harvested and merged with any existing `Available Colors` or `specs.available_colors`, deduplicating seamlessly using `cleanColorArray()`.
  - **Automatic Color Variant Activation**: If a row has truthy values in any color columns, `hasColors` is automatically set to `true`, and both `colors` and `specs.colors` are populated with the active color palette.

- **Bulk Upload Modal & Column Mapper Integration (`BulkCatalogModal.tsx`)**:
  - **Field Statistics Table**: Added **Color Variants** metric to the post-import report screen showing how many rows have active color variants populated (`14/14 filled`).
  - **Intelligent Column Mapper**: In the customizable column mapper modal, recognized per-color columns display an informative `Color: <ColorName>` pill and pre-select `🎨 Color Variant: <ColorName> (Boolean)`. Merchants can still manually override or ignore specific color columns if desired.

- **Automated Verification & Test Suite**:
  - All tests passing at time of release across 12 test suites with 0 failures (`catalogHeaders.test.ts`, `catalogParser.test.ts`, `colors.test.ts`, etc.).
  - Tested directly against the 14-row AR+AF Lens Ring catalog fixture (`media_1793271256007_95a23165.csv`), confirming 0 ignored columns and 100% color preservation across all rows (Black, Silver, Gold, Titanium Grey, Sea Blue, Orange, Pink, Purple, Green, Blue).
  - Both `apps/admin` and `apps/store` compile cleanly with 0 TypeScript/CSS errors (`npm run build`).

---

## Touchpoint 14 — Selective Color Variants Management Across Admin Uploading, Bulk Catalogs, Product Editor, and Storefront PDP

- **Selective Color Configuration & Architecture (`packages/shared/src/colors.ts`, `product.ts`)**:
  - **Selective Per-Catalog Control**: Added first-class support for selective color variants. Catalogs with color variants can enable colors (`has_colors: true`) and configure options, while non-color catalogs (such as clear tempered glass) leave it disabled (`has_colors: false`), cleanly omitting any color picker UI.
  - **Robust Resilient Storage**: Stored inside `specs.has_colors` and `specs.colors` as well as `attributes` (and root `colors?: string[]`), guaranteeing compatibility with live Supabase PostgreSQL schemas without relying on unmigrated columns.
  - **Color Normalization Utilities**: Implemented `cleanColorArray`, `parseColorString` (supporting comma-separated, semicolon-separated, slash-separated, and JSON array strings), `isColorSelectionEnabled(product)`, `getProductColors(product)` (with fallback checks across `specs.colors`, `specs.has_colors`, `attributes`, and legacy specs `Colorways`), and `getColorHex(colorName)` supporting 50+ rich hardware colorway hex mappings (e.g. Jet Black `#0f0f10`, Forest Emerald `#1b4d3e`, Crimson Ruby `#9e1b32`, Desert Titanium `#c5b399`, etc.).
  - **Popular Color Presets**: Provided `POPULAR_COLOR_PRESETS` for quick one-click merchant selection in admin editors.

- **Bulk Catalog CSV & Excel Ingestion (`catalogHeaders.ts`, `catalogParser.ts`, `BulkCatalogModal.tsx`, `UploadDetailModal.tsx`)**:
  - **Canonical Header Aliases**: Registered canonical field aliases for `colors` (`color`, `colours`, `colour`, `availablecolors`, `coloroptions`, `colorways`, `shades`, etc.) and `has_colors` (`hascolors`, `enablecolors`, `colorvariants`, `hascoloroptions`, `allowcolors`, etc.).
  - **Intelligent Parser Logic**: Parses color strings from spreadsheet rows, normalizes and deduplicates color arrays, casts boolean flag `has_colors` (recognizing `true`, `1`, `yes`, `enabled` or `false`, `0`, `no`, `disabled`), and auto-enables `hasColors` if valid color options are provided and `has_colors` is omitted.
  - **Preview & QC Badges**: Visual indicator in `BulkCatalogModal` preview rows showing parsed color counts and color names (`🎨 3 Colors: Jet Black, Forest Emerald...`).
  - **Slide-over QC Error-Fix Drawer (`UploadDetailModal.tsx`)**: Integrated toggle switch, custom color input, chip manager with color swatch previews, and quick presets directly inside the catalog error-fixing drawer.

- **Single Catalog Wizard (`SingleCatalogWizard.tsx`)**:
  - Added dedicated **Color Variants & Selective Options** card in Step 2 with an Enable/Disable toggle switch.
  - Interactive chip editor allowing merchants to add custom colors (with Enter key or button), delete chips, and select from popular presets.
  - Added "Copy colors to all products" shortcut allowing merchants drafting multiple models to instantly propagate color configurations across all products in the batch.
  - In `handlePublishProducts`, automatically serializes `has_colors` and `colors` into `specs` and `attributes` for Supabase persistence.

- **Admin Product Editor Modal (`ProductEditor.tsx`)**:
  - Added dedicated **Color Variants & Selective Options** card positioned between Inventory / Stock rules and Technical Specs.
  - Toggle switch for `hasColors` with instant visual feedback.
  - Chip manager showing color name and real-time color dot preview (`getColorHex`) with remove action.
  - Text input for custom colorways + quick preset suggestions.
  - Synchronized `specs.has_colors` and `specs.colors` on save, while filtering internal color keys from generic technical specs key-value rows.

- **Storefront Product Detail Page & Ordering Pipeline (`ProductDetailPage.tsx`, `App.tsx`, `CartPage.tsx`, `buildWhatsAppMessage.ts`)**:
  - **Interactive Storefront Color Picker (`ProductDetailPage.tsx`)**: When a catalog has colors enabled, displays a mobile-first color selector above the quantity stepper featuring visual color swatches, active selection ring, and selected color badge. Catalogs with colors disabled automatically hide the section.
  - **Specifications Clean-up**: Filtered out internal keys `colors` and `has_colors` from the Technical Specifications grid to ensure clean display.
  - **Cart Color Preservation (`App.tsx`, `CartPage.tsx`)**: Extended `CartStateItem` with `selectedColor?: string`. Items with different colors are distinct line items with accurate quantity updates and removals. Rendered visual color pill with swatch dot in the cart list.
  - **WhatsApp Quote Integration (`buildWhatsAppMessage.ts`)**: Included selected colorway in WhatsApp line items (e.g. `boAt Buds X Prime [Color: Jet Black] x 10 pcs = ₹2,450`) and in direct WhatsApp inquiry links.

- **Automated Verification & Test Suite**:
  - All tests passing at time of release across 12 test suites (`colors.test.ts`, `catalogParser.test.ts`, `catalogHeaders.test.ts`, `buildWhatsAppMessage.test.ts`, etc.) with 0 failures.
  - Both `apps/store` and `apps/admin` compile with 0 TypeScript/CSS errors (`npm run build`).
  - Dev servers running live on ports 5173 (storefront) and 5174 (admin).

---

## Touchpoint 13 — Universal Bulk Catalog Header Aliasing, JSON Volume Tiers Ingestion, and Specifications-First Catalog Alignment

- **Bulk Upload MRP & Pricing Normalization (`packages/shared/src/catalogHeaders.ts`, `catalogParser.ts`)**:
  - **The Root Cause**: During bulk CSV/Excel uploads, MRP values under headers such as `mrp_inr` were unmapped by `resolveCanonicalHeader` because `CANONICAL_FIELD_ALIASES.mrp` previously only accepted `["mrp", "maximumretailprice", "maxretailprice"]`. This resulted in `mrp` being silently dropped as `null`, leaving the "Maximum Retail Price (MRP ₹)" field empty in the product editor and storefront.
  - **Expanded MRP Aliases**: Added `mrpinr`, `mrprs`, `mrprupees`, `mrpprice`, `retailprice`, `retailmrp`, `mrpamount`, `mrpval`, `mrpvalue`, `originalprice`, `listprice`, and `standardmrp` to `CANONICAL_FIELD_ALIASES.mrp`.
  - **Volume Price Tiers JSON Ingestion (`tiers_json`)**: Added canonical field `tiers_json` (`volumepricetiersjson`, `volumetiersjson`, `pricetiersjson`, `tiersjson`, `tiers`, etc.) in `catalogHeaders.ts`. In `catalogParser.ts`, added native parsing for serialized JSON tier arrays (e.g. `[{"min_qty": 1, "unit_price": 13.0}, {"min_qty": 60, "unit_price": 11.0}]`), sorting by `min_qty` and validating non-increasing prices.
  - **Image & Flag Normalization**: Added `primary_image_url`, `mainimage`, `thumbnail`, etc. to `images` aliases, and added `flag_urbanrat_brand`, `flag_featured`, `flag_trending`, `flag_active` to their corresponding boolean canonical fields.

- **Storefront & Admin Catalog Hierarchy: Description Positioned Below Specifications (`ProductDetailPage.tsx`, `SingleCatalogWizard.tsx`)**:
  - **Storefront PDP Layout**: Moved the detailed narrative description from the top of the product page (beneath title) to directly below the **Specifications** card. The top section now remains uncluttered with the title, single-line tagline, warranty badge, and volume pricing.
  - **Dedicated Description Card**: Structured inside a rounded card (`bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-xs`) with `whitespace-pre-line` formatting to preserve paragraph and line break formatting for all 1,000 catalog products.
  - **Single Catalog Wizard Step 2 Reorder**: Placed the *Product Specifications* builder immediately above the *Full Technical Description* input, ensuring full administrative and storefront consistency.

- **Automated Test Suite & Verification**:
  - All tests passing at time of release across 11 test suites with 0 failures (`catalogHeaders.test.ts`, `catalogParser.test.ts`, `categoryTree.test.ts`, etc.).
  - Both `apps/admin` and `apps/store` compile cleanly with 0 TypeScript/CSS errors (`npm run build`).

---

## Touchpoint 12 — Single Product Link Uploads, Stock Privacy, Specifications-First PDP, and Automatic Volume 1 Tier 1 MOQ Synchronization

- **Automatic Minimum Order Quantity (MOQ) & Volume 1 Tier 1 Synchronization (`ProductEditor.tsx`, `SingleCatalogWizard.tsx`)**:
  - **Bi-directional Automatic Sync**: Synchronized Volume 1 Tier #1's `Minimum Quantity (pcs)` with the `Min Order Qty` input under *Inventory & Ordering Rules*. Editing either value automatically and immediately adjusts the other so both visible fields always remain aligned.
  - **Form State Initialization**: Fixed initialization in `ProductEditor.tsx` where an existing product with tiered volume pricing (e.g. Tier 1 MOQ = 5, Unit Price = ₹230) previously loaded `min_order_qty = 1` into the inventory rules section, triggering a validation error (`First tier min_qty must match Minimum Order Quantity`). `minOrderQty` now automatically initializes to `product.price_tiers[0].min_qty`.
  - **Tier Deletion Compensation**: If Tier #1 is removed from the tiers list, `minOrderQty` automatically recalculates and binds to the newly promoted Tier #1.
  - **Single Catalog Wizard Alignment (`SingleCatalogWizard.tsx`)**: Removed the `disabled` lock on Tier 1 in the Volume Price Tiers card and wired two-way reactive state updates so edits to Tier 1 min_qty seamlessly update MOQ throughout multi-product drafts.

- **Direct Image Link Ingestion (`ProductEditor.tsx`, `SingleCatalogWizard.tsx`)**:
  - Added "Paste Image Link" toggle button with URL validator (`http://` / `https://`) allowing merchants to import product image URLs directly without downloading and re-uploading files.
  - Supports comma/newline-separated multi-link ingestion with preview thumbnails.

- **Storefront Stock Privacy & PDP Layout Refinement (`ProductDetailPage.tsx`)**:
  - **Customer Stock Privacy**: Concealed raw warehouse stock unit counts from customer view across all product detail pages. Display now purely indicates `"In Stock"` (or `"Out of Stock"` / `"Discontinued"`) to protect commercial inventory levels.
  - **Specifications-First Hierarchy**: Reorganized the product detail layout so technical specifications are highlighted immediately beneath pricing and actions, with the extended narrative description positioned gracefully below specifications.

- **Admin Category Descendant Product Aggregation (`ProductList.tsx`, `adminService.ts`, `categoryTree.ts`)**:
  - Upgraded admin category filtering so clicking any top-level department or parent category retrieves all products belonging to that category and any of its descendant subcategories recursively via `getCategoryAndDescendantIds`.

- **Automated Test Suite**:
  - All tests passing at time of release across 11 test suites with 0 failures (`packages/shared/src/categoryTree.test.ts`, `catalogImages.test.ts`, `bulkOps.test.ts`, etc.).
  - Both `apps/admin` and `apps/store` build cleanly with 0 TypeScript errors.

---

## Touchpoint 11 — Marketplace Subcategories, Categories Department Overhaul & Catalog Product Count Alignment

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
  - **Unit Tests**: All tests passing at time of release across 11 test suites (`npm test`).
  - **Build**: Both `apps/store` and `apps/admin` compile with 0 TypeScript/CSS errors (`npm run build`).

---

## Touchpoint 10 — Bulk Product Operations & Drawer (`019_bulk_product_ops.sql`)

- **Category Counts Rollup Engine (`categoryTree.ts`)**:
  - Implemented post-order hierarchical rollup in `buildCategoryTree`, attributing both direct product counts and recursive descendant category counts to parent/root cards.
  - Corrected catalog header and sidebar badge alignment across 1195+ catalog products.
- **Sticky Bulk Actions Bar & Scope Selection (`ProductList.tsx`)**:
  - Selection banner: "Select all N products in this category" querying `admin_list_product_ids` (capped at 5,000 with confirmation warning).
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
  - All tests passing at time of release across 11 test suites (`bulkOps.test.ts`, `keywords.test.ts`, `catalogImages.test.ts`, `orders.test.ts`, `returns.test.ts`, `pricing.test.ts`, `categoryTree.test.ts`, etc.).

---

## Touchpoint 09 — Seller-Hub Admin Orders, Returns & Image Library Management (`013_seller_hub_orders.sql`–`016_admin_submit_catalog_images.sql`)

- **Seller-Hub Admin Orders & Reverse Logistics Management (`013_seller_hub_orders.sql`, `014_admin_returns_and_claims.sql`, `015_catalog_images.sql`, `016_admin_submit_catalog_images.sql`)**:
  - **Seller-Hub Orders Console (`apps/admin/src/features/orders/`) (`013_seller_hub_orders.sql`)**:
    - Tabs matching marketplace seller hubs: *Pending*, *Ready to Ship*, *Shipped*, *Delivered*, *Cancelled*, *On Hold*, and *All Orders* with dynamic live badges.
    - Date presets, order source filter, payment status filter, and instant debounced search.
    - Real-time dismissible alert strip for SLA delays (>24h), dispatch queue, on-hold consignments, and catalog low-stock warnings.
    - Desktop data grid with checkboxes, bulk actions (*Mark Confirmed*, *Mark Shipped*, Excel/CSV export), and mobile seller cards.
    - Order detail modal with customer lifetime stats, logistics tracking (courier selector, AWB number with audit logging), internal admin notes, GST tax invoice popup, warehouse packing slip generator (`generatePackingSlipHtml`), and pre-filled WhatsApp communication.
  - **Admin Returns & Claims Dashboard (`apps/admin/src/features/returns/`) (`014_admin_returns_and_claims.sql`)**:
    - Overview KPI cards, seller return assurance banner, root-cause reason distribution bars, and product return performance table highlighting defect rates $\ge 5\%$.
    - Return tracking list with lifecycle status tabs and slide-over inspection drawer with signed evidence previews and mandatory audit notes for rejection.
    - Supplier & courier claim tracking (`ClaimTrackingList.tsx`, `ClaimModal.tsx`) with claim amounts, carrier ticket references, and audit logging.
  - **Catalog Image Library & Image Bulk Upload (`apps/admin/src/features/catalog/images/`) (`015_catalog_images.sql`, `016_admin_submit_catalog_images.sql`)**:
    - Dedicated desktop sidebar and mobile navigation tab.
    - Parallel client-side compression (3 files concurrently) to WebP (max 1200px, quality 0.84) saving 80-90% bandwidth.
    - Technical pre-upload checks (min 500x500px, aspect ratio 4:5 to 5:4, duplicate detection).
    - Image links output table with inline SKU hint editor, 1-click URL copy, Excel sheet export, and usage-protected image deletion.
    - Reusable `ImagePickerModal.tsx` integrated into Single Catalog Wizard and Bulk Upload flows.

---

## Touchpoint 08 — Wholesale Returns, Replacements & Customer Portal UI (`012_returns_backend.sql`)

- **Wholesale Returns, Replacements & Customer Portal UI (`012_returns_backend.sql`)**:
  - **Database Architecture**:
    - `return_requests`: Master table with unique human-readable code `return_code` (`RET-YYMMDD-XXXX`), order/user foreign keys, resolution type (`return`, `replacement`, `refund`), status (11 standard statuses), reason code (6 wholesale reasons), evidence paths array, requested/resolved timestamps, and refund amount.
    - `return_items`: Line-item breakdown tracking `return_id`, `order_item_id`, `product_id`, `quantity`, `reason_code`, and `condition` (`unopened`, `opened`, `damaged`, `defective`).
    - `return_events`: Append-only audit trail logging every status transition, operational notes, actor ID, and timestamps.
    - Storage bucket `return-evidence`: Private storage bucket (`public = false`) with 20 MB limit supporting images and videos (`image/jpeg`, `image/png`, `image/webp`, `image/avif`, `video/mp4`, `video/quicktime`, `video/webm`).
  - **Security Definer RPCs**:
    - `create_return_request(...)`: Enforces order ownership, delivered status, return window (`store_settings.return_window_days`), non-exceeding quantities, generates `RET-YYMMDD-XXXX`, and logs audit events.
    - `admin_update_return_status(...)`: Enforces `is_admin()`, validates allowed state transitions, updates refund amounts, automatically restocks catalog inventory via `admin_adjust_stock` when moving to `qc_passed` for return type (idempotent), and syncs milestones.
    - `get_return_stats(...)`: Admin analytics RPC computing total returns, return rate %, refund value, and status/reason breakdown.
  - **Customer Returns Portal (`apps/store/src/pages/ReturnsPage.tsx` & `ReturnDetailPage.tsx`)**:
    - Return action on delivered orders within return window (`Nd left`).
    - 3-step return request modal: items/quantities, resolution type/reason, and evidence upload with client-side WebP compression.
    - Returns list at `/returns` with status filter tabs (*All*, *Active*, *Completed*, *Rejected*) and search.
    - Detailed tracking at `/returns/:returnId` with chronological vertical timeline, resolution card, and signed URL evidence gallery with lightbox preview.

---

## Touchpoint 07 — Wholesale-Aware Marketplace Orders Rebuild (`/my-orders` & `/order/:orderId`) (`011_order_events_and_details.sql`)

- **Wholesale-Aware Marketplace Orders Rebuild (`/my-orders` & `/order/:orderId`) (`011_order_events_and_details.sql`)**:
  - **Marketplace "My Orders" Dashboard (`apps/store/src/pages/MyOrdersPage.tsx`)**:
    - Modeled on a clean, premium marketplace layout with a 2-column desktop view and responsive mobile-first (390px) bottom-sheet filters.
    - **Live Multi-Criteria Search & Filtering**: Instant search across Order Codes (`id`), Product Titles, and SKUs. Filter sidebar with Order Status (*All*, *On the way / In Progress*, *Delivered*, *Cancelled*, *Returned / Replaced*) and Time Period (*Last 30 days*, *Past 6 months*, *This Year*, *Older Orders*), featuring active filter chips and 1-tap "Clear all".
    - **Wholesale-Aware Order Cards**: First product thumbnail with `+N more` counter badge, 1-click Order ID copy button, date and item count, line items preview showing quantity, unit price, and applied wholesale volume tiers, and colored status indicator with the latest operational message from `order_events`.
    - **Integrated Actions**: View details (`/order/:orderId`), 1-tap reorder with haptic feedback, download GST tax invoice, and return / report issue modal.
    - **Pagination & Empty States**: Clean 6-orders-per-page pagination, empty state with an embedded quick-track search input for guests or offline orders.
  - **Wholesale Order Tracking & Detail View (`apps/store/src/pages/OrderPage.tsx`)**:
    - **Interactive Vertical Timeline**: Renders chronological progression (`Placed` → `Confirmed` → `Processing` → `Shipped` → `Delivered` or special `Cancelled` / `Returned` branches) with checkmark icons, active pulsing rings, timestamps, and carrier tracking notes. Includes an expandable "See All Updates" full audit log.
    - **Collapsible Delivery & Price Cards**: Delivery recipient snapshot with wholesale entity (Business Name, GSTIN), and price breakdown including wholesale tier savings (highlighted in emerald), base taxable value, CGST (9%), SGST (9%), shipping, and total.
    - **Line Items Inspection**: Primary product hero card with unit price, volume tier badge, and quantity, plus a dedicated list for other order items with individual "+ Reorder Item" buttons.
    - **Wholesale Support & Deep Links**: WhatsApp deep-link banner prefilled with Order ID and customer inquiry, plus 1-Year URT Wholesale Warranty resolution desk link.
    - **Access Control & Guest Tracking**: Authenticated customers view their own orders via RLS (`user_id = auth.uid()`). Direct order lookup is accessible to guests via the order code (`/order/:orderId`), while mismatched authenticated user accounts are prevented from accessing other customers' orders.
  - **GST Wholesale Tax Invoice Generator (`apps/store/src/utils/invoiceGenerator.ts`)**:
    - Generates a print-ready and PDF-downloadable GST Wholesale Tax Invoice featuring the registered GSTIN configured in store settings, customer billing/shipping details, line items table with HSN/SAC, wholesale tier badges, taxable value breakdown, 9% CGST + 9% SGST breakdown, and authorized signature block.
  - **Return & Report Issue Modal (`apps/store/src/components/ReturnReportIssueModal.tsx`)**:
    - Allows wholesale customers to report DOA, transit damage, wrong dispatch, or quantity shortages under the 1-Year Warranty, with item selection, problem descriptions, and direct WhatsApp routing prefilled with order details.
  - **Database Migration (`011_order_events_and_details.sql`)**:
    - Extended `orders_status_check` to support `'returned'` status.
    - Enhanced `get_order_by_id` RPC function to return complete order data with embedded chronological `events` array from `order_events`.

---

## Touchpoint 06 — Saved Address Book & Wholesale Customer Authentication (`010_customer_auth_and_addresses.sql`)

- **Saved Address Book & Wholesale Customer Authentication (`010_customer_auth_and_addresses.sql`)**:
  - **Wholesale Customer Authentication (`AuthContext.tsx`, `CustomerAuth.tsx`, `LoginPage.tsx`)**:
    - Sign up with Full Name, 10-digit Indian Mobile (`^[6-9]\d{9}$`), Email, Password, and optional Wholesale business details (Business/Store Name and 15-character GSTIN with regex format validation).
    - Email + Password login, "Forgot password" Supabase reset email delivery, and "Continue as guest" workflow.
    - App-wide `AuthContext` managing reactive session persistence, profile caching, login, signup, profile updates, and logout.
    - Protected route guards (`<ProtectedRoute />`) for `/account`, `/addresses`, `/orders`, and `/my-orders` redirecting unauthorized users to `/login` with return-to-destination redirect.
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

---

## Touchpoint 05 — Search Keywords System & Reusable `KeywordsInput` Across Catalog Touchpoints (`009_catalog_keywords.sql`)

- **Search Keywords System & Reusable `KeywordsInput` Across Catalog Touchpoints (`009_catalog_keywords.sql`)**:
  - Built a complete manual "Search Keywords" system to boost catalog product discovery across admin workflows and storefront search:
    - **Reusable Chip Component (`KeywordsInput.tsx`)**: Mobile-first tag input with brand design tokens (`bg-brand-light/20`, `text-brand-dark`), live counter (`"X / 30"`), dynamic red inline error alerts, keyboard navigation, `aria-label`, remove buttons, and Web Vibration API haptics (`triggerHaptic("heavy")` on error/duplicate, `"selection"` on add/remove).
    - **Delimited & Pasted Text Parsing**: Adds keywords on `Enter`, comma (`,`), or `blur`. Pasting comma, semicolon, pipe, or newline-delimited strings automatically parses and distributes them into distinct chips.
    - **Domain Validation & Normalization Engine (`@urbanrat/shared`)**: `normalizeKeywords` function in `packages/shared/src/keywords.ts` automatically trims whitespace, converts to lowercase, collapses inner whitespace, removes duplicate entries, and enforces strict limits (max 30 keywords per product, max 50 characters each). Backed by Vitest unit tests (`packages/shared/src/keywords.test.ts`).
    - **Touchpoint 1 — SingleCatalogWizard (Step 2: Search & Discovery)**: Product tabs store per-product keyword lists in draft state. "Copy input details to all products" preserves independent keywords unless the "Apply keywords to all products" toggle is explicitly enabled. Supports local storage autosave (`urbanrat_catalog_single_draft`) and submission summary logging.
    - **Touchpoint 2 — Universal Bulk Template & Ingestion (SheetJS `xlsx`)**: Integrated SheetJS (`xlsx`) to generate 2-sheet workbooks (`Products Template` + `Instructions`) with a "Keywords" column. Universal spreadsheet parser (`catalogParser.ts`) reads `.xlsx`, `.xls`, and `.csv` files, flags keyword limit violations with `qc_error`, and allows inline chip editing directly in the bulk preview table (`BulkCatalogModal.tsx`).
    - **Touchpoint 3 — QC Error-Fix Drawer (`UploadDetailModal.tsx`)**: Slide-over drawer for flagged items, integrating `KeywordsInput` in the inline fix form to edit keywords and re-verify items into `qc_pass`.
    - **Touchpoint 4 — ProductEditor (`ProductEditor.tsx`)**: Added `KeywordsInput` to edit keywords post-publishing, persisting directly to `products.keywords`.
    - **Touchpoint 5 — Catalog Upload History Search (`UploadHistoryList.tsx`)**: Extended search filter to match keywords and notes inside upload batches.
    - **Database Migration (`009_catalog_keywords.sql`)**: Non-destructive migration adding `keywords text[] NOT NULL DEFAULT '{}'` to `products`, creating a GIN index `idx_products_keywords`, adding the `normalize_keywords_array(p_raw jsonb)` helper, updating `admin_submit_catalog`, and updating storefront `search_products(p_query text)` to match keywords alongside title, SKU, and brand.

---

## Touchpoint 04 — Category-Wise Catalog Upload System & QC Verification Workflow (`008_catalog_uploads.sql`)

- **Category-Wise Catalog Upload System & QC Verification Workflow (`apps/admin/src/features/catalog/`) (`008_catalog_uploads.sql`)**:
  - **Single Catalog Upload Wizard (`SingleCatalogWizard.tsx`)**: 2-step guided wizard for single product creation. Step 1 selects category via 4-column cascader and captures front image with automated client-side WebP compression. Step 2 configures product details, SKU, specifications, stock, and B2B volume pricing tiers with validation.
  - **Direct Image URL Link Paste**: Expandable URL bar with one-click clipboard pasting (`navigator.clipboard.readText()`), automatic HTTP/HTTPS URL validation, duplicate URL suppression, and support for pasting multiple comma/newline/space-separated URLs in one go.
  - **Bulk Catalog CSV Upload Flow (`BulkCatalogModal.tsx`)**: Category-wise bulk upload with dynamic CSV template generator (`templateGenerator.ts`), client-side CSV parsing and validation (`catalogParser.ts`), row-level error diagnostic table, and atomic batch insertion with audit logging.
  - **Upload History & QC Verification Dashboard (`UploadHistoryList.tsx`, `UploadDetailModal.tsx`)**: Tabbed history tracking (Bulk Uploads vs Single Uploads) with QC status pills (*All*, *Action Required*, *QC in Progress*, *QC Error*, *QC Pass*), summary statistics cards (*Total Uploads Done*, *Using Bulk Uploads*, *Using Single Uploads*), category filtering, file ID search, and item-by-item verification log inspector.
  - **Storefront Backward Compatibility (`apps/store/src/services/storeService.ts`)**: Recursive category descendant resolution (`get_category_descendant_ids` RPC with fallback) ensuring products assigned to deeper L3/L4 nodes seamlessly appear when customers browse parent L1/L2 categories.
  - **Database Migration (`008_catalog_uploads.sql`)**: Created `catalog_uploads` and `catalog_upload_items` tables with RLS policies, indexing, and the recursive `get_category_descendant_ids` Postgres function.

---

## Touchpoint 03 — 4-Level Category Hierarchy & Attribute Schemas (`006_category_attributes.sql`)

- **4-Level Nested Category Tree & Manager (`apps/admin/src/features/catalog/categories/`) (`006_category_attributes.sql`)**:
  - Built full-featured category management system supporting 4 levels of depth (L1 Main Category → L2 Subcategory → L3 Product Group → L4 Item Variety) with recursive depth enforcement, live search filtering, parent reassignment, active/inactive toggle, up/down sibling reordering, and WebP thumbnail upload.
  - **Finder-Style Column Browser**: 4-column drill-down browser on desktop with dark pill active highlighting and right chevrons; collapses to stacked drill-down list on mobile with breadcrumb navigation.
  - **Safe Deletion Pre-Flight Engine**: Blocks category deletion if subcategories or assigned products exist, showing detailed diagnostic reasons.
  - **Dynamic Attribute Engine (`category_attributes`)**: Dynamic specification builder (`text`, `number`, `select`, `multiselect`, `boolean`) with option tag chips, required toggle, and tree inheritance (inherited attributes displayed as read-only chips).
  - **Top Search Box**: Live search query that filters across all 4 levels and automatically opens the column tree to matching items.
  - **Database Migration (`006_category_attributes.sql`)**: Created `category_attributes` table with options JSONB array, validation, and RLS policies.

---

## Touchpoint 02 — Atomic Verified Orders, Volume Pricing Engine & Image Compression (`005_create_verified_order.sql`)

- **Atomic Verified Orders RPC (`005_create_verified_order.sql`)**:
  - Implemented server-side `create_verified_order` PostgreSQL RPC function with transactional inventory locking (`FOR UPDATE`), volume tier pricing calculation, and direct customer insertion revocation.
  - Generates sequential order codes formatted as `URT-YYMMDD-XXXX`.
  - Appends initial state to `order_events` audit log.
- **B2B Volume Quantity Selection & Steppers (`ProductDetailPage.tsx` & `CartPage.tsx`)**:
  - Responsive `QuantityInput.tsx` component allowing wholesale buyers to directly type bulk volume numbers (e.g. 50, 100, 250) or use `+` / `-` steppers, with instant recalculation of volume pricing tiers, line subtotals, and cart totals.
  - Converted static volume tier cards (`1-9 pcs`, `10-49 pcs`, `50+ pcs`) in `ProductDetailPage.tsx` into interactive buttons with `handleSelectTier`: clicking any tier card immediately updates the order quantity to that tier's minimum requirement, stepping by `order_qty_step`, and clamping to available `stock`.
  - Real-time visual feedback: active highlight ring (`ring-2 ring-brand-light/40 shadow-xs`), active badge, live unit price update, and estimated line subtotal.
  - Interactive "Add N more to get tier price" helper below the stepper with an "Apply" shortcut to jump directly to the next volume tier.
- **Client-Side WebP Image Compressor Engine (`ImageCompressorTool.tsx` & `imageCompressor.ts`)**:
  - Added browser-native image compression engine utilizing HTML5 Canvas WebP encoding with dimension clamping (1200px for products, 1920px for hero banners) and visual quality optimization (82%–84%).
  - Reduces banner and catalog image sizes by 65%–85% before uploading to Supabase Storage, accelerating mobile storefront Largest Contentful Paint (LCP). Includes interactive standalone tool with live side-by-side preview comparisons.

---

## Touchpoint 01 — Core Storefront Architecture, Centerpiece Navigation Dock & Branding Standards

- **Mobile-First Layout & Canonical Design System**:
  - Established base viewport at 390px with responsive breakpoints (`md: 768px`, `lg: 1280px`).
  - Systematically refactored styling across 22+ components in store and admin apps to replace arbitrary styles with canonical `@theme` tokens (`--color-brand-light: #5ADBE5`, `--color-brand: #1EAFC7`, `--color-brand-dark: #0A82A8`, `--color-surface: #F8F9FB`), modern Tailwind v4 gradient syntax (`bg-linear-to-b`, `bg-linear-to-r`), and standard utilities:
    - `bg-gradient-to-r` → `bg-linear-to-r` in `CatalogUploadHome.tsx`.
    - `min-w-[260px]`, `max-w-[340px]`, `max-w-[200px]`, `min-h-[360px]`, `max-h-[640px]` → `min-w-65`, `max-w-85`, `max-w-50`, `min-h-90`, `max-h-160` in `CategoryColumn.tsx`.
    - `max-w-[220px]` → `max-w-55` in `CategoryDeleteModal.tsx`.
    - `after:top-[2px] after:left-[2px]` → `after:top-0.5 after:left-0.5` in `CategoryEditModal.tsx`.
    - `max-h-[460px]` → `max-h-115` in `CategoryManagerModal.tsx`.
    - `min-h-[320px]`, `h-[280px] sm:h-[320px]` → `min-h-80`, `h-70 sm:h-80` in `CategoryCascader.tsx`.
    - `min-h-[46px]` → `min-h-11.5` in `KeywordsInput.tsx`.
- **Centerpiece Logo & Navigation Dock (`NavigationDock.tsx`)**:
  - Scaled up the center Urbanrat logo button in `NavigationDock.tsx` to `w-14 h-14` / `w-15 h-15` with an elevated centerpiece ring and glow shadow, establishing a clear visual focal hierarchy.
  - Implemented slide-up bottom sheet / desktop modal (`StoreMenuDrawer.tsx`) triggered from the navigation dock and sub-topbar. Includes structured storefront links, category quick-jump, WhatsApp wholesale desk, company policies, and guest/login actions.
- **Official Brand Mark & Favicons**: Integrated the official Urbanrat logo across web favicons, app headers, docks, product cards, login portals, and footers.
- **Fixed 5:4 Aspect Ratio Hero Media (`aspect-5/4`) & Clearance Spacing**:
  - Standardized all promotional hero banners in customer storefront (`HomePage.tsx`) and admin preview (`ContentEditor.tsx`) to fixed 5:4 aspect ratio with `object-cover` focal rendering, eliminating layout shifts and image squishing.
  - Enforced desktop topbar clearance padding (`md:pt-36`) in `apps/store/src/App.tsx`, preventing hero banner clipping beneath sticky two-tier headers.

---
