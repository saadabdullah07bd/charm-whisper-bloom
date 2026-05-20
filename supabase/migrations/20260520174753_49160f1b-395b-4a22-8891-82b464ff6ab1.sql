create table if not exists public.app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.app_secrets enable row level security;

drop policy if exists "Doctors can read app_secrets" on public.app_secrets;
create policy "Doctors can read app_secrets"
on public.app_secrets for select to authenticated
using (public.has_role(auth.uid(), 'doctor'));

drop policy if exists "Doctors can insert app_secrets" on public.app_secrets;
create policy "Doctors can insert app_secrets"
on public.app_secrets for insert to authenticated
with check (public.has_role(auth.uid(), 'doctor'));

drop policy if exists "Doctors can update app_secrets" on public.app_secrets;
create policy "Doctors can update app_secrets"
on public.app_secrets for update to authenticated
using (public.has_role(auth.uid(), 'doctor'))
with check (public.has_role(auth.uid(), 'doctor'));

drop trigger if exists app_secrets_updated_at on public.app_secrets;
create trigger app_secrets_updated_at
before update on public.app_secrets
for each row execute function public.update_updated_at_column();