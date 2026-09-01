-- Adds optional coordinates to saved addresses so the Customer app can show
-- an exact map pin (and let the user drag it to correct the pin) instead of
-- relying purely on free-text geocoding every time the address is displayed.
alter table public.addresses
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;
