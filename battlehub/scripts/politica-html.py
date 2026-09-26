# Gera loja/politica-de-privacidade.html a partir do .md (página pública para a Play Store).
# Uso: python3 scripts/politica-html.py
import html, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
md = (root / 'loja' / 'politica-de-privacidade.md').read_text(encoding='utf-8').splitlines()

def inline(t):
    t = html.escape(t, quote=True)
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    t = re.sub(r'(?<![*\w])\*(.+?)\*(?!\w)', r'<i>\1</i>', t)
    return t

out, para, items, quote = [], [], [], []
def flush():
    global para, items, quote
    if para: out.append('<p>' + inline(' '.join(para)) + '</p>'); para = []
    if items: out.append('<ul>' + ''.join('<li>' + inline(i) + '</li>' for i in items) + '</ul>'); items = []
    if quote: out.append('<blockquote>' + inline(' '.join(quote)) + '</blockquote>'); quote = []
for line in md:
    s = line.strip()
    if not s: flush(); continue
    if s.startswith('# '): flush(); out.append('<h1>' + inline(s[2:]) + '</h1>'); continue
    if s.startswith('## '): flush(); out.append('<h2>' + inline(s[3:]) + '</h2>'); continue
    if s.startswith('>'): continue  # nota interna do modelo, não vai para a página pública
    if s.startswith('- '):
        if para: flush()
        items.append(s[2:]); continue
    if items and line.startswith('  '): items[-1] += ' ' + s; continue
    if items: flush()
    para.append(s)
flush()
head = ('<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<title>Política de privacidade · BattleHub</title>\n<style>\n'
        ':root{color-scheme:dark}body{margin:0;background:#0a0910;color:#f2effa;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}\n'
        'main{max-width:760px;margin:0 auto;padding:32px 20px 64px}h1{font-size:28px;line-height:1.2}h2{font-size:19px;margin-top:32px;color:#ffd98a}\n'
        'p,li{color:#cdc7e0}b{color:#f2effa}ul{padding-left:20px}li{margin:4px 0}blockquote{margin:0;padding:10px 14px;border-left:3px solid #ffd98a;color:#cdc7e0}\n'
        '</style></head><body><main>\n')
(root / 'loja' / 'politica-de-privacidade.html').write_text(head + '\n'.join(out) + '\n</main></body></html>\n', encoding='utf-8')
print('ok')
