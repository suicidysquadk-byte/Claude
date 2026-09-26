#!/usr/bin/env python3
"""Pesquisa de referências visuais.

Lê um pedido (battlehub/visual/pesquisa/<id>.json), busca imagens nas páginas e buscas listadas,
baixa, mede a qualidade técnica e monta miniaturas e folhas de contato numeradas para a análise visual.
Roda no GitHub Actions (que tem internet). O resultado sai como artifact de vida curta; nada é
guardado no repositório além do pedido.

Uso: python pesquisar.py <pedido.json> <pasta_saida>
"""
import concurrent.futures as cf
import hashlib
import html
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/128.0 Safari/537.36')
LOG = []


def log(*a):
    msg = ' '.join(str(x) for x in a)
    LOG.append(msg)
    print(msg, flush=True)


def baixar(url, limite=12_000_000, tempo=25, aceitar='*/*', ref=None):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA, 'Accept': aceitar, 'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8',
        **({'Referer': ref} if ref else {})})
    with urllib.request.urlopen(req, timeout=tempo) as r:
        dados = r.read(limite + 1)
        if len(dados) > limite:
            raise ValueError('grande demais')
        return dados, r.headers.get('Content-Type', ''), r.geturl()


def texto(url, **kw):
    dados, _, final = baixar(url, limite=6_000_000, aceitar='text/html,application/json;q=0.9,*/*;q=0.8', **kw)
    return dados.decode('utf-8', 'replace'), final


# ---------- fontes ----------

def meta(pagina, nome):
    for pad in (r'<meta[^>]+(?:property|name)=["\']%s["\'][^>]*content=["\']([^"\']+)' % re.escape(nome),
                r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\']%s["\']' % re.escape(nome)):
        m = re.search(pad, pagina, re.I)
        if m:
            return html.unescape(m.group(1))
    return None


def de_pagina(url):
    """Imagens de uma página: API do ArtStation quando der, senão og:image / twitter:image."""
    achados = []
    m = re.match(r'https?://(?:www\.)?artstation\.com/artwork/([A-Za-z0-9]+)', url)
    if m:
        try:
            j = json.loads(texto('https://www.artstation.com/projects/%s.json' % m.group(1), ref=url)[0])
            autor = (j.get('user') or {}).get('full_name')
            for a in (j.get('assets') or [])[:4]:
                if a.get('asset_type') == 'image' and a.get('image_url'):
                    achados.append({'imagem': a['image_url'], 'fonte': url, 'titulo': j.get('title'), 'autor': autor})
            if achados:
                return achados
        except Exception as e:
            log('  artstation api falhou', url, e)
    try:
        pag, final = texto(url)
    except Exception as e:
        log('  página falhou', url, e)
        return []
    titulo = meta(pag, 'og:title') or (re.search(r'<title>([^<]+)', pag) or [None, None])[1]
    autor = meta(pag, 'author') or meta(pag, 'twitter:creator')
    vistos = set()
    for nome in ('og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'):
        img = meta(pag, nome)
        if img and img not in vistos:
            vistos.add(img)
            achados.append({'imagem': urllib.parse.urljoin(final, img), 'fonte': url, 'titulo': titulo, 'autor': autor})
    # Dribbble e Behance põem as imagens grandes no HTML
    for img in re.findall(r'https://cdn\.dribbble\.com/userupload/[^"\'\s?]+\.(?:png|jpe?g|webp|gif)', pag)[:3]:
        if img not in vistos:
            vistos.add(img)
            achados.append({'imagem': img, 'fonte': url, 'titulo': titulo, 'autor': autor})
    for img in re.findall(r'https://mir-s3-cdn-cf\.behance\.net/project_modules/(?:1400|max_1200|fs)/[^"\'\s]+', pag)[:4]:
        if img not in vistos:
            vistos.add(img)
            achados.append({'imagem': img, 'fonte': url, 'titulo': titulo, 'autor': autor})
    return achados


def bing(consulta, n=14):
    url = ('https://www.bing.com/images/search?q=%s&qft=+filterui:imagesize-large&form=IRFLTR&first=1&setlang=en'
           % urllib.parse.quote(consulta))
    try:
        pag, _ = texto(url)
    except Exception as e:
        log('  bing falhou', consulta, e)
        return []
    achados = []
    for bruto in re.findall(r'\sm="(\{[^"]+\})"', pag):
        try:
            j = json.loads(html.unescape(bruto))
        except Exception:
            continue
        if j.get('murl'):
            achados.append({'imagem': j['murl'], 'reserva': j.get('turl'), 'fonte': j.get('purl') or j['murl'],
                            'titulo': j.get('t'), 'autor': None, 'consulta': consulta})
        if len(achados) >= n:
            break
    log('  bing', repr(consulta), len(achados))
    return achados


