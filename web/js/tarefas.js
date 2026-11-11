// Tarefas: quadro A fazer → Fazendo → Feito com arrastar e soltar, dia a dia; atrasadas e prazos; detalhe ao lado
// (subtarefas, anotações, histórico); projetos, lixeira e sugestões do Dimy. Mesmas rotas do app.
import { $, $$, abrirJanela, api, aviso, editarEvento, esc, eventosDe, ha, hoje, horaISO, IC, leve, maiuscula, nomeDia, quando, somaDias } from './base.js';

export const titulo = 'Tarefas';
const ETAPAS = [{ id: 'a_fazer', nome: 'A fazer', cor: 'azul', vazio: 'Nada para começar.' }, { id: 'fazendo', nome: 'Fazendo', cor: 'ambar', vazio: 'Arraste uma tarefa para cá ao começar.' }, { id: 'feito', nome: 'Feito', cor: 'verde', vazio: 'O que você concluir aparece aqui.' }];
const NOME_ETAPA = { a_fazer: 'A fazer', fazendo: 'Fazendo', feito: 'Feito' };
const NOME_REPETE = { diaria: 'todo dia', dias_uteis: 'dias úteis', semanal: 'toda semana', mensal: 'todo mês' };
const NOME_ACAO_HIST = { criada: 'Criada', etapa: 'Etapa', dia: 'Dia', prazo: 'Prazo', editada: 'Editada', arquivada: 'Para a lixeira', restaurada: 'Restaurada', recorrencia: 'Repetição', nota: 'Anotação', subtarefa: 'Subtarefa' };
const POR_HIST = { voz: 'por voz', sugestao: 'sugestão aceita', olho: 'Olho de Deus', sistema: 'automático', recorrencia: 'repetição', dimy: 'Dimy' };
const T = { dia: null, dados: null, prioridade: 2, painel: null, detalhe: null };
let el = null;

const dataCurta = (d) => nomeDia(d, { day: '2-digit', month: 'short' }).replace('.', '');
const proxUtil = (d) => { let n = somaDias(d, 1); while ([0, 6].includes(new Date(`${n}T12:00:00-03:00`).getDay())) n = somaDias(n, 1); return n; };
function rotuloDia(d) {
  const h = hoje();
  const nome = d === h ? 'Hoje' : d === somaDias(h, 1) ? 'Amanhã' : d === somaDias(h, -1) ? 'Ontem' : maiuscula(nomeDia(d, { weekday: 'long' }));
  return `${nome}, ${dataCurta(d)}`;
}
function rotuloPrazo(prazo, h = hoje()) {
  if (prazo < h) return { c: 'venc', t: `venceu ${dataCurta(prazo)}` };
  if (prazo === h) return { c: 'hoje', t: 'vence hoje' };
  if (prazo === somaDias(h, 1)) return { c: 'perto', t: 'vence amanhã' };
  return { c: '', t: `prazo ${dataCurta(prazo)}` };
}

