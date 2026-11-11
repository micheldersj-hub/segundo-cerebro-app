// Hoje: o painel do dia, todo visível sem rolar a página.
// Em cima, um resumo clicável com os números do dia. Embaixo, três colunas de mesma altura; cada uma rola por dentro:
//   1) Agenda de hoje (linha do tempo) e lembretes   2) Pede você: urgentes, dúvidas do Dimy e avisos, cada um resolvível ali
//   3) Tarefas de hoje (concluir com um clique) e quem espera resposta no WhatsApp.
// O calendário do mês fica na tela Agenda.
import { $, api, aviso, avatar, diaISO, editarEvento, editarLembrete, eEndereco, esc, eventosDe, ha, hoje, horaISO, IC, linkMapa, maiuscula, nomeDe, nomeDia, quando, Sessao, somaDias } from './base.js?v=w8';

export const titulo = 'Hoje';
const H = { dados: null, tarefas: null, olho: null, agenda: null, amanha: null, erroAgenda: '', aba: 'urgentes', abertos: new Set(), verAtrasadas: false };
let el = null;

function saudacao() {
  const h = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }));
  return `${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}, ${(Sessao.eu?.usuario?.nome || 'Michelder').split(' ')[0]}`;
}
const TIPOS_MSG = { unsupported: 'mandou figurinha ou reação', image: 'mandou uma foto', audio: 'mandou um áudio', video: 'mandou um vídeo', document: 'mandou um documento', sticker: 'mandou uma figurinha', location: 'mandou uma localização' };
const limpo = (t) => String(t || '').replace(/\[(\w+)\]/g, (m, k) => TIPOS_MSG[k.toLowerCase()] || m).replace(/^[\s\p{Extended_Pictographic}️]+/u, '').trim();
const destinoAviso = (a) => {
  if (a.data?.contact) return `#/whats/${a.data.contact}`;
  const u = String(a.data?.url || '');
  if (u.startsWith('./#')) return `#/${u.slice(3).replace(/^contato\//, 'whats/').replace(/^dossie\//, 'oraculo/').replace(/^(hoje|avisos|mais)$/, 'hoje')}`;
  return '';
};

export async function abrir(alvo) {
  el = alvo;
  el.innerHTML = `
    <header class="cab hj-cab">
      <div><p class="cab-sup" id="h-saud"></p><h1 id="h-data"></h1></div>
      <div class="cab-acoes"><button class="btn claro" data-h="lembrete">${IC.sino}Lembrete</button><button class="btn primario" data-h="evento">${IC.mais}Compromisso</button></div>
    </header>
    <nav class="hj-resumo" id="h-resumo" aria-label="Resumo do dia"></nav>
    <div class="hj-painel">
      <div class="hj-coluna">
        <section class="cartao hj-bloco hj-agenda">
          <header class="hj-bloco-cab"><h2>${IC.cal}<span>Agenda</span></h2><span class="contador" id="h-ag-n"></span><a class="link" href="#/agenda/semana">Semana</a><button class="ic-btn" data-h="evento" title="Novo compromisso" aria-label="Novo compromisso">${IC.mais}</button></header>
          <div class="hj-rolagem" id="h-agenda"></div>
        </section>
        <section class="cartao hj-bloco hj-lembretes">
          <header class="hj-bloco-cab"><h2>${IC.sino}<span>Lembretes</span></h2><span class="contador" id="h-lb-n"></span><button class="ic-btn" data-h="lembrete" title="Novo lembrete" aria-label="Novo lembrete">${IC.mais}</button></header>
          <div class="hj-rolagem" id="h-lembretes"></div>
        </section>
      </div>
      <section class="cartao hj-bloco hj-pede">
        <header class="hj-bloco-cab"><h2>${IC.alerta}<span>Pede você</span></h2><button class="link" data-h="todos-vistos" id="h-todos" hidden>Marcar todos como vistos</button></header>
        <nav class="seg hj-abas" id="h-abas" role="tablist"></nav>
        <div class="hj-rolagem" id="h-pede"></div>
      </section>
      <div class="hj-coluna">
        <section class="cartao hj-bloco hj-tarefas">
          <header class="hj-bloco-cab"><h2>${IC.tarefas}<span>Tarefas</span></h2><span class="contador" id="h-tf-n"></span><a class="link" href="#/tarefas">Quadro</a></header>
          <div class="hj-progresso" id="h-tf-prog"></div>
          <div class="hj-rolagem" id="h-tarefas"></div>
        </section>
        <section class="cartao hj-bloco hj-espera so-dono" id="h-espera-sec">
          <header class="hj-bloco-cab"><h2>${IC.whats}<span>Esperando</span></h2><span class="contador" id="h-es-n"></span><a class="link" href="#/whats">WhatsApp</a></header>
          <div class="hj-rolagem" id="h-espera"></div>
        </section>
      </div>
    </div>`;
  el.onclick = clique;
  if (Sessao.eu && !Sessao.eu.dono) $('#h-espera-sec').hidden = true;
  await atualizar();
}

