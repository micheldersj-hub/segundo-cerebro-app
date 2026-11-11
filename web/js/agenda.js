// Agenda: seus compromissos do Google, em dia, semana ou mês. Clique num horário vazio para marcar;
// clique num compromisso para editar. Grava nas mesmas rotas do app (/agenda), então aparece no celular também.
import { $, diaISO, diaSemana, editarEvento, eEndereco, esc, eventosDe, hoje, horaISO, IC, linkMapa, maiuscula, nomeDia, somaDias } from './base.js';

export const titulo = 'Agenda';
const MODOS = [['dia', 'Dia', IC.dia1], ['semana', 'Semana', IC.semana], ['mes', 'Mês', IC.mes]];
const A = { modo: 'semana', dia: hoje(), eventos: [], google: true, prox: [] };
let el = null, rolou = '';

const inicioDaSemana = (dia) => somaDias(dia, -((diaSemana(dia) + 6) % 7));
function periodo() {
  if (A.modo === 'dia') return { de: A.dia, dias: 1 };
  if (A.modo === 'semana') return { de: inicioDaSemana(A.dia), dias: 7 };
  const mes = A.dia.slice(0, 7), de = inicioDaSemana(`${mes}-01`);
  const [a, m] = mes.split('-').map(Number), ultimo = diaISO(new Date(Date.UTC(a, m, 0, 15)));
  const fim = somaDias(inicioDaSemana(ultimo), 6);
  return { de, dias: Math.round((Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 864e5) + 1 };
}
const curto = (d) => nomeDia(d, { day: 'numeric', month: 'short' }).replace('.', '');
function tituloPeriodo() {
  if (A.modo === 'dia') return maiuscula(nomeDia(A.dia, { weekday: 'long', day: 'numeric', month: 'long' }));
  if (A.modo === 'mes') return maiuscula(nomeDia(`${A.dia.slice(0, 7)}-15`, { month: 'long', year: 'numeric' }));
  const { de } = periodo(), ate = somaDias(de, 6);
  return de.slice(5, 7) === ate.slice(5, 7) ? `${Number(de.slice(8))} a ${curto(ate)}` : `${curto(de)} a ${curto(ate)}`;
}
const doDia = (dia) => A.eventos.filter((e) => diaISO(e.inicio) === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));

export async function abrir(alvo, [modo, dia] = []) {
  if (MODOS.some(([k]) => k === modo)) A.modo = modo;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dia || '')) A.dia = dia;
  if (el !== alvo || !$('#ag-vista')) {
    el = alvo; rolou = '';
    el.innerHTML = `
      <header class="cab">
        <div><p class="cab-sup">Agenda</p><h1 id="ag-titulo"></h1></div>
        <div class="cab-acoes">
          <div class="seg" role="tablist" aria-label="Ver por">${MODOS.map(([k, t, ic]) => `<button role="tab" data-ag-modo="${k}">${ic}<span>${t}</span></button>`).join('')}</div>
          <button class="btn primario" data-ag="novo">${IC.mais}Compromisso</button>
        </div>
      </header>
      <div class="ag-nav">
        <button class="ic-btn" data-ag="ant" aria-label="Anterior">${IC.esq}</button>
        <button class="pilula" data-ag="hoje">Hoje</button>
        <button class="ic-btn" data-ag="prox" aria-label="Próximo">${IC.dir}</button>
        <span class="ag-resumo" id="ag-resumo"></span>
      </div>
      <div class="ag-area">
        <section class="cartao ag-vista" id="ag-vista"></section>
        <aside class="ag-lado">
          <section class="cartao"><div class="sec-cab"><h2>Próximos 7 dias</h2></div><div id="ag-prox"></div></section>
        </aside>
      </div>`;
    el.onclick = clique;
  }
  await carregar();
}
export async function atualizar() { if (el?.isConnected) await carregar(true); }

