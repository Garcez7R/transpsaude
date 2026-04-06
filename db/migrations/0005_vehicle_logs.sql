create table if not exists vehicle_logs (
  id integer primary key autoincrement,
  vehicle_id integer not null,
  driver_id integer,
  entry_type text not null,
  odometer_km integer not null,
  liters real,
  fuel_type text,
  maintenance_type text,
  next_due_km integer,
  notes text,
  recorded_at text not null default current_timestamp,
  created_at text not null default current_timestamp,
  foreign key (vehicle_id) references vehicles(id),
  foreign key (driver_id) references drivers(id)
);

create index if not exists idx_vehicle_logs_vehicle on vehicle_logs(vehicle_id, recorded_at);
