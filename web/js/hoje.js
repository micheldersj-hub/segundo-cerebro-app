// Hoje: calendário do mês com os compromissos, agenda do dia, o que pede você agora, quem espera resposta, lembretes e tarefas.
import { $, api, avatar, diaISO, diaSemana, editarEvento, eventosDe, editarLembrete, eEndereco, esc, ha, hoje, horaISO, IC, linkMapa, maiuscula, nomeDe, nomeDia, quando, Sessao, somaDias } from './base.js';

export const titulo = 'Hoje';
const H = { dia: hoje(), mes: hoje().slice(0, 7), eventos: [], google: true, dados: null, tarefas: null, olho: null, carregadoMes: '' };
let el = null;

const inicioDaSemana = (dia) => somaDias(dia, -((diaSemana(dia) + 6) % 7));
function grade(mes) {
  const ini = inicioDaSemana(`${mes}-01`);
  const [a, m] = mes.split('-').map(Number);
  const ultimo = diaISO(new Date(Date.UTC(a, m, 0, 15)));
  const fim = somaDias(inicioDaSemana(ultimo), 6);
  return { ini, dias: Math.round((Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${ini}T12:00:00Z`)) / 864e5) + 1 };
}
const mesSeguinte = (mes, n) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
function saudacao() {
  const h = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }));
  return `${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}, ${(Sessao.eu?.usuario?.nome || 'Michelder').split(' ')[0]}`;
}

export async function abrir(alvo) {
  el = alvo;
  el.innerHTML = `
    <header class="cab">
      <div><p class="cab-sup" id="h-saud"></p><h1 id="h-data"></h1></div>
      <div class="cab-acoes"><a class="btn claro" href="#/agenda">${IC.cal}Abrir agenda</a><button class="btn claro" data-h="lembrete">${IC.sino}Lembrete</button><button class="btn primario" data-h="evento">${IC.mais}Compromisso</button></div>
    </header>
    <div class="hoje-grade">
      <section class="cartao cal">
        <div class="cal-cab"><button class="ic-btn" data-h="mes-ant" aria-label="Mês anterior">${IC.esq}</button><h2 id="h-mes"></h2><button class="ic-btn" data-h="mes-prox" aria-label="Próximo mês">${IC.dir}</button><button class="pilula" data-h="ir-hoje" id="h-ir-hoje">Hoje</button></div>
        <div class="cal-letras">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => `<span>${d}</span>`).join('')}</div>
        <div class="cal-mes" id="h-grade" role="grid"></div>
      </section>
      <section class="cartao agenda-dia"><div class="sec-cab"><h2 id="h-agenda-t">Agenda</h2><a class="link" href="#/agenda/semana">Ver semana</a><button class="ic-btn" data-h="evento" aria-label="Novo compromisso">${IC.mais}</button></div><div id="h-agenda"></div></section>
      <aside class="hoje-lado">
        <section class="cartao"><div class="sec-cab"><h2>Agora</h2><span class="contador" id="h-agora-n"></span></div><div id="h-agora" class="agora"></div></section>
        <section class="cartao so-dono" id="h-espera-sec" hidden><div class="sec-cab"><h2 id="h-espera-t">Esperando você</h2><a class="link" href="#/whats">Abrir WhatsApp</a></div><ul id="h-espera" class="lista-pessoas"></ul></section>
        <section class="cartao"><div class="sec-cab"><h2>Lembretes</h2><button class="ic-btn" data-h="lembrete" aria-label="Novo lembrete">${IC.mais}</button></div><ul id="h-lembretes" class="lista-simples"></ul></section>
        <section class="cartao"><div class="sec-cab"><h2>Tarefas de hoje</h2><a class="link" href="#/tarefas">Ver todas</a></div><div id="h-tarefas"></div></section>
        <a class="cartao olho-mini" href="#/olho" id="h-olho"></a>
      </aside>
    </div>`;
  el.onclick = clique;
  await atualizar();
}

export async function atualizar(silencioso = false) {
  if (!el?.isConnected) return;
  $('#h-saud').textContent = saudacao();
  $('#h-data').textContent = maiuscula(nomeDia(hoje(), { weekday: 'long', day: 'numeric', month: 'long' }));
  const [d] = await Promise.all([api('/hoje'), carregarMes(silencioso), api('/tarefas').then((t) => (H.tarefas = t)).catch(() => {}), api('/olho/painel').then((o) => (H.olho = o)).catch(() => {})]);
  H.dados = d;
  desenharAgora(d); desenharEspera(d.aguardando || []); desenharLembretes(d.lembretes || []); desenharTarefas(); desenharOlho();
}

async function carregarMes(forcar) {
  const { ini, dias } = grade(H.mes);
  const chave = `${ini}/${dias}`;
  if (forcar || chave !== H.carregadoMes) {
    try { const r = await eventosDe(ini, dias, forcar); H.google = r.google; H.eventos = r.eventos; H.carregadoMes = chave; H.erroAgenda = ''; }
    catch (e) { H.eventos = []; H.erroAgenda = e.message; }
  }
  desenharMes(); desenharDia();
}

function desenharMes() {
  const { ini, dias } = grade(H.mes), hj = hoje();
  $('#h-mes').textContent = maiuscula(nomeDia(`${H.mes}-15`, { month: 'long', year: 'numeric' }));
  $('#h-ir-hoje').hidden = H.mes === hj.slice(0, 7) && H.dia === hj;
  const porDia = {};
  for (const e of H.eventos) (porDia[diaISO(e.inicio)] ||= []).push(e);
  $('#h-grade').innerHTML = Array.from({ length: dias }, (_, k) => {
    const dia = somaDias(ini, k), evs = (porDia[dia] || []).sort((a, b) => a.inicio.localeCompare(b.inicio)), ds = diaSemana(dia);
    const cls = ['cal-dia', dia === H.dia ? 'sel' : '', dia === hj ? 'hoje' : '', dia.slice(0, 7) !== H.mes ? 'fora' : '', ds === 0 || ds === 6 ? 'fds' : ''].join(' ');
    return `<button class="${cls}" data-dia="${dia}" role="gridcell" aria-label="${nomeDia(dia, { day: 'numeric', month: 'long' })}${evs.length ? `, ${evs.length} compromisso(s)` : ''}">
      <span class="cal-n">${Number(dia.slice(8))}</span>
      ${evs.slice(0, 3).map((e) => `<span class="cal-ev">${e.dia_inteiro ? '' : `<b>${horaISO(e.inicio)}</b> `}${esc(e.titulo)}</span>`).join('')}
      ${evs.length > 3 ? `<span class="cal-mais">+${evs.length - 3}</span>` : ''}</button>`;
  }).join('');
}

function desenharDia() {
  const hj = hoje(), dia = H.dia;
  $('#h-agenda-t').textContent = dia === hj ? 'Agenda de hoje' : dia === somaDias(hj, 1) ? 'Agenda de amanhã' : maiuscula(nomeDia(dia, { weekday: 'long', day: 'numeric', month: 'short' }));
  const box = $('#h-agenda');
  if (H.erroAgenda) { box.innerHTML = `<p class="vazio">Não consegui ler sua agenda agora (${esc(H.erroAgenda)}). Tento de novo em instantes.</p>`; return; }
  if (!H.google) { box.innerHTML = '<p class="vazio">Conecte o Google no app (Avisos › Ajustes) para ver sua agenda aqui.</p>'; return; }
  const evs = H.eventos.filter((e) => diaISO(e.inicio) === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (!evs.length) { box.innerHTML = `<button class="vazio-cartao" data-h="evento">${IC.cal}<span>Dia livre<small>Clique para marcar um compromisso</small></span></button>`; return; }
  const agora = Date.now();
  let marcou = dia !== hj;
  box.innerHTML = '<ol class="linha-tempo">' + evs.map((e, k) => {
    let linha = '';
    if (!marcou && Date.parse(e.inicio) > agora) { marcou = true; linha = `<li class="agora-linha"><span>${horaISO(new Date())}</span></li>`; }
    const passou = e.fim && Date.parse(e.fim) < agora;
    return `${linha}<li class="ev ${passou ? 'passou' : ''} c${k % 5}"><button class="ev-cartao" data-evento="${esc(e.id)}">
      <span class="ev-h">${e.dia_inteiro ? 'Dia todo' : `${horaISO(e.inicio)}${e.fim ? ` – ${horaISO(e.fim)}` : ''}`}</span>
      <span class="ev-t">${esc(e.titulo)}</span>${e.local ? `<span class="ev-l">${IC.local}${esc(e.local)}</span>` : ''}</button>
      ${eEndereco(e.local) && !passou ? `<a class="pilula" href="${esc(linkMapa(e.local))}" target="_blank" rel="noopener">Rota no mapa</a>` : ''}</li>`;
  }).join('') + (!marcou ? `<li class="agora-linha"><span>${horaISO(new Date())}</span></li>` : '') + '</ol>';
}

const TIPOS_MSG = { unsupported: 'mandou figurinha ou reação', image: 'mandou uma foto', audio: 'mandou um áudio', video: 'mandou um vídeo', document: 'mandou um documento', sticker: 'mandou uma figurinha', location: 'mandou uma localização' };
const textoAviso = (t) => String(t || '').replace(/\[(\w+)\]/g, (m, k) => TIPOS_MSG[k.toLowerCase()] || m).replace(/^\p{Extended_Pictographic}\s*/u, '');
function desenharAgora(d) {
  const itens = [];
  for (const u of d.avisos.filter((a) => a.kind === 'urgente' && !a.read_at).slice(0, 5)) itens.push({ t: 'urgente', r: 'Urgente', x: `${u.title.replace(/^🚨\s*/, '')}: ${u.body}`, ir: u.data?.contact ? `#/whats/${u.data.contact}` : '' });
  for (const p of d.perguntas || []) itens.push({ t: 'pergunta', r: 'Dúvida do Dimy', x: p.question, ir: '#/conversa' });
  for (const e of (Array.isArray(d.agenda) ? d.agenda : []).filter((x) => new Date(x.inicio) - Date.now() < 3 * 3600e3 && new Date(x.inicio) > Date.now() - 15 * 60e3).slice(0, 3)) itens.push({ t: 'agenda', r: `Agenda · ${horaISO(e.inicio)}`, x: `${e.titulo}${e.local ? `, em ${e.local}` : ''}` });
  for (const c of (d.aguardando || []).filter((x) => Date.now() - Date.parse(x.last_in_at || x.last_seen) < 48 * 3600e3).slice(0, 4)) itens.push({ t: 'whats', r: 'Espera resposta', x: `${nomeDe(c)}${c.last_summary ? `: ${c.last_summary}` : ' mandou mensagem.'}`, ir: `#/whats/${c.wa_id}` });
  for (const l of (d.lembretes || []).filter((x) => new Date(x.due_at) - Date.now() < 6 * 3600e3).slice(0, 3)) itens.push({ t: 'lembrete', r: `Lembrete · ${horaISO(l.due_at)}`, x: l.text });
  for (const a of d.avisos.filter((x) => !x.read_at && x.kind !== 'urgente' && Date.now() - Date.parse(x.created_at) < 24 * 3600e3).slice(0, 4)) itens.push({ t: 'aviso', r: textoAviso(a.title), x: textoAviso(a.body), ir: a.data?.contact ? `#/whats/${a.data.contact}` : String(a.data?.url || '').startsWith('./#') ? `#/${a.data.url.slice(3).replace(/^contato\//, 'whats/').replace(/^dossie\//, 'oraculo/')}` : '' });
  $('#h-agora-n').textContent = itens.length || '';
  $('#h-agora').innerHTML = itens.length ? itens.map((a) => `<${a.ir ? `a href="${esc(a.ir)}"` : 'div'} class="agora-item t-${a.t}"><small>${esc(a.r)}</small><span>${esc(a.x)}</span></${a.ir ? 'a' : 'div'}>`).join('')
    : '<p class="vazio">Nada pedindo você agora.</p>';
}
function desenharEspera(esp) {
  const sec = $('#h-espera-sec'); sec.hidden = !esp.length || (Sessao.eu && !Sessao.eu.dono);
  const t = (c) => c.last_in_at || c.last_seen;
  const ord = [...esp].sort((x, y) => Date.parse(t(y)) - Date.parse(t(x)));
  $('#h-espera-t').textContent = `${ord.length} esperando você`;
  $('#h-espera').innerHTML = ord.slice(0, 6).map((c) => `<li><a class="pessoa" href="#/whats/${esc(c.wa_id)}">${avatar(c)}<span class="pessoa-corpo"><b>${esc(nomeDe(c))}</b><small>${esc(c.last_summary || 'Mandou mensagem')}</small></span><span class="h">${ha(t(c))}</span></a>
    <button class="ic-btn ok" data-resolver="${esc(c.wa_id)}" title="Marcar como respondida" aria-label="Marcar como respondida">${IC.ok}</button></li>`).join('');
}
function desenharLembretes(lem) {
  $('#h-lembretes').innerHTML = lem.length ? lem.map((l) => `<li><button class="lembrete" data-lembrete="${esc(l.id)}">${IC.sino}<span>${esc(l.text)}</span><small>${quando(l.due_at)}</small></button></li>`).join('')
    : `<li><button class="vazio-cartao mini" data-h="lembrete">${IC.mais}Criar um lembrete</button></li>`;
}
function desenharTarefas() {
  const t = H.tarefas; if (!t) { $('#h-tarefas').innerHTML = ''; return; }
  const abertas = [...(t.atrasadas || []), ...t.tarefas.filter((x) => x.etapa !== 'feito')];
  const feitas = t.tarefas.filter((x) => x.etapa === 'feito').length, total = t.tarefas.length;
  $('#h-tarefas').innerHTML = `${total ? `<div class="barra"><span style="width:${Math.round((feitas / total) * 100)}%"></span></div><p class="dica">${feitas} de ${total} feitas${t.atrasadas?.length ? ` · ${t.atrasadas.length} atrasada(s)` : ''}</p>` : ''}
    <ul class="lista-simples">${abertas.slice(0, 6).map((x) => `<li><a class="tf-mini ${x.prioridade === 1 ? 'p1' : ''}" href="#/tarefas"><i class="et-${x.etapa}"></i>${esc(x.titulo)}</a></li>`).join('') || '<li class="vazio">Nada aberto para hoje.</li>'}</ul>`;
}
function desenharOlho() {
  const o = H.olho, a = $('#h-olho'); if (!o) { a.hidden = true; return; }
  const k = o.kpis, n = k.alertas.critico + k.alertas.alto + k.alertas.medio + k.alertas.baixo;
  a.hidden = false;
  a.innerHTML = `<span class="olho-ic"><svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></span>
    <span><b>Olho de Deus</b><small>${k.concorrentes} concorrentes · ${k.similares} similares · ${k.movimentos_30d} movimentos em 30 dias</small></span>${n ? `<i class="badge alerta">${n}</i>` : ''}`;
}

async function clique(e) {
  const dia = e.target.closest('[data-dia]');
  if (dia) { H.dia = dia.dataset.dia; if (H.dia.slice(0, 7) !== H.mes) { H.mes = H.dia.slice(0, 7); await carregarMes(); } else { desenharMes(); desenharDia(); } return; }
  const ev = e.target.closest('[data-evento]');
  if (ev) { const x = H.eventos.find((i) => i.id === ev.dataset.evento); if (x) editarEvento(x, { depois: recarregarAgenda }); return; }
  const lb = e.target.closest('[data-lembrete]');
  if (lb) { const l = H.dados?.lembretes?.find((x) => x.id === lb.dataset.lembrete); if (l) editarLembrete(l, { depois: () => atualizar() }); return; }
  const rs = e.target.closest('[data-resolver]');
  if (rs) { rs.disabled = true; try { await api(`/contatos/${rs.dataset.resolver}/resolvido`, { metodo: 'POST' }); rs.closest('li').remove(); document.dispatchEvent(new Event('dimy:mudou')); } catch (err) { rs.disabled = false; } return; }
  const b = e.target.closest('[data-h]'); if (!b) return;
  const a = b.dataset.h;
  if (a === 'evento') editarEvento(null, { dia: H.dia, depois: recarregarAgenda });
  if (a === 'lembrete') editarLembrete(null, { sugestao: { dia: H.dia }, depois: () => atualizar() });
  if (a === 'mes-ant' || a === 'mes-prox') { H.mes = mesSeguinte(H.mes, a === 'mes-ant' ? -1 : 1); const hj = hoje(); H.dia = hj.slice(0, 7) === H.mes ? hj : `${H.mes}-01`; await carregarMes(); }
  if (a === 'ir-hoje') { H.dia = hoje(); H.mes = H.dia.slice(0, 7); await carregarMes(); }
}
async function recarregarAgenda(dia) { if (dia) { H.dia = dia; H.mes = dia.slice(0, 7); } await carregarMes(true); }
