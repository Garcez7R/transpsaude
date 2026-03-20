create table if not exists vehicles (
  id integer primary key autoincrement,
  name text not null,
  plate text not null unique,
  category text not null,
  active integer not null default 1,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

alter table drivers add column vehicle_id integer;

insert into vehicles (name, plate, category, active)
select 'Van 01', 'IZA1A23', 'Van', 1
where not exists (select 1 from vehicles where plate = 'IZA1A23');

insert into vehicles (name, plate, category, active)
select distinct vehicle_name, upper(substr(hex(randomblob(4)), 1, 7)), 'Veiculo', 1
from drivers
where coalesce(vehicle_name, '') != ''
  and not exists (select 1 from vehicles v where v.name = drivers.vehicle_name);

update drivers
set vehicle_id = (
  select v.id
  from vehicles v
  where v.name = drivers.vehicle_name
  limit 1
)
where vehicle_id is null
  and coalesce(vehicle_name, '') != '';