async function carregar(forcar = false) {
  const { de, dias } = periodo();
  const [r, p] = await Promise.all([eventosDe(de, dias, forcar), eventosDe(hoje(), 7, forcar).catch(() => null)]);
  A.google = r.google; A.eventos = r.eventos; A.prox = p?.eventos || [];
  desenhar();
}

function desenhar() {
  $('#ag-titulo').textContent = tituloPeriodo();
  el.querySelectorAll('[data-ag-modo]').forEach((b) => { const on = b.dataset.agModo === A.modo; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  const box = $('#ag-vista');
  if (!A.google) {
    box.innerHTML = `<div class="vazio-grande">${IC.cal}<b>Sua agenda do Google não está conectada</b><span>Conecte no app em Avisos › Ajustes › Conectar Google Agenda. Depois disso ela aparece aqui sozinha.</span></div>`;
    $('#ag-resumo').textContent = ''; $('#ag-prox').innerHTML = ''; return;
  }
  const n = A.modo === 'mes' ? A.eventos.filter((e) => diaISO(e.inicio).slice(0, 7) === A.dia.slice(0, 7)).length : A.eventos.length;
  $('#ag-resumo').textContent = `${n ? n : 'Nenhum'} compromisso${n === 1 ? '' : 's'} ${A.modo === 'dia' ? 'neste dia' : A.modo === 'semana' ? 'nesta semana' : 'neste mês'}`;
  box.className = `cartao ag-vista modo-${A.modo}`;
  box.innerHTML = A.modo === 'mes' ? mes() : grade(A.modo === 'dia' ? [A.dia] : Array.from({ length: 7 }, (_, i) => somaDias(periodo().de, i)));
  desenharProx();
  // Ao abrir a grade, rola até o horário atual (ou 8h)
  const corpo = box.querySelector('.ag-corpo'), chave = `${A.modo}/${periodo().de}`;
  if (corpo && rolou !== chave) {
    rolou = chave;
    const ini = Number(corpo.dataset.ini), h = Math.max(ini, (periodo().de <= hoje() && hoje() <= somaDias(periodo().de, periodo().dias - 1) ? Number(horaISO(new Date()).slice(0, 2)) - 1 : 8));
    corpo.scrollTop = Math.max(0, (h - ini) * parseFloat(getComputedStyle(corpo).getPropertyValue('--h')) - 10);
  }
}

function mes() {
  const { de, dias } = periodo(), hj = hoje(), mesAtual = A.dia.slice(0, 7);
  return `<div class="cal-letras">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => `<span>${d}</span>`).join('')}</div>
    <div class="cal-mes ag-mes">${Array.from({ length: dias }, (_, k) => {
      const dia = somaDias(de, k), evs = doDia(dia), ds = diaSemana(dia);
      const cls = ['cal-dia', dia === hj ? 'hoje' : '', dia.slice(0, 7) !== mesAtual ? 'fora' : '', ds === 0 || ds === 6 ? 'fds' : ''].join(' ');
      return `<button class="${cls}" data-ag-abrir="${dia}" aria-label="${nomeDia(dia, { day: 'numeric', month: 'long' })}${evs.length ? `, ${evs.length} compromisso(s)` : ''}">
        <span class="cal-n">${Number(dia.slice(8))}</span>
        ${evs.slice(0, 4).map((e, i) => `<span class="cal-ev c${i % 5}">${e.dia_inteiro ? '' : `<b>${horaISO(e.inicio)}</b> `}${esc(e.titulo)}</span>`).join('')}
        ${evs.length > 4 ? `<span class="cal-mais">+${evs.length - 4} mais</span>` : ''}</button>`;
    }).join('')}</div>`;
}

// Grade de horários (dia ou semana). Compromissos que se cruzam dividem a largura.
const minutos = (iso) => { const [h, m] = horaISO(iso).split(':').map(Number); return h * 60 + m; };
function faixas(evs) {
  const out = []; let grupo = [], fimGrupo = -1;
  const fecha = () => { const n = Math.max(...grupo.map((g) => g.faixa)) + 1; grupo.forEach((g) => { g.n = n; out.push(g); }); grupo = []; };
  for (const e of evs) {
    const ini = minutos(e.inicio), fim = Math.max(ini + 20, e.fim && diaISO(e.fim) === diaISO(e.inicio) ? minutos(e.fim) : ini + 60);
    if (grupo.length && ini >= fimGrupo) fecha();
    const usadas = grupo.filter((g) => g.fim > ini).map((g) => g.faixa);
    let f = 0; while (usadas.includes(f)) f++;
    grupo.push({ e, ini, fim, faixa: f }); fimGrupo = Math.max(fimGrupo, fim);
  }
  if (grupo.length) fecha();
  return out;
}
function grade(dias) {
  const hj = hoje(), comHora = A.eventos.filter((e) => !e.dia_inteiro);
  const ini = Math.min(7, ...comHora.map((e) => Math.floor(minutos(e.inicio) / 60)));
  const fim = Math.max(22, ...comHora.map((e) => Math.ceil((e.fim && diaISO(e.fim) === diaISO(e.inicio) ? minutos(e.fim) : minutos(e.inicio) + 60) / 60)));
  const inteiros = dias.map((d) => doDia(d).filter((e) => e.dia_inteiro));
  const agoraMin = minutos(new Date().toISOString());
  return `<div class="ag-grade" style="--dias:${dias.length}">
    <div class="ag-cab"><span></span>${dias.map((d) => `<button class="ag-cab-dia ${d === hj ? 'hoje' : ''} ${[0, 6].includes(diaSemana(d)) ? 'fds' : ''}" data-ag-abrir="${d}" title="Ver o dia"><small>${nomeDia(d, { weekday: 'short' }).replace('.', '')}</small><b>${Number(d.slice(8))}</b></button>`).join('')}</div>
    ${inteiros.some((l) => l.length) ? `<div class="ag-inteiro"><span>Dia todo</span>${inteiros.map((l) => `<div>${l.map((e) => `<button class="ag-ev-inteiro" data-evento="${esc(e.id)}">${esc(e.titulo)}</button>`).join('')}</div>`).join('')}</div>` : ''}
    <div class="ag-corpo" data-ini="${ini}">
      <div class="ag-horas">${Array.from({ length: fim - ini }, (_, i) => `<span>${String(ini + i).padStart(2, '0')}:00</span>`).join('')}</div>
      ${dias.map((d) => `<div class="ag-col ${d === hj ? 'hoje' : ''}" data-ag-novo="${d}" style="--horas:${fim - ini}">
        ${faixas(doDia(d).filter((e) => !e.dia_inteiro)).map(({ e, ini: a, fim: b, faixa, n }, k) => {
          const passou = Date.parse(e.fim || e.inicio) < Date.now(), curto = b - a < 45, alto = b - a >= 120;
          return `<button class="ag-ev c${k % 5} ${passou ? 'passou' : ''} ${curto ? 'curto' : ''} ${alto ? 'alto' : ''}" data-evento="${esc(e.id)}"
            style="top:calc(var(--h) * ${(a - ini * 60) / 60});height:calc(var(--h) * ${(b - a) / 60} - 3px);left:calc(${(100 / n) * faixa}% + 2px);width:calc(${100 / n}% - 4px)"
            title="${esc(`${horaISO(e.inicio)}${e.fim ? `–${horaISO(e.fim)}` : ''} ${e.titulo}${e.local ? ` · ${e.local}` : ''}`)}">
            <b>${esc(e.titulo)}</b><small>${horaISO(e.inicio)}${e.fim ? ` – ${horaISO(e.fim)}` : ''}${e.local && !curto ? ` · ${esc(e.local)}` : ''}</small></button>`;
        }).join('')}
        ${d === hj && agoraMin >= ini * 60 && agoraMin <= fim * 60 ? `<i class="ag-agora" style="top:calc(var(--h) * ${(agoraMin - ini * 60) / 60})"></i>` : ''}
      </div>`).join('')}
    </div></div>`;
}

function desenharProx() {
  const hj = hoje(), agora = Date.now();
  const evs = A.prox.filter((e) => Date.parse(e.fim || e.inicio) >= agora).sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (!evs.length) { $('#ag-prox').innerHTML = `<button class="vazio-cartao" data-ag="novo">${IC.cal}<span>Semana livre<small>Clique para marcar um compromisso</small></span></button>`; return; }
  const porDia = {}; for (const e of evs) (porDia[diaISO(e.inicio)] ||= []).push(e);
  $('#ag-prox').innerHTML = Object.entries(porDia).map(([d, l]) => `<div class="ag-prox-dia"><h3>${d === hj ? 'Hoje' : d === somaDias(hj, 1) ? 'Amanhã' : maiuscula(nomeDia(d, { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', ''))}</h3>
    <ol class="linha-tempo">${l.map((e, k) => `<li class="ev c${k % 5}"><button class="ev-cartao" data-evento-prox="${esc(e.id)}">
      <span class="ev-h">${e.dia_inteiro ? 'Dia todo' : `${horaISO(e.inicio)}${e.fim ? ` – ${horaISO(e.fim)}` : ''}`}</span><span class="ev-t">${esc(e.titulo)}</span>
      ${e.local ? `<span class="ev-l">${IC.local}${esc(e.local)}</span>` : ''}</button>
      ${eEndereco(e.local) ? `<a class="ic-btn" href="${esc(linkMapa(e.local))}" target="_blank" rel="noopener" title="Rota no mapa" aria-label="Rota no mapa">${IC.local}</a>` : ''}</li>`).join('')}</ol></div>`).join('');
}

function ir(modo = A.modo, dia = A.dia) { location.hash = `#/agenda/${modo}/${dia}`; }
const depois = (dia) => { if (dia && dia !== A.dia && A.modo !== 'mes') ir(A.modo, dia); else carregar(true); document.dispatchEvent(new Event('dimy:mudou')); };
function clique(e) {
  const ev = e.target.closest('[data-evento], [data-evento-prox]');
  if (ev) { const id = ev.dataset.evento || ev.dataset.eventoProx, x = [...A.eventos, ...A.prox].find((i) => i.id === id); if (x) editarEvento(x, { depois }); return; }
  const m = e.target.closest('[data-ag-modo]'); if (m) { ir(m.dataset.agModo); return; }
  const d = e.target.closest('[data-ag-abrir]'); if (d) { ir('dia', d.dataset.agAbrir); return; }
  const col = e.target.closest('[data-ag-novo]');
  if (col) {   // clique num horário vazio: novo compromisso naquela hora
    const corpo = col.closest('.ag-corpo'), h = parseFloat(getComputedStyle(corpo).getPropertyValue('--h'));
    const y = e.clientY - col.getBoundingClientRect().top, hora = Math.min(23, Number(corpo.dataset.ini) + Math.floor(y / h));
    const ini = `${String(hora).padStart(2, '0')}:${y % h >= h / 2 ? '30' : '00'}`;
    editarEvento(null, { dia: col.dataset.agNovo, hora: ini, depois }); return;
  }
  const b = e.target.closest('[data-ag]'); if (!b) return;
  const a = b.dataset.ag;
  if (a === 'novo') editarEvento(null, { dia: A.dia < hoje() ? hoje() : A.dia, depois });
  if (a === 'hoje') ir(A.modo, hoje());
  if (a === 'ant' || a === 'prox') {
    const s = a === 'ant' ? -1 : 1;
    if (A.modo === 'dia') ir('dia', somaDias(A.dia, s));
    else if (A.modo === 'semana') ir('semana', somaDias(A.dia, 7 * s));
    else { const [y, mm] = A.dia.split('-').map(Number), x = new Date(Date.UTC(y, mm - 1 + s, 1)); ir('mes', `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-01`); }
  }
}
