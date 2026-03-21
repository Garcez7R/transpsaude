alter table operators add column password_hash text;

alter table patients add column temporary_password_hash text;
alter table patients add column citizen_pin_hash text;

alter table drivers add column password_hash text;
