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
