create table if not exists drivers (
  id integer primary key autoincrement,
  name text not null,
  cpf text not null unique,
  phone text not null,
  is_whatsapp integer not null default 0,
  vehicle_name text not null,
  password text not null,
  active integer not null default 1,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

insert into operators (name, cpf, email, password, role)
select 'Gerente Demo', '22233344455', 'gerencia@capaodoleao.rs.gov.br', '2468', 'manager'
where not exists (select 1 from operators where cpf = '22233344455');

alter table travel_requests add column assigned_driver_id integer;
alter table travel_requests add column assigned_driver_name text;
alter table travel_requests add column departure_time text;
alter table travel_requests add column manager_notes text;
alter table travel_requests add column scheduled_at text;

insert into drivers (name, cpf, phone, is_whatsapp, vehicle_name, password, active)
select 'John Doe', '33322211100', '(53) 99999-0202', 1, 'Van 01', '0000', 1
where not exists (select 1 from drivers where cpf = '33322211100');

update travel_requests
set assigned_driver_name = coalesce(assigned_driver_name, ''),
    departure_time = coalesce(departure_time, ''),
    manager_notes = coalesce(manager_notes, '')
where assigned_driver_name is null
   or departure_time is null
   or manager_notes is null;
