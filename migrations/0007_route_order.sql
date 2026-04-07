create table if not exists route_orders (
  id integer primary key autoincrement,
  driver_id integer not null,
  travel_date text not null,
  request_id integer not null,
  position integer not null,
  updated_at text default current_timestamp,
  unique(driver_id, travel_date, request_id)
);

create index if not exists idx_route_orders_driver_date on route_orders(driver_id, travel_date);
