-- ============================================================================
-- Migration: 022_review_approval_system.sql
-- Description: Review Approval System for Wholesale Store:
--              1. Auto-approval for 4 & 5 star reviews
--              2. Admin moderation required for reviews below 4 stars
--              3. RLS policies allowing public submission and admin moderation
-- ============================================================================

-- Ensure reviews table has user_name column for guest/wholesale buyers
alter table if exists public.reviews
  add column if not exists user_name text default 'Verified Wholesale Buyer';

-- Make user_id nullable so guest buyers can submit reviews
alter table if exists public.reviews
  alter column user_id drop not null;

-- Drop foreign key constraint on user_id if present to allow guest reviews
alter table if exists public.reviews
  drop constraint if exists reviews_user_id_fkey;

-- Ensure status check constraint allows pending, approved, rejected
alter table if exists public.reviews
  drop constraint if exists reviews_status_check;

alter table if exists public.reviews
  add constraint reviews_status_check check (status in ('pending', 'approved', 'rejected'));

-- Trigger function: Automatically set status to 'approved' if rating >= 4, 'pending' if rating < 4
create or replace function public.auto_moderate_review()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.rating >= 4 then
    new.status := 'approved';
  else
    if new.status is null or new.status = 'approved' then
      new.status := 'pending';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_auto_moderate_review on public.reviews;
create trigger trigger_auto_moderate_review
  before insert on public.reviews
  for each row execute function public.auto_moderate_review();

-- RLS Policies for Reviews
alter table public.reviews enable row level security;

-- 1. Anyone can read approved reviews
drop policy if exists "Anyone can read approved reviews" on public.reviews;
drop policy if exists "Anyone can read approved reviews or own reviews or admin reads all" on public.reviews;
create policy "Anyone can read approved reviews or admin reads all"
  on public.reviews for select
  using (
    status = 'approved'
    or public.is_admin()
  );

-- 2. Anyone can insert reviews (rating >= 4 will auto-approve, < 4 will set pending)
drop policy if exists "Anyone can insert reviews" on public.reviews;
drop policy if exists "Users can insert own pending review" on public.reviews;
create policy "Anyone can insert reviews"
  on public.reviews for insert
  with check (true);

-- 3. Only admins can update review status (approve/reject)
drop policy if exists "Admins can update review status" on public.reviews;
drop policy if exists "Users can update own pending review or admin updates any" on public.reviews;
create policy "Admins can update review status"
  on public.reviews for update
  using (public.is_admin())
  with check (public.is_admin());

-- 4. Only admins can delete reviews
drop policy if exists "Admins can delete reviews" on public.reviews;
drop policy if exists "Users can delete own review or admin deletes any" on public.reviews;
create policy "Admins can delete reviews"
  on public.reviews for delete
  using (public.is_admin());

-- Refresh schema cache
notify pgrst, 'reload schema';
