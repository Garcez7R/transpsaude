create table if not exists operators (
  id integer primary key autoincrement,
  name text not null,
  email text not null unique,
  role text not null default 'operator',
  created_at text not null default current_timestamp
);

create table if not exists patients (
  id integer primary key autoincrement,
  full_name text not null,
  cpf text,
  cns text,
  birth_date text,
  phone text,
  city text,
  state text,
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

insert into operators (name, email, role)
select 'Operador Demo', 'operador@prefeitura.local', 'operator'
where not exists (select 1 from operators where email = 'operador@prefeitura.local');
