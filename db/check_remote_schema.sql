-- Auditoria do schema remoto no D1
-- Cole no Console do D1 para verificar se o banco remoto acompanha o estado atual do app.

/***** Tabelas esperadas *****/
select name
from sqlite_master
where type = 'table'
  and name in (
    'operators',
    'patients',
    'travel_requests',
    'vehicles',
    'drivers',
    'request_status_history',
    'audit_logs'
  )
order by name;

/***** Colunas principais *****/
pragma table_info(operators);
pragma table_info(patients);
pragma table_info(travel_requests);
pragma table_info(vehicles);
pragma table_info(drivers);
pragma table_info(request_status_history);
pragma table_info(audit_logs);

/***** Seeds e acessos iniciais *****/
select id, name, cpf, email, role, active, created_by_operator_id
from operators
order by id;

select id, name, cpf, phone, vehicle_id, vehicle_name, active
from drivers
order by id;

select id, name, plate, category, active
from vehicles
order by id;

select id, full_name, cpf, access_cpf, phone, is_whatsapp, address_line
from patients
order by id;

/***** Integridade operacional *****/
select
  id,
  protocol,
  patient_name,
  status,
  assigned_driver_id,
  assigned_driver_name,
  departure_time,
  use_custom_boarding_location,
  boarding_location_name,
  created_by_operator_id
from travel_requests
order by id desc
limit 20;

select
  id,
  travel_request_id,
  protocol,
  status,
  label,
  updated_by_operator_id,
  updated_at
from request_status_history
order by id desc
limit 20;

/***** Contagens úteis *****/
select 'operators' as entity, count(*) as total from operators
union all
select 'patients', count(*) from patients
union all
select 'travel_requests', count(*) from travel_requests
union all
select 'vehicles', count(*) from vehicles
union all
select 'drivers', count(*) from drivers
union all
select 'request_status_history', count(*) from request_status_history
union all
select 'audit_logs', count(*) from audit_logs;
