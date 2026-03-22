create table if not exists request_messages (
  id integer primary key autoincrement,
  travel_request_id integer not null,
  message_type text not null default 'general',
  title text,
  body text not null,
  visible_to_citizen integer not null default 0,
  created_by_operator_id integer,
  created_by_name text not null,
  created_at text not null default current_timestamp,
  foreign key (travel_request_id) references travel_requests(id),
  foreign key (created_by_operator_id) references operators(id)
);
