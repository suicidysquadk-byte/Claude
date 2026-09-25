-- BattleHub: fotos (Supabase Storage)
-- avatars: foto de perfil (pública)
-- chat: fotos enviadas nas conversas (pública, com nome aleatório)
-- verificacoes: print do perfil do Free Fire (privada: dono da foto e equipe)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('chat', 'chat', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('verificacoes', 'verificacoes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

grant execute on function app.is_staff(uuid) to authenticated;

create policy "enviar fotos na própria pasta" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'chat', 'verificacoes') and (storage.foldername(name))[1] = auth.uid()::text);

create policy "trocar fotos da própria pasta" on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'chat', 'verificacoes') and (storage.foldername(name))[1] = auth.uid()::text);

create policy "ver print de verificação" on storage.objects for select to authenticated
  using (bucket_id = 'verificacoes' and ((storage.foldername(name))[1] = auth.uid()::text or app.is_staff(auth.uid())));

-- listar e apagar as próprias fotos (usado ao excluir a conta)
create policy "listar fotos da própria pasta" on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'chat') and (storage.foldername(name))[1] = auth.uid()::text);

create policy "apagar fotos da própria pasta" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'chat', 'verificacoes') and (storage.foldername(name))[1] = auth.uid()::text);
