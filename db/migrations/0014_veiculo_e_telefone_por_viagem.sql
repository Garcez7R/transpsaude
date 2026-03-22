alter table travel_requests add column assigned_driver_phone text;
alter table travel_requests add column show_driver_phone_to_patient integer not null default 1;
alter table travel_requests add column assigned_vehicle_id integer;
alter table travel_requests add column assigned_vehicle_name text;

update travel_requests
set assigned_driver_phone = coalesce(assigned_driver_phone, ''),
    show_driver_phone_to_patient = coalesce(show_driver_phone_to_patient, 1),
    assigned_vehicle_name = coalesce(assigned_vehicle_name, '')
where assigned_driver_phone is null
   or show_driver_phone_to_patient is null
   or assigned_vehicle_name is null;
