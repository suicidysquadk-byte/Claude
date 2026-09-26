-- BattleHub: fotos e áudios das conversas privadas (Supabase Storage)
-- Caminho: <quem mandou>/<id da conversa>/<arquivo>. Só os dois da conversa abrem; a equipe só com acesso
-- excepcional aberto (motivo registrado, vale 24 horas). As fotos antigas continuam no balde público "chat".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('conversas', 'conversas', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a', 'audio/wav'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "enviar arquivo na própria conversa" on storage.objects for insert to authenticated
  with check (bucket_id = 'conversas' and (storage.foldername(name))[1] = auth.uid()::text
    and app.in_thread(((storage.foldername(name))[2])::uuid, auth.uid()));

create policy "ver arquivo da conversa" on storage.objects for select to authenticated
  using (bucket_id = 'conversas' and app.chat_can_read(((storage.foldername(name))[2])::uuid, auth.uid()));

create policy "apagar arquivo que eu mandei" on storage.objects for delete to authenticated
  using (bucket_id = 'conversas' and (storage.foldername(name))[1] = auth.uid()::text);

grant execute on function app.in_thread(uuid, uuid) to authenticated;
