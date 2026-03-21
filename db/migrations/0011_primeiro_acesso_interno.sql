alter table operators add column must_change_password integer not null default 0;
alter table drivers add column must_change_password integer not null default 0;

update operators
set must_change_password = coalesce(must_change_password, 0)
where must_change_password is null;

update drivers
set must_change_password = coalesce(must_change_password, 0)
where must_change_password is null;
