create table if not exists operators (
  id integer primary key autoincrement,
  name text not null,
  cpf text unique,
  email text not null unique,
  password text,
  password_hash text,
  must_change_password integer not null default 0,
  role text not null default 'operator',
  active integer not null default 1,
  created_by_operator_id integer,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  foreign key (created_by_operator_id) references operators(id)
);

create table if not exists patients (
  id integer primary key autoincrement,
  full_name text not null,
  cpf text not null unique,
  cpf_masked text not null,
  access_cpf text not null,
  access_cpf_masked text not null,
  cns text,
  birth_date text,
  phone text,
  is_whatsapp integer not null default 0,
  address_line text,
  city text,
  state text,
  responsible_name text,
  responsible_cpf text,
  responsible_cpf_masked text,
  use_responsible_cpf_for_access integer not null default 0,
  temporary_password text not null default '0000',
  temporary_password_hash text,
  citizen_pin text,
  citizen_pin_hash text,
  must_change_pin integer not null default 1,
  access_activated_at text,
  last_login_at text,
  active integer not null default 1,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists travel_requests (
  id integer primary key autoincrement,
  protocol text not null unique,
  protocol_pin text not null,
  patient_id integer not null,
  patient_name text not null,
  cpf_masked text not null,
  access_cpf_masked text,
  companion_name text,
  companion_cpf_masked text,
  companion_phone text,
  companion_is_whatsapp integer not null default 0,
  companion_address_line text,
  destination_city text not null,
  destination_state text not null,
  treatment_unit text not null,
  specialty text not null,
  requested_at text not null,
  travel_date text not null,
  appointment_time text,
  status text not null,
  companion_required integer not null default 0,
  assigned_driver_id integer,
  assigned_driver_name text,
  assigned_driver_phone text,
  show_driver_phone_to_patient integer not null default 1,
  assigned_vehicle_id integer,
  assigned_vehicle_name text,
  patient_confirmed_at text,
  patient_last_viewed_at text,
  patient_last_message_seen_at text,
  operator_last_patient_message_seen_at text,
  departure_time text,
  manager_notes text,
  use_custom_boarding_location integer not null default 0,
  boarding_location_name text,
  scheduled_at text,
  notes text,
  created_by_operator_id integer,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  foreign key (patient_id) references patients(id),
  foreign key (assigned_driver_id) references drivers(id),
  foreign key (assigned_vehicle_id) references vehicles(id),
  foreign key (created_by_operator_id) references operators(id)
);

create table if not exists vehicles (
  id integer primary key autoincrement,
  name text not null,
  plate text not null unique,
  category text not null,
  active integer not null default 1,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists drivers (
  id integer primary key autoincrement,
  name text not null,
  cpf text not null unique,
  phone text not null,
  is_whatsapp integer not null default 0,
  vehicle_id integer,
  vehicle_name text not null,
  password text not null,
  password_hash text,
  must_change_password integer not null default 0,
  active integer not null default 1,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  foreign key (vehicle_id) references vehicles(id)
);

create table if not exists request_status_history (
  id integer primary key autoincrement,
  travel_request_id integer not null,
  protocol text not null,
  status text not null,
  label text not null,
  note text,
  updated_by_operator_id integer,
  updated_at text not null,
  sort_order integer not null default 0,
  foreign key (travel_request_id) references travel_requests(id),
  foreign key (updated_by_operator_id) references operators(id)
);

create table if not exists request_messages (
  id integer primary key autoincrement,
  travel_request_id integer not null,
  message_type text not null default 'general',
  title text,
  body text not null,
  visible_to_citizen integer not null default 0,
  created_by_operator_id integer,
  created_by_name text not null,
  created_by_role text not null default 'operator',
  created_at text not null default current_timestamp,
  foreign key (travel_request_id) references travel_requests(id),
  foreign key (created_by_operator_id) references operators(id)
);

create table if not exists audit_logs (
  id integer primary key autoincrement,
  operator_id integer,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata text,
  created_at text not null default current_timestamp,
  foreign key (operator_id) references operators(id)
);

create table if not exists auth_sessions (
  id integer primary key autoincrement,
  token text not null unique,
  session_type text not null,
  operator_id integer,
  driver_id integer,
  role text,
  name text not null,
  active integer not null default 1,
  expires_at text,
  last_used_at text,
  created_at text not null default current_timestamp,
  foreign key (operator_id) references operators(id),
  foreign key (driver_id) references drivers(id)
);

insert into operators (name, cpf, email, password, must_change_password, role)
select 'Operador Demo', '11111111111', 'operador@prefeitura.local', '0000', 1, 'operator'
where not exists (select 1 from operators where email = 'operador@prefeitura.local');

insert into operators (name, cpf, email, password, must_change_password, role)
select 'Administrador Geral', '96820373015', 'admin@capaodoleao.rs.gov.br', '0000', 1, 'admin'
where not exists (select 1 from operators where cpf = '96820373015');

insert into operators (name, cpf, email, password, must_change_password, role)
select 'Gerente Demo', '22233344455', 'gerencia@capaodoleao.rs.gov.br', '0000', 1, 'manager'
where not exists (select 1 from operators where cpf = '22233344455');

insert into vehicles (name, plate, category, active)
select 'Van 01', 'IZA1A23', 'Van', 1
where not exists (select 1 from vehicles where plate = 'IZA1A23');

insert into drivers (name, cpf, phone, is_whatsapp, vehicle_id, vehicle_name, password, must_change_password, active)
select 'Motorista Demo', '33322211100', '(53) 99999-0202', 1, (select id from vehicles where plate = 'IZA1A23' limit 1), 'Van 01', '0000', 1, 1
where not exists (select 1 from drivers where cpf = '33322211100');

insert into patients (
  full_name,
  cpf,
  cpf_masked,
  access_cpf,
  access_cpf_masked,
  cns,
  birth_date,
  phone,
  is_whatsapp,
  address_line,
  city,
  state,
  responsible_name,
  responsible_cpf,
  responsible_cpf_masked,
  use_responsible_cpf_for_access,
  temporary_password,
  citizen_pin,
  must_change_pin
)
select
  'Maria das Dores Silva',
  '24890312031',
  '248.903.120-31',
  '24890312031',
  '248.903.120-31',
  '123456789000001',
  '1978-04-12',
  '(53) 99999-0101',
  1,
  'Rua da Prefeitura, 120 - Capao do Leao',
  'Capao do Leao',
  'RS',
  '',
  '',
  '',
  0,
  '0000',
  '4821',
  1
where not exists (select 1 from patients where cpf = '24890312031');