def dribbble(consulta, n=10):
    url = 'https://dribbble.com/search/%s' % urllib.parse.quote(consulta.replace(' ', '-'))
    try:
        pag, _ = texto(url)
    except Exception as e:
        log('  dribbble falhou', consulta, e)
        return []
    shots = []
    for s in re.findall(r'href="(/shots/\d+[^"#?]*)"', pag):
        if s not in shots:
            shots.append(s)
    achados = []
    for s in shots[:n]:
        for a in de_pagina('https://dribbble.com' + s)[:1]:
            a['consulta'] = consulta
            achados.append(a)
    log('  dribbble', repr(consulta), len(achados))
    return achados


def artstation(consulta, n=12):
    """Busca do ArtStation (pode ser bloqueada pelo Cloudflare; aí só registra)."""
    corpo = json.dumps({'query': consulta, 'page': 1, 'per_page': n, 'sorting': 'relevance',
                        'pro_first': '1', 'filters': [], 'additional_fields': []}).encode()
    req = urllib.request.Request('https://www.artstation.com/api/v2/search/projects.json', data=corpo, headers={
        'User-Agent': UA, 'Content-Type': 'application/json', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            j = json.loads(r.read().decode('utf-8', 'replace'))
    except Exception as e:
        log('  artstation busca falhou', consulta, e)
        return []
    achados = []
    for p in (j.get('data') or [])[:n]:
        img = ((p.get('smaller_square_cover_url') or '').replace('/smaller_square/', '/large/')
               or (p.get('cover') or {}).get('thumb_url'))
        if img:
            achados.append({'imagem': img, 'fonte': p.get('url'), 'titulo': p.get('title'),
                            'autor': (p.get('user') or {}).get('full_name'), 'consulta': consulta})
    log('  artstation', repr(consulta), len(achados))
    return achados


# ---------- métricas ----------

def metricas(img):
    rgb = img.convert('RGB')
    peq = rgb.copy()
    peq.thumbnail((512, 512))
    a = np.asarray(peq, dtype=np.float32)
    lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    lap = (-4 * lum[1:-1, 1:-1] + lum[:-2, 1:-1] + lum[2:, 1:-1] + lum[1:-1, :-2] + lum[1:-1, 2:])
    rg = a[..., 0] - a[..., 1]
    yb = 0.5 * (a[..., 0] + a[..., 1]) - a[..., 2]
    colorido = float(np.sqrt(rg.std() ** 2 + yb.std() ** 2) + 0.3 * np.sqrt(rg.mean() ** 2 + yb.mean() ** 2))
    q = peq.quantize(colors=6, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[:18]
    cont = sorted(q.getcolors(), reverse=True)
    paleta = ['#%02x%02x%02x' % tuple(pal[i * 3:i * 3 + 3]) for _, i in cont if i * 3 + 2 < len(pal)][:5]
    return {
        'largura': img.width, 'altura': img.height,
        'nitidez': round(float(lap.var()), 1),
        'contraste': round(float(lum.std()), 1),
        'brilho': round(float(lum.mean()), 1),
        'colorido': round(colorido, 1),
        'paleta': paleta,
    }


def dhash(img):
    g = img.convert('L').resize((9, 8), Image.Resampling.LANCZOS)
    a = np.asarray(g, dtype=np.int16)
    bits = (a[:, 1:] > a[:, :-1]).flatten()
    return int(''.join('1' if b else '0' for b in bits), 2)


def pre_nota(m, req):
    """Nota técnica de 0 a 10 (só filtra; a nota real vem da análise visual)."""
    lado = min(m['largura'], m['altura'])
    n = 0.0
    n += min(lado / 1000, 1) * 3
    n += min(m['nitidez'] / 400, 1) * 3
    n += min(m['contraste'] / 70, 1) * 2
    n += min(m['colorido'] / 60, 1) * 2
    if lado < req['lado_minimo_px'] or m['nitidez'] < req['nitidez_minima'] or m['contraste'] < req['contraste_minimo']:
        n -= 3
    return round(max(n, 0), 2)


# ---------- saída ----------

def fonte_ttf(tam):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, tam)
    return ImageFont.load_default()


def folhas(itens, pasta, por=20, col=5, lado=300):
    os.makedirs(pasta, exist_ok=True)
    f = fonte_ttf(28)
    for k in range(0, len(itens), por):
        grupo = itens[k:k + por]
        lin = (len(grupo) + col - 1) // col
        tela = Image.new('RGB', (col * lado, lin * lado), (24, 24, 30))
        d = ImageDraw.Draw(tela)
        for i, it in enumerate(grupo):
            im = Image.open(it['_mini']).convert('RGB')
            im = ImageOps.contain(im, (lado - 8, lado - 8))
            x, y = (i % col) * lado, (i // col) * lado
            tela.paste(im, (x + (lado - im.width) // 2, y + (lado - im.height) // 2))
            d.rectangle([x + 4, y + 4, x + 64, y + 40], fill=(0, 0, 0))
            d.text((x + 10, y + 6), str(it['n']), fill=(255, 220, 80), font=f)
        tela.save(os.path.join(pasta, 'folha-%02d.jpg' % (k // por + 1)), quality=86)


def principal(pedido_path, saida):
    t0 = time.time()
    pedido = json.load(open(pedido_path, encoding='utf-8'))
    qual = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'qualidade.json'), encoding='utf-8'))
    req = qual['metricas_automaticas']
    rej_path = os.path.join(os.path.dirname(os.path.abspath(pedido_path)), 'rejeitadas.json')
    rejeitadas = set(json.load(open(rej_path)) if os.path.exists(rej_path) else [])
    os.makedirs(os.path.join(saida, 'miniaturas'), exist_ok=True)
    log('pedido', pedido.get('id'), '-', pedido.get('formato'))

    cand = []
    for url in pedido.get('paginas', []):
        cand += de_pagina(url)
    for q in pedido.get('buscas', []):
        cand += bing(q, pedido.get('por_busca', 14))
    for q in pedido.get('dribbble', []):
        cand += dribbble(q)
    for q in pedido.get('artstation', []):
        cand += artstation(q)
    vistos, unicos = set(), []
    for c in cand:
        chave = c['imagem'].split('?')[0]
        if chave in vistos or c['imagem'] in rejeitadas or c.get('fonte') in rejeitadas:
            continue
        vistos.add(chave)
        unicos.append(c)
    log('candidatos', len(cand), 'únicos', len(unicos))

    def processa(c):
        for url in [c['imagem']] + ([c['reserva']] if c.get('reserva') else []):
            try:
                dados, tipo, _ = baixar(url, ref=c.get('fonte'))
                img = Image.open(io.BytesIO(dados))
                img.seek(0)
                img.load()
                if img.mode in ('P', 'LA', 'RGBA'):
                    fundo = Image.new('RGBA', img.size, (22, 22, 28, 255))
                    img = Image.alpha_composite(fundo, img.convert('RGBA')).convert('RGB')
                m = metricas(img)
                m['origem'] = 'reserva' if url != c['imagem'] else 'original'
                return c, img, m, hashlib.sha1(dados).hexdigest()[:12]
            except Exception as e:
                log('  imagem falhou', url[:120], type(e).__name__, str(e)[:80])
        return c, None, None, None

    itens, hashes = [], []
    with cf.ThreadPoolExecutor(8) as ex:
        for c, img, m, sha in ex.map(processa, unicos):
            if img is None:
                continue
            h = dhash(img)
            if any(bin(h ^ o).count('1') <= 6 for o in hashes):
                continue
            hashes.append(h)
            c.update(metricas=m, sha=sha, pre_nota=pre_nota(m, req))
            c['_img'] = img
            itens.append(c)

    itens.sort(key=lambda c: -c['pre_nota'])
    itens = itens[:pedido.get('maximo', 80)]
    for n, c in enumerate(itens, 1):
        c['n'] = n
        mini = ImageOps.contain(c.pop('_img').convert('RGB'), (720, 720))
        c['_mini'] = os.path.join(saida, 'miniaturas', '%03d.jpg' % n)
        mini.save(c['_mini'], quality=85)
    folhas(itens, os.path.join(saida, 'folhas'))
    for c in itens:
        c['miniatura'] = os.path.relpath(c.pop('_mini'), saida)
    json.dump({'pedido': pedido, 'gerado_em': time.strftime('%Y-%m-%d %H:%M'), 'itens': itens},
              open(os.path.join(saida, 'candidatos.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    log('prontos', len(itens), 'em %.0fs' % (time.time() - t0))
    open(os.path.join(saida, 'log.txt'), 'w', encoding='utf-8').write('\n'.join(LOG))


if __name__ == '__main__':
    principal(sys.argv[1], sys.argv[2])
