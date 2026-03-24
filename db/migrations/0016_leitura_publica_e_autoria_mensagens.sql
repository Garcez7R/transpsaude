alter table travel_requests add column patient_last_viewed_at text;
alter table travel_requests add column patient_last_message_seen_at text;
alter table request_messages add column created_by_role text not null default 'operator';
