create table if not exists public.provider_availability (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  day_of_week text not null,
  time_mode text not null default 'custom',
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint provider_availability_day_of_week_check
    check (
      day_of_week in (
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday'
      )
    ),
  constraint provider_availability_time_order_check
    check (end_time > start_time),
  constraint provider_availability_provider_day_unique
    unique (provider_id, day_of_week)
);

create index if not exists provider_availability_provider_id_idx
  on public.provider_availability (provider_id);

create index if not exists provider_availability_day_of_week_idx
  on public.provider_availability (day_of_week);

create or replace function public.set_provider_availability_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists provider_availability_set_updated_at
  on public.provider_availability;

create trigger provider_availability_set_updated_at
before update on public.provider_availability
for each row
execute function public.set_provider_availability_updated_at();