export async function abrir(alvo) {
  el = alvo;
  el.innerHTML = `
    <header class="cab">
      <div><p class="cab-sup">Tarefas</p><h1 id="tf-dia"></h1></div>
      <div class="cab-acoes">
        <button class="btn claro destaque" data-tf-painel="sugestoes" id="tf-b-sug" hidden></button>
        <button class="btn claro" data-tf-painel="projetos">${IC.projeto}Projetos</button>
        <button class="btn claro" data-tf-painel="lixeira">${IC.lixeira}Lixeira</button>
      </div>
    </header>
    <div class="tf-topo">
      <div class="tf-semana"><button class="ic-btn" data-tf-dia="-7" aria-label="Semana anterior"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button><div id="tf-semana" class="tf-dias"></div><button class="ic-btn" data-tf-dia="7" aria-label="Próxima semana"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></button></div>
      <div class="tf-progresso"><div class="barra"><span id="tf-barra"></span></div><small id="tf-prog"></small></div>
    </div>
    <section class="tf-agenda" id="tf-agenda" aria-label="Compromissos do dia"></section>
    <form id="tf-nova" class="tf-nova">
      <button type="button" class="tf-pri" id="tf-pri" data-p="2" title="Prioridade alta (clique para ligar)" aria-label="Prioridade normal">!</button>
      <input id="tf-titulo" placeholder="Nova tarefa… (Enter para adicionar)" autocomplete="off" maxlength="300" data-busca aria-label="Nova tarefa">
      <button class="btn primario">Adicionar</button>
    </form>
    <div class="tf-area">
      <div class="tf-quadro" id="tf-quadro"></div>
      <aside class="tf-lado" id="tf-lado" hidden><header><h2 id="tfl-titulo"></h2><button class="ic-btn" data-tfl-fechar aria-label="Fechar">×</button></header><div id="tfl-corpo"></div></aside>
    </div>`;
  el.onclick = clique; el.onsubmit = enviar;
  el.ondragstart = (e) => { const c = e.target.closest('[data-tf]'); if (!c) return; e.dataTransfer.setData('text/plain', c.dataset.tf); e.dataTransfer.effectAllowed = 'move'; c.classList.add('arrastando'); };
  el.ondragend = (e) => { e.target.closest?.('[data-tf]')?.classList.remove('arrastando'); $$('.tf-col.alvo', el).forEach((c) => c.classList.remove('alvo')); };
  el.ondragover = (e) => { const col = e.target.closest('[data-tf-col]'); if (!col) return; e.preventDefault(); $$('.tf-col.alvo', el).forEach((c) => c !== col && c.classList.remove('alvo')); col.classList.add('alvo'); };
  el.ondrop = async (e) => {
    const col = e.target.closest('[data-tf-col]'); if (!col) return;
    e.preventDefault(); col.classList.remove('alvo');
    const id = e.dataTransfer.getData('text/plain'), t = porId(id), destino = col.dataset.tfCol;
    if (!t) return;
    try {
      if (destino === 'atrasadas') return;
      const corpo = {};
      if (t.etapa !== destino) corpo.etapa = destino;
      if (t.dia !== T.dados.dia) corpo.dia = T.dados.dia;
      if (!Object.keys(corpo).length) return;
      await mudar(id, corpo, destino === 'feito' ? 'Feito! ✅' : `Movida para ${NOME_ETAPA[destino]}.`);
    } catch (err) { aviso(err.message, 'erro'); }
  };
  $('#tf-titulo').addEventListener('keydown', (e) => { if (e.key === 'Escape') e.target.blur(); });
  await carregar(T.dia || hoje());
}
export async function atualizar() { if (el?.isConnected) { await carregar(T.dia, true); if (T.painel === 'detalhe' && T.detalhe) await desenharDetalhe(); } }

async function carregar(dia, forcar = false) {
  T.dia = dia;
  const [d] = await Promise.all([api(`/tarefas?dia=${dia}`), eventosDe(dia, 1, forcar).then((r) => (T.agenda = r)).catch((e) => (T.agenda = { erro: e.message }))]);
  desenhar(d); desenharAgenda();
}
// Compromissos do dia escolhido (Google Agenda), para planejar as tarefas em volta deles.
function desenharAgenda() {
  const box = $('#tf-agenda'), a = T.agenda, h = hoje(); if (!box || !a) return;
  const rot = T.dia === h ? 'Agenda de hoje' : `Agenda de ${rotuloDia(T.dia).split(',')[0].toLowerCase()}`;
  const cab = `<a class="tf-ag-cab" href="#/agenda/dia/${T.dia}" title="Abrir a agenda">${IC.cal}<b>${rot}</b></a>`;
  if (a.erro) { box.innerHTML = `${cab}<span class="tf-ag-vazio">Não consegui ler a agenda agora.</span>`; return; }
  if (!a.google) { box.innerHTML = `${cab}<span class="tf-ag-vazio">Conecte o Google no app para ver seus compromissos aqui.</span>`; return; }
  const evs = [...a.eventos].sort((x, y) => x.inicio.localeCompare(y.inicio)), agora = Date.now();
  box.innerHTML = cab + (evs.length ? `<div class="tf-ag-lista">${evs.map((e) => {
    const passou = Date.parse(e.fim || e.inicio) < agora, ja = !passou && Date.parse(e.inicio) <= agora;
    return `<button class="tf-ag-ev ${passou ? 'passou' : ''} ${ja ? 'agora' : ''}" data-tf-evento="${esc(e.id)}" title="${esc(e.local || e.titulo)}"><span>${e.dia_inteiro ? 'Dia todo' : `${horaISO(e.inicio)}${e.fim ? `–${horaISO(e.fim)}` : ''}`}</span><b>${esc(e.titulo)}</b></button>`;
  }).join('')}</div>` : '<span class="tf-ag-vazio">Nenhum compromisso neste dia.</span>')
    + `<button class="ic-btn" data-tf-novo-evento title="Marcar compromisso" aria-label="Marcar compromisso">${IC.mais}</button>`;
}
const porId = (id) => [...(T.dados?.tarefas || []), ...(T.dados?.atrasadas || []), ...(T.dados?.prazos || [])].find((t) => t.id === id);
async function mudar(id, corpo, msg) { await api(`/tarefas/${id}`, { metodo: 'POST', corpo }); if (msg) aviso(msg); await carregar(T.dia); document.dispatchEvent(new Event('dimy:mudou')); }

