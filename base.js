// base.js — v1.1 — conexão com o banco e funções usadas por todas as telas internas
(function () {
  'use strict';
  const A = window.APP || {};
  if (!window.supabase || !A.SUPABASE_URL) {
    document.body.textContent = 'Site não configurado (config.js).';
    throw new Error('sem config');
  }
  const sb = window.supabase.createClient(A.SUPABASE_URL, A.SUPABASE_CHAVE_PUBLICA, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  const $ = (id) => document.getElementById(id);

  function msg(id, tipo, texto) {
    const el = $(id); if (!el) return;
    el.className = 'msg ' + (tipo || '');
    el.textContent = texto || '';
  }

  function idade(dataISO) {
    if (!dataISO) return null;
    const n = new Date(dataISO + 'T12:00:00'), h = new Date();
    let i = h.getFullYear() - n.getFullYear();
    const m = h.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && h.getDate() < n.getDate())) i--;
    return i;
  }

  function dataBR(dataISO) {
    if (!dataISO) return '';
    const [a, m, d] = String(dataISO).slice(0, 10).split('-');
    return d + '/' + m + '/' + a;
  }

  const NOME_TIPO = { casal: 'Casal', solteira: 'Solteira', solteiro: 'Solteiro' };
  function formacao(p) {
    if (p.tipo !== 'casal') return NOME_TIPO[p.tipo] || p.tipo;
    const n = (s) => s === 'M' ? 'Ele' : 'Ela';
    return 'Casal (' + n(p.sexo_1) + ' e ' + n(p.sexo_2) + ')';
  }

  // Exige login. Devolve { user, perfil } ou manda para a tela de entrar.
  async function exigirLogin() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { location.replace('entrar.html'); throw new Error('sem login'); }
    const { data: perfil } = await sb.from('perfis')
      .select('id, numero, apelido, tipo, sexo_1, sexo_2, status, verificado, foto_perfil, cidade, uf, bio, procura')
      .eq('id', user.id).maybeSingle();
    if (!perfil) { await sair(); throw new Error('sem perfil'); }
    return { user, perfil };
  }

  async function sair() {
    await sb.auth.signOut();
    location.replace('entrar.html');
  }

  // Reduz a foto, tira dados escondidos (GPS, modelo do celular) e devolve JPEG
  async function prepararFoto(arquivo) {
    if (!arquivo || !/^image\//.test(arquivo.type)) throw new Error('Envie apenas fotos (JPG ou PNG).');
    if (arquivo.size > 25 * 1024 * 1024) throw new Error('Foto muito grande.');
    const url = URL.createObjectURL(arquivo);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const max = 1600;
      const escala = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * escala);
      c.height = Math.round(img.naturalHeight * escala);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
      if (!blob) throw new Error('Não consegui ler esta foto. Tente outra.');
      return blob;
    } catch (e) {
      throw new Error(e && e.message && !/decode/i.test(e.message) ? e.message
        : 'Não consegui ler esta foto. Tire um print dela ou use outra.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }


  // ---------- Fotos protegidas ----------
  // Links temporários (1 hora) para arquivos da pasta privada "fotos"
  const cacheLinks = {};
  async function links(caminhos) {
    const faltam = [...new Set(caminhos.filter(c => c && !cacheLinks[c]))];
    if (faltam.length) {
      const { data } = await sb.storage.from('fotos').createSignedUrls(faltam, 3600);
      (data || []).forEach(d => { if (d.signedUrl) cacheLinks[d.path] = d.signedUrl; });
    }
    const r = {};
    caminhos.forEach(c => { if (cacheLinks[c]) r[c] = cacheLinks[c]; });
    return r;
  }

  // Desenha a foto num quadro com a marca d'água de QUEM ESTÁ VENDO (nº + apelido).
  // Se alguém vazar um print, dá para saber de quem foi.
  let marcaTexto = '';
  function definirMarca(perfil) { marcaTexto = 'nº ' + perfil.numero + ' · ' + perfil.apelido; }

  function fotoProtegida(url, opcoes) {
    const o = Object.assign({ largura: 900, cortar: false, alt: '' }, opcoes || {});
    const c = document.createElement('canvas');
    c.className = 'foto-protegida';
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', o.alt || 'Foto');
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('dragstart', e => e.preventDefault());
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight, sx = 0, sy = 0, sw = w, sh = h;
      if (o.cortar) {                 // quadrado (miniaturas)
        const lado = Math.min(w, h); sx = (w - lado) / 2; sy = (h - lado) / 2; sw = sh = lado;
        w = h = Math.min(o.largura, lado);
      } else {
        const esc = Math.min(1, o.largura / w); w = Math.round(w * esc); h = Math.round(h * esc);
      }
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      if (marcaTexto) {
        const fonte = Math.max(11, Math.round(w / 26));
        g.save();
        g.font = '600 ' + fonte + 'px Inter, Helvetica, sans-serif';
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.strokeStyle = 'rgba(0,0,0,0.18)';
        g.lineWidth = 1;
        g.translate(w / 2, h / 2); g.rotate(-Math.PI / 6);
        const passoX = g.measureText(marcaTexto).width + fonte * 3, passoY = fonte * 4;
        const lim = Math.hypot(w, h);
        for (let y = -lim; y < lim; y += passoY) {
          for (let x = -lim + ((y / passoY) % 2 ? passoX / 2 : 0); x < lim; x += passoX) {
            g.strokeText(marcaTexto, x, y); g.fillText(marcaTexto, x, y);
          }
        }
        g.restore();
      }
    };
    img.src = url;
    return c;
  }

  // "online agora", "visto hoje"…
  function visto(dataISO) {
    if (!dataISO) return '';
    const min = (Date.now() - new Date(dataISO).getTime()) / 60000;
    if (min < 15) return '🟢 online agora';
    if (min < 60 * 24) return 'visto hoje';
    if (min < 60 * 24 * 7) return 'visto esta semana';
    return 'visto há mais de uma semana';
  }

  function idades(p) {
    return p.tipo === 'casal' ? (p.idade_1 + ' e ' + p.idade_2 + ' anos') : (p.idade_1 + ' anos');
  }

  const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

  // Menu do topo: mostra "Admin" para a administração e o nº de pedidos de álbum pendentes
  async function menu(perfil) {
    const pag = location.pathname.split('/').pop() || 'inicio.html';
    document.querySelectorAll('.menu a').forEach(a => { if (a.getAttribute('href') === pag) a.classList.add('ativo'); });
    const { data: adm } = await sb.rpc('e_admin');
    const la = document.getElementById('linkAdmin');
    if (la && adm === true) la.classList.remove('oculto');
    const { count } = await sb.from('album_pedidos').select('solicitante', { count: 'exact', head: true })
      .eq('dono', perfil.id).eq('status', 'pendente');
    const c = document.getElementById('cPedidos');
    if (c && count) { c.textContent = count; c.className = 'contador'; }
    return adm === true;
  }

  // Abre a foto em tela cheia (com marca d'água)
  function abrirVisor(url) {
    const v = document.createElement('div'); v.className = 'visor';
    const fechar = document.createElement('button'); fechar.className = 'fechar'; fechar.type = 'button'; fechar.textContent = '✕ Fechar';
    const fim = () => { v.remove(); document.removeEventListener('keydown', tecla); };
    const tecla = (e) => { if (e.key === 'Escape') fim(); };
    fechar.addEventListener('click', fim);
    v.addEventListener('click', (e) => { if (e.target === v) fim(); });
    document.addEventListener('keydown', tecla);
    v.append(fotoProtegida(url, { largura: 1400 }), fechar);
    document.body.appendChild(v);
  }

  // Monta uma grade de miniaturas. fotos = [{caminho, album, ...}]
  async function gradeFotos(container, fotos, opcoes) {
    const o = opcoes || {};
    container.innerHTML = '';
    const urls = await links(fotos.map(f => f.caminho));
    fotos.forEach(f => {
      if (!urls[f.caminho]) return;
      const item = document.createElement('div'); item.className = 'item';
      item.appendChild(fotoProtegida(urls[f.caminho], { cortar: true, largura: 360 }));
      if (o.etiqueta) { const e = o.etiqueta(f); if (e) { const t = document.createElement('span'); t.className = 'etiqueta'; t.textContent = e; item.appendChild(t); } }
      item.addEventListener('click', () => (o.aoClicar ? o.aoClicar(f, urls[f.caminho]) : abrirVisor(urls[f.caminho])));
      container.appendChild(item);
    });
  }

  window.BASE = { sb, $, msg, idade, dataBR, formacao, exigirLogin, sair, prepararFoto,
                  links, definirMarca, menu, abrirVisor, gradeFotos, fotoProtegida, visto, idades, UFS, NOME_TIPO, NOME: A.NOME };

  // Nome da comunidade no topo e no título
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-nome-app]').forEach(el => { el.textContent = A.NOME; });
    if (document.title.indexOf('·') < 0) document.title = document.title + ' · ' + A.NOME;
    const bSair = document.getElementById('bSair');
    if (bSair) bSair.addEventListener('click', sair);
  });
})();
