// inicio.js — v1.1 — lista de membros com filtro por tipo e estado
(async function () {
  'use strict';
  const { sb, $, formacao, idades, visto, links, definirMarca, fotoProtegida, menu, exigirLogin, UFS } = window.BASE;

  const { perfil } = await exigirLogin();
  if (perfil.status !== 'aprovado') { location.replace('verificacao.html'); return; }
  definirMarca(perfil);
  sb.rpc('registrar_acesso');
  menu(perfil);

  $('txtApelido').textContent = perfil.apelido;
  if (!perfil.foto_perfil) {
    $('txtAviso').innerHTML = 'Dica: perfis com foto recebem muito mais visitas. <a href="meu-perfil.html" style="color:var(--rosa2)">Coloque a sua</a>.';
  }
  UFS.forEach(u => { const o = document.createElement('option'); o.value = u; o.textContent = u; $('fUf').appendChild(o); });
  try { const salvo = localStorage.getItem('filtroUf'); if (salvo) $('fUf').value = salvo; } catch (e) {}

  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');

  const POR_PAGINA = 40;
  let pagina = 0;

  async function carregar(reiniciar) {
    if (reiniciar) { pagina = 0; $('lista').innerHTML = ''; }
    $('bMais').classList.add('oculto');
    let q = sb.from('perfis_publicos')
      .select('id, apelido, tipo, sexo_1, sexo_2, idade_1, idade_2, cidade, uf, foto_perfil, ultimo_acesso')
      .neq('id', perfil.id)
      .order('ultimo_acesso', { ascending: false, nullsFirst: false })
      .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
    if ($('fTipo').value) q = q.eq('tipo', $('fTipo').value);
    if ($('fUf').value) q = q.eq('uf', $('fUf').value);
    const { data, error } = await q;
    if (error) { $('lista').textContent = 'Erro ao carregar membros.'; return; }

    $('vazio').classList.toggle('oculto', !(reiniciar && data.length === 0));
    const urls = await links(data.map(p => p.foto_perfil).filter(Boolean));

    data.forEach(p => {
      const a = document.createElement('a');
      a.className = 'membro';
      a.href = 'perfil.html?id=' + encodeURIComponent(p.id);
      const capa = document.createElement('div'); capa.className = 'capa';
      if (p.foto_perfil && urls[p.foto_perfil]) capa.appendChild(fotoProtegida(urls[p.foto_perfil], { cortar: true, largura: 400, alt: p.apelido }));
      else capa.textContent = p.tipo === 'casal' ? '💑' : (p.tipo === 'solteira' ? '👩' : '👨');
      const info = document.createElement('div'); info.className = 'info';
      const b = document.createElement('b'); b.textContent = p.apelido;
      const s1 = document.createElement('span'); s1.textContent = formacao(p) + ' · ' + idades(p);
      const s2 = document.createElement('span'); s2.textContent = p.cidade + ' / ' + p.uf;
      const s3 = document.createElement('span'); s3.textContent = visto(p.ultimo_acesso);
      info.append(b, s1, s2, s3);
      a.append(capa, info);
      $('lista').appendChild(a);
    });
    if (data.length === POR_PAGINA) $('bMais').classList.remove('oculto');
  }

  $('fTipo').addEventListener('change', () => carregar(true));
  $('fUf').addEventListener('change', () => {
    try { localStorage.setItem('filtroUf', $('fUf').value); } catch (e) {}
    carregar(true);
  });
  $('bMais').addEventListener('click', () => { pagina++; carregar(false); });
  carregar(true);
})();