function tags(t, feito) {
  const x = [];
  if (t.prioridade === 1) x.push('<span class="tag alta">Prioridade</span>');
  if (t.projeto) x.push(`<span class="tag proj">${esc(t.projeto)}</span>`);
  if (t.prazo && !feito) { const p = rotuloPrazo(t.prazo); x.push(`<span class="tag prazo ${p.c}">${p.t}</span>`); }
  if (t.recorrencia) x.push(`<span class="tag">↻ ${NOME_REPETE[t.recorrencia]}</span>`);
  if (t.subtarefas?.total) x.push(`<span class="tag ${t.subtarefas.feitas === t.subtarefas.total ? 'ok' : ''}">☑ ${t.subtarefas.feitas}/${t.subtarefas.total}</span>`);
  if (t.empresa) x.push(`<span class="tag emp">${esc(t.empresa)}</span>`);
  if (t.adiada_vezes) x.push(`<span class="tag">adiada ${t.adiada_vezes}×</span>`);
  if (t.origem === 'olho') x.push('<span class="tag" title="Do Olho de Deus">👁</span>');
  return x.join('');
}
function cartao(t, fora = false) {
  const feito = t.etapa === 'feito';
  return `<li class="tf-card ${feito ? 'feito' : ''} ${t.prioridade === 1 ? 'p1' : ''}" data-tf="${esc(t.id)}" draggable="true">
    <button class="tf-check" data-tf-acao="${feito ? 'reabrir' : 'concluir'}" title="${feito ? 'Reabrir' : 'Concluir'}" aria-label="${feito ? 'Reabrir' : 'Concluir'}"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"/></svg></button>
    <button class="tf-corpo" data-tf-acao="detalhe"><span class="tf-t">${esc(t.titulo)}</span>
      ${fora ? `<span class="tag atr">${t.dia > hoje() ? 'marcada p/' : 'de'} ${dataCurta(t.dia)}</span>` : ''}${tags(t, feito)}
      ${t.notas ? `<span class="tf-nota">${esc(t.notas)}</span>` : ''}</button>
    <span class="tf-acoes">
      ${fora ? '<button data-tf-acao="hoje" title="Trazer para hoje">↑ Hoje</button>' : ''}
      ${!feito && !fora ? `<button data-tf-acao="avancar" title="${t.etapa === 'a_fazer' ? 'Começar' : 'Concluir'}">${t.etapa === 'a_fazer' ? '▶' : '✓'}</button>` : ''}
      ${!feito ? '<button data-tf-acao="adiar" title="Passar para o próximo dia útil">→</button>' : ''}
      <button data-tf-acao="editar" title="Editar">✎</button>
    </span></li>`;
}
function desenhar(d) {
  T.dados = d;
  const h = d.hoje;
  $('#tf-dia').textContent = rotuloDia(d.dia);
  const ini = somaDias(d.dia, -3);
  $('#tf-semana').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const dd = somaDias(ini, i), c = d.contagem?.[dd], pend = c ? c.total - c.feitas : 0;
    return `<button class="tf-sd ${dd === d.dia ? 'on' : ''} ${dd === h ? 'hoje' : ''}" data-tf-ir="${dd}"><small>${nomeDia(dd, { weekday: 'short' }).replace('.', '')}</small><b>${dd.slice(8)}</b><i class="${c ? (pend ? 'pend' : 'ok') : ''}" title="${c ? `${pend} pendente(s)` : ''}"></i></button>`;
  }).join('');
  const ts = d.tarefas, feitas = ts.filter((t) => t.etapa === 'feito').length;
  $('#tf-barra').style.width = `${ts.length ? Math.round((feitas / ts.length) * 100) : 0}%`;
  $('#tf-prog').textContent = ts.length ? `${feitas} de ${ts.length} feitas` : 'Nenhuma tarefa neste dia';
  const nSug = d.sugestoes_pendentes || 0;
  $('#tf-b-sug').hidden = !nSug; $('#tf-b-sug').innerHTML = `${IC.brilho}${nSug} sugest${nSug > 1 ? 'ões' : 'ão'} do Dimy`;
  const noDia = new Set([...ts, ...d.atrasadas].map((t) => t.id));
  const fora = d.dia === h ? [...d.atrasadas, ...(d.prazos || []).filter((t) => !noDia.has(t.id))] : [];
  const pend = ts.filter((t) => t.etapa !== 'feito').length + (d.dia === h ? d.atrasadas.length : 0);
  $('#tf-quadro').innerHTML = (fora.length ? `<section class="tf-col vermelho" data-tf-col="atrasadas"><div class="tf-col-cab"><span>Atrasadas e prazos</span><b>${fora.length}</b></div>
      ${d.atrasadas.length ? '<button class="link" data-tf-trazer>Trazer todas para hoje</button>' : ''}<ul class="tf-cards">${fora.map((t) => cartao(t, true)).join('')}</ul></section>` : '')
    + ETAPAS.map((e) => {
      const lista = ts.filter((t) => t.etapa === e.id).sort((x, y) => (x.prioridade - y.prioridade) || (x.ordem - y.ordem));
      return `<section class="tf-col ${e.cor}" data-tf-col="${e.id}"><div class="tf-col-cab"><span>${e.nome}</span><b>${lista.length}</b></div>
        ${lista.length ? `<ul class="tf-cards">${lista.map((t) => cartao(t)).join('')}</ul>` : `<p class="tf-vazio">${e.vazio}</p>`}
        ${e.id === 'a_fazer' && pend && d.dia >= h ? `<button class="link tf-adiar-todas" data-tf-adiar-todas>Passar ${pend} pendente${pend > 1 ? 's' : ''} para ${rotuloDia(proxUtil(d.dia)).split(',')[0].toLowerCase()}</button>` : ''}</section>`;
    }).join('');
  $('#tf-quadro').classList.toggle('com-atrasadas', !!fora.length);
}

