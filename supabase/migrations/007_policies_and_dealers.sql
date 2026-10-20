-- ============================================================================
-- Migration: 007_policies_and_dealers.sql
-- Description: Store Policies Enhancements, Authorized Dealer Applications Engine,
--              Lifecycle Audit Events, Admin Dealer Management RPCs, and Seed Policies.
-- Characteristics: ADDITIVE and idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. STORE_PAGES ENHANCEMENTS
-- ----------------------------------------------------------------------------
alter table public.store_pages
  add column if not exists is_published boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists show_in_footer boolean not null default true,
  add column if not exists meta_description text;

-- Index for public store page queries by publication status and ordering
create index if not exists idx_store_pages_published on public.store_pages(is_published, sort_order asc);

-- Update RLS on store_pages:
-- Public can read only published pages (admins can read all)
alter table public.store_pages enable row level security;

drop policy if exists "Anyone can read store pages" on public.store_pages;
drop policy if exists "Public can read published store pages" on public.store_pages;
create policy "Public can read published store pages"
  on public.store_pages for select
  using (is_published = true or public.is_admin());

drop policy if exists "Admins can manage store pages" on public.store_pages;
create policy "Admins can manage store pages"
  on public.store_pages for all
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. PROFILES ENHANCEMENT: DEALER STATUS FLAG
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_dealer boolean not null default false;

create index if not exists idx_profiles_is_dealer on public.profiles(is_dealer);

-- ----------------------------------------------------------------------------
-- 3. DEALER SEQUENCE GENERATOR (DLR-0001 style sequence)
-- ----------------------------------------------------------------------------
create sequence if not exists public.dealer_code_seq start with 1;
grant usage, select on sequence public.dealer_code_seq to authenticated;

-- ----------------------------------------------------------------------------
-- 4. DEALER_APPLICATIONS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.dealer_applications (
  id uuid primary key default gen_random_uuid(),
  application_no text not null unique,
  business_name text not null,
  owner_name text not null,
  mobile text not null check (mobile ~ '^[0-9]{10}$'),
  whatsapp text,
  email text,
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  business_type text check (business_type in ('retailer', 'distributor', 'online_seller', 'wholesaler', 'other')),
  address text,
  city text,
  state text,
  pincode text check (pincode is null or pincode ~ '^[0-9]{6}$'),
  expected_monthly_volume text check (expected_monthly_volume in ('under_25k', '25k_1l', '1l_5l', 'above_5l')),
  categories_interest text[] default '{}',
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'under_review', 'approved', 'rejected', 'on_hold')),
  dealer_code text unique null,
  admin_note text,
  rejection_reason text,
  user_id uuid null references auth.users(id) on delete set null,
  accepted_terms_at timestamptz not null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reusable updated_at trigger on dealer_applications
drop trigger if exists trigger_dealer_applications_updated_at on public.dealer_applications;
create trigger trigger_dealer_applications_updated_at
  before update on public.dealer_applications
  for each row execute function public.set_updated_at();

-- Indexes for dealer_applications queries
create index if not exists idx_dealer_applications_app_no on public.dealer_applications(application_no);
create index if not exists idx_dealer_applications_status on public.dealer_applications(status);
create index if not exists idx_dealer_applications_mobile on public.dealer_applications(mobile);
create index if not exists idx_dealer_applications_gstin on public.dealer_applications(gstin);
create index if not exists idx_dealer_applications_user_id on public.dealer_applications(user_id);
create index if not exists idx_dealer_applications_created_at on public.dealer_applications(created_at desc);
create index if not exists idx_dealer_applications_dealer_code on public.dealer_applications(dealer_code);

-- ----------------------------------------------------------------------------
-- 5. DEALER_EVENTS TABLE (Audit Trail)
-- ----------------------------------------------------------------------------
create table if not exists public.dealer_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.dealer_applications(id) on delete cascade,
  status text not null,
  note text,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_dealer_events_application_id on public.dealer_events(application_id);
create index if not exists idx_dealer_events_created_at on public.dealer_events(created_at desc);

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY: DEALER APPLICATIONS & EVENTS
-- ----------------------------------------------------------------------------
alter table public.dealer_applications enable row level security;
alter table public.dealer_events enable row level security;

-- Revoke direct INSERT from anon and authenticated (insertions only through validated RPC)
revoke insert on table public.dealer_applications from anon, authenticated;
revoke insert on table public.dealer_events from anon, authenticated;

