create unique index if not exists members_document_identity_uidx
on public.members (
  document_type,
  upper(regexp_replace(btrim(document), '\s+', '', 'g'))
);