function editar(t) {
  abrirJanela({
    titulo: t ? 'Editar tarefa' : 'Nova tarefa', largura: 'larga',
    campos: [
      { rotulo: 'Tarefa', nome: 'titulo', valor: t?.titulo, obrigatorio: true, placeholder: 'Ligar para o Bruno' },
      { rotulo: 'Detalhes', nome: 'notas', tipoInput: 'textarea', linhas: 2, valor: t?.notas || '', placeholder: 'Opcional' },
      { tipo: 'linha', campos: [{ rotulo: 'Dia', nome: 'dia', tipoInput: 'date', valor: t?.dia || T.dia }, { rotulo: 'Prazo final (opcional)', nome: 'prazo', tipoInput: 'date', valor: t?.prazo || '' }] },
      { tipo: 'escolha', rotulo: 'Prioridade', nome: 'prioridade', opcoes: [['1', 'Alta'], ['2', 'Normal'], ['3', 'Baixa']].map(([v, x]) => ({ valor: v, texto: x, marcado: String(t?.prioridade || 2) === v })) },
      { tipo: 'escolha', rotulo: 'Etapa', nome: 'etapa', opcoes: ETAPAS.map((e) => ({ valor: e.id, texto: e.nome, marcado: (t?.etapa || 'a_fazer') === e.id })) },
      { tipo: 'escolha', rotulo: 'Repetir', nome: 'recorrencia', opcoes: [['', 'Não repete'], ['diaria', 'Todo dia'], ['dias_uteis', 'Dias úteis'], ['semanal', 'Toda semana'], ['mensal', 'Todo mês']].map(([v, x]) => ({ valor: v, texto: x, marcado: (t?.recorrencia || '') === v })) },
      { tipo: 'linha', campos: [{ rotulo: 'Projeto', nome: 'projeto', valor: t?.projeto || '', placeholder: 'Ex.: Rede Payments' }, { rotulo: 'Área', nome: 'area', valor: t?.area || '', placeholder: 'Ex.: Comercial' }, { rotulo: 'Empresa / cliente', nome: 'empresa', valor: t?.empresa || '' }] },
    ],
    salvar: async (f) => {
      if (!f.titulo?.trim()) throw new Error('Escreva a tarefa.');
      const corpo = { titulo: f.titulo.trim(), notas: f.notas || '', dia: f.dia || T.dia, prioridade: Number(f.prioridade || 2), etapa: f.etapa || 'a_fazer', prazo: f.prazo || null, recorrencia: f.recorrencia || null, projeto: f.projeto || null, area: f.area || null, empresa: f.empresa || null };
      if (t) await mudar(t.id, corpo, 'Tarefa atualizada.');
      else { await api('/tarefas', { metodo: 'POST', corpo }); await carregar(T.dia); document.dispatchEvent(new Event('dimy:mudou')); }
    },
    apagar: t ? async () => { await api(`/tarefas/${t.id}/arquivar`, { metodo: 'POST' }); aviso('Foi para a lixeira.'); await carregar(T.dia); } : null,
  });
}

