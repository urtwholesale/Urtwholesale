-- ============================================================================
-- Urbanrat Store — Initial Seed Data
-- Description: Categories (parent & subcategories) and realistic product catalog
-- ============================================================================

-- Insert Parent Categories
insert into public.categories (id, name, slug, image_url, parent_id, sort_order, is_active)
values
  ('11111111-0000-0000-0000-000000000001', 'Tempered Glass', 'tempered-glass', 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=300&auto=format&fit=crop&q=80', null, 1, true),
  ('11111111-0000-0000-0000-000000000002', 'Cables & Cords', 'cables', 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=300&auto=format&fit=crop&q=80', null, 2, true),
  ('11111111-0000-0000-0000-000000000003', 'Chargers & Power', 'chargers', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=300&auto=format&fit=crop&q=80', null, 3, true),
  ('11111111-0000-0000-0000-000000000004', 'Audio & TWS', 'audio', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=300&auto=format&fit=crop&q=80', null, 4, true),
  ('11111111-0000-0000-0000-000000000005', 'Adapters & Hubs', 'adapters', 'https://images.unsplash.com/photo-1622445262464-84b1456045b6?w=300&auto=format&fit=crop&q=80', null, 5, true),
  ('11111111-0000-0000-0000-000000000006', 'Holders & Mounts', 'holders-mounts', 'https://images.unsplash.com/photo-1586105251261-72a756497a11?w=300&auto=format&fit=crop&q=80', null, 6, true)
on conflict (slug) do update set
  name = excluded.name,
  image_url = excluded.image_url,
  sort_order = excluded.sort_order;

-- Insert Subcategories
insert into public.categories (id, name, slug, image_url, parent_id, sort_order, is_active)
values
  ('22222222-0000-0000-0000-000000000001', '3D Curved Edge Glass', '3d-curved-glass', 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=200&auto=format&fit=crop&q=80', '11111111-0000-0000-0000-000000000001', 1, true),
  ('22222222-0000-0000-0000-000000000002', 'Privacy Screen Guards', 'privacy-glass', 'https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=200&auto=format&fit=crop&q=80', '11111111-0000-0000-0000-000000000001', 2, true),
  ('22222222-0000-0000-0000-000000000003', 'Matte Gaming Guards', 'matte-glass', 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=200&auto=format&fit=crop&q=80', '11111111-0000-0000-0000-000000000001', 3, true),
  ('22222222-0000-0000-0000-000000000004', 'Type-C to Type-C 100W', 'type-c-to-type-c', 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=200&auto=format&fit=crop&q=80', '11111111-0000-0000-0000-000000000002', 1, true),
  ('22222222-0000-0000-0000-000000000005', '65W GaN Fast Chargers', 'gan-chargers', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=200&auto=format&fit=crop&q=80', '11111111-0000-0000-0000-000000000003', 1, true),
  ('22222222-0000-0000-0000-000000000006', 'TWS True Wireless Earbuds', 'tws-earbuds', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=200&auto=format&fit=crop&q=80', '11111111-0000-0000-0000-000000000004', 1, true)
on conflict (slug) do update set
  name = excluded.name,
  image_url = excluded.image_url;

-- Insert Products
insert into public.products (id, name, slug, description, price, mrp, sku, stock, images, category_id, is_urbanrat_brand, is_active, is_featured)
values
  (
    '33333333-0000-0000-0000-000000000001',
    'Urbanrat 9H Diamond Armor Tempered Glass (iPhone 16 Pro)',
    'urbanrat-9h-diamond-armor-iphone-16-pro',
    'Precision laser-cut edge-to-edge 9H sapphire-grade tempered glass. Oleophobic nano-coating repels fingerprints, oils, and scratches while preserving True Tone clarity.',
    199.00,
    599.00,
    'UR-TG-16P-01',
    240,
    array['https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=800&auto=format&fit=crop&q=80'],
    '22222222-0000-0000-0000-000000000001',
    true,
    true,
    true
  ),
  (
    '33333333-0000-0000-0000-000000000002',
    'Urbanrat 65W GaN III Dual USB-C + USB-A Turbo Power Adapter',
    'urbanrat-65w-gan-turbo-charger',
    'Next-generation Gallium Nitride fast charger capable of powering laptops, tablets, and phones simultaneously. Features Dynamic Power Allocation.',
    999.00,
    2499.00,
    'UR-CHG-65W-BLK',
    85,
    array['https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&auto=format&fit=crop&q=80'],
    '22222222-0000-0000-0000-000000000005',
    true,
    true,
    true
  ),
  (
    '33333333-0000-0000-0000-000000000003',
    'Urbanrat Armored 100W PD Braided Type-C to Type-C Cable (1.5m)',
    'urbanrat-armored-100w-braided-type-c',
    'Kevlar-reinforced ballistic nylon cable tested for 50,000+ bends. Built-in E-Marker smart chip delivers up to 100W Power Delivery.',
    249.00,
    699.00,
    'UR-CBL-100W-15M',
    310,
    array['https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&auto=format&fit=crop&q=80'],
    '22222222-0000-0000-0000-000000000004',
    true,
    true,
    true
  ),
  (
    '33333333-0000-0000-0000-000000000004',
    'Urbanrat AirBass Pro ANC Earbuds (40h Battery, Dual Mic ENC)',
    'urbanrat-airbass-pro-anc-earbuds',
    'Premium studio acoustic drivers with 32dB Active Noise Cancellation and Low-Latency Gaming Mode (45ms). IPX5 sweat-proof rating.',
    1299.00,
    3499.00,
    'UR-AUD-AIRBASS-PRO',
    52,
    array['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80'],
    '22222222-0000-0000-0000-000000000006',
    true,
    true,
    true
  )
on conflict (slug) do update set
  name = excluded.name,
  price = excluded.price,
  mrp = excluded.mrp,
  stock = excluded.stock;
