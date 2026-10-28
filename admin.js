// admin.js — v1.0 — aprovar ou recusar verificações
(async function () {
  'use strict';
  const { sb, $, idade, dataBR, formacao, exigirLogin } = window.BASE;

  await exigirLogin();
  const { data: souAdmin } = await sb.rpc('e_admin');
  $('carregando').classList.add('oculto');
  if (souAdmin !== true) { $('negado').classList.remove('oculto'); return; }
  $('painel').classList.remove('oculto');

  function resultado(card, tipo, texto) {
    const r = card.querySelector('.resultado');
    r.className = 'msg resultado ' + tipo; r.textContent = texto;
  }

  async function apagarFotos(fotos) {
    if (fotos && fotos.length) await sb.storage.from('verificacoes').remove(fotos);
  }

  async function carregar() {
    $('lista').innerHTML = '';
    $('vazio').classList.add('oculto');
    const { data, error } = await sb.from('verificacoes')
      .select('id, codigo, fotos, criado_em, perfil, perfis(apelido, tipo, sexo_1, sexo_2, nascimento_1, nascimento_2, cidade, uf)')
      .eq('status', 'enviada')
      .order('criado_em', { ascending: true });
    if (error) { $('lista').textContent = 'Erro ao carregar: ' + error.message; return; }

    $('qtd').textContent = data.length;
    if (!data.length) { $('vazio').classList.remove('oculto'); return; }

    for (const v of data) {
      const p = v.perfis || {};
      const card = $('modelo').content.firstElementChild.cloneNode(true);
      card.querySelector('.apelido').textContent = p.apelido || '(sem perfil)';
      card.querySelector('.tipo').textContent = formacao(p);
      card.querySelector('.codigoTxt').textContent = v.codigo;
      card.querySelector('.nasc1').textContent = dataBR(p.nascimento_1) + ' (' + idade(p.nascimento_1) + ' anos)';
      if (p.tipo === 'casal') {
        card.querySelector('.nasc2').textContent = dataBR(p.nascimento_2) + ' (' + idade(p.nascimento_2) + ' anos)';
      } else {
        card.querySelectorAll('.r2').forEach(e => e.remove());
      }
      card.querySelector('.cidade').textContent = (p.cidade || '') + ' / ' + (p.uf || '');
      card.querySelector('.enviado').textContent = new Date(v.criado_em).toLocaleString('pt-BR');

      // Fotos com link temporário (pasta privada)
      const grade = card.querySelector('.fotos');
      if (v.fotos && v.fotos.length) {
        const { data: links } = await sb.storage.from('verificacoes').createSignedUrls(v.fotos, 600);
        (links || []).forEach(l => {
          if (!l.signedUrl) return;
          const a = document.createElement('a');
          a.href = l.signedUrl; a.target = '_blank'; a.rel = 'noopener noreferrer';
          const img = document.createElement('img');
          img.src = l.signedUrl; img.alt = l.path.split('-').pop();
          a.appendChild(img); grade.appendChild(a);
        });
      }

      const botoes = card.querySelectorAll('button');
      const travar = (sim) => botoes.forEach(b => { b.disabled = sim; });

      card.querySelector('.aprovar').addEventListener('click', async () => {
        travar(true);
        const { error } = await sb.rpc('analisar_verificacao', { p_id: v.id, p_aprovar: true, p_motivo: null });
        if (error) { travar(false); resultado(card, 'erro', error.message); return; }
        await apagarFotos(v.fotos);
        resultado(card, 'ok', 'Aprovado ✓ — fotos de verificação apagadas.');
        card.querySelector('.acoes').remove(); card.querySelector('.caixaRecusa').remove();
        $('qtd').textContent = Math.max(0, Number($('qtd').textContent) - 1);
      });

      card.querySelector('.recusar').addEventListener('click', () => {
        card.querySelector('.caixaRecusa').classList.toggle('oculto');
      });

      card.querySelector('.confirmar').addEventListener('click', async () => {
        const valor = card.querySelector('.motivo').value;
        if (!valor) { resultado(card, 'erro', 'Escolha o motivo.'); return; }
        const banir = valor.startsWith('BANIR:');
        const motivo = banir ? valor.slice(6) : valor;
        travar(true);
        const { error } = await sb.rpc('analisar_verificacao', { p_id: v.id, p_aprovar: false, p_motivo: motivo });
        if (error) { travar(false); resultado(card, 'erro', error.message); return; }
        if (banir) {
          // Guarda as fotos como prova e encerra a conta
          const { error: e2 } = await sb.from('perfis').update({ status: 'banido' }).eq('id', v.perfil);
          resultado(card, e2 ? 'erro' : 'ok', e2 ? 'Recusado, mas não consegui banir: ' + e2.message
            : 'Recusado e BANIDO. As fotos foram guardadas como prova.');
        } else {
          await apagarFotos(v.fotos);
          resultado(card, 'ok', 'Recusado. O membro vai ver o motivo e pode tentar de novo.');
        }
        card.querySelector('.acoes').remove(); card.querySelector('.caixaRecusa').remove();
        $('qtd').textContent = Math.max(0, Number($('qtd').textContent) - 1);
      });

      $('lista').appendChild(card);
    }
  }

  $('bAtualizar').addEventListener('click', carregar);
  carregar();
})();
