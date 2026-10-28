// base.js — v1.0 — conexão com o banco e funções usadas por todas as telas internas
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
      .select('id, apelido, tipo, sexo_1, sexo_2, status, verificado')
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

  window.BASE = { sb, $, msg, idade, dataBR, formacao, exigirLogin, sair, prepararFoto, NOME: A.NOME };

  // Nome da comunidade no topo e no título
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-nome-app]').forEach(el => { el.textContent = A.NOME; });
    if (document.title.indexOf('·') < 0) document.title = document.title + ' · ' + A.NOME;
    const bSair = document.getElementById('bSair');
    if (bSair) bSair.addEventListener('click', sair);
  });
})();
