alter table vehicle_logs add column travel_request_id integer;

create index if not exists idx_vehicle_logs_trip on vehicle_logs(travel_request_id);
