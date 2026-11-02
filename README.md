# Urbanrat Store

A mobile-first single-vendor e-commerce web app for mobile accessories and electronics, supplied by URP Wholesale.

## Feature Overview

- **B2B Wholesale Pricing**: Multi-tier quantity pricing engine with automatic live unit discount calculation.
- **Dual-Theme Storefront**: Customer store with seamless Light (Cyan/Teal) and Dark (Obsidian/Orange) modes.
- **Enterprise Admin Console**: Dedicated operational dashboard with catalog, order, and inventory management.
- **4-Level Category Hierarchy**: Nested category tree (L1–L4) with dynamic attributes and recursive product rollup.
- **High-Throughput Ingestion**: Single and bulk Excel/CSV catalog uploading with automated WebP compression.
- **Parallel Image Library**: Batch image processing with client-side aspect ratio and dimension verification.
- **Wholesale Order Management**: Real-time lifecycle order tracking, SLA notices, packing slips, and GST invoices.
- **Reverse Logistics & Claims**: Customer return portal, dispute resolution, warehouse QC, and courier claims.
- **Search & Discovery**: Trigram-based typo tolerance, vocabulary harvesting, auto-suggest, and keyword indexing.
- **Automated Review Moderation**: Auto-publishing for $\ge 4$-star ratings with admin verification for $< 4$ stars.

## Documentation

- **[`PROJECT.md`](./PROJECT.md)**: Complete system architecture, design system, database schema, and deployment guide.
- **[`CHANGELOG.md`](./CHANGELOG.md)**: Comprehensive release history and technical implementation log (Touchpoints 01–39).

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Bundler:** Vite 6
- **Styling:** Tailwind CSS v4
- **Routing:** React Router v7
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **Monorepo:** npm workspaces

## Project Structure

```
urbanrat-store/
├── apps/
│   ├── store/       # Customer-facing storefront  (port 5173)
│   └── admin/       # Admin panel                 (port 5174)
├── packages/
│   └── shared/      # Shared TypeScript types
├── .env.example
├── AGENT_RULES.md
└── package.json     # Workspace root
```

## Getting Started

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10

### Install

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` in the project root and fill in your Supabase credentials:

```bash
cp .env.example .env
```

### Development

```bash
# Run both apps
npm run dev

# Run only the store (port 5173)
npm run dev:store

# Run only the admin panel (port 5174)
npm run dev:admin
```

### Build

```bash
npm run build
```

## License

Private — All rights reserved.
