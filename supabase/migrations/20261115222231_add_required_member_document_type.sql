alter table public.members
  add column if not exists document_type text not null default 'cedula_ciudadania';

alter table public.members
  drop constraint if exists members_document_type_check;

alter table public.members
  add constraint members_document_type_check
  check (document_type in (
    'cedula_ciudadania',
    'tarjeta_identidad',
    'cedula_extranjeria',
    'pasaporte',
    'permiso_proteccion_temporal',
    'nit',
    'otro'
  ));
