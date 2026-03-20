alter table travel_requests add column use_custom_boarding_location integer not null default 0;
alter table travel_requests add column boarding_location_name text;

update travel_requests
set use_custom_boarding_location = coalesce(use_custom_boarding_location, 0),
    boarding_location_name = coalesce(boarding_location_name, '')
where boarding_location_name is null;