-- Policies for dealer_applications: Admin-only for select, update, and delete
drop policy if exists "Admins can view dealer applications" on public.dealer_applications;
create policy "Admins can view dealer applications"
  on public.dealer_applications for select
  using (public.is_admin());

drop policy if exists "Admins can update dealer applications" on public.dealer_applications;
create policy "Admins can update dealer applications"
  on public.dealer_applications for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete dealer applications" on public.dealer_applications;
create policy "Admins can delete dealer applications"
  on public.dealer_applications for delete
  using (public.is_admin());

-- Policies for dealer_events: Admin-only for select, insert, update, and delete
drop policy if exists "Admins can view dealer events" on public.dealer_events;
create policy "Admins can view dealer events"
  on public.dealer_events for select
  using (public.is_admin());

drop policy if exists "Admins can insert dealer events" on public.dealer_events;
create policy "Admins can insert dealer events"
  on public.dealer_events for insert
  with check (public.is_admin());

drop policy if exists "Admins can update dealer events" on public.dealer_events;
create policy "Admins can update dealer events"
  on public.dealer_events for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete dealer events" on public.dealer_events;
create policy "Admins can delete dealer events"
  on public.dealer_events for delete
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 7. RPC: SUBMIT_DEALER_APPLICATION (Public submission gateway with rate limits)
-- ----------------------------------------------------------------------------
create or replace function public.submit_dealer_application(
  p_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_name text;
  v_owner_name text;
  v_mobile text;
  v_whatsapp text;
  v_email text;
  v_gstin text;
  v_business_type text;
  v_address text;
  v_city text;
  v_state text;
  v_pincode text;
  v_volume text;
  v_categories text[];
  v_message text;
  v_accepted_terms boolean;
  v_recent_app_count integer;
  v_date_prefix text;
  v_chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_rand text;
  v_app_no text;
  v_attempt integer;
  v_inserted_id uuid;
  v_created_at timestamptz;
begin
  -- 1. Payload validation
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Application submission payload must be a valid JSON object';
  end if;

  -- 2. Business & Owner Name
  v_business_name := nullif(trim(coalesce(p_data->>'business_name', '')), '');
  if v_business_name is null or length(v_business_name) < 2 then
    raise exception 'Business name is required (minimum 2 characters)';
  end if;

  v_owner_name := nullif(trim(coalesce(p_data->>'owner_name', '')), '');
  if v_owner_name is null or length(v_owner_name) < 2 then
    raise exception 'Owner / Contact person name is required (minimum 2 characters)';
  end if;

  -- 3. Mobile Number (Sanitize to 10 digits)
  v_mobile := regexp_replace(trim(coalesce(p_data->>'mobile', '')), '[^0-9]', '', 'g');
  if length(v_mobile) = 12 and v_mobile like '91%' then
    v_mobile := substr(v_mobile, 3);
  end if;

  if v_mobile !~ '^[0-9]{10}$' then
    raise exception 'A valid 10-digit mobile number is required: %', coalesce(p_data->>'mobile', '');
  end if;

  -- 4. WhatsApp Number (Optional, 10 digits if present)
  v_whatsapp := nullif(regexp_replace(trim(coalesce(p_data->>'whatsapp', '')), '[^0-9]', '', 'g'), '');
  if v_whatsapp is not null then
    if length(v_whatsapp) = 12 and v_whatsapp like '91%' then
      v_whatsapp := substr(v_whatsapp, 3);
    end if;
    if v_whatsapp !~ '^[0-9]{10}$' then
      raise exception 'WhatsApp number must be a valid 10-digit number: %', coalesce(p_data->>'whatsapp', '');
    end if;
  end if;

  -- 5. Email Address (Optional, validated format if present)
  v_email := nullif(trim(coalesce(p_data->>'email', '')), '');
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid email address format: %', v_email;
  end if;

  -- 6. GSTIN (Optional, must match standard 15-character Indian GST format if provided)
  v_gstin := nullif(upper(trim(coalesce(p_data->>'gstin', ''))), '');
  if v_gstin is not null and v_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then
    raise exception 'Invalid GSTIN format: %. Expected format: 22AAAAA0000A1Z5', v_gstin;
  end if;

  -- 7. Business Type
  v_business_type := nullif(lower(trim(coalesce(p_data->>'business_type', ''))), '');
  if v_business_type is not null and v_business_type not in ('retailer', 'distributor', 'online_seller', 'wholesaler', 'other') then
    raise exception 'Invalid business type: %. Must be one of retailer, distributor, online_seller, wholesaler, other', v_business_type;
  end if;

  -- 8. Address, City, State
  v_address := nullif(trim(coalesce(p_data->>'address', '')), '');
  v_city := nullif(trim(coalesce(p_data->>'city', '')), '');
  v_state := nullif(trim(coalesce(p_data->>'state', '')), '');

  -- 9. Pincode (Optional, 6 digits if provided)
  v_pincode := nullif(regexp_replace(trim(coalesce(p_data->>'pincode', '')), '[^0-9]', '', 'g'), '');
  if v_pincode is not null and v_pincode !~ '^[0-9]{6}$' then
    raise exception 'Pincode must be a valid 6-digit postal code: %', coalesce(p_data->>'pincode', '');
  end if;

  -- 10. Expected Monthly Volume
  v_volume := nullif(lower(trim(coalesce(p_data->>'expected_monthly_volume', ''))), '');
  if v_volume is not null and v_volume not in ('under_25k', '25k_1l', '1l_5l', 'above_5l') then
    raise exception 'Invalid expected monthly volume: %', v_volume;
  end if;

  -- 11. Categories of Interest Array
  if p_data->'categories_interest' is not null and jsonb_typeof(p_data->'categories_interest') = 'array' then
    select coalesce(array_agg(elem.val::text), '{}'::text[]) into v_categories
    from (
      select distinct trim(both '"' from value::text) as val
      from jsonb_array_elements(p_data->'categories_interest')
      where trim(both '"' from value::text) <> ''
    ) as elem;
    if v_categories is null then
      v_categories := '{}';
    end if;
  else
    v_categories := '{}';
  end if;

  -- 12. Message
  v_message := nullif(trim(coalesce(p_data->>'message', '')), '');

  -- 13. Accepted Terms (Strictly required)
  v_accepted_terms := coalesce((p_data->>'accepted_terms')::boolean, false);
  if not v_accepted_terms then
    raise exception 'You must review and accept the Urbanrat dealer terms and conditions to proceed';
  end if;

  -- 14. Rate Limiting: Max 3 submissions per mobile number per 24 hours
  select count(*) into v_recent_app_count
  from public.dealer_applications
  where mobile = v_mobile
    and created_at >= (now() - interval '24 hours');

  if v_recent_app_count >= 3 then
    raise exception 'Too many dealer applications submitted for mobile number % in the last 24 hours. Please wait before submitting again.', v_mobile;
  end if;

  -- 15. Duplicate Check: Reject if an identical application is already new or under review
  if v_gstin is not null then
    if exists (
      select 1 from public.dealer_applications
      where mobile = v_mobile
        and gstin = v_gstin
        and status in ('new', 'under_review')
    ) then
      raise exception 'A dealer application for mobile % and GSTIN % is already under active review. Our team will contact you shortly.', v_mobile, v_gstin;
    end if;
  else
    if exists (
      select 1 from public.dealer_applications
      where mobile = v_mobile
        and gstin is null
        and status in ('new', 'under_review')
    ) then
      raise exception 'A dealer application for mobile % is already under active review. Our team will contact you shortly.', v_mobile;
    end if;
  end if;

  -- 16. Unique Application Number Generation (DLR-YYMMDD-XXXX) with Collision Retry
  v_date_prefix := 'DLR-' || to_char(now(), 'YYMMDD') || '-';

  for v_attempt in 1..10 loop
    v_rand := '';
    for i in 1..4 loop
      v_rand := v_rand || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    end loop;
    v_app_no := v_date_prefix || v_rand;

    if not exists (select 1 from public.dealer_applications where application_no = v_app_no) then
      exit;
    end if;

    if v_attempt = 10 then
      v_app_no := v_date_prefix || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    end if;
  end loop;

  -- 17. Insert Dealer Application Row
  insert into public.dealer_applications (
    application_no,
    business_name,
    owner_name,
    mobile,
    whatsapp,
    email,
    gstin,
    business_type,
    address,
    city,
    state,
    pincode,
    expected_monthly_volume,
    categories_interest,
    message,
    status,
    user_id,
    accepted_terms_at,
    created_at,
    updated_at
  ) values (
    v_app_no,
    v_business_name,
    v_owner_name,
    v_mobile,
    v_whatsapp,
    v_email,
    v_gstin,
    v_business_type,
    v_address,
    v_city,
    v_state,
    v_pincode,
    v_volume,
    v_categories,
    v_message,
    'new',
    auth.uid(),
    now(),
    now(),
    now()
  )
  returning id, created_at into v_inserted_id, v_created_at;

  -- 18. Record Initial Event
  insert into public.dealer_events (
    application_id,
    status,
    note,
    created_by,
    created_at
  ) values (
    v_inserted_id,
    'new',
    'Dealer application submitted online',
    auth.uid(),
    now()
  );

  -- 19. Return only application_no and created_at (Never other applicants' data)
  return jsonb_build_object(
    'application_no', v_app_no,
    'created_at', v_created_at
  );
end;
$$;

-- Grant execution to public anon and authenticated users
grant execute on function public.submit_dealer_application(jsonb) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. RPC: ADMIN_UPDATE_DEALER_APPLICATION (Admin-only status & lifecycle updater)
-- ----------------------------------------------------------------------------
create or replace function public.admin_update_dealer_application(
  p_id uuid,
  p_status text,
  p_note text default null,
  p_rejection_reason text default null
)
returns public.dealer_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.dealer_applications;
  v_updated_app public.dealer_applications;
  v_dealer_code text;
  v_clean_status text;
  v_clean_reason text;
  v_clean_note text;
begin
  -- 1. Authorization check
  if not public.is_admin() then
    raise exception 'Unauthorized: Only an administrator can update dealer applications';
  end if;

  -- 2. Fetch existing application row with row-lock
  select * into v_app
  from public.dealer_applications
  where id = p_id
  for update;

  if not found then
    raise exception 'Dealer application not found: %', p_id;
  end if;

  -- 3. Validate status
  v_clean_status := lower(trim(coalesce(p_status, '')));
  if v_clean_status not in ('new', 'contacted', 'under_review', 'approved', 'rejected', 'on_hold') then
    raise exception 'Invalid status: %. Must be one of new, contacted, under_review, approved, rejected, on_hold', p_status;
  end if;

  v_clean_note := nullif(trim(coalesce(p_note, '')), '');
  v_clean_reason := nullif(trim(coalesce(p_rejection_reason, '')), '');

  -- 4. Rejection requires a reason
  if v_clean_status = 'rejected' and v_clean_reason is null then
    raise exception 'A rejection reason is mandatory when setting application status to rejected';
  end if;

  v_dealer_code := v_app.dealer_code;

  -- 5. On 'approved': generate unique dealer_code (DLR-0001 sequence) if empty and flag profile
  if v_clean_status = 'approved' then
    if v_dealer_code is null or trim(v_dealer_code) = '' then
      loop
        v_dealer_code := 'DLR-' || lpad(nextval('public.dealer_code_seq')::text, 4, '0');
        exit when not exists (select 1 from public.dealer_applications where dealer_code = v_dealer_code);
      end loop;
    end if;

    -- If user_id is linked, grant dealer status on profile
    if v_app.user_id is not null then
      update public.profiles
      set is_dealer = true, updated_at = now()
      where id = v_app.user_id;
    end if;
  end if;

  -- 6. If moved away from approved, revoke is_dealer on profile if no other approved applications exist
  if v_app.status = 'approved' and v_clean_status <> 'approved' then
    if v_app.user_id is not null then
      if not exists (
        select 1 from public.dealer_applications
        where user_id = v_app.user_id
          and id <> p_id
          and status = 'approved'
      ) then
        update public.profiles
        set is_dealer = false, updated_at = now()
        where id = v_app.user_id;
      end if;
    end if;
  end if;

  -- 7. Update dealer application
  update public.dealer_applications
  set
    status = v_clean_status,
    dealer_code = v_dealer_code,
    admin_note = coalesce(v_clean_note, admin_note),
    rejection_reason = case when v_clean_status = 'rejected' then v_clean_reason else rejection_reason end,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = p_id
  returning * into v_updated_app;

  -- 8. Write dealer_events audit row
  insert into public.dealer_events (
    application_id,
    status,
    note,
    created_by,
    created_at
  ) values (
    p_id,
    v_clean_status,
    coalesce(v_clean_note, case
      when v_clean_status = 'approved' then 'Dealer approved with code ' || v_dealer_code
      when v_clean_status = 'rejected' then 'Dealer application rejected: ' || v_clean_reason
      else 'Application status updated to ' || v_clean_status
    end),
    auth.uid(),
    now()
  );

  return v_updated_app;
end;
$$;

grant execute on function public.admin_update_dealer_application(uuid, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 9. RPC: ADMIN_DEALER_STATS (Admin-only status counts, period stats & approval rate)
-- ----------------------------------------------------------------------------
create or replace function public.admin_dealer_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total bigint;
  v_new bigint;
  v_contacted bigint;
  v_under_review bigint;
  v_approved bigint;
  v_rejected bigint;
  v_on_hold bigint;
  v_last_7_days bigint;
  v_last_30_days bigint;
  v_decided bigint;
  v_approval_rate numeric(5, 2);
begin
  -- 1. Authorization check
  if not public.is_admin() then
    raise exception 'Unauthorized: Only an administrator can access dealer statistics';
  end if;

  -- 2. Aggregate statistics
  select
    count(*),
    count(*) filter (where status = 'new'),
    count(*) filter (where status = 'contacted'),
    count(*) filter (where status = 'under_review'),
    count(*) filter (where status = 'approved'),
    count(*) filter (where status = 'rejected'),
    count(*) filter (where status = 'on_hold'),
    count(*) filter (where created_at >= (now() - interval '7 days')),
    count(*) filter (where created_at >= (now() - interval '30 days'))
  into
    v_total,
    v_new,
    v_contacted,
    v_under_review,
    v_approved,
    v_rejected,
    v_on_hold,
    v_last_7_days,
    v_last_30_days
  from public.dealer_applications;

  -- 3. Approval Rate computation: Approved / (Approved + Rejected)
  v_decided := v_approved + v_rejected;
  if v_decided > 0 then
    v_approval_rate := round((v_approved::numeric / v_decided::numeric) * 100, 2);
  else
    v_approval_rate := 0.00;
  end if;

  -- 4. Return structured JSON payload
  return jsonb_build_object(
    'total', v_total,
    'by_status', jsonb_build_object(
      'new', v_new,
      'contacted', v_contacted,
      'under_review', v_under_review,
      'approved', v_approved,
      'rejected', v_rejected,
      'on_hold', v_on_hold
    ),
    'last_7_days', v_last_7_days,
    'last_30_days', v_last_30_days,
    'approval_rate', v_approval_rate
  );
end;
$$;

grant execute on function public.admin_dealer_stats() to authenticated;

-- ----------------------------------------------------------------------------
-- 10. SEED STORE_PAGES (Idempotent seed: only inserts if slug does not exist)
-- ----------------------------------------------------------------------------
insert into public.store_pages (
  slug,
  title,
  summary,
  content,
  is_published,
  sort_order,
  show_in_footer,
  meta_description
)
values
  (
    'shipping',
    'Shipping & Delivery Policy',
    'Pan-India express logistics, dispatch turnaround, and tracking guidelines',
    'TO BE UPDATED',
    true,
    10,
    true,
    'Urbanrat shipping and courier dispatch timelines across India with express door delivery.'
  ),
  (
    'returns',
    'Returns & Replacements Policy',
    'Transit damage coverage and 1-to-1 replacement protocols',
    'TO BE UPDATED',
    true,
    20,
    true,
    'Urbanrat wholesale return policy covering courier damage and dead-on-arrival replacements within 48 hours.'
  ),
  (
    'warranty',
    'Warranty Policy',
    'Factory warranty coverage terms for electronic accessories and cables',
    'TO BE UPDATED',
    true,
    30,
    true,
    'Urbanrat product replacement warranty guidelines, RMA procedures, and manufacturer guarantee terms.'
  ),
  (
    'wholesale-terms',
    'Wholesale Terms & Conditions',
    'B2B purchasing guidelines, bulk volume tier pricing, and tax invoice terms',
    'TO BE UPDATED',
    true,
    40,
    true,
    'Official B2B wholesale terms of service, volume tier discounts, GST billing, and minimum order requirements.'
  ),
  (
    'dealer-terms',
    'Authorized Dealer Terms',
    'Dealer network criteria, regional wholesale privileges, and compliance',
    'TO BE UPDATED',
    true,
    50,
    true,
    'Urbanrat authorized dealer partner policy, territory commitments, and wholesale merchant agreements.'
  ),
  (
    'contact',
    'Contact & Wholesale Desk',
    'Direct factory desk, warehouse address, and business contact channels',
    'TO BE UPDATED',
    true,
    60,
    true,
    'Get in touch with the Urbanrat wholesale support desk via WhatsApp, phone, email, or visit our central distribution center.'
  )
on conflict (slug) do nothing;
