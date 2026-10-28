// perfil.js — v1.0 — ver o perfil de outro membro
(async function () {
  'use strict';
  const { sb, $, msg, formacao, idades, visto, links, definirMarca, fotoProtegida, gradeFotos,
          menu, exigirLogin } = window.BASE;

  const { perfil: eu } = await exigirLogin();
  if (eu.status !== 'aprovado') { location.replace('verificacao.html'); return; }
  definirMarca(eu);
  menu(eu);

  const id = new URLSearchParams(location.search).get('id') || '';
  if (id === eu.id) { location.replace('meu-perfil.html'); return; }
  $('carregando').classList.add('oculto');
  if (!/^[0-9a-f-]{36}$/i.test(id)) { $('naoAchado').classList.remove('oculto'); return; }

  const { data: p } = await sb.from('perfis_publicos')
    .select('id, apelido, tipo, sexo_1, sexo_2, idade_1, idade_2, cidade, uf, bio, procura, foto_perfil, ultimo_acesso')
    .eq('id', id).maybeSingle();
  if (!p) { $('naoAchado').classList.remove('oculto'); return; }

  document.title = p.apelido + ' · ' + window.APP.NOME;
  $('txtApelido').textContent = p.apelido;
  $('txtTipo').textContent = formacao(p) + ' · ' + idades(p);
  $('txtCidade').textContent = p.cidade + ' / ' + p.uf;
  $('txtVisto').textContent = visto(p.ultimo_acesso);
  $('txtBio').textContent = p.bio || '';
  if (p.procura && p.procura.length) {
    const PLURAL = { casal: 'Casais', solteira: 'Solteiras', solteiro: 'Solteiros' };
    $('txtProcura').textContent = p.procura.map(t => PLURAL[t] || t).join(', ');
    $('blocoProcura').classList.remove('oculto');
  }
  if (p.foto_perfil) {
    const u = await links([p.foto_perfil]);
    if (u[p.foto_perfil]) { $('avatar').textContent = ''; $('avatar').appendChild(fotoProtegida(u[p.foto_perfil], { cortar: true, largura: 300 })); }
  }
  $('tela').classList.remove('oculto');

  // ---------- Fotos públicas ----------
  const { data: publicas } = await sb.from('fotos').select('caminho, album')
    .eq('dono', id).eq('album', 'publico').order('criado_em', { ascending: false });
  if (publicas && publicas.length) await gradeFotos($('gradePublica'), publicas);
  else $('semFotos').classList.remove('oculto');

  // ---------- Álbum privado ----------
  async function mostrarAlbum() {
    msg('mAlbum');
    const { data: acesso } = await sb.rpc('tem_acesso_album', { p_dono: id });
    $('albumLiberado').classList.toggle('oculto', acesso !== true);
    $('albumFechado').classList.toggle('oculto', acesso === true);
    if (acesso === true) {
      const { data: priv } = await sb.from('fotos').select('caminho, album')
        .eq('dono', id).eq('album', 'privado').order('criado_em', { ascending: false });
      if (priv && priv.length) await gradeFotos($('gradePrivada'), priv);
      $('albumVazio').classList.toggle('oculto', !!(priv && priv.length));
      return;
    }
    const { data: ped } = await sb.from('album_pedidos').select('status')
      .eq('dono', id).eq('solicitante', eu.id).maybeSingle();
    $('bPedir').classList.toggle('oculto', !!ped && ped.status === 'pendente');
    $('bCancelarPedido').classList.toggle('oculto', !ped || ped.status !== 'pendente');
    $('txtAlbum').textContent = !ped ? 'Só quem o membro liberar consegue ver.'
      : ped.status === 'pendente' ? 'Pedido enviado. Aguardando o membro responder.'
      : 'O membro não liberou o álbum por enquanto. Você pode pedir de novo.';
  }

  $('bPedir').addEventListener('click', async () => {
    $('bPedir').disabled = true;
    await sb.from('album_pedidos').delete().eq('dono', id).eq('solicitante', eu.id); // limpa recusa antiga
    const { error } = await sb.from('album_pedidos').insert({ dono: id, solicitante: eu.id });
    $('bPedir').disabled = false;
    if (error) { msg('mAlbum', 'erro', 'Não foi possível enviar o pedido.'); return; }
    mostrarAlbum();
  });
  $('bCancelarPedido').addEventListener('click', async () => {
    await sb.from('album_pedidos').delete().eq('dono', id).eq('solicitante', eu.id);
    mostrarAlbum();
  });
  mostrarAlbum();

  // ---------- Bloquear ----------
  $('bBloquear').addEventListener('click', () => {
    $('caixaDenuncia').classList.add('oculto');
    $('caixaBloquear').classList.toggle('oculto');
  });
  $('bConfirmaBloqueio').addEventListener('click', async () => {
    $('bConfirmaBloqueio').disabled = true;
    const { error } = await sb.from('bloqueios').insert({ quem: eu.id, bloqueado: id });
    if (error && !/duplicate/i.test(error.message)) {
      $('bConfirmaBloqueio').disabled = false;
      msg('mAcoes', 'erro', 'Não foi possível bloquear.'); return;
    }
    location.replace('inicio.html');
  });

  // ---------- Denunciar ----------
  $('bDenunciar').addEventListener('click', () => {
    $('caixaBloquear').classList.add('oculto');
    $('caixaDenuncia').classList.toggle('oculto');
  });
  $('bEnviarDenuncia').addEventListener('click', async () => {
    const motivo = $('dMotivo').value;
    if (!motivo) { msg('mAcoes', 'erro', 'Escolha o motivo.'); return; }
    $('bEnviarDenuncia').disabled = true;
    const { error } = await sb.from('denuncias').insert({
      denunciante: eu.id, alvo: id, motivo, detalhes: $('dDetalhes').value.trim() || null
    });
    $('bEnviarDenuncia').disabled = false;
    if (error) {
      msg('mAcoes', /duplicate/i.test(error.message) ? 'info' : 'erro',
        /duplicate/i.test(error.message) ? 'Você já denunciou este perfil por esse motivo. A administração está analisando.'
                                          : 'Não foi possível enviar a denúncia.');
      return;
    }
    $('caixaDenuncia').classList.add('oculto');
    msg('mAcoes', 'ok', 'Denúncia enviada. Obrigado por ajudar a manter a comunidade segura.');
  });
})();
