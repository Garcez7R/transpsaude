alter table patients add column is_whatsapp integer not null default 0;
alter table patients add column address_line text;

alter table travel_requests add column companion_phone text;
alter table travel_requests add column companion_is_whatsapp integer not null default 0;
alter table travel_requests add column companion_address_line text;

update patients
set is_whatsapp = coalesce(is_whatsapp, 0),
    address_line = coalesce(address_line, '')
where address_line is null;

update travel_requests
set companion_phone = coalesce(companion_phone, ''),
    companion_is_whatsapp = coalesce(companion_is_whatsapp, 0),
    companion_address_line = coalesce(companion_address_line, '')
where companion_phone is null
   or companion_address_line is null;
