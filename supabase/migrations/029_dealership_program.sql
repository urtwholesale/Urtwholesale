-- ============================================================================
-- Migration: 029_dealership_program.sql
-- Description: Dynamic database tables, RLS policies, triggers, and seed data
--              for the Dealership Program: Branded vs Copy Item Showcase,
--              Category Margins, Benefits Differentiation Table, and Articles.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DEALERSHIP TIER MARGINS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.dealership_tier_margins (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('branded', 'copy')),
  category text not null,
  item_name text not null,
  lot_size text not null,
  cost_price numeric(10, 2) not null,
  retail_price_range text not null,
  margin_percentage text not null,
  profit_per_lot text not null,
  description text default '',
  image_url text default null,
  badge_text text default null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dealership_tier_margins_active_sort
  on public.dealership_tier_margins (is_active, sort_order);

alter table public.dealership_tier_margins enable row level security;

drop trigger if exists trigger_dealership_tier_margins_updated_at on public.dealership_tier_margins;
create trigger trigger_dealership_tier_margins_updated_at
  before update on public.dealership_tier_margins
  for each row execute function public.set_updated_at();

drop policy if exists "Anyone can read active dealership tier margins" on public.dealership_tier_margins;
create policy "Anyone can read active dealership tier margins"
  on public.dealership_tier_margins for select
  using (is_active = true or public.is_admin());

drop policy if exists "Admins can manage dealership tier margins" on public.dealership_tier_margins;
create policy "Admins can manage dealership tier margins"
  on public.dealership_tier_margins for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.dealership_tier_margins to anon, authenticated;
grant all on public.dealership_tier_margins to authenticated;

-- ----------------------------------------------------------------------------
-- 2. DEALERSHIP ITEM SHOWCASE (Visual Branded vs Copy Comparison with Images)
-- ----------------------------------------------------------------------------
create table if not exists public.dealership_item_showcase (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('branded', 'copy')),
  title text not null,
  subtitle text default '',
  image_url text not null,
  packaging_type text default '',
  warranty_type text default '',
  quality_grade text default '',
  target_customer text default '',
  dealer_margin text default '',
  features text[] default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dealership_item_showcase_type_sort
  on public.dealership_item_showcase (item_type, is_active, sort_order);

alter table public.dealership_item_showcase enable row level security;

drop trigger if exists trigger_dealership_item_showcase_updated_at on public.dealership_item_showcase;
create trigger trigger_dealership_item_showcase_updated_at
  before update on public.dealership_item_showcase
  for each row execute function public.set_updated_at();

drop policy if exists "Anyone can read active dealership showcase" on public.dealership_item_showcase;
create policy "Anyone can read active dealership showcase"
  on public.dealership_item_showcase for select
  using (is_active = true or public.is_admin());

drop policy if exists "Admins can manage dealership showcase" on public.dealership_item_showcase;
create policy "Admins can manage dealership showcase"
  on public.dealership_item_showcase for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.dealership_item_showcase to anon, authenticated;
grant all on public.dealership_item_showcase to authenticated;

