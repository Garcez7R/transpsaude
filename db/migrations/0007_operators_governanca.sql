alter table operators add column active integer not null default 1;
alter table operators add column created_by_operator_id integer;
alter table operators add column updated_at text not null default current_timestamp;

update operators
set active = coalesce(active, 1),
    updated_at = coalesce(updated_at, current_timestamp)
where updated_at is null;