export async function atualizar(silencioso = false) {
  if (!el?.isConnected) return;
  $('#h-saud').textContent = saudacao();
  $('#h-data').textContent = maiuscula(nomeDia(hoje(), { weekday: 'long', day: 'numeric', month: 'long' }));
  const hj = hoje();
  const [d] = await Promise.all([
    api('/hoje'),
    eventosDe(hj, 2, silencioso).then((r) => { H.agenda = r; H.erroAgenda = ''; }).catch((e) => { H.agenda = null; H.erroAgenda = e.message; }),
    api('/tarefas').then((t) => (H.tarefas = t)).catch(() => {}),
    api('/olho/painel').then((o) => (H.olho = o)).catch(() => {}),
  ]);
  H.dados = d;
  desenharResumo(); desenharAgenda(); desenharLembretes(); desenharPede(); desenharTarefas(); desenharEspera();
}

// ---------- Dados derivados ----------
const eventosHoje = () => (H.agenda?.eventos || []).filter((e) => diaISO(e.inicio) === hoje()).sort((a, b) => a.inicio.localeCompare(b.inicio));
const eventosAmanha = () => (H.agenda?.eventos || []).filter((e) => diaISO(e.inicio) === somaDias(hoje(), 1)).sort((a, b) => a.inicio.localeCompare(b.inicio));
function pendencias() {
  const d = H.dados || {}, avisos = (d.avisos || []).filter((a) => !a.read_at);
  return {
    urgentes: avisos.filter((a) => a.kind === 'urgente'),
    duvidas: d.perguntas || [],
    avisos: avisos.filter((a) => a.kind !== 'urgente'),
  };
}
const esperando = () => [...(H.dados?.aguardando || [])].sort((x, y) => Date.parse(y.last_in_at || y.last_seen) - Date.parse(x.last_in_at || x.last_seen));

// ---------- Resumo do dia (cada número leva ao lugar certo) ----------
function desenharResumo() {
  const evs = eventosHoje(), agora = Date.now(), restam = evs.filter((e) => Date.parse(e.fim || e.inicio) >= agora).length;
  const t = H.tarefas, abertas = t ? t.tarefas.filter((x) => x.etapa !== 'feito').length : 0, atr = t?.atrasadas?.length || 0;
  const p = pendencias(), esp = esperando().length;
  const k = H.olho?.kpis, alertas = k ? k.alertas.critico + k.alertas.alto + k.alertas.medio + k.alertas.baixo : 0;
  const prox = evs.find((e) => Date.parse(e.fim || e.inicio) >= agora);
  const tiles = [
    { ic: IC.cal, n: restam, t: restam === 1 ? 'compromisso' : 'compromissos', s: prox ? `Próximo ${prox.dia_inteiro ? 'hoje' : `às ${horaISO(prox.inicio)}`}: ${prox.titulo}` : evs.length ? 'Agenda de hoje encerrada' : 'Dia livre', ir: `#/agenda/dia/${hoje()}`, cor: 'mar' },
    { ic: IC.tarefas, n: abertas + atr, t: abertas + atr === 1 ? 'tarefa' : 'tarefas', s: atr ? `${atr} atrasada${atr > 1 ? 's' : ''}` : abertas ? 'Nenhuma atrasada' : 'Tudo em dia', ir: '#/tarefas', cor: atr ? 'vermelho' : 'azul' },
    { ic: IC.alerta, n: p.urgentes.length, t: 'urgentes', s: p.duvidas.length ? `${p.duvidas.length} dúvida${p.duvidas.length > 1 ? 's' : ''} do Dimy` : 'Sem dúvidas do Dimy', aba: 'urgentes', cor: p.urgentes.length ? 'vermelho' : 'cinza' },
    ...(Sessao.eu && !Sessao.eu.dono ? [] : [{ ic: IC.whats, n: esp, t: 'esperando', s: esp ? `no WhatsApp · mais antigo ${ha(esperando().at(-1).last_in_at || esperando().at(-1).last_seen)}` : 'Ninguém esperando', ir: '#/whats', cor: esp ? 'verde' : 'cinza' }]),
    { ic: IC.olho, n: alertas, t: alertas === 1 ? 'alerta' : 'alertas', s: k ? `Olho de Deus · ${k.movimentos_30d} movimentos` : 'Olho de Deus', ir: '#/olho/alertas', cor: alertas ? 'ambar' : 'cinza' },
  ];
  $('#h-resumo').innerHTML = tiles.map((x) => `<${x.ir ? `a href="${x.ir}"` : `button data-h-aba="${x.aba}"`} class="hj-tile c-${x.cor}">
    <span class="hj-tile-ic">${x.ic}</span><span class="hj-tile-txt"><span class="hj-tile-l"><b>${x.n}</b> ${esc(x.t)}</span><small>${esc(x.s)}</small></span></${x.ir ? 'a' : 'button'}>`).join('');
}

