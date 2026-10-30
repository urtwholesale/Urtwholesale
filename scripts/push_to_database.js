const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = fs.existsSync('.env') ? '.env' : 'apps/store/.env';
const envContent = fs.readFileSync(envPath, 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
  console.error('Could not find Supabase credentials in .env');
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function pushToDatabase() {
  console.log('=== 1. AUTHENTICATING AS ADMIN ===');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'sjainthelegend@urtwholesale.com',
    password: 'URTshubham@1'
  });

  if (authError) {
    console.error('Authentication failed:', authError.message);
    process.exit(1);
  }
  console.log('Authenticated as:', authData.user.email);

  console.log('\n=== 2. UPLOADING HERO CARDS TO STORAGE (banners bucket) ===');
  const heroCards = [
    {
      id: 'offer-gan-65w',
      title: 'Urbanrat 65W GaN Pro Fast Charger',
      subtitle: 'Next-generation GaN III Turbo architecture delivering dual-port 65W ultra-fast charging.',
      badge_text: 'URBANRAT PRO',
      rating: '4.9',
      cta_text: 'Receive',
      cta_link: '/marketplace?category=chargers',
      sort_order: 1,
      badges: [
        { icon: 'Zap', text: '65W GaN Core' },
        { icon: 'Flame', text: 'Dual USB-C PD' },
        { icon: 'Star', text: '4.9 Rated' }
      ]
    },
    {
      id: 'offer-diamond-armor',
      title: 'Urbanrat 9H Diamond Armor Screen',
      subtitle: 'Engineered from high-alumina tempered glass with 9H diamond hardness and 2.5D curved edges.',
      badge_text: 'URBANRAT PRO',
      rating: '4.8',
      cta_text: 'Receive',
      cta_link: '/marketplace?category=tempered-glass',
      sort_order: 2,
      badges: [
        { icon: 'ShieldCheck', text: '9H Sapphire Armor' },
        { icon: 'Sparkles', text: '2.5D Curved Edge' },
        { icon: 'Star', text: '4.8 Rated' }
      ]
    },
    {
      id: 'offer-tws-buds',
      title: 'AirBass Pro Wireless ANC TWS',
      subtitle: 'Acoustic chamber with 13mm titanium composite drivers, ANC, and 38-hour battery playback.',
      badge_text: 'URBANRAT PRO',
      rating: '4.9',
      cta_text: 'Receive',
      cta_link: '/marketplace?category=buds-tws',
      sort_order: 3,
      badges: [
        { icon: 'Zap', text: '13mm Ti Drivers' },
        { icon: 'Sparkles', text: '38H Playtime' },
        { icon: 'Star', text: '4.9 Rated' }
      ]
    },
    {
      id: 'offer-cables',
      title: 'Urbanrat 120W Titanium Super Cable',
      subtitle: 'Kevlar-reinforced dual-braided ballistic nylon cable with aerospace titanium-finish connectors.',
      badge_text: 'URBANRAT ORIGINAL',
      rating: '4.9',
      cta_text: 'Receive',
      cta_link: '/marketplace?category=cables',
      sort_order: 4,
      badges: [
        { icon: 'Zap', text: '120W PD Delivery' },
        { icon: 'ShieldCheck', text: 'Kevlar Reinforced' },
        { icon: 'Star', text: '4.9 Rated' }
      ]
    },
    {
      id: 'offer-power-bank',
      title: 'Urbanrat MagSafe Titanium Power Bank',
      subtitle: 'Ultra-compact 10,000mAh magnetic wireless power bank with 15W MagSafe and real-time LED display.',
      badge_text: 'PREMIERE PACK',
      rating: '5.0',
      cta_text: 'Receive',
      cta_link: '/marketplace?category=power-banks',
      sort_order: 5,
      badges: [
        { icon: 'Zap', text: '15W MagSafe Wireless' },
        { icon: 'Sparkles', text: 'LED Digital Display' },
        { icon: 'Star', text: '5.0 Rated' }
      ]
    }
  ];

  const uploadedHeroUrls = {};

  for (const card of heroCards) {
    for (const mode of ['dark', 'light']) {
      const localFile = path.join('apps/store/public/hero', mode, `${card.id}.jpg`);
      if (fs.existsSync(localFile)) {
        const fileBuffer = fs.readFileSync(localFile);
        const storagePath = `hero/${mode}/${card.id}.jpg`;
        const { data, error } = await supabase.storage
          .from('banners')
          .upload(storagePath, fileBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (error) {
          console.error(`Failed to upload ${storagePath}:`, error.message);
        } else {
          const { data: pubData } = supabase.storage.from('banners').getPublicUrl(storagePath);
          console.log(`Uploaded ${storagePath} -> ${pubData.publicUrl}`);
          if (!uploadedHeroUrls[card.id]) uploadedHeroUrls[card.id] = {};
          uploadedHeroUrls[card.id][mode] = pubData.publicUrl;
        }
      }
    }
  }

  console.log('\n=== 3. UPDATING BANNERS TABLE IN SUPABASE ===');
  // First, deactivate old home_hero banners that don't match our 5 new flagship banners
  const { data: existingBanners, error: exErr } = await supabase
    .from('banners')
    .select('*')
    .eq('placement', 'home_hero');

  if (exErr) {
    console.error('Error fetching existing banners:', exErr);
  } else {
    for (const eb of existingBanners) {
      if (eb.id === '743d8a17-268c-4f5e-931b-2110eab36039') {
        // Update the existing 65W GaN Pro banner with new 3D studio image & data
        const ganCard = heroCards.find(c => c.id === 'offer-gan-65w');
        const imgUrl = uploadedHeroUrls['offer-gan-65w']?.dark || `${supabaseUrl}/storage/v1/object/public/banners/hero/dark/offer-gan-65w.jpg`;
        const { error: updErr } = await supabase.from('banners').update({
          title: ganCard.title,
          subtitle: ganCard.subtitle,
          image_url: imgUrl,
          badge_text: ganCard.badge_text,
          rating: ganCard.rating,
          cta_text: ganCard.cta_text,
          cta_link: ganCard.cta_link,
          sort_order: 1,
          badges: ganCard.badges,
          is_active: true
        }).eq('id', eb.id);
        console.log(`Updated existing banner ${eb.id} (65W GaN Charger):`, updErr ? updErr.message : 'OK');
      } else {
        // Deactivate other old home_hero banners so the 5 flagship cards are prominent
        await supabase.from('banners').update({ is_active: false }).eq('id', eb.id);
        console.log(`Deactivated legacy banner ${eb.id} (${eb.title})`);
      }
    }
  }

  // Insert or upsert the other 4 flagship banners
  const otherCards = heroCards.filter(c => c.id !== 'offer-gan-65w');
  for (const card of otherCards) {
    const imgUrl = uploadedHeroUrls[card.id]?.dark || `${supabaseUrl}/storage/v1/object/public/banners/hero/dark/${card.id}.jpg`;
    
    // Check if banner with this title already exists
    const { data: existing } = await supabase
      .from('banners')
      .select('id')
      .eq('placement', 'home_hero')
      .eq('title', card.title);

    if (existing && existing.length > 0) {
      const { error: updErr } = await supabase.from('banners').update({
        subtitle: card.subtitle,
        image_url: imgUrl,
        badge_text: card.badge_text,
        rating: card.rating,
        cta_text: card.cta_text,
        cta_link: card.cta_link,
        sort_order: card.sort_order,
        badges: card.badges,
        is_active: true
      }).eq('id', existing[0].id);
      console.log(`Updated banner: ${card.title} -> ${updErr ? updErr.message : 'OK'}`);
    } else {
      const { data: newB, error: insErr } = await supabase.from('banners').insert({
        placement: 'home_hero',
        title: card.title,
        subtitle: card.subtitle,
        image_url: imgUrl,
        badge_text: card.badge_text,
        rating: card.rating,
        cta_text: card.cta_text,
        cta_link: card.cta_link,
        sort_order: card.sort_order,
        badges: card.badges,
        is_active: true
      }).select();
      console.log(`Inserted banner: ${card.title} -> ${insErr ? insErr.message : 'ID: ' + newB[0].id}`);
    }
  }

  console.log('\n=== 4. UPLOADING 3D STUDIO CATEGORY IMAGES TO STORAGE ===');
  const categoryMap = [
    { slug: 'cables', filename: 'cables.jpg' },
    { slug: 'tempered-glass-uv-glass', filename: 'tempered-glass.jpg' },
    { slug: 'mobile-chargers', filename: 'chargers.jpg' },
    { slug: 'buds-tws', filename: 'buds-tws.jpg' },
    { slug: 'neckbands', filename: 'neckbands.jpg' },
    { slug: 'audio', filename: 'speakers.jpg' },
    { slug: 'OTG connector', filename: 'otg-connectors.jpg' },
    { slug: 'mobile-holders-stand', filename: 'mobile-holders.jpg' },
    { slug: 'power-banks', filename: 'power-banks.jpg' },
    { slug: 'watches', filename: 'watches.jpg' },
    { slug: 'earphones', filename: 'earphones.jpg' },
    { slug: 'battry', filename: 'battery.jpg' }
  ];

  for (const cat of categoryMap) {
    const lightPath = path.join('apps/store/public/categories/light', cat.filename);
    const darkPath = path.join('apps/store/public/categories/dark', cat.filename);

    if (fs.existsSync(lightPath)) {
      const buf = fs.readFileSync(lightPath);
      await supabase.storage.from('product-images').upload(`categories/studio/light/${cat.filename}`, buf, {
        contentType: 'image/jpeg',
        upsert: true
      });
    }

    if (fs.existsSync(darkPath)) {
      const buf = fs.readFileSync(darkPath);
      const { data } = await supabase.storage.from('product-images').upload(`categories/studio/dark/${cat.filename}`, buf, {
        contentType: 'image/jpeg',
        upsert: true
      });
      if (data) {
        const { data: pubData } = supabase.storage.from('product-images').getPublicUrl(`categories/studio/dark/${cat.filename}`);
        
        // Update category image_url in categories table
        const { error: catErr } = await supabase
          .from('categories')
          .update({ image_url: pubData.publicUrl })
          .eq('slug', cat.slug);

        console.log(`Updated category [${cat.slug}] image_url -> ${catErr ? catErr.message : 'OK'}`);
      }
    }
  }

  console.log('\n=== 5. VERIFYING DATABASE STATE ===');
  const { data: finalBanners } = await supabase
    .from('banners')
    .select('id, sort_order, title, image_url, is_active')
    .eq('placement', 'home_hero')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  console.log('Active Home Hero Banners in DB:');
  console.table(finalBanners);

  console.log('\nAll data and media assets successfully pushed to Supabase database & storage!');
}

pushToDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