// ---- Painel ao lado: detalhe, projetos, lixeira, sugestões ----
function abrirLado(modo, tituloLado) { T.painel = modo; $('#tf-lado').hidden = false; $('#tfl-titulo').textContent = tituloLado; $('#tfl-corpo').innerHTML = '<p class="dica">Carregando…</p>'; el.querySelector('.tf-area').classList.add('com-lado'); }
function fecharLado() { T.painel = null; T.detalhe = null; $('#tf-lado').hidden = true; el.querySelector('.tf-area').classList.remove('com-lado'); }
async function desenharDetalhe() {
  const { tarefa: t, subtarefas: subs, historico: hist } = await api(`/tarefas/${T.detalhe}/detalhe`);
  $('#tfl-titulo').textContent = t.titulo;
  const feitas = subs.filter((x) => x.feita).length;
  $('#tfl-corpo').innerHTML = `
    <p class="dica">${[NOME_ETAPA[t.etapa], rotuloDia(t.dia), t.prazo ? rotuloPrazo(t.prazo).t : '', t.recorrencia ? `repete ${NOME_REPETE[t.recorrencia]}` : '', t.projeto ? `projeto ${esc(t.projeto)}` : '', t.area ? esc(t.area) : '', t.empresa ? esc(t.empresa) : ''].filter(Boolean).join(' · ')}</p>
    <div class="acoes"><button class="btn claro" data-tf-editar="${esc(t.id)}">Editar</button>${t.etapa !== 'feito' ? `<button class="btn claro" data-tfd-adiar="${esc(t.id)}">Próximo dia útil</button>` : ''}</div>
    ${t.notas ? `<p class="tfl-notas">${leve(t.notas)}</p>` : ''}
    <h3>Subtarefas ${subs.length ? `<small>${feitas}/${subs.length}</small>` : ''}</h3>
    ${subs.length ? `<div class="barra fina"><span style="width:${Math.round((feitas / subs.length) * 100)}%"></span></div>` : ''}
    <ul class="tfl-subs">${subs.map((x) => `<li class="${x.feita ? 'feita' : ''}"><button class="tf-check mini" data-tfs-feita="${esc(x.id)}" data-v="${x.feita ? '0' : '1'}" aria-label="${x.feita ? 'Desmarcar' : 'Marcar'}"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"/></svg></button><span>${esc(x.titulo)}</span><button class="ic-btn" data-tfs-apagar="${esc(x.id)}" aria-label="Apagar subtarefa">×</button></li>`).join('')}</ul>
    <form data-tfs="nova" class="linha-form"><input name="v" maxlength="200" placeholder="Nova subtarefa…" autocomplete="off"><button class="btn primario">Adicionar</button></form>
    <h3>Anotações e histórico</h3>
    <form data-tfs="nota" class="linha-form"><input name="v" maxlength="1000" placeholder="Escreva uma anotação…" autocomplete="off"><button class="btn claro">Anotar</button></form>
    <ol class="tfl-hist">${hist.map((h) => `<li class="${h.acao === 'nota' ? 'nota' : ''}"><b>${NOME_ACAO_HIST[h.acao] || esc(h.acao)}</b>${h.detalhe ? ` <span>${esc(h.detalhe)}</span>` : ''}<small>${quando(h.created_at)}${POR_HIST[h.por] ? ` · ${POR_HIST[h.por]}` : ''}</small></li>`).join('') || '<li class="dica">Sem registros ainda.</li>'}</ol>`;
}
async function desenharProjetos() {
  const { projetos } = await api('/tarefas/projetos');
  $('#tfl-corpo').innerHTML = projetos.length ? `<ul class="tfl-lista">${projetos.map((p) => `<li><button data-tfl-projeto="${esc(p.projeto)}"><b>${esc(p.projeto)}</b><small>${p.abertas} aberta${p.abertas === 1 ? '' : 's'} · ${p.feitas} feita${p.feitas === 1 ? '' : 's'}${p.vencidas ? ` · <em>${p.vencidas} vencida(s)</em>` : ''}${p.areas.length ? ` · ${p.areas.map(esc).join(', ')}` : ''}</small></button></li>`).join('')}</ul>`
    : '<p class="dica">Nenhum projeto ainda. Ao editar uma tarefa, preencha "Projeto".</p>';
}
async function desenharProjeto(p) {
  $('#tfl-titulo').textContent = p;
  const { tarefas } = await api(`/tarefas/buscar?projeto=${encodeURIComponent(p)}`);
  $('#tfl-corpo').innerHTML = `<button class="link" data-tf-painel="projetos">‹ Todos os projetos</button><ul class="tfl-lista">${tarefas.map((t) => `<li><button data-tfl-dia="${esc(t.dia)}"><b>${esc(t.titulo)}</b><small>${NOME_ETAPA[t.etapa]} · ${rotuloDia(t.dia)}${t.prazo ? ` · ${rotuloPrazo(t.prazo).t}` : ''}</small></button></li>`).join('') || '<li class="dica">Nenhuma tarefa aberta.</li>'}</ul>`;
}
async function desenharLixeira() {
  const { tarefas } = await api('/tarefas/lixeira');
  $('#tfl-corpo').innerHTML = tarefas.length ? `<p class="dica">Removidas nos últimos 60 dias.</p><ul class="tfl-lista">${tarefas.map((t) => `<li class="lixo"><div><b>${esc(t.titulo)}</b><small>${rotuloDia(t.dia)}${t.projeto ? ` · ${esc(t.projeto)}` : ''} · removida ${ha(t.arquivada_em || t.updated_at)}</small></div>
    <span class="acoes"><button class="btn claro" data-tfl-restaurar="${esc(t.id)}">Restaurar</button><button class="link perigo" data-tfl-excluir="${esc(t.id)}">Excluir de vez</button></span></li>`).join('')}</ul>` : '<p class="dica">A lixeira está vazia.</p>';
}
async function desenharSugestoes() {
  const { sugestoes } = await api('/tarefas/sugestoes');
  $('#tfl-corpo').innerHTML = sugestoes.length ? `<p class="dica">Nada vira tarefa sem o seu "Aceitar".</p><ul class="tfl-sug">${sugestoes.map((s) => `<li>
    <small class="origem">${s.origem === 'olho' ? '👁 Olho de Deus' : '💬 Das suas conversas'}</small><b>${esc(s.titulo)}</b>${s.motivo ? `<p>${esc(s.motivo)}</p>` : ''}${s.notas ? `<p class="dica">${esc(s.notas)}</p>` : ''}
    <small>${[s.prazo ? rotuloPrazo(s.prazo).t : '', s.projeto, s.empresa, ha(s.created_at)].filter(Boolean).map(esc).join(' · ')}</small>
    <span class="acoes"><button class="btn primario" data-tfl-aceitar="${esc(s.id)}">Aceitar</button><button class="btn claro" data-tfl-descartar="${esc(s.id)}">Descartar</button></span></li>`).join('')}</ul>` : '<p class="dica">Nenhuma sugestão pendente.</p>';
}
async function painel(modo) {
  abrirLado(modo, { projetos: 'Projetos', lixeira: 'Lixeira', sugestoes: 'Sugestões do Dimy' }[modo]);
  await ({ projetos: desenharProjetos, lixeira: desenharLixeira, sugestoes: desenharSugestoes }[modo])();
}

async function clique(e) {
  const ev = e.target.closest('[data-tf-evento],[data-tf-novo-evento]');
  if (ev) {
    const voltar = () => { carregar(T.dia, true); document.dispatchEvent(new Event('dimy:mudou')); };
    const item = T.agenda?.eventos?.find((i) => i.id === ev.dataset.tfEvento);
    editarEvento(item || null, { dia: T.dia, depois: voltar }); return;
  }
  const x = e.target.closest('[data-tf-dia],[data-tf-ir],[data-tf-acao],[data-tf-painel],[data-tfl-fechar],[data-tf-trazer],[data-tf-adiar-todas],[data-tf-editar],[data-tfd-adiar],[data-tfl-projeto],[data-tfl-dia],[data-tfl-restaurar],[data-tfl-excluir],[data-tfl-aceitar],[data-tfl-descartar],[data-tfs-feita],[data-tfs-apagar],#tf-pri,#tf-dia');
  if (!x) return;
  const d = x.dataset;
  try {
    if (x.id === 'tf-pri') { T.prioridade = T.prioridade === 1 ? 2 : 1; x.dataset.p = String(T.prioridade); x.setAttribute('aria-label', T.prioridade === 1 ? 'Prioridade alta' : 'Prioridade normal'); return; }
    if (x.id === 'tf-dia') { await carregar(hoje()); return; }
    if (d.tfDia) { await carregar(somaDias(T.dia, Number(d.tfDia))); return; }
    if (d.tfIr) { await carregar(d.tfIr); return; }
    if (d.tfPainel) { await painel(d.tfPainel); return; }
    if (d.tflFechar !== undefined) { fecharLado(); return; }
    if (d.tflProjeto) { await desenharProjeto(d.tflProjeto); return; }
    if (d.tflDia) { await carregar(d.tflDia); return; }
    if (d.tfEditar) { const t = porId(d.tfEditar) || (await api(`/tarefas/${d.tfEditar}/detalhe`)).tarefa; editar(t); return; }
    x.disabled = true;
    if (d.tfTrazer !== undefined) { for (const t of T.dados.atrasadas) await api(`/tarefas/${t.id}`, { metodo: 'POST', corpo: { dia: T.dados.hoje } }); aviso('Trouxe tudo para hoje.'); await carregar(T.dados.hoje); return; }
    if (d.tfAdiarTodas !== undefined) { const r = await api('/tarefas/adiar-pendentes', { metodo: 'POST', corpo: { dia: T.dia } }); aviso(`${r.movidas} tarefa(s) para ${rotuloDia(r.para).toLowerCase()}.`); await carregar(T.dia); return; }
    if (d.tfdAdiar) { const r = await api(`/tarefas/${d.tfdAdiar}/adiar`, { metodo: 'POST' }); aviso(`Passei para ${rotuloDia(r.tarefa?.dia || proxUtil(T.dia)).toLowerCase()}.`); await carregar(T.dia); await desenharDetalhe(); return; }
    if (d.tflRestaurar) { await api(`/tarefas/${d.tflRestaurar}/restaurar`, { metodo: 'POST' }); aviso('Tarefa restaurada.'); await desenharLixeira(); await carregar(T.dia); return; }
    if (d.tflExcluir) { if (!confirm('Excluir esta tarefa de vez? Não dá para desfazer.')) { x.disabled = false; return; } await api(`/tarefas/${d.tflExcluir}/excluir`, { metodo: 'POST', corpo: { confirmar: true } }); aviso('Excluída.'); await desenharLixeira(); return; }
    if (d.tflAceitar) { const r = await api(`/tarefas/sugestoes/${d.tflAceitar}/aceitar`, { metodo: 'POST' }); aviso(`Tarefa criada para ${rotuloDia(r.tarefa.dia).toLowerCase()}.`); await desenharSugestoes(); await carregar(T.dia); return; }
    if (d.tflDescartar) { await api(`/tarefas/sugestoes/${d.tflDescartar}/descartar`, { metodo: 'POST' }); await desenharSugestoes(); await carregar(T.dia); return; }
    if (d.tfsFeita) { await api(`/tarefas/${T.detalhe}/subtarefas/${d.tfsFeita}`, { metodo: 'POST', corpo: { feita: d.v === '1' } }); await desenharDetalhe(); await carregar(T.dia); return; }
    if (d.tfsApagar) { await api(`/tarefas/${T.detalhe}/subtarefas/${d.tfsApagar}/apagar`, { metodo: 'POST' }); await desenharDetalhe(); await carregar(T.dia); return; }
    const li = x.closest('[data-tf]'), t = porId(li?.dataset.tf); if (!t) return;
    const a = d.tfAcao;
    if (a === 'detalhe') { x.disabled = false; T.detalhe = t.id; abrirLado('detalhe', t.titulo); await desenharDetalhe(); return; }
    if (a === 'editar') { x.disabled = false; editar(t); return; }
    li.classList.add('mexendo');
    if (a === 'concluir') await mudar(t.id, { etapa: 'feito' }, 'Feito! ✅');
    if (a === 'reabrir') await mudar(t.id, { etapa: 'a_fazer' });
    if (a === 'avancar') await mudar(t.id, { etapa: t.etapa === 'a_fazer' ? 'fazendo' : 'feito' }, t.etapa === 'fazendo' ? 'Feito! ✅' : null);
    if (a === 'hoje') await mudar(t.id, { dia: T.dados.hoje }, 'Trouxe para hoje.');
    if (a === 'adiar') { const r = await api(`/tarefas/${t.id}/adiar`, { metodo: 'POST' }); aviso(`Passei para ${rotuloDia(r.tarefa?.dia || proxUtil(T.dia)).toLowerCase()}.`); await carregar(T.dia); }
  } catch (err) { x.disabled = false; aviso(err.message, 'erro'); }
}
async function enviar(e) {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'tf-nova') {
    const titulo = $('#tf-titulo').value.trim(); if (!titulo) return;
    $('#tf-titulo').value = '';
    try { await api('/tarefas', { metodo: 'POST', corpo: { titulo, dia: T.dia, prioridade: T.prioridade } }); T.prioridade = 2; $('#tf-pri').dataset.p = '2'; await carregar(T.dia); document.dispatchEvent(new Event('dimy:mudou')); $('#tf-titulo').focus(); }
    catch (err) { $('#tf-titulo').value = titulo; aviso(err.message, 'erro'); }
    return;
  }
  if (f.dataset.tfs) {
    const v = String(new FormData(f).get('v') || '').trim(); if (!v) return;
    try {
      await api(f.dataset.tfs === 'nova' ? `/tarefas/${T.detalhe}/subtarefas` : `/tarefas/${T.detalhe}/nota`, { metodo: 'POST', corpo: f.dataset.tfs === 'nova' ? { titulo: v } : { texto: v } });
      await desenharDetalhe(); $(`[data-tfs="${f.dataset.tfs}"] input`)?.focus(); carregar(T.dia).catch(() => {});
    } catch (err) { aviso(err.message, 'erro'); }
  }
}