// ---------- Coluna 1: agenda e lembretes ----------
function desenharAgenda() {
  const box = $('#h-agenda'), hj = hoje();
  if (H.erroAgenda) { box.innerHTML = `<p class="vazio">Não consegui ler sua agenda agora (${esc(H.erroAgenda)}). Tento de novo em instantes.</p>`; $('#h-ag-n').textContent = ''; return; }
  if (H.agenda && !H.agenda.google) { box.innerHTML = '<p class="vazio">Conecte o Google no app (Avisos › Ajustes) para ver sua agenda aqui.</p>'; return; }
  const evs = eventosHoje(), agora = Date.now();
  $('#h-ag-n').textContent = evs.length || '';
  let html = '';
  if (!evs.length) html = `<button class="vazio-cartao" data-h="evento">${IC.cal}<span>Dia livre<small>Clique para marcar um compromisso</small></span></button>`;
  else {
    let marcou = false;
    html = '<ol class="linha-tempo">' + evs.map((e, k) => {
      let linha = '';
      if (!marcou && Date.parse(e.inicio) > agora) { marcou = true; linha = `<li class="agora-linha"><span>${horaISO(new Date())}</span></li>`; }
      const passou = Date.parse(e.fim || e.inicio) < agora, rota = eEndereco(e.local) && !passou;
      return `${linha}<li class="ev ${passou ? 'passou' : ''} c${k % 5}"><button class="ev-cartao" data-evento="${esc(e.id)}">
        <span class="ev-h">${e.dia_inteiro ? 'Dia todo' : `${horaISO(e.inicio)}${e.fim ? ` – ${horaISO(e.fim)}` : ''}`}</span>
        <span class="ev-t">${esc(e.titulo)}</span>${e.local ? `<span class="ev-l">${rota ? IC.local : ''}${esc(e.local)}</span>` : ''}</button>
        ${rota ? `<a class="ic-btn" href="${esc(linkMapa(e.local))}" target="_blank" rel="noopener" title="Rota no mapa" aria-label="Rota no mapa">${IC.local}</a>` : ''}</li>`;
    }).join('') + (!marcou ? `<li class="agora-linha"><span>${horaISO(new Date())}</span></li>` : '') + '</ol>';
  }
  const am = eventosAmanha();
  if (am.length) html += `<a class="hj-amanha" href="#/agenda/dia/${somaDias(hj, 1)}"><b>Amanhã</b> ${am.length} compromisso${am.length > 1 ? 's' : ''} · primeiro ${am[0].dia_inteiro ? 'o dia todo' : `às ${horaISO(am[0].inicio)}`}: ${esc(am[0].titulo)}</a>`;
  box.innerHTML = html;
}
function desenharLembretes() {
  const lem = H.dados?.lembretes || [];
  $('#h-lb-n').textContent = lem.length || '';
  $('#h-lembretes').innerHTML = lem.length ? `<ul class="lista-simples">${lem.map((l) => `<li><button class="lembrete" data-lembrete="${esc(l.id)}">${IC.sino}<span>${esc(l.text)}</span><small>${quando(l.due_at)}</small></button></li>`).join('')}</ul>`
    : `<button class="vazio-cartao mini" data-h="lembrete">${IC.mais}Criar um lembrete</button>`;
}

