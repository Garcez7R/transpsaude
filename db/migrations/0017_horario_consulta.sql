alter table travel_requests add column appointment_time text;

update travel_requests
set appointment_time = coalesce(appointment_time, '')
where appointment_time is null;
