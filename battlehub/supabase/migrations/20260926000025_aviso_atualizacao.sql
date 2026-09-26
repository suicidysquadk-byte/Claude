-- Aviso fixado para quem tem um APK antigo (sem o atualizador automático): baixar o instalador novo uma única vez.
-- A partir da 2.10.0 o app se atualiza sozinho. Roda uma vez só (não repete se o aviso já existir).
do $$
declare
  v_title text := 'Nova versão do BattleHub: instale uma única vez';
  v_body text := 'Baixe o app novo em https://tjaqjirsayclexzaycti.supabase.co/storage/v1/object/public/app/BattleHub.apk'
    || ' — se o celular não deixar instalar por cima, desinstale o BattleHub antigo e instale o novo (sua conta, saldo e itens ficam salvos no servidor, é só entrar de novo).'
    || ' Depois disso as próximas atualizações chegam sozinhas, sem precisar baixar nada.';
  v_n int;
begin
  if exists (select 1 from public.announcements where title = v_title) then return; end if;
  insert into public.notifications (user_id, kind, title, body)
    select id, 'aviso', v_title, v_body from public.profiles where coalesce(banned_until, '-infinity') <= now();
  get diagnostics v_n = row_count;
  update public.announcements set pinned = false where pinned;
  insert into public.announcements (title, body, target, pinned, reach) values (v_title, v_body, 'todos', true, v_n);
end $$;