// ---------- Coluna 2: o que pede você ----------
const ABAS = [['urgentes', 'Urgentes'], ['duvidas', 'Dúvidas'], ['avisos', 'Avisos']];
function desenharPede() {
  const p = pendencias();
  if (!p[H.aba].length) H.aba = ABAS.find(([k]) => p[k].length)?.[0] || H.aba;
  $('#h-abas').innerHTML = ABAS.map(([k, t]) => `<button role="tab" data-h-aba="${k}" class="${H.aba === k ? 'on' : ''}" aria-selected="${H.aba === k}">${t}${p[k].length ? ` <i class="badge ${k === 'urgentes' ? 'alerta' : ''}">${p[k].length}</i>` : ''}</button>`).join('');
  $('#h-todos').hidden = !(p.urgentes.length + p.avisos.length);
  const lista = p[H.aba], box = $('#h-pede');
  if (!lista.length) { box.innerHTML = `<div class="vazio-grande">${IC.ok}<b>${H.aba === 'duvidas' ? 'Nenhuma dúvida do Dimy' : 'Nada pendente aqui'}</b><span>Quando algo precisar de você, aparece nesta coluna.</span></div>`; return; }
  box.innerHTML = `<ul class="hj-itens">${lista.map((x) => item(x)).join('')}</ul>`;
}
function item(x) {
  if (H.aba === 'duvidas') {
    return `<li class="hj-item t-duvida"><div class="hj-item-txt"><p>${esc(x.question)}</p><small>${ha(x.created_at)}</small></div>
      <div class="hj-item-acoes"><a class="btn claro mini" href="#/conversa" data-h-responder="${esc(x.question)}">Responder ao Dimy</a></div></li>`;
  }
  const titulo = limpo(x.title).replace(/^urgente:?\s*/i, ''), corpo = limpo(x.body), ir = destinoAviso(x), aberto = H.abertos.has(x.id);
  return `<li class="hj-item ${x.kind === 'urgente' ? 't-urgente' : 't-aviso'} ${aberto ? 'aberto' : ''}">
    <div class="hj-item-txt" data-h-expandir="${esc(x.id)}" title="${aberto ? 'Recolher' : 'Ver tudo'}"><b>${esc(titulo)}</b><p>${esc(corpo)}</p><small>${ha(x.created_at)}</small></div>
    <div class="hj-item-acoes">${ir ? `<a class="btn claro mini" href="${esc(ir)}">${ir.startsWith('#/whats') ? 'Abrir conversa' : 'Abrir'}</a>` : ''}
      <button class="btn claro mini" data-h-visto="${esc(x.id)}" title="Tirar desta lista">${IC.ok}Resolvido</button></div></li>`;
}

// ---------- Coluna 3: tarefas e quem espera ----------
function desenharTarefas() {
  const t = H.tarefas, box = $('#h-tarefas');
  if (!t) { box.innerHTML = '<p class="vazio">Não consegui carregar as tarefas.</p>'; return; }
  const doDia = t.tarefas, feitas = doDia.filter((x) => x.etapa === 'feito').length, abertas = doDia.filter((x) => x.etapa !== 'feito'), atr = t.atrasadas || [];
  $('#h-tf-n').textContent = abertas.length + atr.length || '';
  $('#h-tf-prog').innerHTML = doDia.length ? `<div class="barra"><span style="width:${Math.round((feitas / doDia.length) * 100)}%"></span></div><small>${feitas} de ${doDia.length} de hoje feitas</small>` : '';
  const li = (x, atrasada) => `<li class="hj-tf ${x.prioridade === 1 ? 'p1' : ''}">
    <button class="tf-check mini" data-h-concluir="${esc(x.id)}" title="Concluir" aria-label="Concluir">${IC.ok}</button>
    <a href="#/tarefas" class="hj-tf-t"><span>${esc(x.titulo)}</span>${atrasada ? `<small class="atr">de ${nomeDia(x.dia, { day: '2-digit', month: 'short' }).replace('.', '')}</small>` : x.etapa === 'fazendo' ? '<small class="faz">fazendo</small>' : ''}</a></li>`;
  let html = abertas.length ? `<ul class="hj-tfs">${abertas.map((x) => li(x, false)).join('')}</ul>` : `<p class="vazio">${doDia.length ? 'Tudo de hoje feito. 👏' : 'Nada marcado para hoje.'}</p>`;
  if (atr.length) {
    html += `<button class="hj-grupo ${H.verAtrasadas ? 'aberto' : ''}" data-h="atrasadas">${IC.dir}<b>${atr.length} atrasada${atr.length > 1 ? 's' : ''}</b><span>${H.verAtrasadas ? 'esconder' : 'mostrar'}</span></button>`;
    if (H.verAtrasadas) html += `<ul class="hj-tfs">${atr.map((x) => li(x, true)).join('')}</ul>`;
  }
  box.innerHTML = html;
}
function desenharEspera() {
  const esp = esperando(); $('#h-es-n').textContent = esp.length || '';
  const t = (c) => c.last_in_at || c.last_seen;
  $('#h-espera').innerHTML = esp.length ? `<ul class="lista-pessoas">${esp.map((c) => `<li><a class="pessoa" href="#/whats/${esc(c.wa_id)}">${avatar(c)}<span class="pessoa-corpo"><b>${esc(nomeDe(c))}</b><small>${esc(c.last_summary || 'Mandou mensagem')}</small></span><span class="h">${ha(t(c))}</span></a>
    <button class="ic-btn ok" data-resolver="${esc(c.wa_id)}" title="Já respondi" aria-label="Já respondi">${IC.ok}</button></li>`).join('')}</ul>`
    : '<p class="vazio">Ninguém esperando resposta.</p>';
}

