# Urbanrat Store

A mobile-first single-vendor e-commerce web app for mobile accessories and electronics, supplied by URP Wholesale.

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