-- ----------------------------------------------------------------------------
-- 3. DEALERSHIP BENEFITS COMPARISON (URT Dealer vs Normal Person)
-- ----------------------------------------------------------------------------
create table if not exists public.dealership_benefits_comparison (
  id uuid primary key default gen_random_uuid(),
  feature_name text not null,
  normal_person_benefit text not null,
  urt_dealer_benefit text not null,
  category text default 'General',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dealership_benefits_comparison_sort
  on public.dealership_benefits_comparison (is_active, sort_order);

alter table public.dealership_benefits_comparison enable row level security;

drop trigger if exists trigger_dealership_benefits_comparison_updated_at on public.dealership_benefits_comparison;
create trigger trigger_dealership_benefits_comparison_updated_at
  before update on public.dealership_benefits_comparison
  for each row execute function public.set_updated_at();

drop policy if exists "Anyone can read active dealership benefits comparison" on public.dealership_benefits_comparison;
create policy "Anyone can read active dealership benefits comparison"
  on public.dealership_benefits_comparison for select
  using (is_active = true or public.is_admin());

drop policy if exists "Admins can manage dealership benefits comparison" on public.dealership_benefits_comparison;
create policy "Admins can manage dealership benefits comparison"
  on public.dealership_benefits_comparison for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.dealership_benefits_comparison to anon, authenticated;
grant all on public.dealership_benefits_comparison to authenticated;

-- ----------------------------------------------------------------------------
-- 4. DEALERSHIP ARTICLES (Branded vs Copy Dealership Short Articles)
-- ----------------------------------------------------------------------------
create table if not exists public.dealership_articles (
  id uuid primary key default gen_random_uuid(),
  article_type text not null unique check (article_type in ('branded', 'copy')),
  title text not null,
  short_summary text not null,
  content text not null,
  badge text not null,
  key_points text[] default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dealership_articles enable row level security;

drop trigger if exists trigger_dealership_articles_updated_at on public.dealership_articles;
create trigger trigger_dealership_articles_updated_at
  before update on public.dealership_articles
  for each row execute function public.set_updated_at();

drop policy if exists "Anyone can read active dealership articles" on public.dealership_articles;
create policy "Anyone can read active dealership articles"
  on public.dealership_articles for select
  using (is_active = true or public.is_admin());

drop policy if exists "Admins can manage dealership articles" on public.dealership_articles;
create policy "Admins can manage dealership articles"
  on public.dealership_articles for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.dealership_articles to anon, authenticated;
grant all on public.dealership_articles to authenticated;

-- ----------------------------------------------------------------------------
-- 5. INITIAL SEED DATA
-- ----------------------------------------------------------------------------

-- Seed Articles
insert into public.dealership_articles (article_type, title, short_summary, content, badge, key_points, sort_order)
values
  (
    'branded',
    'URT Original Branded Gear Dealership',
    'Engineered for premium retail counters seeking high ticket size, repeat brand loyalty, certified safety, and complete warranty swap security.',
    'The Urbanrat Original Branded Dealership is designed for electronics stores and smartphone showrooms catering to quality-conscious consumers who refuse low-grade copies. Every branded item features precision aerospace Gallium Nitride internals, 9H sapphire-infused glass, tamper-evident retail blister packaging, and official BIS safety certifications. As an authorized branded dealer, you command higher selling prices (up to ₹799 per charger, ₹1,499 per TWS), build counter trust, and receive unconditional 1-year over-the-counter replacement backing from our central depot.',
    'PREMIUM AUTHENTIC',
    array[
      'Official Urbanrat laser-etched branding and security QR seal',
      'Full BIS, CE & RoHS certified electrical safety standards',
      'Command premium retail prices (₹599 to ₹1,499 ticket size)',
      '1-Year instant over-the-counter 1-for-1 replacement swap',
      'Complimentary acrylic counter display stands and branded posters'
    ],
    1
  ),
  (
    'copy',
    'High-Turnover Compatible (Normal / Copy) Dealership',
    'Engineered for maximum counter volume, rapid daily stock rotation, lowest initial inventory barrier, and unmatched 400%+ cash margin velocity.',
    'The Compatible (Normal / Copy) Dealership model targets mass-market retail outlets, repair kiosks, and busy suburban mobile counters where daily footfall demands affordable replacements. These items deliver commercial-grade performance at unfiltered factory floor unit costs (e.g. ₹18 for 9H glass, ₹38 for 120W cables). While packaged in unbranded bulk blisters or generic sleeves, they allow shop owners to rotate working capital 4 to 6 times a month with extreme profit margins of 300% to 700%, capturing every budget-sensitive walk-in customer without financial friction.',
    'FAST TURNOVER COMPATIBLE',
    array[
      'Lowest acquisition cost: start from ₹18/pc on tempered glass',
      'Huge markup potential: 300% to 700% gross profit margin',
      'Unbranded commercial blister packaging for flexible counter pricing',
      'Ideal for repair counters, high-density markets, and daily volume',
      'Rotate capital 4–6 times per month with minimal cash lock-in'
    ],
    2
  )
on conflict (article_type) do nothing;

-- Seed Item Showcases (Visual Branded vs Copy Item Differentiation)
insert into public.dealership_item_showcase (
  item_type,
  title,
  subtitle,
  image_url,
  packaging_type,
  warranty_type,
  quality_grade,
  target_customer,
  dealer_margin,
  features,
  sort_order
)
values
  (
    'branded',
    'Urbanrat 65W GaN Pro Charger (Authentic Branded)',
    'Next-gen GaN III dual USB-C architecture with aerospace heat dissipation',
    '/hero/dark/offer-gan-65w.jpg',
    'Metallic foil embossed retail box with anti-counterfeit QR seal',
    '1-Year Instant 1-for-1 DOA Replacement Swap',
    'Tier-1 GaN III Gallium Nitride Architecture',
    'Premium smartphone & laptop owners seeking fast, safe charging',
    '145% – 180% Gross Profit (₹414 – ₹514 per unit net gain)',
    array[
      'Authentic Urbanrat laser logo and embossed branding',
      'Dual Type-C PD 65W + USB-A 30W multi-device delivery',
      'Active thermal throttling and flame-retardant casing',
      'BIS registered safety compliance certificate'
    ],
    1
  ),
  (
    'copy',
    'Generic 65W GaN Style Charger (Normal / Copy Compatible)',
    'Commercial grade dual-port fast charger in neutral bulk packaging',
    '/hero/light/offer-gan-65w.jpg',
    'Neutral retail blister box without proprietary brand logos',
    '7-Day Testing & DOA Replacement Guarantee',
    'Standard Commercial Dual-IC Circuitry',
    'Price-sensitive buyers seeking quick everyday charging',
    '250% – 320% Gross Profit (₹250 – ₹380 per unit net gain)',
    array[
      'Clean neutral styling ready for counter retail pricing',
      'Standard 65W rated dual output with basic QC support',
      'Low unit wholesale cost (₹140 vs ₹285 branded)',
      'Rapid counter impulse buy turnover'
    ],
    2
  ),
  (
    'branded',
    'Urbanrat 9H Diamond Armor Screen (Authentic Branded)',
    'High-alumina double-tempered glass with oleophobic electroplated coating',
    '/hero/dark/offer-diamond-armor.jpg',
    'Rigid retail hardbook with alignment frame & microfiber kit',
    '1-Year Anti-Crack & Shatter Guarantee',
    'Double-Tempered 9H High-Alumina Sapphire Glass',
    'iPhone & flagship Android owners demanding zero touch latency',
    '300% – 450% Gross Profit (₹75 – ₹110 per unit net gain)',
    array[
      'Oleophobic electroplated fingerprint-resistant layer',
      'Ultra-thin 0.33mm with 2.5D curved silk-printed borders',
      'Dust-free installation frame included in retail pack',
      'Urbanrat hologram quality verification sticker'
    ],
    3
  ),
  (
    'copy',
    'Generic 9H Clear Tempered Glass (Normal / Copy Compatible)',
    'Standard high-clarity tempered glass in bulk shop lots',
    '/hero/light/offer-diamond-armor.jpg',
    'Bulk foam sleeve pack of 50 pcs (Zero individual box cost)',
    'Dead-On-Arrival broken transit replacement only',
    'Standard Commercial Soda-Lime Glass',
    'Walk-in counter repairs, screen replacement add-on sales',
    '450% – 720% Gross Profit (₹81 – ₹131 per unit net gain)',
    array[
      'Lowest unit cost in India (just ₹18 per piece)',
      'Sell for ₹99–₹149 counter installation with instant profit',
      'High turnover: 100+ pcs sold weekly per retail counter',
      'Zero packaging waste: compact 50-piece storage box'
    ],
    4
  )
on conflict do nothing;

-- Seed Benefits Comparison Table (URT Dealer vs Normal Person)
insert into public.dealership_benefits_comparison (
  feature_name,
  normal_person_benefit,
  urt_dealer_benefit,
  category,
  sort_order
)
values
  (
    'Purchase Price Tier',
    'Standard Retail MRP prices (Full price, zero wholesale discount)',
    'Unfiltered Tier-1 Factory Direct Wholesale Depot Pricing',
    'Commercial',
    1
  ),
  (
    'Profit Margin Potential',
    '0% (End-use consumer consumption)',
    '45% to 120%+ Gross Margin on Branded, up to 720% on Compatible Glass',
    'Commercial',
    2
  ),
  (
    'Warranty & Defect Protection',
    'Standard 7-day manufacturer DOA replacement',
    '1-Year 100% Instant 1-for-1 Over-The-Counter Swap on Branded Gear',
    'Warranty',
    3
  ),
  (
    'Payment & Credit Terms',
    '100% Upfront Prepaid (UPI, Card, NetBanking)',
    '15 to 30 Day Revolving Net Credit Lines (Post-KYC verification)',
    'Financial',
    4
  ),
  (
    'Minimum Order Commitment',
    'Single unit consumer purchases',
    'Low 10-piece flexible mix-and-match lots across any product line',
    'Operational',
    5
  ),
  (
    'Retail POS Marketing Kits',
    'None',
    'Free countertop acrylic display stands, posters & barcode tags',
    'Marketing',
    6
  ),
  (
    'Dispatch & Logistics Priority',
    'Standard surface courier (3 to 7 business days)',
    'Priority 24H SafeXpress air/surface cargo with same-day tracking',
    'Logistics',
    7
  ),
  (
    'Territory Protection',
    'None',
    'Exclusive pincode dealer rights for Gold & Platinum partners',
    'Commercial',
    8
  ),
  (
    'Dedicated Support Desk',
    'Standard email helpdesk',
    'Dedicated Depot WhatsApp Manager with instant stock reservation',
    'Support',
    9
  )
on conflict do nothing;

-- Seed Tier Margins (Mix of Branded and Copy Items)
insert into public.dealership_tier_margins (
  item_type,
  category,
  item_name,
  lot_size,
  cost_price,
  retail_price_range,
  margin_percentage,
  profit_per_lot,
  description,
  badge_text,
  sort_order
)
values
  (
    'branded',
    'Fast Chargers',
    'Urbanrat 65W GaN Pro Dual-Port Charger',
    '20 pcs / carton',
    285.00,
    '₹699 – ₹799',
    '+145% to +180%',
    '₹8,280 – ₹10,280',
    'Certified GaN III internals, aluminum heat dissipation, metallic retail box.',
    'BRANDED ORIGINAL',
    1
  ),
  (
    'copy',
    'Tempered Glass',
    '9H Sapphire Diamond Tempered Glass (Bulk)',
    '50 pcs / box',
    18.00,
    '₹99 – ₹149',
    '+450% to +720%',
    '₹4,050 – ₹6,550',
    'Universal high-volume daily counter driver. 50-piece compact shop pack.',
    'FAST TURNOVER COPY',
    2
  ),
  (
    'branded',
    'Data Cables',
    'Urbanrat 120W Ballistic Braided Type-C',
    '30 pcs / pack',
    38.00,
    '₹149 – ₹199',
    '+292% to +423%',
    '₹3,330 – ₹4,830',
    'Kevlar core, unbreakable alloy joints, metallic hang-tag packaging.',
    'BRANDED ORIGINAL',
    3
  ),
  (
    'copy',
    'Data Cables',
    'Generic 65W Fast Charge Braided Cable (Bulk)',
    '50 pcs / bundle',
    19.00,
    '₹79 – ₹99',
    '+315% to +421%',
    '₹3,000 – ₹4,000',
    'Daily counter staple in polybag packaging for impulse add-on sales.',
    'FAST TURNOVER COPY',
    4
  ),
  (
    'branded',
    'Audio / TWS',
    'AirBass Pro Wireless ANC Earbuds (38H Playtime)',
    '10 pcs / lot',
    420.00,
    '₹1,199 – ₹1,399',
    '+185% to +233%',
    '₹7,790 – ₹9,790',
    '13mm titanium composite drivers, ANC, luxury magnetic packaging.',
    'BRANDED ORIGINAL',
    5
  ),
  (
    'branded',
    'Power Banks',
    'Urbanrat 10,000mAh MagSafe Titanium Wireless Bank',
    '10 pcs / lot',
    540.00,
    '₹1,399 – ₹1,599',
    '+159% to +196%',
    '₹8,590 – ₹10,590',
    '15W magnetic wireless + 20W PD Type-C, LED digital battery indicator.',
    'BRANDED ORIGINAL',
    6
  )
on conflict do nothing;

notify pgrst, 'reload schema';