// ---------- Ações ----------
const mudou = () => document.dispatchEvent(new Event('dimy:mudou'));
async function clique(e) {
  const ev = e.target.closest('[data-evento]');
  if (ev) { const x = (H.agenda?.eventos || []).find((i) => i.id === ev.dataset.evento); if (x) editarEvento(x, { depois: () => atualizar(true) }); return; }
  const lb = e.target.closest('[data-lembrete]');
  if (lb) { const l = H.dados?.lembretes?.find((x) => x.id === lb.dataset.lembrete); if (l) editarLembrete(l, { depois: () => atualizar() }); return; }
  const ab = e.target.closest('[data-h-aba]');
  if (ab) { H.aba = ab.dataset.hAba; desenharPede(); $('#h-pede').scrollTop = 0; return; }
  const ex = e.target.closest('[data-h-expandir]');
  if (ex) { const id = ex.dataset.hExpandir; H.abertos.has(id) ? H.abertos.delete(id) : H.abertos.add(id); ex.closest('.hj-item').classList.toggle('aberto'); return; }
  const rp = e.target.closest('[data-h-responder]');
  if (rp) { try { sessionStorage.setItem('dimy-rascunho', `Sobre sua dúvida "${rp.dataset.hResponder}": `); } catch { /* sem armazenamento */ } return; }
  const vs = e.target.closest('[data-h-visto]');
  if (vs) {
    const li = vs.closest('li'); li.classList.add('saindo');
    try {
      await api(`/avisos/${vs.dataset.hVisto}/lido`, { metodo: 'POST' });
      const a = H.dados.avisos.find((x) => x.id === vs.dataset.hVisto); if (a) a.read_at = new Date().toISOString();
      desenharPede(); desenharResumo(); mudou();
    } catch (err) { li.classList.remove('saindo'); aviso(err.status === 404 ? 'O servidor ainda está sendo atualizado. Tente de novo em um minuto.' : err.message, 'erro'); }
    return;
  }
  const cc = e.target.closest('[data-h-concluir]');
  if (cc) {
    cc.disabled = true; cc.closest('li').classList.add('feita');
    try { await api(`/tarefas/${cc.dataset.hConcluir}`, { metodo: 'POST', corpo: { etapa: 'feito', dia: hoje() } }); aviso('Feito! ✅'); H.tarefas = await api('/tarefas'); desenharTarefas(); desenharResumo(); mudou(); }
    catch (err) { cc.disabled = false; cc.closest('li').classList.remove('feita'); aviso(err.message, 'erro'); }
    return;
  }
  const rs = e.target.closest('[data-resolver]');
  if (rs) {
    rs.disabled = true;
    try { await api(`/contatos/${rs.dataset.resolver}/resolvido`, { metodo: 'POST' }); H.dados.aguardando = H.dados.aguardando.filter((c) => c.wa_id !== rs.dataset.resolver); desenharEspera(); desenharResumo(); mudou(); }
    catch (err) { rs.disabled = false; aviso(err.message, 'erro'); }
    return;
  }
  const b = e.target.closest('[data-h]'); if (!b) return;
  const a = b.dataset.h;
  if (a === 'evento') editarEvento(null, { dia: hoje(), depois: () => atualizar(true) });
  if (a === 'lembrete') editarLembrete(null, { sugestao: { dia: hoje() }, depois: () => atualizar() });
  if (a === 'atrasadas') { H.verAtrasadas = !H.verAtrasadas; desenharTarefas(); }
  if (a === 'todos-vistos') {
    if (!confirm('Marcar todos os urgentes e avisos como vistos? Eles saem desta lista.')) return;
    try { await api('/avisos/lidas', { metodo: 'POST' }); (H.dados.avisos || []).forEach((x) => { x.read_at ||= new Date().toISOString(); }); desenharPede(); desenharResumo(); mudou(); aviso('Tudo marcado como visto.'); }
    catch (err) { aviso(err.message, 'erro'); }
  }
}
