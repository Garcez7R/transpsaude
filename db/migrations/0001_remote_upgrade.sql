alter table operators add column cpf text;
alter table operators add column password text;

create unique index if not exists idx_operators_cpf on operators(cpf);

alter table patients add column cpf_masked text;
alter table patients add column temporary_password text default '0000';
alter table patients add column citizen_pin text;
alter table patients add column must_change_pin integer not null default 1;
alter table patients add column access_activated_at text;
alter table patients add column last_login_at text;

create unique index if not exists idx_patients_cpf on patients(cpf);

update patients
set cpf_masked =
  case
    when cpf is not null and length(cpf) = 11 then
      substr(cpf, 1, 3) || '.' || substr(cpf, 4, 3) || '.' || substr(cpf, 7, 3) || '-' || substr(cpf, 10, 2)
    else cpf_masked
  end
where cpf_masked is null;

update operators
set cpf = '11111111111',
    password = '1234'
where email = 'operador@prefeitura.local'
  and (cpf is null or password is null);

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
