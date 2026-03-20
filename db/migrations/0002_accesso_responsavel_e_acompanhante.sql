alter table patients add column access_cpf text;
alter table patients add column access_cpf_masked text;
alter table patients add column responsible_name text;
alter table patients add column responsible_cpf text;
alter table patients add column responsible_cpf_masked text;
alter table patients add column use_responsible_cpf_for_access integer not null default 0;

alter table travel_requests add column access_cpf_masked text;
alter table travel_requests add column companion_name text;
alter table travel_requests add column companion_cpf_masked text;

update patients
set access_cpf = coalesce(access_cpf, cpf),
    access_cpf_masked = coalesce(access_cpf_masked, cpf_masked),
    responsible_name = coalesce(responsible_name, ''),
    responsible_cpf = coalesce(responsible_cpf, ''),
    responsible_cpf_masked = coalesce(responsible_cpf_masked, ''),
    use_responsible_cpf_for_access = coalesce(use_responsible_cpf_for_access, 0)
where access_cpf is null
   or access_cpf_masked is null
   or responsible_name is null
   or responsible_cpf is null
   or responsible_cpf_masked is null
   or use_responsible_cpf_for_access is null;

update travel_requests
set access_cpf_masked = coalesce(access_cpf_masked, cpf_masked),
    companion_name = coalesce(companion_name, ''),
    companion_cpf_masked = coalesce(companion_cpf_masked, '')
where access_cpf_masked is null
   or companion_name is null
   or companion_cpf_masked is null;
