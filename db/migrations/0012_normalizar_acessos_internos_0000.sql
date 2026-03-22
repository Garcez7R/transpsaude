update operators
set password = '0000',
    password_hash = null,
    must_change_password = 1,
    active = 1,
    updated_at = current_timestamp
where cpf in ('96820373015', '22233344455', '11111111111');

update drivers
set password = '0000',
    password_hash = null,
    must_change_password = 1,
    active = 1,
    updated_at = current_timestamp
where cpf = '33322211100';
