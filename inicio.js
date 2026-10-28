// inicio.js — v1.0 — tela inicial do membro aprovado
(async function () {
  'use strict';
  const { sb, $, formacao, exigirLogin } = window.BASE;

  const { perfil } = await exigirLogin();
  if (perfil.status !== 'aprovado') { location.replace('verificacao.html'); return; }

  sb.rpc('registrar_acesso');
  const { data: souAdmin } = await sb.rpc('e_admin');
  if (souAdmin === true) $('linkAdmin').classList.remove('oculto');

  $('txtApelido').textContent = perfil.apelido;
  $('txtTipo').textContent = formacao(perfil);
  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');
})();
