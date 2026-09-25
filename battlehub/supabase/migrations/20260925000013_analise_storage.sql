-- BattleHub: vídeos da análise de partida (Supabase Storage)
-- analises: vídeo que o suspeito manda (privado: só ele e a equipe veem). Até 50 MB, o limite do plano grátis.
-- Vídeo maior vai por link (Google Drive ou YouTube não listado).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('analises', 'analises', false, 52428800,
   array['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-matroska', 'video/x-msvideo'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "enviar vídeo de análise na própria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'analises' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "trocar vídeo de análise da própria pasta" on storage.objects for update to authenticated
  using (bucket_id = 'analises' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "ver vídeo de análise" on storage.objects for select to authenticated
  using (bucket_id = 'analises' and ((storage.foldername(name))[1] = auth.uid()::text or app.is_staff(auth.uid())));

create policy "apagar vídeo de análise da própria pasta" on storage.objects for delete to authenticated
  using (bucket_id = 'analises' and (storage.foldername(name))[1] = auth.uid()::text);
