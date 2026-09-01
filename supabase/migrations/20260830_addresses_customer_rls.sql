-- The addresses table has, until now, only ever been written to by the
-- Next.js API route using the Supabase service-role key (which bypasses
-- RLS). The Flutter Customer app writes directly as the signed-in customer
-- instead, so it needs its own RLS policies for insert/update/delete on
-- rows it owns. Idempotent: safe to re-run.
alter table public.addresses enable row level security;

drop policy if exists "Customers can view own addresses" on public.addresses;
create policy "Customers can view own addresses"
  on public.addresses for select
  using (auth.uid() = user_id);

drop policy if exists "Customers can insert own addresses" on public.addresses;
create policy "Customers can insert own addresses"
  on public.addresses for insert
  with check (auth.uid() = user_id);

drop policy if exists "Customers can update own addresses" on public.addresses;
create policy "Customers can update own addresses"
  on public.addresses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Customers can delete own addresses" on public.addresses;
create policy "Customers can delete own addresses"
  on public.addresses for delete
  using (auth.uid() = user_id);
