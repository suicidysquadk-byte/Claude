-- O Supabase bloqueia DELETE/UPDATE sem WHERE (extensão safeupdate) nas chamadas do app. Algumas funções limpavam
-- tabelas temporárias assim e davam "DELETE requires a WHERE clause": prévia/pagamento da sala (roleta do
-- Player Rei e sorteio), pagamento de evento, divisão do cofre da guilda, ranking e palavras proibidas.
-- Aqui cada função atual é regravada com "where true" nesses comandos (o resto do código fica igual).
do $$
declare f record; v_def text; v_new text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'app') and p.prokind = 'f'
       and p.proname in ('compute_payout', 'event_payout', 'admin_banned_words_set', 'guild_payout_plan', 'rankings')
  loop
    v_def := pg_get_functiondef(f.oid);
    v_new := regexp_replace(v_def, '(delete\s+from\s+[a-z_.]+)\s*;', '\1 where true;', 'gi');
    v_new := regexp_replace(v_new, '(update\s+_plan\s+set\s+score\s*=[^;]*?)\s*;', '\1 where true;', 'gi');
    if v_new is distinct from v_def then execute v_new; end if;
  end loop;
end $$;
