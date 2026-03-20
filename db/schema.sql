create table if not exists operators (
  id integer primary key autoincrement,
  name text not null,
  cpf text unique,
  email text not null unique,
  password text,
  role text not null default 'operator',
  created_at text not null default current_timestamp
);

create table if not exists patients (
  id integer primary key autoincrement,
  full_name text not null,
  cpf text not null unique,
  cpf_masked text not null,
  cns text,
  birth_date text,
  phone text,
  city text,
  state text,
  temporary_password text not null default '0000',
  citizen_pin text,
  must_change_pin integer not null default 1,
  access_activated_at text,
  last_login_at text,
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
  destination_city text not null,
  destination_state text not null,
  treatment_unit text not null,
  specialty text not null,
  requested_at text not null,
  travel_date text not null,
  status text not null,
  companion_required integer not null default 0,
  notes text,
  created_by_operator_id integer,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  foreign key (patient_id) references patients(id),
  foreign key (created_by_operator_id) references operators(id)
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

insert into operators (name, cpf, email, password, role)
select 'Operador Demo', '11111111111', 'operador@prefeitura.local', '1234', 'operator'
where not exists (select 1 from operators where email = 'operador@prefeitura.local');

insert into operators (name, cpf, email, password, role)
select 'Administrador Geral', '96820373015', 'admin@capaodoleao.rs.gov.br', '1978', 'admin'
where not exists (select 1 from operators where cpf = '96820373015');

insert into patients (
  full_name,
  cpf,
  cpf_masked,
  cns,
  birth_date,
  phone,
  city,
  state,
  temporary_password,
  citizen_pin,
  must_change_pin
)
select
  'Maria das Dores Silva',
  '24890312031',
  '248.903.120-31',
  '123456789000001',
  '1978-04-12',
  '(53) 99999-0101',
  'Capao do Leao',
  'RS',
  '0000',
  '4821',
  1
where not exists (select 1 from patients where cpf = '24890312031');
