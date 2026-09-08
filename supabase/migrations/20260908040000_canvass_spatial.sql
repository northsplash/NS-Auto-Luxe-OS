-- Canvass performance + import lock. Reuses territory_doors as the property pin store.

alter table public.lead_territories
  add column if not exists houses_imported_at timestamptz;

create index if not exists idx_territory_doors_lat_lng
  on public.territory_doors (latitude, longitude)
  where latitude is not null and longitude is not null;

create index if not exists idx_territory_doors_territory_lat_lng
  on public.territory_doors (territory_id, latitude, longitude);

create index if not exists idx_territory_doors_status
  on public.territory_doors (status);

create index if not exists idx_territory_doors_last_employee
  on public.territory_doors (last_employee_id)
  where last_employee_id is not null;

create or replace function public.territory_doors_in_bounds(
  p_territory_ids uuid[],
  p_south double precision,
  p_west double precision,
  p_north double precision,
  p_east double precision
)
returns setof public.territory_doors
language sql
stable
as $$
  select d.*
  from public.territory_doors d
  where (p_territory_ids is null or cardinality(p_territory_ids) = 0 or d.territory_id = any(p_territory_ids))
    and d.latitude between p_south and p_north
    and d.longitude between p_west and p_east;
$$;

grant execute on function public.territory_doors_in_bounds(uuid[], double precision, double precision, double precision, double precision)
  to authenticated;
