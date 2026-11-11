// Olho de Deus: inteligência de mercado. Abas (visão, alertas, empresas, movimentos, histórico, ajustes) e o detalhe
// de empresa ou movimento num painel ao lado. Tudo vem do servidor (coleta programada); nada de demonstração.
import { $, abrirJanela, api, aviso, esc, ha, IC, quando } from './base.js?v=w8';

export const titulo = 'Olho de Deus';
const O = { aba: 'visao', cfg: null, admin: false, empresas: [], fEmp: { categoria: '', segmento: '', q: '' }, fMov: { relevancia: '', filtro: '', dias: '30', segmento: '', categoria: '' }, fAl: { nivel: '', nao_lidos: '1' }, lado: null };
const ABAS = [['visao', 'Visão geral', 'grafico'], ['alertas', 'Alertas', 'alerta'], ['empresas', 'Empresas', 'predio'], ['movimentos', 'Movimentos', 'pulso'], ['historico', 'Histórico', 'historico'], ['ajustes', 'Ajustes', 'ajustes']];
const NIVEL = { critico: 'Crítico', alto: 'Alto', medio: 'Médio', baixo: 'Baixo' };
const CAT = { concorrente: 'Concorrente', similar: 'Similar', candidata: 'Em análise', descartada: 'Descartada' };
const TIPO_MOV = { produto: 'Produto', preco_taxa: 'Preço/taxa', parceria: 'Parceria', expansao: 'Expansão', campanha: 'Campanha', estrategia: 'Estratégia', infraestrutura: 'Infraestrutura', regulatorio: 'Regulação', mercado: 'Mercado', oportunidade: 'Oportunidade' };
const TIPO_EXEC = { empresa: 'Empresa', setor: 'Setor', regulatorio: 'Regulação', descoberta: 'Novas empresas' };
const PASSO = { inicio: 'na fila', pesquisar: 'pesquisando', extrair: 'estruturando', analisar: 'analisando', gravar: 'gravando', fim: 'concluída' };
const CAMPOS = [['identificacao', 'Identificação'], ['site_redes', 'Site e redes'], ['produtos', 'Produtos e serviços'], ['diferenciais', 'Diferenciais'], ['publico_alvo', 'Público-alvo'], ['infraestrutura', 'Infraestrutura e tecnologia'], ['parceiros', 'Parceiros e instituições'], ['taxas_condicoes', 'Taxas e condições'], ['lancamentos', 'Lançamentos'], ['mudancas_estrategicas', 'Mudanças estratégicas'], ['campanhas', 'Campanhas'], ['expansao', 'Expansão comercial'], ['parcerias_anunciadas', 'Parcerias anunciadas'], ['regulatorio', 'Regulatório/operacional']];
const urlSegura = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');
const host = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };
const dataBR = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00-03:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '') : '');
const valorPerfil = (v) => (Array.isArray(v) ? `<ul>${v.filter(Boolean).map((x) => `<li>${/^https?:\/\//.test(x) ? `<a href="${esc(x)}" target="_blank" rel="noopener">${esc(host(x) || x)}</a>` : esc(x)}</li>`).join('')}</ul>` : esc(v ?? ''));
let el = null;

export async function abrir(alvo, [aba, id]) {
  if (!$('#ol-corpo')) {
    el = alvo;
    el.innerHTML = `
      <header class="cab"><div><p class="cab-sup">Inteligência de mercado da B2B PAY</p><h1>Olho de Deus</h1></div></header>
      <nav class="abas" id="ol-abas">${ABAS.map(([k, t, ic]) => `<a href="#/olho/${k}" data-ol-aba="${k}">${IC[ic]}${t}${k === 'alertas' ? ' <i class="badge alerta" id="ol-n" hidden></i>' : ''}</a>`).join('')}</nav>
      <div class="ol-area"><div id="ol-corpo" class="ol-corpo"></div><aside class="ol-lado" id="ol-lado" hidden><header><span id="ol-lado-t"></span><button class="ic-btn" data-ol-fechar aria-label="Fechar">×</button></header><div id="ol-lado-corpo"></div></aside></div>`;
    el.onclick = clique; el.onchange = mudou; el.onsubmit = enviar;
  }
  if ((aba === 'empresa' || aba === 'movimento') && id) {
    if (!$('#ol-corpo').innerHTML) { if (!O.cfg) { const c = await api('/olho/config'); O.cfg = c.config; O.admin = c.admin; } el.querySelector(`[data-ol-aba="${O.aba}"]`)?.classList.add('on'); await ({ visao, alertas, empresas, movimentos, historico, ajustes }[O.aba])(); }
    await lado(aba, id); return;
  }
  O.aba = ABAS.some(([k]) => k === aba) ? aba : O.aba;
  el.querySelectorAll('[data-ol-aba]').forEach((x) => x.classList.toggle('on', x.dataset.olAba === O.aba));
  if (!O.cfg) { const c = await api('/olho/config'); O.cfg = c.config; O.admin = c.admin; }
  await ({ visao, alertas, empresas, movimentos, historico, ajustes }[O.aba])();
}
export async function atualizar() { if ($('#ol-corpo') && O.aba !== 'ajustes') await ({ visao, alertas, empresas, movimentos, historico }[O.aba])?.(); }
const corpo = (h) => { $('#ol-corpo').innerHTML = h; };

const mov = (m) => `<button class="ol-mov n-${m.relevancia}" data-ol-mov="${esc(m.id)}"><i class="ponto n-${m.relevancia}" title="${NIVEL[m.relevancia]}"></i>
  <span><b>${esc(m.titulo)}</b><small>${[m.empresa || 'Mercado', TIPO_MOV[m.tipo] || m.tipo, m.data_evento ? dataBR(m.data_evento) : `detectado ${ha(m.created_at)}`, m.fonte || host(m.url)].filter(Boolean).map(esc).join(' · ')}</small></span>
  ${m.ameaca ? '<i class="flag ameaca">ameaça</i>' : ''}${m.oportunidade ? '<i class="flag oport">oportunidade</i>' : ''}</button>`;
const alerta = (a) => { const u = urlSegura(a.url); return `<article class="ol-alerta n-${a.nivel} ${a.lido_em ? 'lido' : ''}">
  <header><span class="nivel n-${a.nivel}">${NIVEL[a.nivel]}</span><small>${a.quando ? `${dataBR(a.quando)} · ` : ''}detectado ${ha(a.created_at)}</small></header>
  <h3>${esc(a.titulo)}</h3><p class="dica">${esc(a.empresa || 'Mercado')}${u ? ` · <a href="${esc(u)}" target="_blank" rel="noopener">${esc(a.fonte || host(u))}</a>` : ''}</p>
  <dl>${a.porque ? `<dt>Por que importa</dt><dd>${esc(a.porque)}</dd>` : ''}${a.impacto ? `<dt>Impacto</dt><dd>${esc(a.impacto)}</dd>` : ''}${a.acao ? `<dt>Ação recomendada</dt><dd>${esc(a.acao)}</dd>` : ''}</dl>
  <div class="acoes"><button class="btn claro" data-ol-mov="${esc(a.movimento_id)}">Análise completa</button><button class="btn claro" data-ol-tarefa="${esc(a.movimento_id)}">Criar tarefa</button>${a.lido_em ? '' : `<button class="link" data-ol-lido="${esc(a.id)}">Marcar como lido</button>`}</div></article>`; };
const exec = (x) => `<li class="ol-exec ${x.status}"><span class="st">${{ fila: 'Na fila', rodando: PASSO[x.passo] || 'rodando', ok: 'Concluída', erro: 'Falhou', pulada: 'Pulada' }[x.status]}</span><b>${TIPO_EXEC[x.tipo]}${x.empresa ? `: ${esc(x.empresa)}` : ''}</b>
  <small>${[ha(x.created_at), x.fontes ? `${x.fontes} fontes` : '', x.status === 'ok' ? `${x.novidades} novidade${x.novidades === 1 ? '' : 's'}` : '', x.resumo && x.status === 'ok' ? x.resumo : ''].filter(Boolean).map(esc).join(' · ')}</small>${x.erro && x.status !== 'ok' ? `<small class="erro">${esc(x.erro)}</small>` : ''}</li>`;
const chip = (obj, campo, v, rot) => `<button class="chip ${O[obj][campo] === v ? 'on' : ''}" data-ol-f="${obj}.${campo}" data-v="${v}">${rot}</button>`;

async function visao() {
  const p = await api('/olho/painel'), s = p.status, k = p.kpis, n = k.alertas, nAl = n.critico + n.alto + n.medio + n.baixo;
  const andamento = p.execucoes.filter((x) => ['fila', 'rodando'].includes(x.status));
  $('#ol-n').hidden = !nAl; $('#ol-n').textContent = nAl;
  const kpi = (rot, val, ir, cls = '') => `<button class="kpi ${cls}" data-ol-ir="${ir}"><b>${val}</b><small>${rot}</small></button>`;
  corpo(`
    <section class="ol-hero ${s.ativo ? '' : 'pausado'}"><div><b>${s.ativo ? (andamento.length ? 'Pesquisando agora' : 'Monitorando') : 'Monitoramento pausado'}</b>
      <small>Última coleta ${s.ultima_coleta ? ha(s.ultima_coleta) : ': ainda nenhuma'}${andamento.length ? ` · ${andamento.length} na fila` : ''} · cada empresa a cada ${s.frequencia.empresas_h} h · até ${s.limite_dia} pesquisas/dia</small></div>
      ${O.admin ? '<button class="btn claro" data-ol-descobrir>Buscar novas empresas agora</button>' : ''}</section>
    <div class="kpis">${kpi('Concorrentes', k.concorrentes, 'empresas:concorrente')}${kpi('Similares', k.similares, 'empresas:similar')}${kpi('Em análise', k.candidatas, 'empresas:candidata')}${kpi('Movimentos 30 dias', k.movimentos_30d, 'movimentos:')}${kpi('Ameaças', k.ameacas, 'movimentos:ameacas', 'ameaca')}${kpi('Oportunidades', k.oportunidades, 'movimentos:oportunidades', 'oport')}</div>
    <div class="niveis">${['critico', 'alto', 'medio', 'baixo'].map((x) => `<button class="nv n-${x}" data-ol-ir="alertas:${x}"><b>${n[x]}</b>${NIVEL[x]}</button>`).join('')}</div>
    <div class="grade-2">
      <section><h2 class="sec-tit">Alertas não lidos</h2>${p.alertas.slice(0, 4).map(alerta).join('') || '<p class="dica">Nenhum alerta pendente.</p>'}${p.alertas.length > 4 ? '<button class="btn claro largo" data-ol-ir="alertas:">Ver todos</button>' : ''}</section>
      <section>${p.ameacas.length ? `<h2 class="sec-tit">Ameaças</h2><div class="ol-movs">${p.ameacas.map(mov).join('')}</div>` : ''}${p.oportunidades.length ? `<h2 class="sec-tit">Oportunidades</h2><div class="ol-movs">${p.oportunidades.map(mov).join('')}</div>` : ''}
        <h2 class="sec-tit">Últimas movimentações</h2><div class="ol-movs">${p.movimentos.slice(0, 10).map(mov).join('') || '<p class="dica">Ainda nenhuma.</p>'}</div>
        <h2 class="sec-tit">Pesquisas recentes</h2><ul class="ol-execs">${p.execucoes.slice(0, 6).map(exec).join('') || '<li class="dica">Nenhuma ainda.</li>'}</ul></section>
    </div>`);
}
async function alertas() {
  const q = new URLSearchParams(Object.entries(O.fAl).filter(([, v]) => v)).toString();
  const { alertas: lista } = await api(`/olho/alertas${q ? `?${q}` : ''}`);
  corpo(`<div class="filtros">${chip('fAl', 'nao_lidos', '1', 'Não lidos')}${chip('fAl', 'nao_lidos', '', 'Todos')}<span class="sep"></span>${chip('fAl', 'nivel', '', 'Qualquer nível')}${chip('fAl', 'nivel', 'medio', 'Médio+')}${chip('fAl', 'nivel', 'alto', 'Alto+')}${chip('fAl', 'nivel', 'critico', 'Crítico')}
    ${lista.some((a) => !a.lido_em) ? '<button class="link" data-ol-todos-lidos>Marcar todos como lidos</button>' : ''}</div>
    <div class="grade-alertas">${lista.map(alerta).join('') || '<p class="dica">Nenhum alerta com esse filtro.</p>'}</div>`);
}
async function empresas() {
  const q = new URLSearchParams(Object.entries(O.fEmp).filter(([, v]) => v)).toString();
  const { empresas: lista } = await api(`/olho/empresas${q ? `?${q}` : ''}`);
  O.empresas = lista;
  const segs = O.cfg?.segmentos || [];
  corpo(`<form class="filtros" data-ol-busca="fEmp"><input name="q" value="${esc(O.fEmp.q)}" placeholder="Buscar empresa  ( / )" data-busca autocomplete="off"><select name="segmento"><option value="">Todos os segmentos</option>${segs.map((x) => `<option ${O.fEmp.segmento === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
    ${chip('fEmp', 'categoria', '', 'Ativas')}${chip('fEmp', 'categoria', 'concorrente', 'Concorrentes')}${chip('fEmp', 'categoria', 'similar', 'Similares')}${chip('fEmp', 'categoria', 'candidata', 'Em análise')}${chip('fEmp', 'categoria', 'descartada', 'Descartadas')}
    ${O.admin ? '<button type="button" class="btn primario" data-ol-nova>+ Acompanhar empresa</button>' : ''}</form>
    <div class="ol-emps">${lista.map((e) => `<button class="ol-emp" data-ol-emp="${esc(e.id)}"><span class="cab"><b>${esc(e.nome)}</b><span class="cat ${e.categoria}">${CAT[e.categoria]}</span>${e.nivel_ameaca ? `<span class="nivel n-${e.nivel_ameaca}">${NIVEL[e.nivel_ameaca]}</span>` : ''}</span>
      ${e.resumo ? `<span class="res">${esc(e.resumo)}</span>` : ''}${(e.classificacoes || []).length ? `<span class="rotulos">${e.classificacoes.slice(0, 3).map((c) => `<i>${esc(c.rotulo)} · ${Math.round(c.confianca * 100)}%</i>`).join('')}</span>` : ''}
      <small>${e.ultima_em ? `analisada ${ha(e.ultima_em)}` : 'aguardando a primeira análise'}${e.silenciada ? ' · alertas silenciados' : ''}${e.ativo ? '' : ' · pausada'}</small></button>`).join('') || '<p class="dica">Nenhuma empresa com esse filtro.</p>'}</div>`);
}
async function movimentos() {
  const f = O.fMov, p = new URLSearchParams();
  if (f.relevancia) p.set('relevancia', f.relevancia); if (f.filtro) p.set('filtro', f.filtro); if (f.dias) p.set('desde', new Date(Date.now() - Number(f.dias) * 864e5).toISOString()); if (f.segmento) p.set('segmento', f.segmento); if (f.categoria) p.set('categoria', f.categoria);
  const { movimentos: lista } = await api(`/olho/movimentos?${p}`);
  const segs = O.cfg?.segmentos || [];
  corpo(`<div class="filtros">${chip('fMov', 'filtro', '', 'Tudo')}${chip('fMov', 'filtro', 'ameacas', 'Ameaças')}${chip('fMov', 'filtro', 'oportunidades', 'Oportunidades')}<span class="sep"></span>${chip('fMov', 'categoria', '', 'Todas')}${chip('fMov', 'categoria', 'concorrente', 'Concorrentes')}${chip('fMov', 'categoria', 'similar', 'Similares')}</div>
    <form class="filtros" data-ol-busca="fMov">${chip('fMov', 'relevancia', '', 'Qualquer relevância')}${chip('fMov', 'relevancia', 'medio', 'Médio+')}${chip('fMov', 'relevancia', 'alto', 'Alto+')}${chip('fMov', 'relevancia', 'critico', 'Crítico')}<span class="sep"></span>${chip('fMov', 'dias', '7', '7 dias')}${chip('fMov', 'dias', '30', '30 dias')}${chip('fMov', 'dias', '90', '90 dias')}${chip('fMov', 'dias', '', 'Tudo')}
      <select name="segmento"><option value="">Todos os segmentos</option>${segs.map((x) => `<option ${f.segmento === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></form>
    <div class="ol-movs">${lista.map(mov).join('') || '<p class="dica">Nada com esses filtros.</p>'}</div>`);
}
async function historico() {
  const [{ execucoes }, { empresas: emps }] = await Promise.all([api('/olho/execucoes'), O.empresas.length ? { empresas: O.empresas } : api('/olho/empresas?categoria=')]);
  const nomes = Object.fromEntries((emps || []).map((e) => [e.id, e.nome]));
  const ok = execucoes.filter((x) => x.status === 'ok').length, erro = execucoes.filter((x) => x.status === 'erro').length;
  corpo(`<p class="dica">Cada linha é uma pesquisa real no servidor. ${ok} concluída${ok === 1 ? '' : 's'}, ${erro} com falha nas últimas ${execucoes.length}.</p><ul class="ol-execs">${execucoes.map((x) => exec({ ...x, empresa: nomes[x.empresa_id] })).join('') || '<li class="dica">Nenhuma ainda.</li>'}</ul>`);
}
async function ajustes() {
  const { config: c, admin } = await api('/olho/config'); O.cfg = c; O.admin = admin;
  const dis = admin ? '' : 'disabled';
  const sel = (nome, v) => `<select name="${nome}" ${dis}>${Object.entries(NIVEL).map(([k, t]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${t}${k === 'baixo' ? '' : ' ou mais'}</option>`).join('')}</select>`;
  corpo(`<form id="ol-ajustes" class="cartao form-largo">${admin ? '' : '<p class="aviso-faixa">Só o administrador altera estes ajustes.</p>'}
    <label class="linha-check"><input type="checkbox" name="ativo" ${c.ativo ? 'checked' : ''} ${dis}><span><b>Monitoramento ligado</b><small>Desligado, nenhuma pesquisa nova é feita.</small></span></label>
    <div class="linha-campos"><label class="campo"><span>Gerar alerta a partir de</span>${sel('nivel_minimo_alerta', c.nivel_minimo_alerta)}</label><label class="campo"><span>Avisar no celular a partir de</span>${sel('nivel_push', c.nivel_push)}</label>
      <label class="campo"><span>Reanalisar cada empresa a cada (horas)</span><input type="number" name="frequencia_empresa_h" min="12" max="720" value="${c.frequencia_empresa_h}" ${dis}></label><label class="campo"><span>Limite de pesquisas por dia</span><input type="number" name="max_execucoes_dia" min="1" max="200" value="${c.max_execucoes_dia}" ${dis}></label></div>
    <div class="linha-campos"><label class="campo"><span>Assuntos que geram alerta (um por linha; vazio = todos)</span><textarea name="temas_alerta" rows="4" ${dis}>${esc((c.temas_alerta || []).join('\n'))}</textarea></label>
      <label class="campo"><span>Segmentos monitorados (um por linha)</span><textarea name="segmentos" rows="4" ${dis}>${esc((c.segmentos || []).join('\n'))}</textarea></label></div>
    <label class="campo"><span>Seu negócio (base de toda comparação)</span><textarea name="meu_negocio" rows="6" ${dis}>${esc(c.meu_negocio)}</textarea></label>
    ${admin ? '<button class="btn primario">Salvar ajustes</button>' : ''}</form>`);
}

async function lado(tipo, id) {
  O.lado = { tipo, id };
  const l = $('#ol-lado'); l.hidden = false; el.querySelector('.ol-area').classList.add('com-lado');
  $('#ol-lado-corpo').innerHTML = '<p class="carregando">Carregando…</p>';
  if (tipo === 'empresa') {
    const { empresa: e, historico: hist, movimentos: movs, execucoes } = await api(`/olho/empresas/${id}`);
    if (!e) { $('#ol-lado-corpo').innerHTML = '<p class="vazio">Não achei essa empresa. Ela pode ter sido removida; atualize a lista.</p>'; return; }
    const site = urlSegura(e.site), perfil = e.perfil || {}, preench = CAMPOS.filter(([c]) => perfil[c] != null && String(perfil[c]).trim() && !(Array.isArray(perfil[c]) && !perfil[c].length));
    const abertas = execucoes.filter((x) => ['fila', 'rodando'].includes(x.status));
    $('#ol-lado-t').textContent = e.nome;
    $('#ol-lado-corpo').innerHTML = `
      <p class="cab-chips"><span class="cat ${e.categoria}">${CAT[e.categoria]}</span>${e.nivel_ameaca ? `<span class="nivel n-${e.nivel_ameaca}">Ameaça ${NIVEL[e.nivel_ameaca].toLowerCase()}</span>` : ''}${site ? `<a href="${esc(site)}" target="_blank" rel="noopener">${esc(host(site))}</a>` : ''}</p>
      ${e.resumo ? `<p>${esc(e.resumo)}</p>` : ''}${e.motivo_inclusao ? `<p class="dica"><b>Por que está aqui:</b> ${esc(e.motivo_inclusao)}</p>` : ''}
      ${abertas.length ? `<p class="aviso-faixa">Pesquisa em andamento (${PASSO[abertas[0].passo] || 'na fila'}).</p>` : ''}
      ${O.admin ? `<div class="acoes"><button class="btn primario" data-ol-atualizar="${esc(e.id)}" ${abertas.length ? 'disabled' : ''}>Atualizar agora</button>
        <select data-ol-cat="${esc(e.id)}" aria-label="Categoria">${Object.entries(CAT).map(([k, v]) => `<option value="${k}" ${e.categoria === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <button class="btn claro" data-ol-alt="${esc(e.id)}" data-campo="silenciada" data-v="${e.silenciada ? '0' : '1'}">${e.silenciada ? 'Reativar alertas' : 'Silenciar alertas'}</button>
        <button class="btn claro" data-ol-alt="${esc(e.id)}" data-campo="ativo" data-v="${e.ativo ? '0' : '1'}">${e.ativo ? 'Pausar' : 'Retomar'}</button></div>` : ''}
      <h3>Promessa × comprovação</h3><p class="dica">✓ = a evidência apareceu de fato na pesquisa; sem ✓ a confiança fica limitada a 30%.</p>
      ${(e.classificacoes || []).map((c) => `<article class="classe"><header><b>${esc(c.rotulo)}</b><span class="conf"><span style="width:${Math.round(c.confianca * 100)}%"></span></span><small>${Math.round(c.confianca * 100)}%</small></header>${c.conclusao ? `<p>${esc(c.conclusao)}</p>` : ''}
        <ul class="evid">${(c.evidencias || []).map((v) => `<li class="${v.verificada ? 'ok' : ''}"><span>${v.verificada ? '✓' : '·'}</span><div>${esc(v.afirmacao)}${urlSegura(v.url) ? ` <a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.fonte || host(v.url))}</a>` : ''}</div></li>`).join('')}</ul></article>`).join('') || '<p class="dica">Ainda sem classificação.</p>'}
      <h3>O que acompanhamos (${preench.length} de 14)</h3><dl class="def">${preench.map(([c, r]) => `<dt>${r}</dt><dd>${valorPerfil(perfil[c])}</dd>`).join('') || '<dd class="dica">Nada coletado ainda.</dd>'}</dl>
      <h3>Linha do tempo</h3><div class="ol-movs">${movs.map((m) => mov({ ...m, empresa: e.nome })).join('') || '<p class="dica">Nenhuma movimentação.</p>'}</div>
      <h3>Histórico de mudanças</h3><ol class="mudancas">${hist.map((h) => `<li><small>${esc(quando(h.created_at))}</small>${(h.mudancas || []).length ? h.mudancas.map((m) => `<b>${esc((CAMPOS.find(([c]) => c === m.campo) || [, m.campo])[1])}</b>`).join(', ') + ' mudou' : ' sem mudanças'}</li>`).join('') || '<li class="dica">Ainda não há duas coletas para comparar.</li>'}</ol>`;
  } else {
    const { movimento: m } = await api(`/olho/movimentos/${id}`);
    if (!m) { $('#ol-lado-corpo').innerHTML = '<p class="vazio">Não achei esse movimento; atualize a lista.</p>'; return; }
    const a = m.analise || {}, u = urlSegura(m.url), bloco = (r, t) => (t ? `<dt>${r}</dt><dd>${esc(t)}</dd>` : '');
    $('#ol-lado-t').textContent = TIPO_MOV[m.tipo] || 'Movimento';
    $('#ol-lado-corpo').innerHTML = `<p class="cab-chips"><span class="nivel n-${m.relevancia}">${NIVEL[m.relevancia]}</span>${m.ameaca ? '<i class="flag ameaca">ameaça</i>' : ''}${m.oportunidade ? '<i class="flag oport">oportunidade</i>' : ''}<small>${esc(m.empresa || 'Mercado')} · ${m.data_evento ? dataBR(m.data_evento) : `detectado ${ha(m.created_at)}`}</small></p>
      <h2>${esc(m.titulo)}</h2>${m.resumo ? `<p>${esc(m.resumo)}</p>` : ''}<p class="dica">Fonte: ${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(m.fonte || host(u))}</a>` : esc(m.fonte || '—')}</p>
      <div class="acoes"><button class="btn primario" data-ol-tarefa="${esc(m.id)}">Criar tarefa</button>${m.empresa_id ? `<button class="btn claro" data-ol-emp="${esc(m.empresa_id)}">Ver empresa</button>` : ''}</div>
      <h3>Análise estratégica</h3><dl class="def">${bloco('O que significa para a B2B PAY', a.o_que_significa)}${bloco('Comparação com a sua oferta', a.comparacao)}${bloco('Vantagens do outro lado', a.vantagens_concorrente)}${bloco('Ameaças', a.ameacas)}${bloco('Impacto comercial', a.impacto_comercial)}${bloco('Como se posicionar', a.posicionamento)}${bloco('Como se diferenciar', a.diferenciacao)}${a.acao_recomendada ? `<dt>Ação recomendada</dt><dd class="destaque">${esc(a.acao_recomendada)}</dd>` : ''}</dl>
      <p class="dica">Análise gerada por IA a partir da fonte citada. Confira a fonte antes de decidir.</p>`;
  }
}

async function clique(e) {
  const x = e.target.closest('[data-ol-ir],[data-ol-mov],[data-ol-emp],[data-ol-tarefa],[data-ol-lido],[data-ol-todos-lidos],[data-ol-f],[data-ol-descobrir],[data-ol-atualizar],[data-ol-alt],[data-ol-nova],[data-ol-fechar]');
  if (!x || x.tagName === 'SELECT') return;
  const d = x.dataset;
  try {
    if (d.olFechar !== undefined) { $('#ol-lado').hidden = true; el.querySelector('.ol-area').classList.remove('com-lado'); O.lado = null; if (/\/(empresa|movimento)\//.test(location.hash)) history.replaceState(null, '', `#/olho/${O.aba}`); return; }
    if (d.olIr) { const [aba, v] = d.olIr.split(':'); if (aba === 'empresas') O.fEmp.categoria = v || ''; if (aba === 'movimentos') Object.assign(O.fMov, { filtro: v || '', dias: '30' }); if (aba === 'alertas') O.fAl = { nivel: v || '', nao_lidos: '1' }; location.hash = `#/olho/${aba}`; return; }
    if (d.olMov) { await lado('movimento', d.olMov); return; }
    if (d.olEmp) { await lado('empresa', d.olEmp); return; }
    if (d.olF) { const [obj, campo] = d.olF.split('.'); O[obj][campo] = d.v; await ({ fEmp: empresas, fMov: movimentos, fAl: alertas }[obj])(); return; }
    if (d.olNova !== undefined) {
      abrirJanela({ titulo: 'Acompanhar empresa', botao: 'Acompanhar', campos: [{ rotulo: 'Nome', nome: 'nome', obrigatorio: true, placeholder: 'Ex.: Asaas' }, { rotulo: 'Site oficial', nome: 'site', tipoInput: 'url', placeholder: 'https://…' }, { tipo: 'escolha', rotulo: 'Categoria', nome: 'categoria', opcoes: [{ texto: 'Deixar a análise decidir', valor: '', marcado: true }, { texto: 'Concorrente', valor: 'concorrente' }, { texto: 'Similar', valor: 'similar' }] }],
        salvar: async (f) => { if (!f.nome?.trim()) throw new Error('Informe o nome.'); const r = await api('/olho/empresas', { metodo: 'POST', corpo: f }); aviso('Empresa no radar. A primeira análise sai em 4 a 8 minutos.'); await empresas(); await lado('empresa', r.id); } });
      return;
    }
    x.disabled = true;
    if (d.olTarefa) { await api(`/olho/movimentos/${d.olTarefa}/tarefa`, { metodo: 'POST' }); aviso('Tarefa criada para hoje, no projeto “Inteligência de mercado”.'); x.textContent = 'Tarefa criada ✓'; document.dispatchEvent(new Event('dimy:mudou')); return; }
    if (d.olLido) { await api(`/olho/alertas/${d.olLido}/lido`, { metodo: 'POST' }); await atualizar(); document.dispatchEvent(new Event('dimy:mudou')); return; }
    if (d.olTodosLidos !== undefined) { await api('/olho/alertas/lidos', { metodo: 'POST' }); await atualizar(); document.dispatchEvent(new Event('dimy:mudou')); return; }
    if (d.olDescobrir !== undefined) { const r = await api('/olho/descobrir', { metodo: 'POST' }); aviso(r.mensagem); await atualizar(); return; }
    if (d.olAtualizar) { const r = await api(`/olho/empresas/${d.olAtualizar}/atualizar`, { metodo: 'POST' }); aviso(r.mensagem); await lado('empresa', d.olAtualizar); return; }
    if (d.olAlt) { await api(`/olho/empresas/${d.olAlt}`, { metodo: 'POST', corpo: { [d.campo]: d.v === '1' } }); await lado('empresa', d.olAlt); return; }
  } catch (err) { x.disabled = false; aviso(err.message, 'erro'); }
}
async function mudou(e) {
  const s = e.target;
  try {
    if (s.dataset.olCat) { await api(`/olho/empresas/${s.dataset.olCat}`, { metodo: 'POST', corpo: { categoria: s.value } }); aviso(`Categoria: ${CAT[s.value]}.`); await lado('empresa', s.dataset.olCat); return; }
    const f = s.closest('[data-ol-busca]');
    if (f && s.tagName === 'SELECT') { O[f.dataset.olBusca][s.name] = s.value; await atualizar(); }
  } catch (err) { aviso(err.message, 'erro'); }
}
async function enviar(e) {
  e.preventDefault();
  const f = e.target;
  try {
    if (f.dataset.olBusca) { O[f.dataset.olBusca].q = String(new FormData(f).get('q') || '').trim(); await atualizar(); return; }
    if (f.id === 'ol-ajustes') {
      const v = new FormData(f), linhas = (k) => String(v.get(k) || '').split('\n').map((x) => x.trim()).filter(Boolean);
      const r = await api('/olho/config', { metodo: 'POST', corpo: { ativo: !!v.get('ativo'), nivel_minimo_alerta: v.get('nivel_minimo_alerta'), nivel_push: v.get('nivel_push'), temas_alerta: linhas('temas_alerta'), segmentos: linhas('segmentos'), frequencia_empresa_h: Number(v.get('frequencia_empresa_h')), max_execucoes_dia: Number(v.get('max_execucoes_dia')), meu_negocio: String(v.get('meu_negocio') || '') } });
      O.cfg = r.config; aviso('Ajustes salvos.');
    }
  } catch (err) { aviso(err.message, 'erro'); }
}
