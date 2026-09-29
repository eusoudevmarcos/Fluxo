-- Imita o Render: um dono de banco sem superusuario, que so pode criar papeis.
create role render_owner login createrole password 'local-owner';
create database wave owner render_owner;
