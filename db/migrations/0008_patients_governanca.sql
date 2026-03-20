alter table patients add column active integer not null default 1;

update patients
set active = coalesce(active, 1)
where active is null;
