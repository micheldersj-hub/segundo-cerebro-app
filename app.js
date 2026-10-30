// Segundo Cérebro — app do iPhone (PWA). Fala só com a função "app" do Supabase.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const API = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/app';
const GRAVADOR = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/gravador';
const ORACULO = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/oraculo';
const EQUIPE = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/equipe';
const EXTRA = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/extra';
// Login da equipe (e-mail e senha). A chave pública só permite entrar; os dados passam pelas funções do servidor.
const SUPA = createClient('https://mavjbevuhzalkqyxaajw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hdmpiZXZ1aHphbGtxeXhhYWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5ODg5OTQsImV4cCI6MjEwNjU2NDk5NH0.BGSKd3B2B0m2MuDUmdJHEVOPS6l551axEP7DVAxfidA',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'cerebro-sessao' } });
let sessao = null;
let eu = null; // { usuario: {id, nome, email, papel}, dono: bool }
const CHAVE = 'cerebro-chave';
const $ = (s) => document.querySelector(s);

const guardado = {
  ler(k) { try { return localStorage.getItem(k); } catch { return null; } },
  gravar(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
};
let chave = guardado.ler(CHAVE);

// Diagnóstico leve: erros do app e etapas do botão de voz vão para uma tabela só de escrita (para achar falhas no iPhone).
const VERSAO = 'v23';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hdmpiZXZ1aHphbGtxeXhhYWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5ODg5OTQsImV4cCI6MjEwNjU2NDk5NH0.BGSKd3B2B0m2MuDUmdJHEVOPS6l551axEP7DVAxfidA';
function diag(evento, detalhe = '') {
  try {
    fetch('https://mavjbevuhzalkqyxaajw.supabase.co/rest/v1/app_diag', {
      method: 'POST', keepalive: true,
      headers: { apikey: ANON, authorization: `Bearer ${ANON}`, 'content-type': 'application/json', prefer: 'return=minimal' },
      body: JSON.stringify({ versao: VERSAO, ua: navigator.userAgent.slice(0, 300), evento: String(evento).slice(0, 60), detalhe: String(detalhe ?? '').slice(0, 1000) }),
    }).catch(() => {});
  } catch { /* sem rede */ }
}
window.addEventListener('error', (e) => diag('erro', `${e.message} @${(e.filename || '').split('/').pop()}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => diag('promessa', e.reason?.message || String(e.reason)));

// ---- Tema: automático (segue o iPhone) → claro → escuro ----
const TEMAS = ['auto', 'claro', 'escuro'];
function aplicarTema(t) {
  const r = document.documentElement;
  if (t === 'auto') { delete r.dataset.theme; delete r.dataset.tema; } else { r.dataset.theme = t === 'claro' ? 'light' : 'dark'; r.dataset.tema = t; }
  const escuro = t === 'escuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', escuro ? '#0E1116' : '#F4F5F7'));
  const b = document.getElementById('b-tema');
  if (b) b.setAttribute('aria-label', `Tema: ${{ auto: 'automático', claro: 'claro', escuro: 'escuro' }[t]}`);
}
aplicarTema(TEMAS.includes(guardado.ler('cerebro-tema')) ? guardado.ler('cerebro-tema') : 'auto');
document.getElementById('b-tema')?.addEventListener('click', () => {
  const atual = TEMAS.includes(guardado.ler('cerebro-tema')) ? guardado.ler('cerebro-tema') : 'auto';
  const novo = TEMAS[(TEMAS.indexOf(atual) + 1) % TEMAS.length];
  guardado.gravar('cerebro-tema', novo === 'auto' ? null : novo);
  aplicarTema(novo);
  aviso({ auto: 'Tema automático (segue o iPhone)', claro: 'Tema claro', escuro: 'Tema escuro' }[novo]);
});

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
async function api(caminho, { metodo = 'GET', corpo, tipo } = {}) {
  const headers = {};
  try { sessao = (await SUPA.auth.getSession()).data.session; } catch { sessao = null; }
  if (sessao) headers.authorization = `Bearer ${sessao.access_token}`;
  else if (chave) headers['x-app-key'] = chave;
  let body;
  if (corpo instanceof Blob) { body = corpo; headers['content-type'] = tipo || corpo.type || 'application/octet-stream'; }
  else if (corpo !== undefined) { body = JSON.stringify(corpo); headers['content-type'] = 'application/json'; }
  const ehEquipe = /^\/equipe/.test(caminho);
  if (ehEquipe) caminho = caminho.replace(/^\/equipe/, '');
  const base = ehEquipe ? EQUIPE : /^\/(gravacoes|voz)/.test(caminho) ? GRAVADOR : /^\/exportar/.test(caminho) ? EXTRA : /^\/(dossies|local|proximas)/.test(caminho) ? ORACULO : API;
  const res = await fetch(base + caminho, { method: metodo, headers, body });
  const dados = await res.json().catch(() => ({}));
  if (res.status === 401) { sair(); throw new Error(dados.erro || 'Sessão expirada. Entre de novo.'); }
  if (!res.ok) throw new Error(dados.erro || `Erro ${res.status}`);
  return dados;
}

function aviso(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(aviso.t); aviso.t = setTimeout(() => (t.hidden = true), 3200);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// *negrito* e quebras de linha, sem HTML vindo de fora
const leve = (s) => esc(s).replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
const hora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
function quando(iso) {
  const d = new Date(iso), hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  return mesmoDia ? hora(iso) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' }) + ' ' + hora(iso);
}
const nomeDe = (c) => c?.name || (c?.wa_id ? '+' + c.wa_id : 'Contato');

// ---------------------------------------------------------------------------
// Navegação
// ---------------------------------------------------------------------------
const VISTAS = {
  hoje: '#v-hoje', conversa: '#v-conversa', gravar: '#v-gravar', gravando: '#v-gravando', gravacao: '#v-gravacao',
  whats: '#v-whats', contato: '#v-contato', mais: '#v-mais', oraculo: '#v-oraculo', dossie: '#v-dossie', radar: '#v-radar',
};
const ABA_DE = { whats: 'hoje', contato: 'hoje', gravando: 'gravar', gravacao: 'gravar', oraculo: 'hoje', dossie: 'hoje', radar: 'hoje' };

function ir(destino) { location.hash = destino; }

async function rota() {
  const [nome, arg] = (location.hash.slice(1) || 'hoje').split('/');
  let vista = nome === 'avisos' ? 'mais' : VISTAS[nome] ? nome : 'hoje';
  if ((vista === 'whats' || vista === 'contato') && eu && !eu.dono) vista = 'hoje';   // WhatsApp é só do dono
  for (const [k, sel] of Object.entries(VISTAS)) $(sel).hidden = k !== vista;
  document.querySelectorAll('.abas button').forEach((b) => b.classList.toggle('ativa', b.dataset.ir === (ABA_DE[vista] || vista)));
  $('#pilula-gravando').hidden = !Rec.ativo || vista === 'gravando';
  if (vista !== 'gravacao') pararDetalhe();
  if (vista !== 'dossie') clearTimeout(Oraculo.timer);
  window.scrollTo(0, 0);
  try {
    if (vista === 'hoje') await carregarHoje();
    if (vista === 'conversa') await carregarConversa();
    if (vista === 'whats') await carregarContatos();
    if (vista === 'contato') await carregarContato(arg);
    if (vista === 'mais') await carregarMais();
    if (vista === 'gravar') await carregarGravacoes();
    if (vista === 'gravando') mostrarGravando();
    if (vista === 'gravacao') await carregarGravacao(arg);
    if (vista === 'oraculo') await carregarOraculo();
    if (vista === 'dossie') await carregarDossie(arg);
    if (vista === 'radar') await carregarRadar();
  } catch (e) { aviso(e.message); }
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-ir]');
  if (b) { e.preventDefault(); ir(b.dataset.ir); }
});

// ---------------------------------------------------------------------------
// Hoje
// ---------------------------------------------------------------------------
function saudacao() {
  const h = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }));
  const nome = (eu?.usuario?.nome || 'Michelder').split(' ')[0];
  return `${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}, ${nome}`;
}

// "Agora": tudo o que pede você, do mais urgente ao menos — em rolagem lateral ou em blocos.
function listaAgora(d) {
  const itens = [];
  for (const u of d.avisos.filter((a) => a.kind === 'urgente' && !a.read_at).slice(0, 5)) {
    itens.push({ tipo: 'urgente', rotulo: 'Urgente', texto: `${u.title.replace(/^🚨\s*/, '')}: ${u.body}`, acao: 'Ver conversa', ir: u.data?.contact ? `contato/${u.data.contact}` : 'mais' });
  }
  for (const p of d.perguntas) itens.push({ tipo: 'pergunta', rotulo: 'Dúvida do Dimy', texto: p.question, acao: 'Responder', ir: 'conversa' });
  const agenda = Array.isArray(d.agenda) ? d.agenda : [];
  for (const e of agenda.filter((x) => new Date(x.inicio) - Date.now() < 3 * 3600e3 && new Date(x.inicio) > Date.now() - 15 * 60e3).slice(0, 3)) {
    itens.push({ tipo: 'agenda', rotulo: `Agenda · ${hora(e.inicio)}`, texto: `${e.titulo}${e.local ? `, em ${e.local}` : ''}.`, ...(eEndereco(e.local) ? { acao: 'Ir com Waze', url: linkWaze(e.local) } : {}) });
  }
  for (const c of d.aguardando.slice(0, 8)) {
    itens.push({ tipo: 'whats', rotulo: 'Espera resposta', texto: `${nomeDe(c)}${c.last_summary ? `: ${c.last_summary}` : ' mandou mensagem.'}`, acao: 'Responder', ir: `contato/${c.wa_id}` });
  }
  for (const l of d.lembretes.filter((x) => new Date(x.due_at) - Date.now() < 6 * 3600e3).slice(0, 3)) {
    itens.push({ tipo: 'lembrete', rotulo: `Lembrete · ${hora(l.due_at)}`, texto: l.text });
  }
  for (const a of d.avisos.filter((x) => !x.read_at && x.kind !== 'urgente' && Date.now() - Date.parse(x.created_at) < 24 * 3600e3).slice(0, 4)) {
    itens.push({ tipo: 'aviso', rotulo: a.title.replace(/^\p{Extended_Pictographic}\s*/u, ''), texto: a.body, acao: a.data?.url && a.data.url.startsWith('./#') ? 'Abrir' : 'Ver', ir: a.data?.url?.startsWith('./#') ? a.data.url.slice(3) : 'mais' });
  }
  if (!itens.length) itens.push({ tipo: 'calmo', rotulo: 'Agora', texto: 'Nada pedindo você agora. Se quiser, me conta como está o dia.', acao: 'Conversar', ir: 'conversa' });
  return itens;
}
const ModoAgora = { blocos: guardadoCedo('cerebro-agora') === 'blocos', itens: [] };
function guardadoCedo(k) { try { return localStorage.getItem(k); } catch { return null; } }
function desenharAgora(itens) {
  ModoAgora.itens = itens;
  const sec = $('#ancora'), lista = $('#agora-lista');
  sec.hidden = false;
  sec.classList.toggle('blocos', ModoAgora.blocos);
  lista.className = `agora-lista ${ModoAgora.blocos ? 'blocos' : 'rolar'}`;
  const reais = itens.filter((i) => i.tipo !== 'calmo').length;
  $('#agora-qtd').textContent = reais > 1 ? String(reais) : '';
  $('#agora-modo').hidden = itens.length < 2;
  $('#agora-modo-t').textContent = ModoAgora.blocos ? 'Rolar' : 'Blocos';
  $('#agora-modo').setAttribute('aria-label', ModoAgora.blocos ? 'Mostrar em rolagem' : 'Mostrar em blocos');
  lista.innerHTML = itens.map((a, k) => `<article class="ancora t-${a.tipo}">
      <span class="ancora-ic"><svg viewBox="0 0 24 24">${ICONE_AGORA[a.tipo] || ICONE_AGORA.calmo}</svg></span>
      <div class="ancora-corpo"><p class="ancora-rotulo">${esc(a.rotulo)}</p><p class="ancora-texto">${esc(a.texto)}</p></div>
      ${a.acao ? `<button class="ancora-btn" data-agora="${k}">${esc(a.acao)}</button>` : ''}</article>`).join('');
  $('#agora-pontos').innerHTML = itens.length > 1 && !ModoAgora.blocos ? itens.map((_, k) => `<i class="${k === 0 ? 'on' : ''}"></i>`).join('') : '';
  lista.scrollLeft = 0;
}
const ICONE_AGORA = {
  urgente: '<path d="M12 3 2 20h20L12 3Zm0 6v5m0 3v.5"/>',
  pergunta: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.5"/>',
  agenda: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  whats: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z"/>',
  lembrete: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8Zm4 11a2 2 0 0 0 4 0"/>',
  aviso: '<path d="M4 5h16v11H8l-4 4V5Z"/>',
  calmo: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-agora]');
  if (b) { const a = ModoAgora.itens[Number(b.dataset.agora)]; if (a?.url) location.href = a.url; else if (a?.ir) ir(a.ir); return; }
  if (e.target.closest('#agora-modo')) {
    ModoAgora.blocos = !ModoAgora.blocos;
    try { localStorage.setItem('cerebro-agora', ModoAgora.blocos ? 'blocos' : 'rolar'); } catch { /* sem armazenamento */ }
    desenharAgora(ModoAgora.itens);
  }
});
document.addEventListener('scroll', (e) => {
  const l = e.target;
  if (!(l instanceof Element) || l.id !== 'agora-lista' || ModoAgora.blocos) return;
  const w = l.firstElementChild?.getBoundingClientRect().width || 1;
  const k = Math.round(l.scrollLeft / (w + 10));
  document.querySelectorAll('#agora-pontos i').forEach((p, i) => p.classList.toggle('on', i === k));
}, true);

// ---- Datas no fuso de São Paulo ----
const TZ = 'America/Sao_Paulo';
const diaISO = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d instanceof Date ? d : new Date(d));
const horaISO = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d instanceof Date ? d : new Date(d));
const montarISO = (dia, hm) => `${dia}T${hm}:00-03:00`;
const somaDias = (dia, n) => diaISO(new Date(Date.parse(`${dia}T12:00:00-03:00`) + n * 864e5));
const diaSemana = (dia) => new Date(`${dia}T12:00:00-03:00`).getUTCDay(); // 0 = domingo
const nomeDia = (dia, opts) => new Date(`${dia}T12:00:00-03:00`).toLocaleDateString('pt-BR', { timeZone: TZ, ...opts });

// ---- Endereços: mapa e rota (Waze / Mapas) ----
const eEndereco = (l) => !!l && l.trim().length >= 6 && !/^https?:|meet\.|zoom|teams|google meet|online|whatsapp|liga[cç][aã]o|telefone|videochamada/i.test(l);
const linkWaze = (l) => `https://waze.com/ul?q=${encodeURIComponent(l)}&navigate=yes`;
const linkMapas = (l) => `https://maps.apple.com/?daddr=${encodeURIComponent(l)}&dirflg=d`;
const mapaEmbed = (l) => `https://maps.google.com/maps?q=${encodeURIComponent(l)}&z=15&output=embed`;
const IC_WAZE = '<svg viewBox="0 0 24 24"><path d="M5 17a8 8 0 1 1 14.5-4.6c0 2.4-1.7 4.6-4.2 4.6H9.5A2.5 2.5 0 0 1 5 17Z"/><circle cx="9" cy="10" r=".8"/><circle cx="14" cy="10" r=".8"/><path d="M9.5 13c1.3 1 3.7 1 5 0"/><circle cx="8" cy="19.5" r="1.5"/><circle cx="16" cy="19.5" r="1.5"/></svg>';
const IC_ROTA = '<svg viewBox="0 0 24 24"><path d="M3 11 21 3l-8 18-2-8-8-2Z"/></svg>';
function blocoRota(l) {
  return `<div class="ev-rota">
    <a class="ev-mapa" href="${esc(linkWaze(l))}" target="_blank" rel="noopener" aria-label="Abrir trajeto no Waze"><iframe src="${esc(mapaEmbed(l))}" loading="lazy" tabindex="-1" title="Mapa"></iframe></a>
    <div class="ev-rota-acoes"><a class="btn-waze" href="${esc(linkWaze(l))}" target="_blank" rel="noopener">${IC_WAZE}Ir com Waze</a><a class="btn-mapas" href="${esc(linkMapas(l))}" target="_blank" rel="noopener">${IC_ROTA}Mapas</a></div>
  </div>`;
}

const Agenda = { dia: diaISO(new Date()), inicioSemana: null, eventos: [], google: true, mes: diaISO(new Date()).slice(0, 7), mexeu: 0, aberto: guardado.ler('cerebro-cal') === 'mes' };
// Semana (padrão, compacta) ou mês inteiro (expandido pelo botão).
const gradeAtual = () => (Agenda.aberto ? gradeDoMes(Agenda.mes) : { ini: inicioDaSemana(Agenda.dia), dias: 7 });
function inicioDaSemana(dia) { return somaDias(dia, -((diaSemana(dia) + 6) % 7)); } // segunda-feira
// Grade do mês: começa na segunda-feira da semana do dia 1 e vai até o domingo da última semana.
function gradeDoMes(mes) {
  const ini = inicioDaSemana(`${mes}-01`);
  const [a, m] = mes.split('-').map(Number);
  const ultimo = diaISO(new Date(Date.UTC(a, m, 0, 15)));
  const fim = somaDias(inicioDaSemana(ultimo), 6);
  const dias = Math.round((Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${ini}T12:00:00Z`)) / 864e5) + 1;
  return { ini, dias };
}
const mesSeguinte = (mes, n) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };

async function carregarHoje() {
  $('#hoje-saudacao').textContent = saudacao();
  const hoje = diaISO(new Date());
  $('#hoje-data').textContent = nomeDia(hoje, { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase());
  // Voltou ao app depois de um tempo: o calendário volta para hoje.
  if (Date.now() - Agenda.mexeu > 10 * 60e3) { Agenda.dia = hoje; Agenda.mes = hoje.slice(0, 7); }
  Agenda.inicioSemana = null; // sempre busca a agenda de novo (o Dimy pode ter marcado algo enquanto o app estava aberto)
  const [d] = await Promise.all([api('/hoje'), carregarSemana()]);
  atualizarBadges(d);
  desenharAgora(listaAgora(d));

  // Lembretes: cartões com sino e horário (toque para mudar data e hora)
  const lem = d.lembretes || [];
  $('#lista-lembretes').innerHTML = lem.length
    ? lem.map((l) => `<button class="lembrete" data-lembrete="${esc(l.id)}" data-texto="${esc(l.text)}" data-quando="${esc(l.due_at)}">
        <span class="lembrete-ic"><svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8Zm4 11a2 2 0 0 0 4 0"/></svg></span>
        <span class="lembrete-t">${esc(l.text)}</span>
        <span class="pilula-hora"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${quandoCurto(l.due_at)}</span></button>`).join('')
    : '<button class="vazio-cartao" data-acao="lembrete"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Criar um lembrete</button>';

  const esp = d.aguardando || [];
  $('#bloco-espera').hidden = !esp.length;
  $('#lista-espera').innerHTML = esp.slice(0, 6).map((c) => `<li><button class="pessoa" data-ir="contato/${esc(c.wa_id)}">
      <span class="avatar-p">${esc(iniciais(nomeDe(c)))}</span>
      <span class="pessoa-corpo"><span class="t">${esc(nomeDe(c))}</span><span class="d">${esc(c.last_summary || 'Mensagem nova')}</span></span>
      <span class="h">${quando(c.last_in_at || c.last_seen)}</span></button></li>`).join('');
}

const iniciais = (n) => n.replace(/^\+/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '•';
function quandoCurto(iso) {
  const dia = diaISO(iso), hoje = diaISO(new Date());
  const rot = dia === hoje ? 'Hoje' : dia === somaDias(hoje, 1) ? 'Amanhã' : nomeDia(dia, { day: '2-digit', month: 'short' }).replace('.', '');
  return `${rot}, ${horaISO(iso)}`;
}

async function carregarSemana() {
  const { ini, dias } = gradeAtual();
  const chave = `${ini}/${dias}`;
  if (chave !== Agenda.inicioSemana) {
    Agenda.inicioSemana = chave;
    try {
      const r = await api(`/agenda?de=${ini}&dias=${dias}`);
      Agenda.google = r.google; Agenda.eventos = Array.isArray(r.eventos) ? r.eventos : [];
    } catch (e) { Agenda.eventos = []; aviso(`Agenda: ${e.message}`); }
  }
  desenharSemana(); desenharLinhaTempo();
}

function desenharSemana() {
  const { ini, dias } = gradeAtual(), hoje = diaISO(new Date());
  const ref = Agenda.aberto ? `${Agenda.mes}-15` : somaDias(ini, 3);
  $('#sem-mes').textContent = nomeDia(ref, { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase());
  $('#cal-hoje').hidden = Agenda.dia === hoje && (Agenda.aberto ? Agenda.mes === hoje.slice(0, 7) : ini === inicioDaSemana(hoje));
  $('#semana').className = Agenda.aberto ? 'mes' : 'semana';
  $('#mes-letras').hidden = !Agenda.aberto;
  $('#cal-expandir').setAttribute('aria-expanded', String(Agenda.aberto));
  $('#cal-expandir-t').textContent = Agenda.aberto ? 'Recolher' : 'Ver mês';
  $('#sem-ant').setAttribute('aria-label', Agenda.aberto ? 'Mês anterior' : 'Semana anterior');
  $('#sem-prox').setAttribute('aria-label', Agenda.aberto ? 'Próximo mês' : 'Próxima semana');
  const LETRAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const porDia = {};
  for (const e of Agenda.eventos) { const k = diaISO(e.inicio); porDia[k] = (porDia[k] || 0) + 1; }
  $('#semana').innerHTML = Array.from({ length: dias }, (_, k) => {
    const dia = somaDias(ini, k), n = porDia[dia] || 0, ds = diaSemana(dia);
    const cls = ['dia', dia === Agenda.dia ? 'sel' : '', dia === hoje ? 'hoje' : '', Agenda.aberto && dia.slice(0, 7) !== Agenda.mes ? 'fora' : '', ds === 0 || ds === 6 ? 'fds' : ''].join(' ');
    return `<button class="${cls}" data-dia="${dia}" role="gridcell" aria-selected="${dia === Agenda.dia}" aria-label="${nomeDia(dia, { day: 'numeric', month: 'long' })}${n ? `, ${n} compromisso(s)` : ''}">
      ${Agenda.aberto ? '' : `<span class="dia-l">${LETRAS[ds]}</span>`}<span class="dia-n">${Number(dia.slice(8))}</span><span class="pontos">${'<i></i>'.repeat(Math.min(n, 3))}</span></button>`;
  }).join('');
}

function desenharLinhaTempo() {
  const hoje = diaISO(new Date()), dia = Agenda.dia;
  $('#agenda-titulo').textContent = dia === hoje ? 'Agenda de hoje' : dia === somaDias(hoje, 1) ? 'Agenda de amanhã' : nomeDia(dia, { weekday: 'long', day: 'numeric', month: 'short' }).replace(/^./, (c) => c.toUpperCase());
  const box = $('#linha-tempo');
  if (!Agenda.google) { box.innerHTML = '<p class="vazio">Conecte o Google em Avisos → Ajustes para ver sua agenda.</p>'; return; }
  const evs = Agenda.eventos.filter((e) => diaISO(e.inicio) === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (!evs.length) {
    box.innerHTML = `<button class="vazio-cartao grande" data-acao="evento"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg><span>Dia livre<small>Toque para marcar um compromisso</small></span></button>`;
    return;
  }
  const agora = Date.now();
  let marcouAgora = dia !== hoje;
  const cores = ['c-verde', 'c-azul', 'c-roxo', 'c-ambar', 'c-rosa'];
  box.innerHTML = evs.map((e, k) => {
    let linha = '';
    if (!marcouAgora && Date.parse(e.inicio) > agora) { marcouAgora = true; linha = `<div class="agora-linha"><span>${horaISO(new Date())}</span></div>`; }
    const passou = e.fim && Date.parse(e.fim) < agora;
    const hora = e.dia_inteiro ? 'Dia todo' : `${horaISO(e.inicio)}${e.fim ? ` – ${horaISO(e.fim)}` : ''}`;
    const rota = eEndereco(e.local) && !passou;
    return `${linha}<div class="evento ${passou ? 'passou' : ''}">
      <div class="ev-hora">${e.dia_inteiro ? '•' : horaISO(e.inicio)}</div>
      <div class="ev-wrap ${cores[k % cores.length]}">
      <button class="ev-cartao" data-evento="${esc(e.id)}">
        <span class="ev-t">${esc(e.titulo)}</span>
        <span class="ev-meta"><span class="pilula-hora"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${hora}</span>${e.local ? `<span class="ev-local"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-12a7 7 0 1 1 14 0c0 5.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>${esc(e.local)}</span>` : ''}</span>
        <span class="ev-editar" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/></svg></span>
      </button>${rota ? blocoRota(e.local) : ''}</div></div>`;
  }).join('') + (!marcouAgora ? `<div class="agora-linha"><span>${horaISO(new Date())}</span></div>` : '');
}

document.addEventListener('click', async (e) => {
  const d = e.target.closest('.dia[data-dia]');
  if (d) {
    Agenda.dia = d.dataset.dia; Agenda.mexeu = Date.now();
    if (Agenda.dia.slice(0, 7) !== Agenda.mes) { Agenda.mes = Agenda.dia.slice(0, 7); carregarSemana(); } else { desenharSemana(); desenharLinhaTempo(); }
    return;
  }
  const ev = e.target.closest('[data-evento]');
  if (ev) { const x = Agenda.eventos.find((i) => i.id === ev.dataset.evento); if (x) editarEvento(x); return; }
  const lb = e.target.closest('[data-lembrete]');
  if (lb) { editarLembrete({ id: lb.dataset.lembrete, text: lb.dataset.texto, due_at: lb.dataset.quando }); return; }
  const ac = e.target.closest('[data-acao]');
  if (ac) {
    if (ac.dataset.acao === 'evento') editarEvento(null);
    if (ac.dataset.acao === 'lembrete') editarLembrete(null);
    if (ac.dataset.acao === 'dimy') { ir('conversa'); setTimeout(() => !Dimy.ligado && ligarDimy(), 300); }
  }
});
function mudarMes(n) {
  Agenda.mexeu = Date.now();
  if (!Agenda.aberto) { Agenda.dia = somaDias(Agenda.dia, 7 * n); Agenda.mes = Agenda.dia.slice(0, 7); carregarSemana(); return; }
  Agenda.mes = mesSeguinte(Agenda.mes, n);
  const hoje = diaISO(new Date());
  Agenda.dia = hoje.slice(0, 7) === Agenda.mes ? hoje : `${Agenda.mes}-01`;
  carregarSemana();
}
$('#cal-expandir').addEventListener('click', () => {
  Agenda.aberto = !Agenda.aberto; Agenda.mes = Agenda.dia.slice(0, 7);
  guardado.gravar('cerebro-cal', Agenda.aberto ? 'mes' : null);
  carregarSemana();
});
$('#sem-ant').addEventListener('click', () => mudarMes(-1));
$('#sem-prox').addEventListener('click', () => mudarMes(1));
$('#cal-hoje').addEventListener('click', () => { const h = diaISO(new Date()); Agenda.dia = h; Agenda.mes = h.slice(0, 7); Agenda.mexeu = 0; carregarSemana(); });
// Deslizar o calendário para o lado troca de mês.
(() => {
  let x0 = null, y0 = 0;
  const el = $('#semana');
  el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) mudarMes(dx < 0 ? 1 : -1);
  }, { passive: true });
})();

// ---------------------------------------------------------------------------
// Folha de edição: calendário (data) e relógio (hora) nativos do iPhone
// ---------------------------------------------------------------------------
const IC_CAL = '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
const IC_REL = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
let folhaAcao = null;

let folhaBotao = 'Salvar';
function abrirFolha({ titulo, campos, salvar, apagar, botao = 'Salvar' }) {
  $('#folha-titulo').textContent = titulo;
  folhaBotao = botao; $('#folha-salvar').textContent = botao;
  $('#folha-campos').innerHTML = campos.map((c) => {
    if (c.tipo === 'data-hora') {
      return `<div class="linha-campos">
        <label class="campo ic-campo"><span>${IC_CAL}${c.rotuloData || 'Data'}</span><input type="date" name="${c.data}" value="${esc(c.vData)}" required></label>
        <label class="campo ic-campo"><span>${IC_REL}${c.rotuloHora || 'Hora'}</span><input type="time" name="${c.hora}" value="${esc(c.vHora)}" required></label>
        ${c.hora2 ? `<label class="campo ic-campo"><span>${IC_REL}Até</span><input type="time" name="${c.hora2}" value="${esc(c.vHora2)}"></label>` : ''}
      </div>`;
    }
    if (c.tipo === 'escolha' || c.tipo === 'marcas') {
      const radio = c.tipo === 'escolha';
      return `<div class="campo"><span>${c.rotulo}</span><div class="escolha">${c.opcoes.map((o) => `<label><input type="${radio ? 'radio' : 'checkbox'}" name="${radio ? c.nome : o.nome}" value="${esc(o.valor ?? '1')}" ${o.marcado ? 'checked' : ''}><span>${esc(o.texto)}</span></label>`).join('')}</div></div>`;
    }
    return `<label class="campo"><span>${c.rotulo}</span><input name="${c.nome}" type="${c.tipoInput || 'text'}" value="${esc(c.valor || '')}" placeholder="${esc(c.placeholder || '')}" ${c.obrigatorio ? 'required' : ''} autocomplete="${c.autocomplete || 'off'}" ${c.tipoInput === 'email' ? 'autocapitalize="off" inputmode="email"' : ''}></label>${c.dica ? `<p class="campo-dica">${esc(c.dica)}</p>` : ''}`;
  }).join('');
  $('#folha-erro').textContent = '';
  $('#folha-apagar').hidden = !apagar;
  $('#folha-apagar').onclick = apagar ? async () => { if (confirm('Apagar mesmo?')) { try { await apagar(); fecharFolha(); } catch (err) { $('#folha-erro').textContent = err.message; } } } : null;
  folhaAcao = salvar;
  $('#folha').hidden = false;
  requestAnimationFrame(() => $('#folha').classList.add('aberta'));
}
function fecharFolha() { $('#folha').classList.remove('aberta'); setTimeout(() => ($('#folha').hidden = true), 220); }
$('#folha').addEventListener('click', (e) => { if (e.target.closest('[data-fechar]')) fecharFolha(); });
$('#folha-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(e.currentTarget));
  const b = $('#folha-salvar'); b.disabled = true; b.textContent = folhaBotao === 'Salvar' ? 'Salvando…' : 'Enviando…';
  try { await folhaAcao(dados); fecharFolha(); }
  catch (err) { $('#folha-erro').textContent = err.message; }
  finally { b.disabled = false; b.textContent = folhaBotao; }
});

function proximaHoraCheia() { const d = new Date(Date.now() + 3600e3); d.setMinutes(0); return horaISO(d); }

function editarEvento(ev, sug) {
  const dia = ev ? diaISO(ev.inicio) : Agenda.dia;
  const ini = ev && !ev.dia_inteiro ? horaISO(ev.inicio) : proximaHoraCheia();
  const fim = ev && ev.fim && !ev.dia_inteiro ? horaISO(ev.fim) : horaISO(new Date(Date.parse(montarISO(dia, ini)) + 3600e3));
  abrirFolha({
    titulo: ev ? 'Editar compromisso' : 'Novo compromisso',
    campos: [
      { rotulo: 'O quê', nome: 'titulo', valor: ev?.titulo ?? sug?.titulo, placeholder: 'Visita – cliente', obrigatorio: true },
      { tipo: 'data-hora', data: 'dia', hora: 'inicio', hora2: 'fim', vData: dia, vHora: ini, vHora2: fim, rotuloHora: 'Início' },
      { rotulo: 'Onde', nome: 'local', valor: ev?.local ?? sug?.local, placeholder: 'Opcional' },
    ],
    salvar: async (f) => {
      if (!f.titulo?.trim() || !f.dia || !f.inicio) throw new Error('Preencha o quê, o dia e a hora.');
      let fimISO = montarISO(f.dia, f.fim || f.inicio);
      if (!f.fim || Date.parse(fimISO) <= Date.parse(montarISO(f.dia, f.inicio))) fimISO = new Date(Date.parse(montarISO(f.dia, f.inicio)) + 3600e3).toISOString();
      const corpo = { titulo: f.titulo.trim(), inicio: montarISO(f.dia, f.inicio), fim: fimISO, local: f.local?.trim() || '' };
      await api(ev ? `/agenda/${encodeURIComponent(ev.id)}` : '/agenda', { metodo: 'POST', corpo });
      aviso(ev ? 'Compromisso atualizado.' : 'Compromisso marcado. O alarme toca 20 min antes.');
      Agenda.dia = f.dia; Agenda.mes = f.dia.slice(0, 7); Agenda.mexeu = Date.now(); Agenda.inicioSemana = null; await carregarSemana();
    },
    apagar: ev ? async () => { await api(`/agenda/${encodeURIComponent(ev.id)}/apagar`, { metodo: 'POST' }); aviso('Compromisso apagado.'); Agenda.inicioSemana = null; await carregarSemana(); } : null,
  });
}

function editarLembrete(l, sugestao) {
  const quando = l ? new Date(l.due_at) : null;
  abrirFolha({
    titulo: l ? 'Editar lembrete' : 'Novo lembrete',
    campos: [
      { rotulo: 'Lembrar de', nome: 'texto', valor: l?.text ?? sugestao?.texto, placeholder: 'Ligar para o cliente', obrigatorio: true },
      { tipo: 'data-hora', data: 'dia', hora: 'hora', vData: quando ? diaISO(quando) : sugestao?.dia || Agenda.dia, vHora: quando ? horaISO(quando) : sugestao?.hora || proximaHoraCheia() },
    ],
    salvar: async (f) => {
      if (!f.texto?.trim() || !f.dia || !f.hora) throw new Error('Preencha o texto, o dia e a hora.');
      const corpo = { texto: f.texto.trim(), quando: montarISO(f.dia, f.hora) };
      await api(l ? `/lembretes/${encodeURIComponent(l.id)}` : '/lembretes', { metodo: 'POST', corpo });
      aviso(l ? 'Lembrete atualizado.' : 'Lembrete criado.');
      if (!$('#v-hoje').hidden) carregarHoje();
    },
    apagar: l ? async () => { await api(`/lembretes/${encodeURIComponent(l.id)}/cancelar`, { metodo: 'POST' }); aviso('Lembrete cancelado.'); carregarHoje(); } : null,
  });
}

// "sexta", "amanhã", "até 10/11", "semana que vem" → dia sugerido para agendar uma ação
function sugerirDia(prazo) {
  const hoje = diaISO(new Date());
  const t = (prazo || '').toLowerCase();
  const m = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) { const ano = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : hoje.slice(0, 4); return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  if (/amanh/.test(t)) return somaDias(hoje, 1);
  if (/hoje/.test(t)) return hoje;
  if (/semana que vem|pr[oó]xima semana/.test(t)) return somaDias(inicioDaSemana(hoje), 7);
  const dias = ['domingo', 'segunda', 'terça|terca', 'quarta', 'quinta', 'sexta', 's[aá]bado'];
  for (let k = 0; k < 7; k++) if (new RegExp(dias[k]).test(t)) { const delta = (k - diaSemana(hoje) + 7) % 7 || 7; return somaDias(hoje, delta); }
  return somaDias(hoje, 1);
}

function atualizarBadges(d) {
  const n = d.aguardando?.length || 0;
  $('#badge-whats').hidden = !n; $('#badge-whats').textContent = n;
  const a = (d.avisos || []).filter((x) => !x.read_at).length;
  $('#badge-avisos').hidden = !a; $('#badge-avisos').textContent = a;
}

// ---------------------------------------------------------------------------
// Conversa
// ---------------------------------------------------------------------------
function bolha(papel, texto, iso, extra = '') {
  const el = document.createElement('div');
  el.className = `bolha ${papel} ${extra}`;
  el.innerHTML = leve(texto) + (iso ? `<span class="quando">${quando(iso)}</span>` : '');
  $('#mensagens').appendChild(el);
  el.scrollIntoView({ block: 'end' });
  return el;
}

async function carregarConversa() {
  const { turnos } = await api('/conversa');
  $('#mensagens').innerHTML = '';
  if (!turnos.length) bolha('ia', 'Oi, Michelder. Pode me contar qualquer coisa: do trabalho, da família, uma ideia solta. Eu guardo e organizo.');
  for (const t of turnos) bolha(t.role === 'user' ? 'eu' : 'ia', t.content, t.created_at);
  // Pedido vindo de outra tela (ex.: "transformar ações em lembretes").
  let pendente = null;
  try { pendente = sessionStorage.getItem('cerebro-enviar'); sessionStorage.removeItem('cerebro-enviar'); } catch { /* ok */ }
  if (pendente) { texto.value = pendente; texto.dispatchEvent(new Event('input')); $('#form-chat').requestSubmit(); return; }
  $('#texto').focus({ preventScroll: true });
}

const texto = $('#texto');
texto.addEventListener('input', () => {
  texto.style.height = 'auto'; texto.style.height = Math.min(texto.scrollHeight, 140) + 'px';
  const tem = !!texto.value.trim();
  $('#enviar').hidden = !tem; $('#mic').hidden = tem;
});
texto.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); $('#form-chat').requestSubmit(); }
});

$('#form-chat').addEventListener('submit', async (e) => {
  e.preventDefault();
  const t = texto.value.trim();
  if (!t) return;
  texto.value = ''; texto.dispatchEvent(new Event('input'));
  bolha('eu', t, new Date().toISOString());
  const pensando = bolha('ia', 'Pensando', null, 'pensando');
  try {
    const { resposta } = await api('/chat', { metodo: 'POST', corpo: { texto: t, id: crypto.randomUUID() } });
    pensando.remove(); bolha('ia', resposta, new Date().toISOString());
  } catch (err) {
    pensando.remove(); bolha('ia', `Não consegui responder: ${err.message}. Sua mensagem não se perdeu; tente de novo.`);
  }
});

// Áudio: toque para gravar, toque de novo para enviar.
let gravador = null, pedacos = [];
$('#mic').addEventListener('click', async () => {
  const mic = $('#mic');
  if (gravador?.state === 'recording') { gravador.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const tipo = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';
    gravador = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
    pedacos = [];
    gravador.ondataavailable = (ev) => ev.data.size && pedacos.push(ev.data);
    gravador.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      mic.classList.remove('gravando'); mic.setAttribute('aria-label', 'Gravar áudio');
      const audio = new Blob(pedacos, { type: gravador.mimeType || 'audio/mp4' });
      const pensando = bolha('ia', 'Ouvindo', null, 'pensando');
      try {
        const r = await api('/audio', { metodo: 'POST', corpo: audio, tipo: audio.type.split(';')[0] });
        pensando.remove(); bolha('eu', `🎤 ${r.texto}`, new Date().toISOString()); bolha('ia', r.resposta, new Date().toISOString());
      } catch (err) { pensando.remove(); bolha('ia', `Não consegui ouvir: ${err.message}`); }
    };
    gravador.start();
    mic.classList.add('gravando'); mic.setAttribute('aria-label', 'Parar e enviar');
    aviso('Gravando. Toque de novo para enviar.');
  } catch { aviso('Libere o microfone para o app nos Ajustes do iPhone.'); }
});

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------
async function carregarContatos() {
  const { contatos: todos } = await api('/contatos');
  // Contatos de teste neutralizados não interessam a ninguém.
  const contatos = todos.filter((c) => c.name !== '[teste removido]' && new Date(c.last_seen).getFullYear() > 2001);
  contatos.sort((a, b) => (b.awaiting_reply - a.awaiting_reply) || (new Date(b.last_seen) - new Date(a.last_seen)));
  $('#lista-contatos').hidden = !contatos.length;
  $('#whats-desconectado').hidden = !!contatos.length;
  $('#lista-contatos').innerHTML = contatos.map((c) => `<li><button class="pessoa" data-ir="contato/${esc(c.wa_id)}"><span class="avatar-p">${esc(iniciais(nomeDe(c)))}</span><span class="pessoa-corpo"><span class="t">${esc(nomeDe(c))}${c.muted ? ' · silenciado' : ''}</span><span class="d">${esc(c.last_summary || '')}</span></span><span class="h">${c.awaiting_reply ? '<i class="etiqueta">espera</i>' : quando(c.last_seen)}</span></button></li>`).join('');
}

let contatoAtual = null;
async function carregarContato(wa) {
  contatoAtual = wa;
  const { contato, mensagens, perfil } = await api(`/contatos/${encodeURIComponent(wa)}`);
  contatoInfo = contato;
  desenharPerfil(perfil);
  $('#contato-nome').textContent = nomeDe(contato || { wa_id: wa });
  $('#contato-resumo').textContent = contato?.last_summary || '';
  $('#b-silenciar').textContent = contato?.muted ? 'Voltar a avisar' : 'Silenciar';
  $('#b-silenciar').dataset.muted = contato?.muted ? '1' : '';
  const box = $('#contato-msgs');
  box.innerHTML = mensagens.map((m) => `<div class="bolha ${m.direction === 'out' ? 'eu' : 'ia'}">${leve(m.body || `[${m.type}]`)}<span class="quando">${quando(m.occurred_at)}</span></div>`).join('')
    || '<p class="vazio">Sem mensagens registradas.</p>';
  box.lastElementChild?.scrollIntoView({ block: 'end' });
  $('#resposta').value = '';
  linkWhats();
}

let contatoInfo = null;
const RELACAO = { cliente: 'Cliente', prospect: 'Prospect', parceiro: 'Parceiro', fornecedor: 'Fornecedor', equipe: 'Equipe', familia: 'Família', amigo: 'Amigo', servico: 'Serviço', outro: 'Contato' };
function desenharPerfil(p) {
  const el = $('#contato-perfil');
  el.hidden = false;
  if (!p) { $('#perfil-linha').textContent = 'Ainda aprendendo sobre este contato'; $('#perfil-corpo').innerHTML = '<p class="dica">Eu monto o perfil a partir das conversas (quem é, assuntos e o que ficou em aberto).</p><button class="btn claro" id="b-perfilar">Aprender agora</button>'; return; }
  $('#perfil-linha').innerHTML = `<b>${esc(RELACAO[p.relacao] || 'Contato')}</b>${p.empresa ? ` · ${esc(p.empresa)}` : ''}${p.resumo ? ` · ${esc(p.resumo)}` : ''}`;
  $('#perfil-corpo').innerHTML = `${p.resumo ? `<p>${esc(p.resumo)}</p>` : ''}
    ${p.temas?.length ? `<p class="rot">Assuntos</p><div class="chips">${p.temas.map((t) => `<span class="chip-o">${esc(t)}</span>`).join('')}</div>` : ''}
    ${p.pendencias?.length ? `<p class="rot">Em aberto</p><ul class="checks">${p.pendencias.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    ${p.tom ? `<p class="rot">Como você fala com ele</p><p class="dica">${esc(p.tom)}</p>` : ''}
    <p class="dica">Aprendido de ${p.msgs_analisadas} mensagens · ${quando(p.atualizado_em)}</p>`;
}
document.addEventListener('click', async (e) => {
  if (!e.target.closest('#b-perfilar')) return;
  const b = e.target.closest('#b-perfilar'); b.disabled = true; b.textContent = 'Lendo as conversas…';
  try { const { perfil } = await api(`/contatos/${contatoAtual}/perfil`, { metodo: 'POST' }); desenharPerfil(perfil); $('#contato-perfil').open = true; }
  catch (err) { aviso(err.message); b.disabled = false; b.textContent = 'Aprender agora'; }
});
// Dentro das 24 h desde a última mensagem dele dá para enviar direto pelo app; fora disso, abre o WhatsApp.
const podeEnviar = () => !!contatoInfo?.last_in_at && Date.now() - Date.parse(contatoInfo.last_in_at) < 24 * 3600e3;
function linkWhats() {
  $('#b-abrir').href = `https://wa.me/${contatoAtual}?text=${encodeURIComponent($('#resposta').value)}`;
  const tem = !!$('#resposta').value.trim();
  $('#b-enviar-wa').hidden = !(tem && podeEnviar());
  $('#b-abrir').hidden = tem && podeEnviar();
}
$('#b-enviar-wa').addEventListener('click', async (e) => {
  const texto = $('#resposta').value.trim(); if (!texto) return;
  const b = e.currentTarget; b.disabled = true; b.textContent = 'Enviando…';
  try { const { ok } = await api(`/contatos/${contatoAtual}/responder`, { metodo: 'POST', corpo: { texto } }); aviso(ok || 'Enviado.'); await carregarContato(contatoAtual); }
  catch (err) { aviso(err.message); }
  finally { b.disabled = false; b.textContent = 'Enviar'; }
});
$('#resposta').addEventListener('input', linkWhats);

$('#b-sugerir').addEventListener('click', async (e) => {
  const b = e.currentTarget; b.disabled = true; b.textContent = 'Escrevendo…';
  try { const { sugestao } = await api(`/contatos/${contatoAtual}/sugerir`, { metodo: 'POST' }); $('#resposta').value = sugestao; linkWhats(); }
  catch (err) { aviso(err.message); }
  finally { b.disabled = false; b.textContent = 'Dimy, responda'; }
});
$('#b-abrir').addEventListener('click', () => {
  // Ao abrir o WhatsApp para responder, tira da lista de espera (o eco da mensagem confirma depois).
  api(`/contatos/${contatoAtual}/resolvido`, { metodo: 'POST' }).catch(() => {});
});
$('#b-resolvido').addEventListener('click', async () => {
  await api(`/contatos/${contatoAtual}/resolvido`, { metodo: 'POST' }); aviso('Tirei da lista de espera.'); ir('whats');
});
$('#b-silenciar').addEventListener('click', async (e) => {
  const silenciar = !e.currentTarget.dataset.muted;
  await api(`/contatos/${contatoAtual}/silenciar`, { metodo: 'POST', corpo: { silenciar } });
  aviso(silenciar ? 'Não aviso mais sobre esse contato.' : 'Voltei a avisar sobre esse contato.');
  carregarContato(contatoAtual);
});

// ---------------------------------------------------------------------------
// Avisos e ajustes
// ---------------------------------------------------------------------------
const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

async function carregarMais() {
  const [{ avisos }, st] = await Promise.all([api('/avisos'), api('/status')]);
  $('#lista-avisos').innerHTML = avisos.length
    ? avisos.map((a) => `<li class="${a.read_at ? '' : 'novo'}"><p class="t">${esc(a.title)}</p><p class="d">${leve(a.body)}</p><p class="h">${quando(a.created_at)}</p></li>`).join('')
    : '<li><p class="vazio">Aqui chegam o plano da manhã, o resumo da noite, lembretes e urgências.</p></li>';
  if (avisos.some((a) => !a.read_at)) api('/avisos/lidas', { metodo: 'POST' }).then(() => ($('#badge-avisos').hidden = true)).catch(() => {});

  const itens = [
    [st.claude, 'Inteligência (Claude)'],
    [st.openai, 'Memória e áudio (OpenAI)'],
    [st.google, 'Google Agenda e Gmail'],
    ...(st.dono === false ? [] : [[!!st.whatsapp_ultima, st.whatsapp_ultima ? `WhatsApp Business (última mensagem ${quando(st.whatsapp_ultima)})` : 'WhatsApp Business (aguardando conexão)']]),
  ];
  $('#status').innerHTML = itens.map(([ok, t]) => `<li class="${ok ? 'ok' : ''}">${esc(t)}</li>`).join('');
  if (st.antecedencia_alarme) $('#alarme-min').textContent = st.antecedencia_alarme;
  aplicarPapel();
  carregarEquipe().catch(() => {});
  if (st.dono !== false) carregarAgendador().catch(() => {});
  const g = $('#b-google');
  g.hidden = st.google || !st.google_conectar; if (st.google_conectar) g.href = st.google_conectar;

  const dica = $('#push-dica'), bp = $('#b-push');
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    bp.hidden = true; dica.textContent = instalado() ? 'Este aparelho não suporta notificações.' : 'Para receber notificações no iPhone, primeiro adicione o app à Tela de Início (Compartilhar → Adicionar à Tela de Início) e abra por lá.';
  } else if (Notification.permission === 'granted') {
    bp.textContent = 'Notificações ativas'; bp.disabled = true; dica.textContent = '';
  } else { bp.hidden = false; dica.textContent = ''; }
}

async function copiar(texto, ok) {
  try { await navigator.clipboard.writeText(texto); aviso(ok); }
  catch { prompt('Copie:', texto); }
}
$('#b-copiar-url').addEventListener('click', () => copiar(`${API}/alarmes?horas=6`, 'Endereço copiado.'));
$('#b-copiar-chave').addEventListener('click', () => (chave ? copiar(chave, 'Chave copiada.') : aviso('A chave do atalho fica no aparelho onde ela foi usada. Peça ao Claude se precisar dela de novo.')));

$('#b-push').addEventListener('click', async () => {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { aviso('Notificações não autorizadas.'); return; }
    const reg = await navigator.serviceWorker.ready;
    const { chave: vapid } = await api('/push/chave');
    const pad = '='.repeat((4 - (vapid.length % 4)) % 4);
    const raw = Uint8Array.from(atob((vapid + pad).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw }));
    await api('/push/inscrever', { metodo: 'POST', corpo: { subscription: sub.toJSON() } });
    aviso('Pronto. Você vai receber os avisos aqui.');
    carregarMais();
  } catch (err) { aviso(`Não deu para ativar: ${err.message}`); }
});

function sair() {
  SUPA.auth.signOut().catch(() => {});
  sessao = null; eu = null;
  guardado.gravar(CHAVE, null); chave = null;
  pararGeo?.();
  $('#app').hidden = true;
  mostrarEntrar('login');
}
$('#b-sair').addEventListener('click', () => { if (confirm('Sair deste aparelho? Para voltar, entre com seu e-mail e senha.')) sair(); });

// ---------------------------------------------------------------------------
// Gravador (reuniões, ligações, notas de voz) — no espírito do Plaud, com o iPhone como gravador
// ---------------------------------------------------------------------------
const PARTE_S = 300;          // cada parte tem 5 min: vai sendo enviada durante a reunião
const IMPORT_PARTE_S = 480;   // áudio importado é fatiado em partes de 8 min (WAV 16 kHz ≈ 15 MB)
const TIPOS = { reuniao: 'Reunião', ligacao: 'Ligação', nota: 'Nota de voz' };
const DICAS = {
  reuniao: 'Deixe o iPhone no meio da mesa, com a tela para cima.',
  ligacao: 'Coloque a ligação no viva-voz e grave por aqui, ou grave a chamada pelo próprio iPhone e importe o áudio depois.',
  nota: 'Fale à vontade: eu organizo as ideias e os próximos passos.',
};
const mmss = (s) => {
  const t = Math.max(0, Math.round(s || 0)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), ss = t % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};
const vibrar = (p) => { try { navigator.vibrate?.(p); } catch { /* iPhone ignora */ } };

// ---- Fila de envio no IndexedDB: nada se perde se a rede cair ou o app fechar ----
const fila = {
  db: null,
  async abrir() {
    if (this.db) return this.db;
    this.db = await new Promise((ok, erro) => {
      const r = indexedDB.open('cerebro-gravador', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('fila', { keyPath: 'chave' });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => erro(r.error);
    });
    return this.db;
  },
  async op(modo, fn) {
    const db = await this.abrir();
    return new Promise((ok, erro) => {
      const tx = db.transaction('fila', modo); const req = fn(tx.objectStore('fila'));
      tx.oncomplete = () => ok(req?.result); tx.onerror = () => erro(tx.error);
    });
  },
  por(item) { return this.op('readwrite', (st) => st.put(item)).catch(() => {}); },
  tirar(chave) { return this.op('readwrite', (st) => st.delete(chave)).catch(() => {}); },
  todos() { return this.op('readonly', (st) => st.getAll()).catch(() => []); },
};
const memoria = new Map(); // reserva se o IndexedDB falhar
let enviando = false;

async function enfileirar(item) {
  memoria.set(item.chave, item);
  await fila.por(item);
  enviarFila();
}

async function enviarFila() {
  if (enviando || !logado()) return;
  enviando = true;
  try {
    const itens = new Map([...(await fila.todos()).map((i) => [i.chave, i]), ...memoria]);
    // Partes primeiro (em ordem); o "encerrar" só depois que as partes daquela gravação saíram.
    const lista = [...itens.values()].sort((a, b) => (a.tipo === 'fim') - (b.tipo === 'fim') || a.rid.localeCompare(b.rid) || a.idx - b.idx);
    for (const it of lista) {
      if (it.tipo === 'fim' && lista.some((o) => o.tipo === 'parte' && o.rid === it.rid && itens.has(o.chave))) continue;
      try {
        if (it.tipo === 'parte') {
          await api(`/gravacoes/${it.rid}/partes?idx=${it.idx}&inicio=${it.inicio.toFixed(1)}&duracao=${it.dur.toFixed(1)}`, { metodo: 'POST', corpo: it.blob, tipo: it.mime });
        } else {
          await api(`/gravacoes/${it.rid}/encerrar`, { metodo: 'POST', corpo: { partes: it.partes, duracao: it.duracao } }).catch((e) => {
            if (!/encerrada/.test(e.message)) throw e;
          });
        }
        itens.delete(it.chave); memoria.delete(it.chave); await fila.tirar(it.chave);
      } catch (e) {
        if (/Parte vazia/.test(e.message)) { itens.delete(it.chave); memoria.delete(it.chave); await fila.tirar(it.chave); continue; }
        setTimeout(enviarFila, 8000); // sem rede: tenta de novo daqui a pouco
        break;
      }
    }
  } finally {
    enviando = false;
    atualizarEstadoEnvio();
  }
}
window.addEventListener('online', enviarFila);

// ---- Estado da gravação ----
const Rec = {
  ativo: false, id: null, tipo: 'reuniao', stream: null, mr: null, mime: '', idx: 0,
  acumulado: 0, inicioParte: 0, pausado: false, interrompido: false, troca: null, relogio: null,
  ctx: null, analisador: null, wake: null, partesPendentes: 0,
};

const tempoAtual = () => Rec.acumulado + (Rec.mr && !Rec.pausado && !Rec.interrompido ? (performance.now() - Rec.inicioParte) / 1000 : 0);

function escolherMime() {
  return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';
}

async function pegarMicrofone() {
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
}

async function manterTelaAcesa() {
  try { Rec.wake = await navigator.wakeLock?.request('screen'); } catch { /* sem suporte: a dica na tela avisa */ }
}

function iniciarParte() {
  const mr = new MediaRecorder(Rec.stream, Rec.mime ? { mimeType: Rec.mime, audioBitsPerSecond: 64000 } : undefined);
  const pedacos = [], idx = Rec.idx++, inicio = Rec.acumulado, comecou = performance.now();
  mr.ondataavailable = (e) => e.data?.size && pedacos.push(e.data);
  mr.onstop = () => {
    const dur = (performance.now() - comecou) / 1000;
    const tipo = (mr.mimeType || Rec.mime || 'audio/mp4').split(';')[0];
    const blob = new Blob(pedacos, { type: tipo });
    if (blob.size > 1000) enfileirar({ chave: `${Rec.id}:${String(idx).padStart(3, '0')}`, tipo: 'parte', rid: Rec.id, idx, inicio, dur, blob, mime: tipo });
    else Rec.idx = Math.max(Rec.idx, idx + 1);
  };
  mr.start(1000);
  Rec.mr = mr; Rec.inicioParte = comecou;
  clearTimeout(Rec.troca);
  Rec.troca = setTimeout(trocarParte, PARTE_S * 1000);
}

function fecharParte() {
  clearTimeout(Rec.troca);
  if (!Rec.mr) return;
  Rec.acumulado += (performance.now() - Rec.inicioParte) / 1000;
  if (Rec.mr.state !== 'inactive') Rec.mr.stop();
  Rec.mr = null;
}

function trocarParte() {
  if (!Rec.ativo || Rec.pausado || Rec.interrompido) return;
  fecharParte();
  iniciarParte();
}

async function comecarGravacao() {
  if (Rec.ativo) { ir('gravando'); return; }
  if (!window.MediaRecorder) { aviso('Este aparelho não grava áudio pelo app.'); return; }
  let stream;
  try { stream = await pegarMicrofone(); } catch { aviso('Libere o microfone para o app nos Ajustes do iPhone.'); return; }
  try {
    const r = await api('/gravacoes', { metodo: 'POST', corpo: { tipo: Rec.tipo } });
    Object.assign(Rec, { ativo: true, id: r.id, stream, mime: escolherMime(), idx: 0, acumulado: 0, pausado: false, interrompido: false });
    vigiarMicrofone();
    iniciarParte();
    medirNivel();
    await manterTelaAcesa();
    Rec.relogio = setInterval(tique, 500);
    vibrar(40);
    ir('gravando');
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    aviso(`Não consegui começar: ${e.message}`);
  }
}

function vigiarMicrofone() {
  const trilha = Rec.stream?.getAudioTracks()[0];
  if (!trilha) return;
  const caiu = () => {
    if (!Rec.ativo || Rec.pausado || Rec.interrompido) return;
    Rec.interrompido = true; fecharParte(); mostrarGravando();
  };
  trilha.addEventListener('ended', caiu);
  trilha.addEventListener('mute', () => setTimeout(() => trilha.muted && caiu(), 1500));
}

async function continuarDepoisDeInterrupcao() {
  try {
    Rec.stream?.getTracks().forEach((t) => t.stop());
    Rec.stream = await pegarMicrofone();
    Rec.interrompido = false; vigiarMicrofone(); medirNivel(); iniciarParte(); await manterTelaAcesa(); mostrarGravando();
  } catch { aviso('Não consegui o microfone de volta. Abra o app e tente de novo.'); }
}

function pausarOuContinuar() {
  if (!Rec.ativo || Rec.interrompido) return;
  if (Rec.pausado) { Rec.pausado = false; iniciarParte(); }
  else { Rec.pausado = true; fecharParte(); }
  vibrar(30); mostrarGravando();
}

async function encerrarGravacao() {
  if (!Rec.ativo) return;
  if (tempoAtual() < 3 && !confirm('A gravação tem menos de 3 segundos. Encerrar assim mesmo?')) return;
  const id = Rec.id;
  fecharParte();
  // Espera o último pedaço sair do MediaRecorder antes de contar as partes.
  await new Promise((r) => setTimeout(r, 400));
  const partes = Rec.idx, duracao = Rec.acumulado;
  clearInterval(Rec.relogio);
  Rec.stream?.getTracks().forEach((t) => t.stop());
  try { Rec.ctx?.close(); } catch { /* ok */ }
  try { await Rec.wake?.release(); } catch { /* ok */ }
  Object.assign(Rec, { ativo: false, id: null, stream: null, mr: null, ctx: null, analisador: null, wake: null });
  await enfileirar({ chave: `${id}:fim`, tipo: 'fim', rid: id, idx: 9999, partes, duracao });
  vibrar([30, 60, 30]);
  aviso('Gravação encerrada. Vou transcrever e te aviso quando a ata estiver pronta.');
  ir(`gravacao/${id}`);
}

async function anexar(corpo) {
  if (!Rec.id) return;
  try { await api(`/gravacoes/${Rec.id}/anexos`, { metodo: 'POST', corpo }); } catch (e) { aviso(`Não salvou: ${e.message}`); }
}

// Foto: reduz para no máx. 1600 px (JPEG) antes de enviar.
async function reduzirFoto(arquivo) {
  const img = await createImageBitmap(arquivo).catch(() => null);
  if (!img) return arquivo;
  const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob((b) => ok(b || arquivo), 'image/jpeg', 0.82));
}

// ---- Tela "gravando" ----
function tique() {
  const t = mmss(tempoAtual());
  $('#rec-tempo').textContent = t;
  $('#pilula-tempo').textContent = Rec.pausado ? `Pausado ${t}` : `Gravando ${t}`;
}

function atualizarEstadoEnvio() {
  fila.todos().then((itens) => {
    const n = new Set([...itens.map((i) => i.chave), ...memoria.keys()]).size;
    const el = $('#rec-estado');
    if (!el || !Rec.ativo) return;
    el.textContent = Rec.interrompido ? 'Microfone pausado pelo iPhone' : Rec.pausado ? 'Pausado' : n ? `Gravando · enviando ${n} parte(s)` : 'Gravando · tudo salvo na nuvem';
  });
}

function mostrarGravando() {
  if (!Rec.ativo) { ir('gravar'); return; }
  $('#rec-tipo').textContent = TIPOS[Rec.tipo];
  $('#b-pausar').textContent = Rec.pausado ? 'Continuar' : 'Pausar';
  $('#rec-aviso').hidden = !Rec.interrompido;
  $('#v-gravando').classList.toggle('pausado', Rec.pausado || Rec.interrompido);
  tique(); atualizarEstadoEnvio();
}

function medirNivel() {
  try {
    Rec.ctx?.close();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    Rec.ctx = new Ctx();
    Rec.analisador = Rec.ctx.createAnalyser();
    Rec.analisador.fftSize = 512;
    Rec.ctx.createMediaStreamSource(Rec.stream).connect(Rec.analisador);
  } catch { Rec.analisador = null; }
  const barras = $('#rec-nivel');
  if (!barras.childElementCount) barras.innerHTML = '<i></i>'.repeat(28);
  const dados = new Uint8Array(512), hist = new Array(28).fill(0.04);
  const passo = () => {
    if (!Rec.ativo) return;
    if (!document.hidden && !$('#v-gravando').hidden && Rec.analisador) {
      Rec.analisador.getByteTimeDomainData(dados);
      let soma = 0; for (const v of dados) soma += ((v - 128) / 128) ** 2;
      const nivel = Rec.pausado || Rec.interrompido ? 0.04 : Math.min(1, Math.sqrt(soma / dados.length) * 4 + 0.04);
      hist.shift(); hist.push(nivel);
      [...barras.children].forEach((b, i) => (b.style.transform = `scaleY(${hist[i].toFixed(3)})`));
    }
    requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden || !Rec.ativo) return;
  manterTelaAcesa();
  const trilha = Rec.stream?.getAudioTracks()[0];
  if (!Rec.pausado && !Rec.interrompido && (!trilha || trilha.readyState === 'ended')) { Rec.interrompido = true; fecharParte(); }
  mostrarGravando();
});
window.addEventListener('beforeunload', (e) => { if (Rec.ativo) { e.preventDefault(); e.returnValue = ''; } });

// ---- Tela "Gravar" ----
document.querySelectorAll('.tipos .chip').forEach((b) => b.addEventListener('click', () => {
  Rec.tipo = b.dataset.tipo;
  document.querySelectorAll('.tipos .chip').forEach((x) => { x.classList.toggle('ativo', x === b); x.setAttribute('aria-checked', x === b); });
  $('#dica-tipo').textContent = DICAS[Rec.tipo];
}));
$('#b-gravar').addEventListener('click', comecarGravacao);
$('#b-pausar').addEventListener('click', pausarOuContinuar);
$('#b-encerrar').addEventListener('click', encerrarGravacao);
$('#b-continuar-mic').addEventListener('click', continuarDepoisDeInterrupcao);
$('#b-destaque').addEventListener('click', () => { vibrar(25); aviso('Momento marcado como importante.'); anexar({ tipo: 'destaque', em: tempoAtual() }); });
$('#b-nota').addEventListener('click', () => {
  const t = prompt('Nota para esta gravação:');
  if (t?.trim()) anexar({ tipo: 'nota', em: tempoAtual(), texto: t.trim() }).then(() => aviso('Nota anexada.'));
});
$('#b-foto').addEventListener('click', () => $('#arquivo-foto').click());
$('#arquivo-foto').addEventListener('change', async (e) => {
  const arq = e.target.files?.[0]; e.target.value = '';
  if (!arq || !Rec.id) return;
  const em = tempoAtual();
  aviso('Enviando a foto…');
  try {
    const foto = await reduzirFoto(arq);
    await api(`/gravacoes/${Rec.id}/anexos?tipo=foto&em=${em.toFixed(1)}`, { metodo: 'POST', corpo: foto, tipo: 'image/jpeg' });
    aviso('Foto anexada. Vou ler o que está nela.');
  } catch (err) { aviso(`A foto não foi: ${err.message}`); }
});

const ESTADO = { gravando: 'gravando', processando: 'transcrevendo', resumindo: 'montando a ata', pronta: '', erro: 'deu erro' };

async function carregarGravacoes() {
  const d = await api('/gravacoes');
  $('#cartao-voz').hidden = !!d.voz_referencia;
  $('#lista-gravacoes').innerHTML = d.gravacoes.length
    ? d.gravacoes.map((g) => `<li><button class="item" data-ir="gravacao/${esc(g.id)}"><span class="t">${esc(g.title || (g.status === 'pronta' ? 'Gravação' : TIPOS[g.kind] + ' em processamento'))}</span><span class="h">${quando(g.started_at)}${g.duration_s ? ` · ${mmss(g.duration_s)}` : ''}</span><span class="d">${ESTADO[g.status] ? `<em class="etiqueta">${ESTADO[g.status]}</em> ` : ''}${esc(g.resumo || TIPOS[g.kind])}</span></button></li>`).join('')
    : '<li><p class="vazio">Suas gravações aparecem aqui, com ata, plano de ação e transcrição.</p></li>';
}

$('#form-perguntar-todas').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('#pergunta-todas').value.trim(); if (!q) return;
  const box = $('#resposta-todas'); box.hidden = false; box.innerHTML = '<p class="dica">Procurando nas gravações…</p>';
  try {
    const r = await api('/gravacoes/perguntar', { metodo: 'POST', corpo: { pergunta: q } });
    box.innerHTML = `<p>${leve(r.resposta)}</p>${r.fontes.length ? `<p class="fontes">${r.fontes.map((f) => `<a href="#gravacao/${esc(f.id)}">${esc(f.titulo)} · ${quando(f.data)}</a>`).join('')}</p>` : ''}`;
  } catch (err) { box.innerHTML = `<p class="erro">${esc(err.message)}</p>`; }
});

// ---- Áudio → WAV 16 kHz mono (importação e voz de referência) ----
async function decodificar(arrayBuffer) {
  const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new Off(1, 16000, 16000);
  return new Promise((ok, erro) => {
    const p = ctx.decodeAudioData(arrayBuffer, ok, erro);
    p?.then?.(ok, erro);
  });
}
function mono(buf) {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0);
  const a = buf.getChannelData(0), b = buf.getChannelData(1), out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) / 2;
  return out;
}
function wav(amostras, taxa) {
  const v = new DataView(new ArrayBuffer(44 + amostras.length * 2));
  const txt = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, 'RIFF'); v.setUint32(4, 36 + amostras.length * 2, true); txt(8, 'WAVE'); txt(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); txt(36, 'data');
  v.setUint32(40, amostras.length * 2, true);
  for (let i = 0; i < amostras.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, amostras[i])) * 0x7fff, true);
  return new Blob([v], { type: 'audio/wav' });
}
function duracaoDoArquivo(arq) {
  return new Promise((ok) => {
    const a = new Audio(); const url = URL.createObjectURL(arq);
    a.preload = 'metadata'; a.src = url;
    a.onloadedmetadata = () => { URL.revokeObjectURL(url); ok(Number.isFinite(a.duration) ? a.duration : null); };
    a.onerror = () => { URL.revokeObjectURL(url); ok(null); };
  });
}

$('#b-importar').addEventListener('click', () => $('#arquivo-audio').click());
$('#arquivo-audio').addEventListener('change', async (e) => {
  const arq = e.target.files?.[0]; e.target.value = '';
  if (!arq) return;
  const st = $('#importando'); st.hidden = false; st.textContent = 'Preparando o áudio…';
  try {
    const dur = await duracaoDoArquivo(arq);
    const tipo = Rec.tipo === 'reuniao' && /liga|call|chamada|whatsapp|ptt/i.test(arq.name) ? 'ligacao' : Rec.tipo;
    const inicio = arq.lastModified && dur ? new Date(arq.lastModified - dur * 1000).toISOString() : undefined;
    const rec = await api('/gravacoes', { metodo: 'POST', corpo: { tipo, inicio, titulo: undefined } });
    let partes = 0, total = dur || 0;
    if (arq.size <= 24 * 1024 * 1024 && dur && dur <= 600) {
      // Curto: vai do jeito que está (m4a, mp3, wav…).
      await enfileirar({ chave: `${rec.id}:000`, tipo: 'parte', rid: rec.id, idx: 0, inicio: 0, dur, blob: arq, mime: arq.type || 'audio/mp4' });
      partes = 1;
    } else {
      st.textContent = 'Fatiando o áudio em partes…';
      const amostras = mono(await decodificar(await arq.arrayBuffer()));
      total = amostras.length / 16000;
      const passo = IMPORT_PARTE_S * 16000;
      for (let i = 0, idx = 0; i < amostras.length; i += passo, idx++) {
        const fatia = amostras.subarray(i, Math.min(amostras.length, i + passo));
        await enfileirar({ chave: `${rec.id}:${String(idx).padStart(3, '0')}`, tipo: 'parte', rid: rec.id, idx, inicio: i / 16000, dur: fatia.length / 16000, blob: wav(fatia, 16000), mime: 'audio/wav' });
        partes++;
        st.textContent = `Enviando parte ${partes} de ${Math.ceil(amostras.length / passo)}…`;
      }
    }
    await enfileirar({ chave: `${rec.id}:fim`, tipo: 'fim', rid: rec.id, idx: 9999, partes, duracao: total });
    st.hidden = true;
    aviso('Áudio importado. Vou transcrever e te aviso.');
    ir(`gravacao/${rec.id}`);
  } catch (err) {
    st.textContent = `Não consegui importar: ${err.message}. Formatos: m4a, mp3, wav, ogg.`;
  }
});

// ---- Voz de referência (8 s) ----
$('#b-voz').addEventListener('click', async (e) => {
  const b = e.currentTarget;
  let stream;
  try { stream = await pegarMicrofone(); } catch { aviso('Libere o microfone para o app nos Ajustes do iPhone.'); return; }
  const frase = 'Leia em voz alta: "Oi, aqui é o Michelder. Estou gravando a minha voz para o Segundo Cérebro me reconhecer nas reuniões."';
  b.disabled = true; b.textContent = 'Gravando… 8'; aviso(frase);
  const mr = new MediaRecorder(stream, escolherMime() ? { mimeType: escolherMime() } : undefined), pedacos = [];
  mr.ondataavailable = (ev) => ev.data.size && pedacos.push(ev.data);
  mr.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    try {
      const bruto = new Blob(pedacos, { type: mr.mimeType || 'audio/mp4' });
      const amostras = mono(await decodificar(await bruto.arrayBuffer()));
      await api('/voz', { metodo: 'POST', corpo: wav(amostras.subarray(0, 16000 * 10), 16000), tipo: 'audio/wav' });
      aviso('Pronto, aprendi sua voz.'); $('#cartao-voz').hidden = true;
    } catch (err) { aviso(`Não deu: ${err.message}`); }
    finally { b.disabled = false; b.textContent = 'Gravar minha voz'; }
  };
  mr.start();
  let n = 8; const t = setInterval(() => { n--; b.textContent = `Gravando… ${n}`; if (n <= 0) { clearInterval(t); mr.stop(); } }, 1000);
});

// ---- Detalhe de uma gravação ----
const Det = { id: null, dados: null, timer: null, partes: [], parteAtual: -1, pane: 'resumo' };
const audioEl = $('#p-audio');
function pararDetalhe() { clearTimeout(Det.timer); Det.timer = null; if (!audioEl.paused) audioEl.pause(); }

async function carregarGravacao(id) {
  if (Det.id !== id) { Det.id = id; Det.dados = null; Det.parteAtual = -1; audioEl.removeAttribute('src'); $('#g-respostas').innerHTML = ''; trocarPane('resumo'); }
  const g = await api(`/gravacoes/${encodeURIComponent(id)}`);
  if (Det.id !== id) return;
  Det.dados = g;
  $('#g-titulo').textContent = g.title || `${TIPOS[g.kind]} de ${new Date(g.started_at).toLocaleDateString('pt-BR')}`;
  $('#g-meta').textContent = [TIPOS[g.kind], quando(g.started_at), g.duration_s ? mmss(g.duration_s) : '', g.falantes?.length ? `${new Set(g.falantes.map((f) => f.nome)).size} pessoa(s)` : ''].filter(Boolean).join(' · ');

  const pronta = g.status === 'pronta';
  const proc = $('#g-processando');
  if (!pronta) {
    const feitas = g.partes.filter((p) => p.status === 'transcrita').length;
    const total = g.parts_expected ?? g.partes.length;
    proc.hidden = false;
    proc.innerHTML = g.status === 'erro'
      ? `<p>Não consegui processar esta gravação${g.error ? ` (${esc(g.error.slice(0, 120))})` : ''}.</p><button id="b-tentar" class="btn claro">Tentar de novo</button>`
      : g.status === 'gravando'
        ? `<p>${Rec.id === id ? 'Gravando agora.' : 'Esta gravação ainda está aberta: as partes que faltam podem estar no aparelho, esperando internet.'}</p>`
        : `<p class="pulsando">${g.status === 'resumindo' ? 'Montando a ata e o plano de ação…' : `Transcrevendo e separando quem falou o quê (${feitas} de ${total || '?'} parte(s))…`}</p>`;
    $('#b-tentar')?.addEventListener('click', async () => { await api(`/gravacoes/${id}/tentar-de-novo`, { metodo: 'POST' }); carregarGravacao(id); });
    clearTimeout(Det.timer);
    if (g.status !== 'erro') Det.timer = setTimeout(() => !$('#v-gravacao').hidden && carregarGravacao(id).catch(() => {}), 5000);
  } else proc.hidden = true;

  Det.partes = g.partes.filter((p) => p.url).sort((a, b) => a.idx - b.idx);
  $('#g-player').hidden = !Det.partes.length;
  $('#p-barra').max = String(Math.max(1, Math.round(g.duration_s || Det.partes.reduce((m, p) => Math.max(m, (p.inicio || 0) + (p.duracao || 0)), 0))));

  $('#g-rodape').hidden = !pronta;
  $('#g-modelo').innerHTML = (g.modelos || []).map((m) => `<option value="${esc(m.id)}" ${m.id === g.template ? 'selected' : ''}>${esc(m.nome)}</option>`).join('');
  renderResumo(g); renderTranscricao(g);
  $('#form-perguntar').hidden = !pronta;
}

function lista(itens, fmt = (x) => leve(x)) { return itens?.length ? `<ul class="marcadores">${itens.map((i) => `<li>${fmt(i)}</li>`).join('')}</ul>` : ''; }

function mapaMental(texto) {
  if (!texto) return '';
  const linhas = texto.split('\n').filter((l) => l.trim().replace(/^[-•*]\s*/, ''));
  let html = '', nivel = -1;
  for (const l of linhas) {
    const n = Math.min(3, Math.floor((l.match(/^\s*/)[0].length) / 2));
    const t = leve(l.trim().replace(/^[-•*]\s*/, ''));
    if (n > nivel) html += '<ul>'.repeat(n - nivel); else { html += '</li>'; if (n < nivel) html += '</ul></li>'.repeat(nivel - n); }
    html += `<li><span>${t}</span>`; nivel = n;
  }
  html += '</li>' + '</ul></li>'.repeat(Math.max(0, nivel)) + '</ul>';
  return `<div class="mapa">${html}</div>`;
}

function renderResumo(g) {
  const s = g.summary || {};
  if (g.status !== 'pronta' && !g.summary) { $('#pane-resumo').innerHTML = '<p class="vazio">A ata aparece aqui assim que eu terminar.</p>'; return; }
  const acoes = s.acoes || [];
  const fotos = (g.anexos || []).filter((a) => a.tipo === 'foto');
  const notas = (g.anexos || []).filter((a) => a.tipo !== 'foto');
  $('#pane-resumo').innerHTML = `
    ${s.resumo ? `<p class="resumo-texto">${leve(s.resumo)}</p>` : ''}
    ${acoes.length ? `<h3>Plano de ação</h3><ul class="acoes-lista">${acoes.map((a, k) => `<li class="${a.eh_michelder ? 'minha' : ''}"><span class="t">${leve(a.tarefa)}</span><span class="d">${esc(a.responsavel || '')}${a.eh_michelder ? ' <em class="etiqueta">sua</em>' : ''}</span><button class="agendar" data-agendar="${k}" aria-label="Agendar no calendário"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>${esc(a.prazo || 'Agendar')}</button></li>`).join('')}</ul>
      ${acoes.some((a) => a.eh_michelder) ? '<button id="b-lembretes" class="btn claro">Transformar as minhas ações em lembretes</button>' : ''}` : ''}
    ${s.decisoes?.length ? `<h3>Decisões</h3>${lista(s.decisoes)}` : ''}
    ${(s.secoes_extra || []).map((x) => `<h3>${esc(x.titulo)}</h3><p class="pre">${leve(x.conteudo)}</p>`).join('')}
    ${s.topicos?.length ? `<h3>O que foi discutido</h3>${s.topicos.map((t) => `<details><summary>${esc(t.titulo)}</summary>${lista(t.pontos)}</details>`).join('')}` : ''}
    ${s.pendencias?.length ? `<h3>Em aberto</h3>${lista(s.pendencias)}` : ''}
    ${s.insights?.length ? `<h3>O que eu notei</h3>${lista(s.insights)}` : ''}
    ${s.mapa_mental ? `<h3>Mapa mental</h3>${mapaMental(s.mapa_mental)}` : ''}
    ${fotos.length ? `<h3>Fotos</h3><div class="fotos">${fotos.map((f) => `<figure>${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener"><img src="${esc(f.url)}" alt="${esc(f.texto || 'Foto da gravação')}" loading="lazy"></a>` : ''}<figcaption>${f.em != null ? `<button class="tempo" data-t="${f.em}">${mmss(f.em)}</button> ` : ''}${esc(f.leitura || 'Lendo a foto…')}</figcaption></figure>`).join('')}</div>` : ''}
    ${notas.length ? `<h3>Notas e destaques</h3><ul class="marcadores">${notas.map((n) => `<li>${n.em != null ? `<button class="tempo" data-t="${n.em}">${mmss(n.em)}</button> ` : ''}${n.tipo === 'destaque' ? '★ ' : ''}${esc(n.texto || 'Momento importante')}</li>`).join('')}</ul>` : ''}
    ${s.partes_com_erro ? `<p class="dica">${s.partes_com_erro} parte(s) do áudio não puderam ser transcritas.</p>` : ''}`;
  document.querySelectorAll('[data-agendar]').forEach((b) => b.addEventListener('click', () => {
    const a = acoes[Number(b.dataset.agendar)];
    editarLembrete(null, { texto: a.tarefa, dia: sugerirDia(a.prazo), hora: '09:00' });
  }));
  $('#b-lembretes')?.addEventListener('click', () => {
    sessionStorage.setItem('cerebro-enviar', `Crie lembretes para as ações que são minhas na gravação "${g.title}" (id ${g.id}), usando os prazos combinados. Se faltar data, me pergunte.`);
    ir('conversa');
  });
}

const CORES = 6;
function renderTranscricao(g) {
  const segs = g.transcript || [];
  if (!segs.length) { $('#pane-transcricao').innerHTML = `<p class="vazio">${g.status === 'pronta' ? 'Sem fala reconhecida.' : 'A transcrição aparece aqui assim que eu terminar.'}</p>`; return; }
  const nomes = [...new Set(segs.map((s) => s.s))];
  const cor = (n) => (n === 'Michelder' ? 'eu' : `c${nomes.filter((x) => x !== 'Michelder').indexOf(n) % CORES}`);
  const rotuloDe = (nome) => g.falantes.find((f) => f.nome === nome)?.rotulo;
  $('#pane-transcricao').innerHTML = `
    <p class="dica">Toque num nome para corrigir quem é. Toque no horário para ouvir.</p>
    <div class="falantes">${nomes.map((n) => `<button class="chip falante ${cor(n)}" data-rotulo="${esc(rotuloDe(n) || '')}" data-nome="${esc(n)}">${esc(n)}</button>`).join('')}</div>
    <div class="transcricao">${segs.map((s) => `<p class="fala ${cor(s.s)}"><button class="tempo" data-t="${s.i}">${mmss(s.i)}</button> <strong>${esc(s.s)}</strong> ${esc(s.t)}</p>`).join('')}</div>`;
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('.tempo[data-t]');
  if (t && !$('#v-gravacao').hidden) { e.preventDefault(); tocarEm(Number(t.dataset.t)); return; }
  const f = e.target.closest('.chip.falante');
  if (f && Det.id) {
    const novo = prompt(`Quem é "${f.dataset.nome}"?`, f.dataset.nome === 'Michelder' ? 'Michelder' : '');
    if (!novo?.trim() || !f.dataset.rotulo) return;
    try { await api(`/gravacoes/${Det.id}/falante`, { metodo: 'POST', corpo: { rotulo: f.dataset.rotulo, nome: novo.trim() } }); await carregarGravacao(Det.id); trocarPane('transcricao'); aviso('Nome corrigido na transcrição e na ata.'); }
    catch (err) { aviso(err.message); }
  }
});

function trocarPane(p) {
  Det.pane = p;
  document.querySelectorAll('.segmentos .seg').forEach((b) => { b.classList.toggle('ativo', b.dataset.pane === p); b.setAttribute('aria-selected', b.dataset.pane === p); });
  for (const n of ['resumo', 'transcricao', 'perguntar']) $(`#pane-${n}`).hidden = n !== p;
}
document.querySelectorAll('.segmentos .seg').forEach((b) => b.addEventListener('click', () => trocarPane(b.dataset.pane)));

$('#form-perguntar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('#pergunta').value.trim(); if (!q || !Det.id) return;
  $('#pergunta').value = '';
  const box = $('#g-respostas');
  box.insertAdjacentHTML('beforeend', `<div class="bolha eu">${esc(q)}</div><div class="bolha ia pensando">Lendo a gravação</div>`);
  const pensando = box.lastElementChild;
  try { const r = await api(`/gravacoes/${Det.id}/perguntar`, { metodo: 'POST', corpo: { pergunta: q } }); pensando.classList.remove('pensando'); pensando.innerHTML = leve(r.resposta); }
  catch (err) { pensando.classList.remove('pensando'); pensando.textContent = `Não consegui: ${err.message}`; }
  pensando.scrollIntoView({ block: 'end' });
});

$('#b-refazer').addEventListener('click', async (e) => {
  const modelo = $('#g-modelo').value;
  let instrucao;
  if (modelo === 'livre') { instrucao = prompt('O que você quer no resumo? Ex.: "foque nos números e riscos do contrato"'); if (!instrucao?.trim()) return; }
  const b = e.currentTarget; b.disabled = true; b.textContent = 'Refazendo…';
  try { await api(`/gravacoes/${Det.id}/resumo`, { metodo: 'POST', corpo: { modelo, instrucao } }); await carregarGravacao(Det.id); trocarPane('resumo'); aviso('Resumo refeito.'); }
  catch (err) { aviso(err.message); }
  finally { b.disabled = false; b.textContent = 'Refazer'; }
});
$('#b-apagar').addEventListener('click', async () => {
  if (!confirm('Apagar esta gravação, o áudio e a ata? Não dá para desfazer.')) return;
  try { await api(`/gravacoes/${Det.id}/apagar`, { metodo: 'POST' }); aviso('Gravação apagada.'); ir('gravar'); } catch (err) { aviso(err.message); }
});

// ---- Player: as partes tocam em sequência, como um áudio só ----
function parteEm(t) { let i = 0; Det.partes.forEach((p, k) => { if ((p.inicio || 0) <= t + 0.01) i = k; }); return i; }
function tocarEm(t) {
  if (!Det.partes.length) return;
  const i = parteEm(t), p = Det.partes[i];
  const pos = Math.max(0, t - (p.inicio || 0));
  if (Det.parteAtual !== i) { Det.parteAtual = i; audioEl.src = p.url; }
  const ir2 = () => { try { audioEl.currentTime = pos; } catch { /* ainda carregando */ } audioEl.play().catch(() => {}); };
  if (audioEl.readyState >= 1) ir2(); else audioEl.addEventListener('loadedmetadata', ir2, { once: true });
  if (audioEl.readyState < 1) audioEl.load();
}
$('#p-tocar').addEventListener('click', () => {
  if (audioEl.paused) { if (Det.parteAtual < 0) tocarEm(0); else audioEl.play().catch(() => {}); } else audioEl.pause();
});
audioEl.addEventListener('play', () => $('#p-tocar').classList.add('tocando'));
audioEl.addEventListener('pause', () => $('#p-tocar').classList.remove('tocando'));
audioEl.addEventListener('timeupdate', () => {
  const p = Det.partes[Det.parteAtual]; if (!p) return;
  const t = (p.inicio || 0) + audioEl.currentTime;
  $('#p-tempo').textContent = mmss(t); $('#p-barra').value = String(Math.round(t));
});
audioEl.addEventListener('ended', () => { const prox = Det.partes[Det.parteAtual + 1]; if (prox) tocarEm(prox.inicio || 0); });
$('#p-barra').addEventListener('change', (e) => tocarEm(Number(e.target.value)));

// Ao abrir o app, reenvia o que tiver ficado na fila.
setTimeout(enviarFila, 1500);


// ---------------------------------------------------------------------------
// Mãos-livres: o app fica ouvindo e só age quando a frase começa com "Dimy"
// ---------------------------------------------------------------------------
const Dimy = { ligado: false, stream: null, ctx: null, an: null, mr: null, pedacos: [], falando: false, ocupado: false, ultimaVoz: 0, inicioFala: 0, chao: 0.01, timer: null, ultimoComando: 0, wake: null };

function falar(texto) {
  return new Promise((ok) => {
    try {
      const u = new SpeechSynthesisUtterance(texto.replace(/[*_#•]/g, ''));
      u.lang = 'pt-BR'; u.rate = 1.05;
      const voz = speechSynthesis.getVoices().find((v) => v.lang?.startsWith('pt-BR'));
      if (voz) u.voice = voz;
      Dimy.falando = true;
      u.onend = u.onerror = () => { Dimy.falando = false; ok(); };
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch { Dimy.falando = false; ok(); }
  });
}

function estadoDimy(t) { $('#dimy-estado').textContent = t; }

async function ligarDimy() {
  try { Dimy.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch { aviso('Libere o microfone para o app nos Ajustes do iPhone.'); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  Dimy.ctx = new Ctx(); Dimy.an = Dimy.ctx.createAnalyser(); Dimy.an.fftSize = 1024;
  Dimy.ctx.createMediaStreamSource(Dimy.stream).connect(Dimy.an);
  Dimy.ligado = true; Dimy.ultimoComando = Date.now();
  try { Dimy.wake = await navigator.wakeLock?.request('screen'); } catch { /* ok */ }
  $('#b-maos-livres').setAttribute('aria-pressed', 'true');
  $('.barra-dimy').classList.add('ouvindo');
  falar('Pode falar.'); // destrava a voz do iPhone (precisa de um toque)
  // Mede o ruído do ambiente por 1 s para saber o que é voz.
  const dados = new Float32Array(1024); let soma = 0, n = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < 1000) { Dimy.an.getFloatTimeDomainData(dados); soma += rms(dados); n++; await new Promise((r) => setTimeout(r, 50)); }
  Dimy.chao = Math.max(0.004, soma / n);
  estadoDimy('Ouvindo. Diga "Dimy, …"');
  Dimy.timer = setInterval(ouvirDimy, 60);
}

function desligarDimy(motivo) {
  clearInterval(Dimy.timer);
  try { if (Dimy.mr?.state === 'recording') { Dimy.mr.onstop = null; Dimy.mr.stop(); } } catch { /* ok */ }
  Dimy.stream?.getTracks().forEach((t) => t.stop());
  try { Dimy.ctx?.close(); } catch { /* ok */ }
  try { Dimy.wake?.release(); } catch { /* ok */ }
  Object.assign(Dimy, { ligado: false, stream: null, ctx: null, an: null, mr: null });
  $('#b-maos-livres').setAttribute('aria-pressed', 'false');
  $('.barra-dimy').classList.remove('ouvindo');
  estadoDimy(motivo || 'Ligue e é só falar: "Dimy, agenda…"');
}

const rms = (d) => { let s = 0; for (const v of d) s += v * v; return Math.sqrt(s / d.length); };

function ouvirDimy() {
  if (!Dimy.ligado || !Dimy.an) return;
  if (Date.now() - Dimy.ultimoComando > 30 * 60e3) { desligarDimy('Desliguei o mãos-livres depois de 30 min sem comandos.'); return; }
  if (Dimy.falando || Dimy.ocupado) return;
  const dados = new Float32Array(1024); Dimy.an.getFloatTimeDomainData(dados);
  const nivel = rms(dados), agora = performance.now();
  const voz = nivel > Math.max(0.015, Dimy.chao * 3.2);
  if (voz) Dimy.ultimaVoz = agora;
  const gravando = Dimy.mr?.state === 'recording';
  if (voz && !gravando) {
    const tipo = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
    Dimy.mr = new MediaRecorder(Dimy.stream, tipo ? { mimeType: tipo } : undefined);
    Dimy.pedacos = []; Dimy.inicioFala = agora;
    Dimy.mr.ondataavailable = (e) => e.data.size && Dimy.pedacos.push(e.data);
    Dimy.mr.onstop = enviarDimy;
    Dimy.mr.start(250);
  } else if (gravando && (agora - Dimy.ultimaVoz > 1300 || agora - Dimy.inicioFala > 30000)) {
    Dimy.mr.stop();
  }
}

async function enviarDimy() {
  const fala = Dimy.ultimaVoz - Dimy.inicioFala;
  const audio = new Blob(Dimy.pedacos, { type: (Dimy.mr?.mimeType || 'audio/mp4').split(';')[0] });
  if (fala < 500 || audio.size < 2000) return; // tosse, barulho
  Dimy.ocupado = true; estadoDimy('Entendendo…');
  try {
    const r = await api('/audio?maos_livres=1', { metodo: 'POST', corpo: audio, tipo: audio.type });
    if (r.ignorado) return;
    Dimy.ultimoComando = Date.now();
    if (!$('#v-conversa').hidden) { bolha('eu', `🎤 ${r.texto}`, new Date().toISOString()); bolha('ia', r.resposta, new Date().toISOString()); }
    estadoDimy('Respondendo…');
    await falar(r.resposta);
  } catch (e) { aviso(`Dimy: ${e.message}`); }
  finally { Dimy.ocupado = false; if (Dimy.ligado) estadoDimy('Ouvindo. Diga "Dimy, …"'); }
}

$('#b-maos-livres').addEventListener('click', () => (Dimy.ligado ? desligarDimy() : ligarDimy()));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && Dimy.ligado) desligarDimy('O mãos-livres para quando o app sai da tela. Toque para ligar de novo.');
});

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------
let iniciou = false;
function iniciar() {
  $('#entrar').hidden = true; $('#app').hidden = false;
  aplicarPapel();
  if (!iniciou) { window.addEventListener('hashchange', rota); iniciou = true; }
  rota();
  iniciarGeo();
}

// ---------------------------------------------------------------------------
// Login da equipe
// ---------------------------------------------------------------------------
const logado = () => !!(sessao || chave);

function mostrarEntrar(etapa, erro = '') {
  $('#app').hidden = true; $('#entrar').hidden = false;
  document.querySelectorAll('#entrar .entrar-form').forEach((f) => { f.hidden = f.dataset.etapa !== etapa; f.querySelector('[data-erro]').textContent = ''; });
  $('#entrar-carregando').hidden = etapa !== 'carregando';
  const f = document.querySelector(`#entrar [data-etapa="${etapa}"]`);
  if (f && erro) f.querySelector('[data-erro]').textContent = erro;
}

async function carregarEu() {
  try { eu = await api('/equipe/eu'); } catch { eu = null; }
}

/** Mostra ou esconde o que é só do dono (WhatsApp, atalho da Siri) e a gestão da equipe. */
function aplicarPapel() {
  const dono = !eu || eu.dono;          // sem login (chave antiga) = dono
  document.querySelectorAll('.so-dono').forEach((el) => { el.hidden = !dono; });
  $('#equipe-sec').hidden = !(eu?.usuario?.papel === 'admin');
  $('#conta-quem').textContent = eu?.usuario ? `Você entrou como ${eu.usuario.nome} (${eu.usuario.email}).` : 'Você está usando a chave de acesso antiga.';
  $('#b-criar-login').hidden = !!sessao || !chave;
  if (eu?.usuario?.nome) $('#avatar-eu').textContent = iniciais(eu.usuario.nome).slice(0, 1);
}

document.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => {
  const i = document.getElementById(b.dataset.ver); i.type = i.type === 'password' ? 'text' : 'password';
}));

$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget, erro = f.querySelector('[data-erro]'), bt = $('#login-btn');
  const email = $('#login-email').value.trim().toLowerCase(), password = $('#login-senha').value;
  if (!email || !password) { erro.textContent = 'Preencha e-mail e senha.'; return; }
  bt.disabled = true; bt.textContent = 'Entrando…'; erro.textContent = '';
  try {
    const { data, error } = await SUPA.auth.signInWithPassword({ email, password });
    if (error) throw new Error(/invalid/i.test(error.message) ? 'E-mail ou senha incorretos.' : error.message);
    sessao = data.session;
    await carregarEu();
    if (!eu) { await SUPA.auth.signOut(); sessao = null; throw new Error('Seu acesso não está liberado. Fale com o administrador.'); }
    $('#login-senha').value = '';
    iniciar();
  } catch (err) { erro.textContent = err.message; }
  finally { bt.disabled = false; bt.textContent = 'Entrar'; }
});

$('#form-senha').addEventListener('submit', async (e) => {
  e.preventDefault();
  const erro = e.currentTarget.querySelector('[data-erro]');
  const a = $('#nova-senha').value, b = $('#nova-senha2').value;
  if (a.length < 8) { erro.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; return; }
  if (a !== b) { erro.textContent = 'As duas senhas não estão iguais.'; return; }
  const { error } = await SUPA.auth.updateUser({ password: a });
  if (error) { erro.textContent = /same|different/i.test(error.message) ? 'Use uma senha diferente da anterior.' : error.message; return; }
  sessao = (await SUPA.auth.getSession()).data.session;
  $('#nova-senha').value = ''; $('#nova-senha2').value = '';
  await carregarEu();
  aviso('Senha criada. Bem-vindo!');
  iniciar();
});

/** Abre a sessão a partir de um link de acesso (convite ou redefinição) e pede a senha. */
async function usarCodigoDeAcesso(tokenHash) {
  mostrarEntrar('carregando');
  const { data, error } = await SUPA.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
  if (error || !data.session) { mostrarEntrar('login', 'Este link expirou ou já foi usado. Peça um novo ao administrador.'); return false; }
  sessao = data.session;
  await carregarEu();
  $('#senha-ola').textContent = eu?.usuario ? `Olá, ${eu.usuario.nome.split(' ')[0]}! Crie sua senha para entrar.` : 'Crie sua senha para entrar.';
  if (eu?.usuario?.email) $('#login-email').value = eu.usuario.email;
  mostrarEntrar('senha');
  return true;
}

$('#form-ativar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const erro = e.currentTarget.querySelector('[data-erro]');
  const email = $('#ativar-email').value.trim().toLowerCase(), nome = $('#ativar-nome').value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { erro.textContent = 'Informe um e-mail válido.'; return; }
  try {
    const r = await api('/equipe/ativar', { metodo: 'POST', corpo: { email, nome } });
    await usarCodigoDeAcesso(r.token_hash);
  } catch (err) { erro.textContent = err.message; }
});
$('#ativar-depois').addEventListener('click', () => { guardado.gravar('cerebro-ativar-depois', String(Date.now())); iniciar(); });
$('#b-criar-login').addEventListener('click', () => mostrarEntrar('ativar'));

// ---- Agendamento automático pelo WhatsApp (só o dono) ----
const AG_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const AG_STATUS = { aguardando: 'esperando o cliente escolher', marcado: 'marcada', cancelado: 'cancelada', expirado: 'sem resposta' };
(() => {
  const horas = (de, ate) => Array.from({ length: ate - de + 1 }, (_, i) => `<option value="${de + i}">${de + i}h</option>`).join('');
  $('#ag-inicio').innerHTML = horas(5, 22); $('#ag-fim').innerHTML = horas(6, 23);
  $('#ag-dias').innerHTML = AG_DIAS.map((d, i) => `<button type="button" class="ag-dia" data-dia="${i}">${d}</button>`).join('');
})();

function mostrarAgendador({ config: c, agendamentos: todos }) {
  const agendamentos = todos.filter((a) => a.status !== 'cancelado');
  $('#ag-ativo').checked = c.ativo;
  document.querySelectorAll('.ag-dia').forEach((b) => b.classList.toggle('on', c.dias_semana.includes(Number(b.dataset.dia))));
  $('#ag-inicio').value = c.hora_inicio; $('#ag-fim').value = c.hora_fim;
  $('#ag-duracao').value = c.duracao_min; $('#ag-intervalo').value = c.intervalo_min;
  $('#ag-almoco').checked = c.almoco_inicio != null;
  $('#ag-lista').innerHTML = agendamentos.length
    ? `<li class="ag-tit">Últimos pedidos</li>` + agendamentos.map((a) => `<li><b>${esc(a.nome || '+' + a.wa_id)}</b>
        <span>${a.status === 'marcado' && a.inicio ? `${quando(a.inicio)} · ` : ''}${esc(AG_STATUS[a.status] || a.status)}${a.assunto ? ` · ${esc(a.assunto)}` : ''}</span></li>`).join('')
    : '';
}
async function carregarAgendador() { mostrarAgendador(await api('/agendador')); }
async function salvarAgendador(campos) {
  try { mostrarAgendador(await api('/agendador', { metodo: 'POST', corpo: campos })); aviso('Agendamento atualizado.'); }
  catch (e) { aviso(e.message); carregarAgendador().catch(() => {}); }
}
$('#ag-ativo').addEventListener('change', (e) => salvarAgendador({ ativo: e.target.checked }));
$('#ag-almoco').addEventListener('change', (e) => salvarAgendador({ almoco: e.target.checked }));
$('#ag-dias').addEventListener('click', (e) => {
  const b = e.target.closest('.ag-dia'); if (!b) return;
  b.classList.toggle('on');
  const dias = [...document.querySelectorAll('.ag-dia.on')].map((x) => Number(x.dataset.dia));
  if (!dias.length) { b.classList.add('on'); aviso('Deixe pelo menos um dia.'); return; }
  salvarAgendador({ dias_semana: dias });
});
for (const [id, campo] of [['#ag-inicio', 'hora_inicio'], ['#ag-fim', 'hora_fim'], ['#ag-duracao', 'duracao_min'], ['#ag-intervalo', 'intervalo_min']]) {
  $(id).addEventListener('change', (e) => {
    if (Number($('#ag-fim').value) <= Number($('#ag-inicio').value)) { aviso('O fim do expediente precisa ser depois do início.'); carregarAgendador(); return; }
    salvarAgendador({ [campo]: Number(e.target.value) });
  });
}

// ---- Equipe (administrador) ----
async function carregarEquipe() {
  if (eu?.usuario?.papel !== 'admin') return;
  const { membros } = await api('/equipe');
  $('#lista-equipe').innerHTML = membros.map((m) => {
    const eu_ = m.user_id === eu.usuario.id;
    return `<li class="${m.ativo ? '' : 'inativo'}"><span class="avatar-p ${m.papel === 'admin' ? 'roxo' : ''}">${esc(iniciais(m.nome))}</span>
      <div class="eq-corpo"><b>${esc(m.nome)}${eu_ ? ' (você)' : ''}</b><span>${esc(m.email)}</span>
        <small>${m.papel === 'admin' ? 'Administrador' : 'Membro'}${m.ativo ? '' : ' · bloqueado'}${m.ultimo_acesso ? ` · entrou ${quando(m.ultimo_acesso)}` : ' · ainda não entrou'}</small></div>
      ${eu_ ? '' : `<div class="eq-acoes"><button class="btn mini claro" data-eq-link="${m.user_id}">Novo link</button>
        <button class="btn mini ${m.ativo ? 'perigo-txt' : 'claro'}" data-eq-ativo="${m.user_id}" data-ativo="${m.ativo ? '0' : '1'}">${m.ativo ? 'Bloquear' : 'Liberar'}</button></div>`}</li>`;
  }).join('');
}

function mostrarLinkConvite(r) {
  const texto = `Oi, ${r.nome.split(' ')[0]}! Liberei seu acesso ao Segundo Cérebro. Abra este link no iPhone (Safari), crie sua senha e depois adicione à Tela de Início: ${r.link}\n(O link vale por 1 hora.)`;
  const box = $('#convite-link');
  box.hidden = false;
  box.innerHTML = `<p><b>Link de acesso de ${esc(r.nome)}</b> (vale 1 hora). Envie só para essa pessoa.</p>
    <div class="acoes"><button class="btn claro" id="convite-copiar">Copiar link</button>
    <a class="btn primario" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(texto)}">Enviar pelo WhatsApp</a></div>`;
  $('#convite-copiar').onclick = () => copiar(texto, 'Convite copiado.');
}

$('#form-convite').addEventListener('submit', async (e) => {
  e.preventDefault();
  const bt = $('#convite-btn'); bt.disabled = true; bt.textContent = '…';
  try {
    const r = await api('/equipe/convidar', { metodo: 'POST', corpo: { nome: $('#convite-nome').value.trim(), email: $('#convite-email').value.trim() } });
    $('#convite-nome').value = ''; $('#convite-email').value = '';
    mostrarLinkConvite(r);
    await carregarEquipe();
  } catch (err) { aviso(err.message); } finally { bt.disabled = false; bt.textContent = 'Convidar'; }
});
$('#lista-equipe').addEventListener('click', async (e) => {
  const l = e.target.closest('[data-eq-link]'), a = e.target.closest('[data-eq-ativo]');
  try {
    if (l) mostrarLinkConvite(await api(`/equipe/${l.dataset.eqLink}/link`, { metodo: 'POST' }));
    if (a) {
      const liberar = a.dataset.ativo === '1';
      if (!liberar && !confirm('Bloquear o acesso dessa pessoa? Os dados dela ficam guardados.')) return;
      await api(`/equipe/${a.dataset.eqAtivo}/ativo`, { metodo: 'POST', corpo: { ativo: liberar } });
      await carregarEquipe();
    }
  } catch (err) { aviso(err.message); }
});

async function comecar() {
  const codigo = location.hash.match(/^#acesso=([^&]+)/);
  if (codigo) {
    history.replaceState(null, '', location.pathname);
    if (await usarCodigoDeAcesso(decodeURIComponent(codigo[1]))) return;
    return;
  }
  try { sessao = (await SUPA.auth.getSession()).data.session; } catch { sessao = null; }
  if (sessao) {
    await carregarEu();
    if (eu) { iniciar(); return; }
    await SUPA.auth.signOut().catch(() => {}); sessao = null;
  }
  if (chave) {
    // Aparelho antigo do dono: continua funcionando e oferece criar o login (uma vez por semana, se ele adiar).
    const adiou = Number(guardado.ler('cerebro-ativar-depois') || 0);
    if (Date.now() - adiou > 7 * 864e5) { mostrarEntrar('ativar'); return; }
    iniciar(); return;
  }
  mostrarEntrar('login');
}

// ---------------------------------------------------------------------------
// Oráculo: dossiês de clientes
// ---------------------------------------------------------------------------
const Oraculo = { timer: null, atual: null, pane: 'abordagem' };
const RISCO = {
  baixo: { t: 'Risco baixo', c: 'verde' }, medio: { t: 'Risco médio', c: 'ambar' }, alto: { t: 'Risco alto', c: 'vermelho' },
  indefinido: { t: 'Risco indefinido', c: 'cinza' },
};
const TIPO_SINAL = {
  divida_federal: 'Dívida federal', divida_estadual: 'Dívida estadual', divida_municipal: 'Dívida municipal', protesto: 'Protesto',
  credito: 'Crédito', recuperacao_judicial: 'Recuperação judicial', judicial: 'Processo', trabalhista: 'Trabalhista',
  reputacao: 'Reputação', cadastral: 'Cadastro', outro: 'Outro',
};
const ETAPAS = ['Identificar empresa', 'Mercado e posicionamento', 'Reputação e finanças', 'Sócios e responsáveis', 'Dossiê e abordagem'];
const fmtCnpj = (c) => String(c || '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const fmtReais = (v) => (v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
const fmtData = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00-03:00`).toLocaleDateString('pt-BR', { timeZone: TZ }) : '');
const dominio = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const lis = (arr) => (arr || []).filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('');

async function carregarOraculo() {
  const { dossies } = await api('/dossies');
  $('#lista-dossies').innerHTML = dossies.length
    ? dossies.map((d) => {
      const r = RISCO[d.risco] || null;
      const estado = d.status === 'pronto' ? (r ? `<i class="selo ${r.c}">${r.t.replace('Risco ', '')}</i>` : '')
        : d.status === 'erro' ? '<i class="selo vermelho">erro</i>' : '<i class="selo roxo pulsando">pesquisando</i>';
      return `<li><button class="pessoa" data-ir="dossie/${esc(d.id)}"><span class="avatar-p roxo">${esc(iniciais(d.nome || d.alvo))}</span>
        <span class="pessoa-corpo"><span class="t">${esc(d.nome || d.alvo)}</span><span class="d">${esc(d.status === 'pronto' ? (d.resumo || '') : (d.etapa || 'Na fila'))}</span></span>
        <span class="h">${estado}</span></button></li>`;
    }).join('')
    : '<li><p class="vazio">Nenhum dossiê ainda. Pesquise o primeiro cliente acima.</p></li>';
}

// Oráculo por voz: toque para falar, toque de novo para enviar (para sozinho em 25 s).
const VozO = { mr: null, stream: null, pedacos: [], timer: null, enviando: false };
function marcarVoz(estado) {
  document.querySelectorAll('[data-voz-oraculo]').forEach((b) => { b.classList.toggle('ouvindo', estado === 'ouvindo'); b.classList.toggle('enviando', estado === 'enviando'); });
  const campo = $('#oraculo-hoje-alvo');
  campo.placeholder = estado === 'ouvindo' ? 'Ouvindo… fale agora' : estado === 'enviando' ? 'Entendendo…' : DICAS_ORACULO[0];
  VozO.ocupado = !!estado;
}
async function vozOraculo() {
  if (VozO.enviando) return;
  if (VozO.mr && VozO.mr.state === 'recording') { VozO.mr.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { aviso('Este aparelho não grava áudio pelo app.'); return; }
  try { VozO.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch { aviso('Libere o microfone para o app nos Ajustes do iPhone.'); return; }
  const tipo = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
  VozO.pedacos = [];
  VozO.mr = new MediaRecorder(VozO.stream, tipo ? { mimeType: tipo } : undefined);
  VozO.mr.ondataavailable = (ev) => ev.data.size && VozO.pedacos.push(ev.data);
  VozO.mr.onstop = async () => {
    clearTimeout(VozO.timer);
    VozO.stream.getTracks().forEach((t) => t.stop());
    const mime = (VozO.mr.mimeType || 'audio/mp4').split(';')[0];
    const audio = new Blob(VozO.pedacos, { type: mime });
    VozO.enviando = true; marcarVoz('enviando');
    try {
      const r = await api('/dossies/voz', { metodo: 'POST', corpo: audio, tipo: mime });
      aviso(`Pesquisando: ${r.alvo}`);
      ir(`dossie/${r.id}`);
    } catch (err) { aviso(err.message); }
    finally { VozO.enviando = false; marcarVoz(''); }
  };
  VozO.mr.start();
  marcarVoz('ouvindo');
  if (navigator.vibrate) navigator.vibrate(30);
  VozO.timer = setTimeout(() => VozO.mr?.state === 'recording' && VozO.mr.stop(), 25000);
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-voz-oraculo]')) { e.preventDefault(); vozOraculo(); } });

// Dica que vai mudando no campo do Oráculo (só quando está vazio e sem foco).
const DICAS_ORACULO = ['Oráculo: pesquise uma empresa', 'Nome, CNPJ, site ou @', 'Ex.: Padaria 3 Poderes, BH', 'Ou toque no microfone e fale'];
let dicaO = 0;
setInterval(() => {
  const c = $('#oraculo-hoje-alvo');
  if (!c || c.value || document.activeElement === c || VozO.ocupado || document.hidden) return;
  dicaO = (dicaO + 1) % DICAS_ORACULO.length; c.placeholder = DICAS_ORACULO[dicaO];
}, 3500);

// Cartão do Oráculo na tela Hoje: pesquisa direto daqui e abre a tela da pesquisa.
$('#oraculo-hoje').addEventListener('submit', async (e) => {
  e.preventDefault();
  const alvo = $('#oraculo-hoje-alvo').value.trim();
  if (!alvo) { ir('oraculo'); return; }
  const bt = $('#oraculo-hoje-btn'); bt.disabled = true;
  try {
    const { id } = await api('/dossies', { metodo: 'POST', corpo: { alvo } });
    $('#oraculo-hoje-alvo').value = '';
    ir(`dossie/${id}`);
  } catch (err) { aviso(err.message); } finally { bt.disabled = false; }
});

$('#form-oraculo').addEventListener('submit', async (e) => {
  e.preventDefault();
  const alvo = $('#oraculo-alvo').value.trim();
  if (!alvo) return;
  const bt = $('#oraculo-enviar'); bt.disabled = true; bt.textContent = 'Enviando…';
  try {
    const { id } = await api('/dossies', { metodo: 'POST', corpo: { alvo, contexto: $('#oraculo-contexto').value.trim() } });
    $('#oraculo-alvo').value = ''; $('#oraculo-contexto').value = '';
    ir(`dossie/${id}`);
  } catch (err) { aviso(err.message); } finally { bt.disabled = false; bt.textContent = 'Pesquisar'; }
});

// ---------------------------------------------------------------------------
// Região: sua localização atual (só com o app aberto) e empresas por perto
// ---------------------------------------------------------------------------
const Geo = { ultimo: null, watch: null, empresas: [], falhaEm: 0, enviando: false };
const geoLigado = () => guardado.ler('cerebro-geo') === '1';
const distM = (a, b) => { const R = 6371e3, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const fmtDist = (m) => (m == null ? '' : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`);
const pegarPosicao = () => new Promise((ok, erro) => navigator.geolocation.getCurrentPosition(ok, erro, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }));

async function enviarLocal(pos, forcar = false) {
  const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  const u = Geo.ultimo;
  if (!forcar && u && distM(u, p) < 150 && Date.now() - u.t < 10 * 60e3) return u.local;
  // Se o servidor falhou há pouco, espera 2 min antes de tentar de novo (o GPS dispara várias vezes por minuto).
  if (!forcar && Geo.falhaEm && Date.now() - Geo.falhaEm < 120e3) return u?.local ?? null;
  if (Geo.enviando) return u?.local ?? null;
  Geo.enviando = true;
  let local;
  try {
    const end = !u || !u.local?.cidade || distM(u, p) >= 150 ? await enderecoNoCelular(p) : null;
    ({ local } = await api('/local', { metodo: 'POST', corpo: { ...p, precisao: Math.round(pos.coords.accuracy || 0), end } }));
    Geo.falhaEm = 0;
  } catch (e) { Geo.falhaEm = Date.now(); throw e; } finally { Geo.enviando = false; }
  Geo.ultimo = { ...p, t: Date.now(), local };
  mostrarOnde(local);
  return local;
}
// Endereço da posição, consultado direto do celular (OpenStreetMap); se falhar, o servidor tenta.
const UFS = { 'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM', 'Bahia': 'BA', 'Ceará': 'CE', 'Distrito Federal': 'DF', 'Espírito Santo': 'ES', 'Goiás': 'GO', 'Maranhão': 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS', 'Minas Gerais': 'MG', 'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR', 'Pernambuco': 'PE', 'Piauí': 'PI', 'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN', 'Rio Grande do Sul': 'RS', 'Rondônia': 'RO', 'Roraima': 'RR', 'Santa Catarina': 'SC', 'São Paulo': 'SP', 'Sergipe': 'SE', 'Tocantins': 'TO' };
async function enderecoNoCelular({ lat, lng }) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=pt-BR`, { signal: AbortSignal.timeout?.(7000) });
    if (!r.ok) return null;
    const a = (await r.json()).address || {};
    const bairro = a.suburb || a.neighbourhood || a.quarter || a.city_district || null;
    const cidade = a.city || a.town || a.village || a.municipality || null;
    const uf = (a['ISO3166-2-lvl4'] || '').replace(/^BR-/, '') || UFS[a.state] || a.state || null;
    if (!cidade) return null;
    const rua = [a.road, a.house_number].filter(Boolean).join(', ');
    return { endereco: [rua, bairro, uf ? `${cidade}/${uf}` : cidade].filter(Boolean).join(' · '), bairro, cidade, uf };
  } catch { return null; }
}
function iniciarGeo() {
  if (!navigator.geolocation || !geoLigado() || !logado() || Geo.watch != null) return;
  Geo.watch = navigator.geolocation.watchPosition((pos) => enviarLocal(pos).catch(() => {}), () => {}, { enableHighAccuracy: false, maximumAge: 120000 });
}
function pararGeo() { if (Geo.watch != null) { navigator.geolocation.clearWatch(Geo.watch); Geo.watch = null; } }
document.addEventListener('visibilitychange', () => (document.hidden ? pararGeo() : iniciarGeo()));
function mostrarOnde(local) {
  const el = $('#perto-onde'); if (!el || !local) return;
  el.textContent = `Você está em ${local.endereco || [local.bairro, local.cidade].filter(Boolean).join(', ') || 'local sem endereço'}`;
  $('#perto-desligar').hidden = !geoLigado();
}

function mostrarPerto(r, segmento = '') {
  const lista = $('#lista-perto');
  Geo.empresas = r.empresas || []; Geo.segmento = segmento || r.segmento || '';
  $('#perto-exportar').hidden = !Geo.empresas.length;
  $('#perto-exportar').innerHTML = Geo.empresas.length ? blocoExportar('perto', `Exportar ou enviar as ${Geo.empresas.length} empresas`) : '';
  mostrarOnde(r.local);
  lista.innerHTML = Geo.empresas.length ? Geo.empresas.map((e, i) => `<li class="perto-item">
      <div class="pi-corpo"><b>${esc(e.nome)}</b>
        <span class="pi-meta">${esc(e.categoria || '')}${e.distancia_m != null ? ` · ${fmtDist(e.distancia_m)}` : e.fonte === 'web' ? ' · da web' : ''}</span>
        ${e.endereco ? `<small>${esc(e.endereco)}</small>` : ''}${e.motivo ? `<small class="pi-motivo">${esc(e.motivo)}</small>` : ''}</div>
      <div class="pi-acoes"><button class="btn mini roxo-btn" data-perto-oraculo="${i}">Oráculo</button>
        ${e.lat || e.endereco ? `<a class="btn mini btn-waze" href="${esc(e.lat ? `https://waze.com/ul?ll=${e.lat},${e.lng}&navigate=yes` : linkWaze(e.endereco))}">Waze</a>` : ''}</div></li>`).join('')
    : `<li class="vazio">Não achei empresas${segmento ? ` de "${esc(segmento)}"` : ''} por aqui. Tente outro segmento.</li>`;
}

async function buscarPerto() {
  if (!navigator.geolocation) { aviso('Este aparelho não informa a localização.'); return; }
  const bt = $('#perto-btn'), lista = $('#lista-perto');
  bt.disabled = true; bt.textContent = 'Localizando…';
  lista.innerHTML = '<li class="perto-carregando"><span class="pulsando">📍</span> Procurando empresas por perto… pode levar até 1 minuto.</li>';
  try {
    let pos;
    try { pos = await pegarPosicao(); } catch (e) {
      throw new Error(e?.code === 1 ? 'Libere a localização: Ajustes do iPhone → Privacidade → Serviços de Localização → Safari/Segundo Cérebro.' : 'Não consegui pegar sua localização agora.');
    }
    guardado.gravar('cerebro-geo', '1'); iniciarGeo();
    await enviarLocal(pos, true);
    bt.textContent = 'Buscando…';
    const segmento = $('#perto-seg').value.trim();
    const r = await api('/proximas', { metodo: 'POST', corpo: { segmento } });
    mostrarPerto(r, segmento);
  } catch (err) { lista.innerHTML = ''; aviso(err.message); }
  finally { bt.disabled = false; bt.textContent = 'Buscar aqui'; }
}
$('#form-perto').addEventListener('submit', (e) => { e.preventDefault(); buscarPerto(); });
$('#perto-desligar').addEventListener('click', () => { guardado.gravar('cerebro-geo', null); pararGeo(); $('#perto-desligar').hidden = true; aviso('Localização desligada. Ligo de novo quando você buscar empresas por perto.'); });
$('#oh-perto').addEventListener('click', () => { $('#perto-seg').value = ''; ir('oraculo'); setTimeout(() => { $('#form-perto').scrollIntoView({ behavior: 'smooth', block: 'start' }); buscarPerto(); }, 250); });
document.addEventListener('click', (e) => {
  const s = e.target.closest('[data-perto-seg]'); if (!s) return;
  $('#perto-seg').value = s.dataset.pertoSeg; ir('oraculo');
  setTimeout(() => { $('#form-perto').scrollIntoView({ behavior: 'smooth', block: 'start' }); buscarPerto(); }, 250);
});
$('#lista-perto').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-perto-oraculo]'); if (!b) return;
  const em = Geo.empresas[Number(b.dataset.pertoOraculo)]; if (!em) return;
  const onde = Geo.ultimo?.local;
  b.disabled = true; b.textContent = '…';
  try {
    const cidade = onde?.cidade ? `, ${onde.cidade}${onde.uf ? `/${onde.uf}` : ''}` : '';
    const { id } = await api('/dossies', { metodo: 'POST', corpo: { alvo: `${em.nome}${cidade}`, contexto: [`${em.categoria || ''} encontrada perto de mim`, em.endereco ? `Endereço: ${em.endereco}` : onde?.endereco ? `Perto de: ${onde.endereco}` : '', em.telefone ? `Telefone: ${em.telefone}` : '', em.site ? `Site: ${em.site}` : ''].filter(Boolean).join('. ') } });
    ir(`dossie/${id}`);
  } catch (err) { aviso(err.message); b.disabled = false; b.textContent = 'Oráculo'; }
});
iniciarGeo();

function etapaAtual(d) {
  if (!d.cadastro) return 0;
  if (/mercado/i.test(d.etapa || '') && !/pesquisado/i.test(d.etapa || '')) return 1;
  if (/Mercado pesquisado|reputação e sinais/i.test(d.etapa || '')) return 2;
  if (/Sinais financeiros pesquisados|sócios e responsáveis/i.test(d.etapa || '')) return 3;
  if (/Sócios pesquisados|Montando/i.test(d.etapa || '')) return 4;
  return 1;
}

async function carregarDossie(id) {
  clearTimeout(Oraculo.timer);
  const d = await api(`/dossies/${encodeURIComponent(id)}`);
  Oraculo.atual = d;
  const c = d.cadastro && !d.cadastro.nao_encontrado ? d.cadastro : null;
  $('#dossie-nome').textContent = d.nome || d.alvo;
  $('#dossie-sub').textContent = [d.cnpj ? fmtCnpj(d.cnpj) : '', c?.municipio ? `${c.municipio}/${c.uf}` : ''].filter(Boolean).join(' · ');
  const corpo = $('#dossie-corpo');

  if (d.status !== 'pronto') {
    if (d.status === 'erro') {
      corpo.innerHTML = `<div class="processando"><p><strong>Não consegui concluir a pesquisa.</strong></p><p class="dica">${esc(d.error || '')}</p>
        <button class="btn primario largo" data-dossie="refazer">Tentar de novo</button></div>${rodapeDossie()}`;
      return;
    }
    const at = etapaAtual(d);
    corpo.innerHTML = `<div class="progresso-oraculo">
      <span class="ic roxo grande pulsando"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></span>
      <p class="po-titulo">${esc(d.etapa || 'Na fila')}…</p>
      <ol class="etapas">${ETAPAS.map((t, i) => `<li class="${i < at ? 'feito' : i === at ? 'agora' : ''}">${t}</li>`).join('')}</ol>
      <p class="dica centro">Pode sair desta tela: eu aviso quando o dossiê ficar pronto.</p></div>`;
    Oraculo.timer = setTimeout(() => location.hash === `#dossie/${id}` && carregarDossie(id).catch(() => {}), 7000);
    return;
  }

  const x = d.dossie || {};
  const fin = x.financeiro || {};
  const r = RISCO[d.risco] || RISCO.indefinido;
  const ficha = c ? [
    ['Situação', c.situacao], ['Abertura', fmtData(c.abertura)], ['Porte', c.porte],
    ['Simples', c.simples == null ? '—' : c.simples ? (c.mei ? 'MEI' : 'Sim') : 'Não'], ['Capital', fmtReais(c.capital_social)],
    ['Atividade', c.cnae_fiscal_descricao],
  ].filter(([, v]) => v) : [];

  corpo.innerHTML = `
    <article class="risco-cartao ${r.c}">
      <div class="risco-topo"><span class="risco-selo">${r.t}</span><button class="link" data-dpane-ir="riscos">Ver sinais ›</button></div>
      <p>${esc(fin.resumo || '')}</p>
    </article>
    <p class="resumo-texto">${esc(x.resumo || '')}</p>
    ${ficha.length ? `<div class="ficha">${ficha.map(([k, v]) => `<div class="ficha-item ${k === 'Atividade' ? 'largo' : ''}"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>` : '<p class="dica">CNPJ não identificado: dossiê feito só com o que é público na web.</p>'}
    ${blocoExportar('dossie', 'Exportar ou enviar o dossiê')}
    ${blocoEnvio(d)}
    <nav class="segs" aria-label="Ir para">
      ${[['abordagem', 'Abordagem'], ['socios', 'Sócios'], ['empresa', 'Empresa'], ['riscos', 'Riscos'], ['fontes', 'Fontes']].map(([k, t]) => `<button class="seg dseg" data-dpane="${k}">${t}</button>`).join('')}
    </nav>
    ${['abordagem', 'socios', 'empresa', 'riscos', 'fontes'].map((k) => `<section class="secao-d" id="sec-${k}"><h2 class="titulo-sec">${{ abordagem: 'Abordagem', socios: 'Sócios e responsáveis', empresa: 'Empresa e mercado', riscos: 'Riscos e sinais financeiros', fontes: 'Fontes' }[k]}</h2>${paneDossie(d, k)}</section>`).join('')}
    ${rodapeDossie()}`;
}

const IC_WHATS = '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z"/></svg>';
const waLink = (numero, texto) => `https://wa.me/${numero || ''}?text=${encodeURIComponent(texto || '')}`;

// Encaminhar: aviso de envio pedido ao Dimy + botão para mandar o dossiê completo pelo WhatsApp.
function blocoEnvio(d) {
  const e = d.envio;
  const status = e?.status === 'enviado'
    ? `<p class="envio-ok">${IC_WHATS}Enviado pelo WhatsApp para <b>${esc(e.nome)}</b></p>`
    : d.enviar_para ? `<a class="envio-pend" href="${esc(waLink(e?.numero, d.texto_whatsapp))}" target="_blank" rel="noopener">${IC_WHATS}<span>Enviar para <b>${esc(e?.nome || d.enviar_para)}</b> no WhatsApp<small>${esc(e?.motivo ? 'Toque para mandar pelo seu WhatsApp' : 'Pronto para enviar')}</small></span>›</a>` : '';
  return `${status}<button class="btn largo encaminhar" data-dossie="encaminhar">${IC_WHATS}Encaminhar dossiê no WhatsApp</button>`;
}

function rodapeDossie() {
  return `<div class="rodape-gravacao"><div class="acoes"><button class="btn claro" data-dossie="refazer">Pesquisar de novo</button>
    <button class="btn claro perigo-txt" data-dossie="apagar">Apagar</button></div></div>`;
}

function paneDossie(d, p) {
  const x = d.dossie || {};
  const ab = x.abordagem || {};
  const c = d.cadastro && !d.cadastro.nao_encontrado ? d.cadastro : null;
  if (p === 'abordagem') {
    const fone = String(c?.telefone || '').replace(/\D/g, '');
    return `
      <div class="bloco-o"><h3>Por que abordar</h3><p>${esc(ab.tese || '')}</p>${ab.oferta_sugerida ? `<p class="oferta"><b>Oferta:</b> ${esc(ab.oferta_sugerida)}</p>` : ''}</div>
      <div class="dupla">
        <div class="mini"><span class="ic azul"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z"/></svg></span><b>Gancho</b><p>${esc(ab.gancho || '')}</p></div>
        <div class="mini"><span class="ic verde"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></span><b>Canal e quem</b><p>${esc(ab.canal || '')}</p></div>
      </div>
      ${ab.momento ? `<p class="dica momento"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${esc(ab.momento)}</p>` : ''}
      <div class="msg-whats">
        <div class="msg-cab"><b>Primeira mensagem</b><span>WhatsApp</span></div>
        <p id="msg-oraculo">${esc(ab.mensagem_whatsapp || '')}</p>
        <div class="acoes"><button class="btn claro" data-dossie="copiar">Copiar</button>
          <a class="btn primario" target="_blank" rel="noopener" href="https://wa.me/${fone ? (fone.startsWith('55') ? fone : '55' + fone) : ''}?text=${encodeURIComponent(ab.mensagem_whatsapp || '')}">Abrir no WhatsApp</a></div>
      </div>
      <div class="acoes"><button class="btn claro" data-dossie="visita"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>Agendar visita</button>
        <button class="btn claro" data-dossie="followup"><svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8Zm4 11a2 2 0 0 0 4 0"/></svg>Lembrete</button></div>
      ${ab.roteiro?.length ? `<div class="bloco-o"><h3>Roteiro</h3><ol class="passos">${lis(ab.roteiro)}</ol></div>` : ''}
      ${ab.perguntas?.length ? `<div class="bloco-o"><h3>Perguntas para descobrir</h3><ul class="marcadores">${lis(ab.perguntas)}</ul></div>` : ''}
      ${ab.objecoes?.length ? `<div class="bloco-o"><h3>Objeções prováveis</h3>${ab.objecoes.map((o) => `<details><summary>${esc(o.objecao)}</summary><p>${esc(o.resposta)}</p></details>`).join('')}</div>` : ''}
      ${ab.cuidados?.length ? `<div class="bloco-o alerta-suave"><h3>Cuidados</h3><ul class="marcadores">${lis(ab.cuidados)}</ul></div>` : ''}
      ${x.proximos_passos?.length ? `<div class="bloco-o"><h3>Próximos passos</h3><ul class="checks">${lis(x.proximos_passos)}</ul></div>` : ''}`;
  }
  if (p === 'empresa') {
    const e = x.empresa || {}, m = x.mercado || {};
    const linhas = [['O que faz', e.o_que_faz], ['Público', e.publico], ['Porte', e.porte_estimado], ['Faturamento', e.faturamento_estimado], ['Como recebe hoje', e.como_recebe_hoje], ['Presença digital', e.presenca_digital]].filter(([, v]) => v);
    const chips = (arr, cls = '') => (arr || []).map((t) => `<span class="chip-o ${cls}">${esc(t)}</span>`).join('');
    return `
      <div class="bloco-o"><h3>A empresa</h3><dl class="def">${linhas.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>
      <div class="bloco-o"><h3>Posicionamento</h3><p>${esc(m.posicionamento || '')}</p>
        ${m.diferenciais?.length ? `<p class="rot">Diferenciais</p><div class="chips">${chips(m.diferenciais, 'verde')}</div>` : ''}
        ${m.concorrentes?.length ? `<p class="rot">Concorrentes</p><div class="chips">${chips(m.concorrentes)}</div>` : ''}</div>
      ${x.dores_segmento?.length ? `<div class="bloco-o"><h3>Dores do segmento</h3>${x.dores_segmento.map((dd) => `<div class="dor"><b>${esc(dd.dor)}</b>${dd.impacto ? `<span>${esc(dd.impacto)}</span>` : ''}</div>`).join('')}</div>` : ''}
      ${m.tendencias?.length ? `<div class="bloco-o"><h3>Tendências do setor</h3><ul class="marcadores">${lis(m.tendencias)}</ul></div>` : ''}
`;
  }
  if (p === 'socios') {
    const pessoas = Array.isArray(x.socios) ? x.socios : [];
    if (!pessoas.length) {
      return c?.socios?.length
        ? `<div class="bloco-o"><h3>Quadro societário (Receita)</h3><ul class="marcadores">${c.socios.map((s) => `<li>${esc(s.nome)}${s.qualificacao ? ` · ${esc(s.qualificacao)}` : ''}</li>`).join('')}</ul>
           <p class="dica">Este dossiê é anterior à pesquisa de perfil dos sócios. Toque em "Pesquisar de novo" para incluir.</p></div>`
        : '<div class="bloco-o"><p>Não encontrei sócios ou responsáveis em fontes públicas.</p></div>';
    }
    const PAPEL = { decisor: ['Decide', 'verde'], influencia: ['Influencia', 'azul'], investidor: ['Investidor', 'cinza'], indefinido: ['Papel incerto', 'cinza'] };
    return `${x.quem_decide ? `<div class="quem-decide"><span class="ic verde"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></span><p><b>Com quem falar</b>${esc(x.quem_decide)}</p></div>` : ''}
      ${pessoas.map((pe) => {
        const [pt, pc] = PAPEL[pe.papel] || PAPEL.indefinido;
        const fontes = (pe.fontes || []).filter((u) => /^https?:/.test(u));
        return `<article class="socio">
          <header class="socio-topo"><span class="avatar-p roxo">${esc(iniciais(pe.nome))}</span>
            <div><b>${esc(pe.nome)}</b><span>${esc([pe.cargo, pe.desde ? `desde ${pe.desde}` : ''].filter(Boolean).join(' · '))}</span></div>
            <i class="selo ${pc}">${pt}</i></header>
          ${pe.confirmado === false ? '<p class="dica nao-conf">Perfil público não confirmado: pode haver homônimos.</p>' : ''}
          ${pe.perfil ? `<p>${esc(pe.perfil)}</p>` : ''}
          ${pe.trajetoria ? `<p class="rot">Trajetória</p><p>${esc(pe.trajetoria)}</p>` : ''}
          ${pe.outras_empresas?.length ? `<p class="rot">Outras empresas</p><div class="chips">${pe.outras_empresas.map((t) => `<span class="chip-o">${esc(t)}</span>`).join('')}</div>` : ''}
          ${pe.interesses?.length ? `<p class="rot">Valoriza</p><div class="chips">${pe.interesses.map((t) => `<span class="chip-o verde">${esc(t)}</span>`).join('')}</div>` : ''}
          ${pe.como_abordar ? `<div class="como-abordar"><b>Como abordar</b><p>${esc(pe.como_abordar)}</p></div>` : ''}
          ${fontes.length ? `<div class="socio-fontes">${fontes.slice(0, 4).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(dominio(u))} ›</a>`).join('')}</div>` : ''}
        </article>`;
      }).join('')}
      <p class="dica">Só perfil profissional público. Dados pessoais (CPF, endereço, família) ficam de fora.</p>`;
  }
  if (p === 'riscos') {
    const f = x.financeiro || {};
    const cnpj = d.cnpj || '';
    const checar = [
      ['Protestos (cartórios do Brasil)', 'https://www.pesquisaprotesto.com.br/'],
      ['Dívida ativa da União (PGFN)', 'https://www.listadevedores.pgfn.gov.br/'],
      ['Certidão negativa federal (Receita)', 'https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cnpj'],
      ['Processos (JusBrasil)', `https://www.jusbrasil.com.br/busca?q=${encodeURIComponent(cnpj ? fmtCnpj(cnpj) : d.nome || d.alvo)}`],
      ['Reclame Aqui', `https://www.reclameaqui.com.br/busca/?q=${encodeURIComponent(d.nome || d.alvo)}`],
    ];
    return `
      ${f.sinais?.length ? `<div class="bloco-o"><h3>Sinais encontrados</h3>${f.sinais.map((s) => `<div class="sinal g-${esc(s.gravidade || 'media')}">
          <span class="sinal-tipo">${esc(TIPO_SINAL[s.tipo] || s.tipo)}</span><p>${esc(s.descricao)}</p>${s.fonte && /^https?:/.test(s.fonte) ? `<a href="${esc(s.fonte)}" target="_blank" rel="noopener">${esc(dominio(s.fonte))} ›</a>` : ''}</div>`).join('')}</div>`
        : '<div class="bloco-o"><h3>Sinais encontrados</h3><p>Nenhum sinal financeiro ou jurídico encontrado em fontes públicas.</p></div>'}
      ${f.nao_encontrado?.length ? `<div class="bloco-o"><h3>Pesquisado, nada público</h3><ul class="checks">${lis(f.nao_encontrado)}</ul></div>` : ''}
      <div class="bloco-o"><h3>Confirmar na fonte oficial</h3>
        <p class="dica">Serasa e a lista completa de protestos não são públicos: só por consulta oficial (o Serasa exige contrato). ${cnpj ? `CNPJ para copiar: <b>${fmtCnpj(cnpj)}</b>` : ''}</p>
        <div class="links-oficiais">${checar.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${t}<span>›</span></a>`).join('')}</div></div>
      ${x.reputacao ? `<div class="bloco-o"><h3>Reputação</h3><p>${esc(x.reputacao)}</p></div>` : ''}`;
  }
  const fontes = d.fontes || [];
  return `<div class="bloco-o"><h3>Fontes consultadas</h3>${fontes.length ? `<div class="links-oficiais">${fontes.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(dominio(u))}<span>›</span></a>`).join('')}</div>` : '<p>Sem links registrados.</p>'}
    <p class="dica">Cadastro: dados públicos da Receita Federal (via BrasilAPI).</p></div>`;
}

$('#v-dossie').addEventListener('click', async (e) => {
  const seg = e.target.closest('[data-dpane], [data-dpane-ir]');
  if (seg) {
    const alvo = document.getElementById(`sec-${seg.dataset.dpane || seg.dataset.dpaneIr}`);
    if (alvo) window.scrollTo({ top: alvo.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
    return;
  }
  const b = e.target.closest('[data-dossie]');
  if (!b) return;
  const d = Oraculo.atual;
  const nome = d.nome || d.alvo;
  try {
    switch (b.dataset.dossie) {
      case 'copiar':
        await navigator.clipboard.writeText(d.dossie?.abordagem?.mensagem_whatsapp || '');
        aviso('Mensagem copiada.'); break;
      case 'visita': {
        const c = d.cadastro || {};
        editarEvento(null, { titulo: `Visita – ${nome}`, local: [c.bairro, c.municipio].filter(Boolean).join(', ') });
        break;
      }
      case 'followup':
        editarLembrete(null, { texto: `Falar com ${nome}`, dia: somaDias(diaISO(new Date()), 1), hora: '10:00' }); break;
      case 'refazer':
        await api(`/dossies/${d.id}/refazer`, { metodo: 'POST' }); aviso('Pesquisando de novo.'); carregarDossie(d.id); break;
      case 'encaminhar':
        abrirFolha({
          titulo: 'Encaminhar no WhatsApp', botao: 'Enviar',
          campos: [{ rotulo: 'Para quem (nome ou número) — deixe vazio para escolher no WhatsApp', nome: 'para', valor: d.enviar_para || '', placeholder: 'Ex.: Bruno ou 31 99999-0000' }],
          salvar: async (f) => {
            const para = (f.para || '').trim();
            if (!para) { location.href = waLink('', d.texto_whatsapp); return; }
            const r = await api(`/dossies/${d.id}/enviar`, { metodo: 'POST', corpo: { para } });
            if (r.status === 'enviado') { aviso(`Enviado para ${r.nome}.`); carregarDossie(d.id); return; }
            location.href = r.link || waLink('', d.texto_whatsapp);
          },
        });
        break;
      case 'apagar':
        if (!confirm(`Apagar o dossiê de ${nome}?`)) return;
        await api(`/dossies/${d.id}/apagar`, { metodo: 'POST' }); aviso('Dossiê apagado.'); ir('oraculo'); break;
    }
  } catch (err) { aviso(err.message); }
});

// ---------------------------------------------------------------------------
// Exportar: PDF e CSV do Oráculo (dossiê e empresas por perto), com envio direto por e-mail ou WhatsApp
// ---------------------------------------------------------------------------
const IC_PDF = '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6V3Z"/><path d="M15 3v4h4M9 13h6M9 17h4"/></svg>';
const IC_CSV = '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/></svg>';
const IC_MAIL = '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
const Exp = {};
function blocoExportar(alvo, titulo = 'Exportar e enviar') {
  return `<div class="exportar"><p>${titulo}</p><div class="exp-botoes">
    <button class="exp-btn pdf" data-exp="pdf" data-exp-alvo="${alvo}">${IC_PDF}PDF</button>
    <button class="exp-btn csv" data-exp="csv" data-exp-alvo="${alvo}">${IC_CSV}CSV</button>
    <button class="exp-btn email" data-exp="email" data-exp-alvo="${alvo}">${IC_MAIL}E-mail</button>
    <button class="exp-btn wa" data-exp="whatsapp" data-exp-alvo="${alvo}">${IC_WHATS}WhatsApp</button></div></div>`;
}
// Texto seguro para as fontes padrão do PDF (sem emoji).
const pdfTxt = (s) => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/•/g, '-').replace(/…/g, '...').replace(/[^\x00-\xFF]/g, '').replace(/\*/g, '').trim();
const csvCel = (v) => { const t = String(v ?? '').replace(/\r?\n/g, ' ').trim(); return /[";]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const csvBlob = (linhas) => new Blob(['﻿' + linhas.map((l) => l.map(csvCel).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
const nomeArq = (s) => String(s || 'oraculo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 50) || 'oraculo';
let libPdf = null;
async function carregarPdf() {
  if (!libPdf) {
    const [{ jsPDF }, at] = await Promise.all([import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm'), import('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/+esm')]);
    libPdf = { jsPDF, autoTable: at.default || at.autoTable };
  }
  return libPdf;
}
// Documento simples: título, subtítulo, seções com parágrafos, listas e tabelas; quebra de página automática.
async function novoPdf(titulo, sub) {
  const { jsPDF, autoTable } = await carregarPdf();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const M = 44, L = doc.internal.pageSize.getWidth() - 2 * M, H = doc.internal.pageSize.getHeight();
  let y = M;
  const cabe = (h) => { if (y + h > H - M) { doc.addPage(); y = M; } };
  doc.setFillColor(109, 40, 217); doc.rect(0, 0, doc.internal.pageSize.getWidth(), 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(18, 22, 28);
  for (const l of doc.splitTextToSize(pdfTxt(titulo), L)) { cabe(22); doc.text(l, M, y + 14); y += 22; }
  if (sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(107, 114, 128); doc.text(doc.splitTextToSize(pdfTxt(sub), L), M, y + 6); y += 18 * Math.ceil(pdfTxt(sub).length / 95) + 4; }
  const api_ = {
    secao(t) { y += 10; cabe(30); doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(109, 40, 217); doc.text(pdfTxt(t), M, y + 10); y += 20; doc.setTextColor(18, 22, 28); },
    p(t, { negrito = false, tam = 10.5 } = {}) {
      const txt = pdfTxt(t); if (!txt) return;
      doc.setFont('helvetica', negrito ? 'bold' : 'normal'); doc.setFontSize(tam); doc.setTextColor(18, 22, 28);
      for (const l of doc.splitTextToSize(txt, L)) { cabe(15); doc.text(l, M, y + 10); y += 14; }
      y += 4;
    },
    campo(k, v) { if (v == null || v === '') return; api_.p(`${k}: ${v}`); },
    lista(arr) { for (const t of (arr || []).filter(Boolean)) { const ls = doc.splitTextToSize(pdfTxt(t), L - 14); doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); ls.forEach((l, k) => { cabe(15); if (!k) doc.text('-', M, y + 10); doc.text(l, M + 12, y + 10); y += 14; }); y += 2; } },
    tabela(cab, linhas) {
      autoTable(doc, { startY: y + 4, head: [cab.map(pdfTxt)], body: linhas.map((l) => l.map(pdfTxt)), margin: { left: M, right: M }, styles: { fontSize: 8.5, cellPadding: 4, overflow: 'linebreak' }, headStyles: { fillColor: [109, 40, 217] }, alternateRowStyles: { fillColor: [245, 243, 255] } });
      y = doc.lastAutoTable.finalY + 10;
    },
    blob() {
      const n = doc.getNumberOfPages();
      for (let k = 1; k <= n; k++) { doc.setPage(k); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(156, 163, 175); doc.text(`Segundo Cérebro · Oráculo · ${new Date().toLocaleDateString('pt-BR')} · ${k}/${n}`, M, H - 20); }
      return doc.output('blob');
    },
  };
  return api_;
}

// Dossiê → PDF / CSV / texto
async function pdfDossie(d) {
  const x = d.dossie || {}, c = d.cadastro && !d.cadastro.nao_encontrado ? d.cadastro : null, f = x.financeiro || {}, ab = x.abordagem || {}, e = x.empresa || {}, m = x.mercado || {};
  const pdf = await novoPdf(`Oráculo · ${d.nome || d.alvo}`, [d.cnpj ? `CNPJ ${fmtCnpj(d.cnpj)}` : '', c?.municipio ? `${c.municipio}/${c.uf}` : '', `Gerado em ${new Date().toLocaleString('pt-BR')}`].filter(Boolean).join(' · '));
  pdf.secao(`${(RISCO[d.risco] || RISCO.indefinido).t}`); pdf.p(f.resumo);
  pdf.secao('Resumo'); pdf.p(x.resumo);
  if (c) { pdf.secao('Cadastro (Receita Federal)'); pdf.tabela(['Campo', 'Valor'], [['Situação', c.situacao], ['Abertura', fmtData(c.abertura)], ['Porte', c.porte], ['Simples', c.simples == null ? '-' : c.simples ? (c.mei ? 'MEI' : 'Sim') : 'Não'], ['Capital social', fmtReais(c.capital_social)], ['Atividade', c.cnae_fiscal_descricao], ['Telefone', c.telefone], ['Endereço', [c.logradouro, c.numero, c.bairro, c.municipio && `${c.municipio}/${c.uf}`].filter(Boolean).join(', ')]].filter(([, v]) => v)); }
  pdf.secao('Abordagem'); pdf.p(ab.tese); pdf.campo('Oferta', ab.oferta_sugerida); pdf.campo('Gancho', ab.gancho); pdf.campo('Canal e quem', ab.canal); pdf.campo('Momento', ab.momento);
  if (ab.mensagem_whatsapp) { pdf.p('Primeira mensagem:', { negrito: true }); pdf.p(ab.mensagem_whatsapp); }
  if (ab.roteiro?.length) { pdf.p('Roteiro', { negrito: true }); pdf.lista(ab.roteiro); }
  if (ab.perguntas?.length) { pdf.p('Perguntas para descobrir', { negrito: true }); pdf.lista(ab.perguntas); }
  if (ab.objecoes?.length) { pdf.p('Objeções prováveis', { negrito: true }); pdf.lista(ab.objecoes.map((o) => `${o.objecao} -> ${o.resposta}`)); }
  if (x.socios?.length) { pdf.secao('Sócios e responsáveis'); pdf.p(x.quem_decide); for (const s of x.socios) { pdf.p(`${s.nome}${s.cargo ? ` (${s.cargo})` : ''}`, { negrito: true }); pdf.p(s.perfil); pdf.campo('Como abordar', s.como_abordar); } }
  pdf.secao('Empresa e mercado'); pdf.campo('O que faz', e.o_que_faz); pdf.campo('Público', e.publico); pdf.campo('Porte estimado', e.porte_estimado); pdf.campo('Faturamento estimado', e.faturamento_estimado); pdf.campo('Como recebe hoje', e.como_recebe_hoje); pdf.campo('Presença digital', e.presenca_digital);
  pdf.campo('Posicionamento', m.posicionamento); if (m.concorrentes?.length) pdf.campo('Concorrentes', m.concorrentes.join(', '));
  if (x.dores_segmento?.length) { pdf.p('Dores do segmento', { negrito: true }); pdf.lista(x.dores_segmento.map((g) => `${g.dor}${g.impacto ? ` - ${g.impacto}` : ''}`)); }
  pdf.secao('Riscos e sinais financeiros'); if (f.sinais?.length) pdf.lista(f.sinais.map((g) => `${TIPO_SINAL[g.tipo] || g.tipo}: ${g.descricao}${g.fonte ? ` (${g.fonte})` : ''}`)); else pdf.p('Nenhum sinal encontrado em fontes públicas.');
  if (x.proximos_passos?.length) { pdf.secao('Próximos passos'); pdf.lista(x.proximos_passos); }
  if (d.fontes?.length) { pdf.secao('Fontes'); pdf.lista(d.fontes); }
  return pdf.blob();
}
function csvDossie(d) {
  const x = d.dossie || {}, c = d.cadastro && !d.cadastro.nao_encontrado ? d.cadastro : null, f = x.financeiro || {}, ab = x.abordagem || {}, e = x.empresa || {}, m = x.mercado || {};
  const L = [['Seção', 'Campo', 'Valor'], ['Empresa', 'Nome', d.nome || d.alvo], ['Empresa', 'CNPJ', d.cnpj ? fmtCnpj(d.cnpj) : ''], ['Empresa', 'Cidade', c?.municipio ? `${c.municipio}/${c.uf}` : ''],
    ['Empresa', 'Situação', c?.situacao], ['Empresa', 'Abertura', c ? fmtData(c.abertura) : ''], ['Empresa', 'Porte', c?.porte], ['Empresa', 'Simples', c?.simples == null ? '' : c.simples ? 'Sim' : 'Não'], ['Empresa', 'Capital social', c ? fmtReais(c.capital_social) : ''], ['Empresa', 'Atividade', c?.cnae_fiscal_descricao], ['Empresa', 'Telefone', c?.telefone],
    ['Resumo', 'Resumo', x.resumo], ['Risco', 'Nível', (RISCO[d.risco] || RISCO.indefinido).t], ['Risco', 'Resumo', f.resumo],
    ...(f.sinais || []).map((g) => ['Risco', TIPO_SINAL[g.tipo] || g.tipo, `${g.descricao}${g.fonte ? ` (${g.fonte})` : ''}`]),
    ['Abordagem', 'Tese', ab.tese], ['Abordagem', 'Oferta', ab.oferta_sugerida], ['Abordagem', 'Gancho', ab.gancho], ['Abordagem', 'Canal', ab.canal], ['Abordagem', 'Momento', ab.momento], ['Abordagem', 'Mensagem WhatsApp', ab.mensagem_whatsapp],
    ...(ab.objecoes || []).map((o) => ['Objeção', o.objecao, o.resposta]),
    ...(x.socios || []).map((s) => ['Sócio', s.nome, [s.cargo, s.perfil, s.como_abordar && `Como abordar: ${s.como_abordar}`].filter(Boolean).join(' | ')]),
    ['Mercado', 'O que faz', e.o_que_faz], ['Mercado', 'Faturamento estimado', e.faturamento_estimado], ['Mercado', 'Como recebe hoje', e.como_recebe_hoje], ['Mercado', 'Posicionamento', m.posicionamento], ['Mercado', 'Concorrentes', (m.concorrentes || []).join(', ')],
    ...(x.dores_segmento || []).map((g) => ['Dor do segmento', g.dor, g.impacto]),
    ...(x.proximos_passos || []).map((t, k) => ['Próximo passo', String(k + 1), t]),
    ...(d.fontes || []).map((u, k) => ['Fonte', String(k + 1), u])];
  return csvBlob(L.filter((l) => l[2]));
}
// Empresas por perto → PDF / CSV
const linhaPerto = (e) => [e.nome, e.categoria || '', e.distancia_m != null ? fmtDist(e.distancia_m) : '', e.endereco || '', e.telefone || '', e.site || '', e.motivo || ''];
async function pdfPerto() {
  const onde = Geo.ultimo?.local;
  const pdf = await novoPdf(`Empresas perto de ${onde?.bairro || onde?.cidade || 'você'}${Geo.segmento ? ` · ${Geo.segmento}` : ''}`, [onde?.endereco, `${Geo.empresas.length} empresas`, `Gerado em ${new Date().toLocaleString('pt-BR')}`].filter(Boolean).join(' · '));
  pdf.tabela(['Empresa', 'Segmento', 'Dist.', 'Endereço', 'Telefone', 'Site', 'Por que abordar'], Geo.empresas.map(linhaPerto));
  return pdf.blob();
}
const csvPerto = () => csvBlob([['Empresa', 'Segmento', 'Distância', 'Endereço', 'Telefone', 'Site', 'Por que abordar', 'Latitude', 'Longitude'], ...Geo.empresas.map((e) => [...linhaPerto(e), e.lat ?? '', e.lng ?? ''])]);

function dadosExport(alvo) {
  if (alvo === 'dossie') {
    const d = Oraculo.atual, base = `oraculo-${nomeArq(d.nome || d.alvo)}`;
    return { base, assunto: `Oráculo · ${d.nome || d.alvo}`, texto: `Segue o dossiê do Oráculo sobre ${d.nome || d.alvo}.${d.dossie?.resumo ? `\n\n${d.dossie.resumo}` : ''}`, pdf: () => pdfDossie(d), csv: () => csvDossie(d) };
  }
  const onde = Geo.ultimo?.local, base = `empresas-perto-${nomeArq(onde?.bairro || onde?.cidade || 'aqui')}${Geo.segmento ? `-${nomeArq(Geo.segmento)}` : ''}`;
  return { base, assunto: `Empresas perto de ${onde?.bairro || onde?.cidade || 'mim'}${Geo.segmento ? ` (${Geo.segmento})` : ''}`, texto: `Segue a lista de ${Geo.empresas.length} empresas${Geo.segmento ? ` de ${Geo.segmento}` : ''} perto de ${onde?.endereco || 'mim'}.`, pdf: pdfPerto, csv: async () => csvPerto() };
}
async function entregarArquivo(blob, nome) {
  const f = new File([blob], nome, { type: blob.type });
  if (navigator.canShare?.({ files: [f] })) {
    try { await navigator.share({ files: [f], title: nome }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = nome; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 60000);
}
const paraBase64 = (blob) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = erro; r.readAsDataURL(blob); });

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-exp]'); if (!b) return;
  const alvo = b.dataset.expAlvo, x = dadosExport(alvo), acao = b.dataset.exp;
  if (alvo === 'perto' && !Geo.empresas.length) { aviso('Busque as empresas primeiro.'); return; }
  if (acao === 'pdf' || acao === 'csv') {
    const t = b.innerHTML; b.disabled = true; b.textContent = '…';
    try { await entregarArquivo(await x[acao](), `${x.base}.${acao}`); } catch (err) { aviso(`Não consegui gerar o ${acao.toUpperCase()}: ${err.message}`); }
    finally { b.disabled = false; b.innerHTML = t; }
    return;
  }
  const email = acao === 'email';
  abrirFolha({
    titulo: email ? 'Enviar por e-mail' : 'Enviar no WhatsApp', botao: 'Enviar',
    campos: [
      email
        ? { rotulo: 'E-mail de quem recebe', nome: 'para', tipoInput: 'email', valor: guardado.ler('cerebro-ultimo-email') || '', placeholder: 'nome@empresa.com.br', obrigatorio: true, dica: 'Sai do seu Gmail, com os arquivos em anexo.' }
        : { rotulo: 'Contato ou número', nome: 'para', valor: '', placeholder: 'Ex.: Bruno ou 31 99999-0000', obrigatorio: true, dica: 'Sai do seu WhatsApp comercial. A Meta só deixa enviar para quem te escreveu nas últimas 24 h.' },
      { tipo: 'marcas', rotulo: 'Arquivos', opcoes: [{ nome: 'pdf', texto: 'PDF', marcado: true }, { nome: 'csv', texto: 'CSV (planilha)', marcado: email }] },
      { rotulo: 'Mensagem', nome: 'texto', valor: x.texto },
    ],
    salvar: async (f) => {
      if (!f.pdf && !f.csv) throw new Error('Escolha pelo menos um arquivo.');
      const arquivos = [];
      if (f.pdf) arquivos.push({ nome: `${x.base}.pdf`, tipo: 'application/pdf', base64: await paraBase64(await x.pdf()) });
      if (f.csv) arquivos.push({ nome: `${x.base}.csv`, tipo: 'text/csv', base64: await paraBase64(await x.csv()) });
      const r = await api('/exportar', { metodo: 'POST', corpo: { canal: email ? 'email' : 'whatsapp', para: f.para, assunto: x.assunto, texto: f.texto, arquivos } });
      if (email) guardado.gravar('cerebro-ultimo-email', f.para);
      aviso(r.mensagem || 'Enviado.');
    },
  });
});

// ---------------------------------------------------------------------------
// Radar: o Dimy conectado à internet (notícias, mercado, aprendizado)
// ---------------------------------------------------------------------------
const Radar = { timer: null };
function desenharMapa() {
  const web = [['Notícias', 60, 34], ['Mercado', 300, 34], ['Concorrentes', 56, 118], ['Regulação', 304, 118]];
  const voce = [['Memória', 70, 212], ['WhatsApp', 150, 232], ['Agenda', 230, 232], ['Oráculo', 300, 206]];
  const cx = 180, cy = 120;
  const no = (t, x, y, cls) => `<g class="${cls}"><line class="lig ${cls === 'n-web' ? 'web' : 'voce'}" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><circle cx="${x}" cy="${y}" r="7" stroke-width="2"/><text x="${x}" y="${y - 12}" text-anchor="middle">${t}</text></g>`;
  $('#radar-mapa').innerHTML = `<text class="legenda" x="180" y="14" text-anchor="middle">INTERNET</text><text class="legenda" x="180" y="248" text-anchor="middle">VOCÊ</text>
    ${web.map(([t, x, y]) => no(t, x, y, 'n-web')).join('')}${voce.map(([t, x, y]) => no(t, x, y + 0, 'n-voce')).join('')}
    <g class="n-dimy"><circle cx="${cx}" cy="${cy}" r="34"/><text x="${cx}" y="${cy + 5}" text-anchor="middle">Dimy</text></g>`;
}
async function carregarRadar() {
  clearTimeout(Radar.timer);
  desenharMapa();
  const { edicao: e, temas, historico } = await api('/radar');
  $('#radar-temas').innerHTML = temas.length ? temas.map((t) => `<button data-radar-tema="${esc(t.id)}" aria-label="Parar de seguir ${esc(t.tema)}">${esc(t.tema)}<span>×</span></button>`).join('') : '<p class="dica">Nenhum tema. Adicione abaixo.</p>';
  $('#radar-historico').innerHTML = historico.length ? historico.map((h) => `<li><div class="item"><span class="t">${esc(fmtData(h.dia))}</span><span class="h">${h.status === 'pronto' ? '' : esc(h.status)}</span><span class="d">${esc(h.manchete || '')}</span></div></li>`).join('') : '<li><p class="vazio">Ainda sem edições.</p></li>';
  const box = $('#radar-edicao');
  const botoes = `<div class="radar-acoes"><button class="btn claro" data-radar="atualizar">Atualizar agora</button><button class="btn claro" data-radar="conversar">Conversar sobre isso</button></div>`;
  if (!e) { box.innerHTML = `<div class="processando"><p>O Radar ainda não rodou. Toque em atualizar para a primeira leitura (leva uns 2 minutos).</p>${botoes}</div>`; return; }
  if (e.status === 'pesquisando') {
    box.innerHTML = `<div class="processando"><p class="pulsando"><b>Lendo a internet…</b></p><p class="dica">Notícias, concorrentes e regulação dos seus temas. Leva uns 2 minutos; eu aviso quando ficar pronto.</p></div>`;
    Radar.timer = setTimeout(() => location.hash === '#radar' && carregarRadar().catch(() => {}), 10000);
    return;
  }
  if (e.status === 'erro') { box.innerHTML = `<div class="processando"><p><b>A última leitura falhou.</b></p><p class="dica">${esc(e.erro || '')}</p>${botoes}</div>`; return; }
  const c = e.conteudo || {}, an = c.analise || {};
  const lista = (t, arr) => arr?.length ? `<div class="bloco-o"><h3>${t}</h3><ul class="marcadores">${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  box.innerHTML = `<article class="manchete"><small>Radar de ${esc(fmtData(e.dia))}</small><b>${esc(c.manchete || '')}</b></article>
    <div class="bloco-o"><h3>Notícias</h3>${(c.noticias || []).map((n) => `<div class="noticia"><span class="n-tema">${esc(n.tema || '')}</span><b>${esc(n.titulo)}</b><p>${esc(n.resumo || '')}</p>${n.impacto ? `<p class="n-impacto">→ ${esc(n.impacto)}</p>` : ''}${n.url ? `<a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.fonte || dominio(n.url))} ›</a>` : n.fonte ? `<p class="dica">${esc(n.fonte)}</p>` : ''}</div>`).join('') || '<p>Nada relevante hoje.</p>'}</div>
    ${lista('Oportunidades para você', an.oportunidades)}${lista('Concorrentes', an.concorrentes)}${lista('Tendências', an.tendencias)}${lista('Riscos', an.riscos)}
    ${c.aprender?.length ? `<div class="bloco-o"><h3>Para aprender</h3>${c.aprender.map((a) => `<details><summary>${esc(a.conceito)}</summary><p>${esc(a.explicacao)}</p></details>`).join('')}</div>` : ''}
    ${botoes}`;
}
$('#v-radar').addEventListener('click', async (e) => {
  const t = e.target.closest('[data-radar-tema]');
  if (t) { if (!confirm('Parar de acompanhar este tema?')) return; try { await api(`/radar/temas/${t.dataset.radarTema}/remover`, { metodo: 'POST' }); carregarRadar(); } catch (err) { aviso(err.message); } return; }
  const b = e.target.closest('[data-radar]'); if (!b) return;
  if (b.dataset.radar === 'atualizar') { b.disabled = true; try { await api('/radar/atualizar', { metodo: 'POST' }); aviso('Lendo a internet… leva uns 2 minutos.'); setTimeout(() => carregarRadar().catch(() => {}), 2500); } catch (err) { aviso(err.message); b.disabled = false; } }
  if (b.dataset.radar === 'conversar') perguntarAoDimy('Me explica o Radar de hoje: o que mais importa para o meu negócio e o que eu devo fazer com isso?');
});
$('#form-tema').addEventListener('submit', async (e) => {
  e.preventDefault();
  const tema = $('#radar-novo').value.trim(); if (!tema) return;
  try { await api('/radar/temas', { metodo: 'POST', corpo: { tema } }); $('#radar-novo').value = ''; aviso('Tema adicionado ao Radar.'); carregarRadar(); } catch (err) { aviso(err.message); }
});
$('#form-web').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('#web-pergunta').value.trim(); if (!q) return;
  $('#web-pergunta').value = '';
  perguntarAoDimy(`Pesquise na internet e me responda com as fontes: ${q}`);
});
function perguntarAoDimy(t) {
  ir('conversa');
  setTimeout(() => { const c = $('#texto'); c.value = t; c.dispatchEvent(new Event('input')); $('#form-chat').requestSubmit(); }, 500);
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
// Ao voltar para o app, atualiza a tela atual.
document.addEventListener('visibilitychange', () => { if (!document.hidden && logado() && !$('#app').hidden) rota(); });

comecar();


// ---------------------------------------------------------------------------
// Comando de voz: botão do centro da barra. Toque = fala e para sozinho no silêncio;
// segurar = fala enquanto segura e envia ao soltar. O Dimy executa e o app abre a tela certa.
// ---------------------------------------------------------------------------
const Voz = { estado: 'parado', stream: null, mr: null, pedacos: [], ctx: null, an: null, raf: 0, inicio: 0, falou: false, ultimaFala: 0, base: 0.006, apertou: 0, segurando: false, seguir: false, acoes: [] };
const VOZ_LIMITE_MS = 40000, VOZ_SILENCIO_MS = 1300, VOZ_ESPERA_MS = 7000;

function vozUI(estado, texto) {
  if (estado !== Voz.estado) Voz.desde = Date.now();
  Voz.estado = estado;
  const painel = $('#voz');
  painel.dataset.estado = estado;
  $('#b-comando-voz').classList.toggle('ouvindo', estado === 'ouvindo');
  if (texto != null) $('#voz-estado').textContent = texto;
}

function abrirVoz() {
  const el = $('#voz');
  if (!el.hidden) return;
  el.hidden = false;
  $('#voz-ouvido').hidden = true; $('#voz-resposta').hidden = true; $('#voz-acoes').innerHTML = '';
  $('#voz-dicas').hidden = false;
  document.body.classList.add('com-voz');
}
function fecharVoz() {
  pararEscuta(false);
  try { speechSynthesis.cancel(); } catch { /* sem voz */ }
  $('#voz').hidden = true;
  document.body.classList.remove('com-voz');
  vozUI('parado', 'Toque e fale');
}

async function ouvirComando() {
  try { await ouvirComandoInterno(); }
  catch (e) { diag('voz-erro', e?.message || String(e)); vozUI('erro', `Não consegui ouvir: ${e?.message || 'erro'}. Toque de novo.`); Voz.estado = 'parado'; }
}
async function ouvirComandoInterno() {
  diag('voz-toque', `estado=${Voz.estado}`);
  if (Voz.estado === 'ouvindo') { pararEscuta(true); return; }
  // Preso em "pensando" (resposta que nunca voltou)? Libera depois de 45 s.
  if (Voz.estado === 'pensando' && Date.now() - (Voz.desde || 0) < 45000) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { aviso('Este aparelho não grava áudio pelo app.'); return; }
  if (Rec.ativo) { aviso('Há uma gravação em andamento. Pare a gravação para usar o comando de voz.'); return; }
  if (typeof Dimy !== 'undefined' && Dimy.ligado) desligarDimy('Mãos-livres pausado para o comando de voz.');
  abrirVoz();
  try { speechSynthesis.cancel(); } catch { /* sem voz */ }
  // iPhone: a voz só toca depois de liberada por um toque; libera agora, no toque do microfone.
  if (!Voz.liberou) { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch { /* sem voz */ } Voz.liberou = true; }
  atualizarLocalSilencioso().catch(() => {});
  try { Voz.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { diag('voz-mic', `${e?.name}: ${e?.message}`); vozUI('erro', 'Libere o microfone para o app nos Ajustes do iPhone.'); return; }
  const tipo = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
  Voz.pedacos = []; Voz.falou = false; Voz.inicio = performance.now(); Voz.ultimaFala = 0; Voz.base = 0.006;
  Voz.mr = new MediaRecorder(Voz.stream, tipo ? { mimeType: tipo } : undefined);
  Voz.mr.ondataavailable = (e) => e.data.size && Voz.pedacos.push(e.data);
  Voz.mr.onstop = enviarComando;
  Voz.mr.start(250);
  // Medidor de nível: anima o botão e detecta o fim da fala.
  try {
    Voz.ctx = new (window.AudioContext || window.webkitAudioContext)();
    await Voz.ctx.resume?.();
    Voz.an = Voz.ctx.createAnalyser(); Voz.an.fftSize = 1024;
    Voz.ctx.createMediaStreamSource(Voz.stream).connect(Voz.an);
  } catch { Voz.an = null; }
  vozUI('ouvindo', Voz.segurando ? 'Pode falar… solte para enviar' : 'Ouvindo… pode falar');
  if (navigator.vibrate) navigator.vibrate(25);
  medirVoz();
}

function medirVoz() {
  cancelAnimationFrame(Voz.raf);
  const buf = Voz.an ? new Float32Array(Voz.an.fftSize) : null;
  const passo = () => {
    if (Voz.estado !== 'ouvindo') return;
    const agora = performance.now(), dt = agora - Voz.inicio;
    let rms = 0;
    if (buf) { Voz.an.getFloatTimeDomainData(buf); for (const v of buf) rms += v * v; rms = Math.sqrt(rms / buf.length); }
    if (dt < 400) Voz.base = Math.max(Voz.base, rms * 0.9);
    const limiar = Math.max(0.015, Voz.base * 2.5);
    if (rms > limiar) { Voz.falou = true; Voz.ultimaFala = agora; }
    $('#voz').style.setProperty('--nivel', Math.min(1, rms / 0.12).toFixed(3));
    if (!Voz.segurando && buf) {
      if (Voz.falou && agora - Voz.ultimaFala > VOZ_SILENCIO_MS) { pararEscuta(true); return; }
      if (!Voz.falou && dt > VOZ_ESPERA_MS) { pararEscuta(false); vozUI('parado', 'Não ouvi nada. Toque e fale de novo.'); return; }
    }
    if (dt > VOZ_LIMITE_MS) { pararEscuta(true); return; }
    Voz.raf = requestAnimationFrame(passo);
  };
  Voz.raf = requestAnimationFrame(passo);
}

function pararEscuta(enviar) {
  cancelAnimationFrame(Voz.raf);
  Voz.enviar = enviar;
  if (Voz.mr && Voz.mr.state !== 'inactive') Voz.mr.stop();
  else Voz.stream?.getTracks().forEach((t) => t.stop());
  try { Voz.ctx?.close(); } catch { /* já fechado */ }
  Voz.ctx = null; Voz.an = null;
  $('#voz').style.setProperty('--nivel', 0);
  if (enviar) vozUI('pensando', 'Entendendo…');
}

async function enviarComando() {
  Voz.stream?.getTracks().forEach((t) => t.stop());
  const mime = (Voz.mr?.mimeType || 'audio/mp4').split(';')[0];
  const audio = new Blob(Voz.pedacos, { type: mime });
  Voz.mr = null;
  if (!Voz.enviar) return;
  diag('voz-audio', `${audio.size} bytes ${mime}`);
  if (audio.size < 1500) { vozUI('parado', 'Muito curto. Toque e fale de novo.'); return; }
  vozUI('pensando', 'Entendendo…');
  try {
    const r = await api('/audio?voz=1', { metodo: 'POST', corpo: audio, tipo: mime });
    if (r.ignorado || !r.resposta) { vozUI('parado', 'Não entendi. Toque e fale de novo.'); return; }
    await mostrarRespostaVoz(r.texto, r.resposta, r.acoes || []);
  } catch (e) { diag('voz-envio', e.message); vozUI('erro', e.message || 'Falhou. Tente de novo.'); }
}

async function comandoTexto(texto) {
  if (Voz.estado === 'ouvindo') pararEscuta(false);
  abrirVoz();
  vozUI('pensando', 'Entendendo…');
  try {
    const r = await api('/chat', { metodo: 'POST', corpo: { texto, voz: true, id: `voz-${Date.now()}` } });
    await mostrarRespostaVoz(texto, r.resposta, r.acoes || []);
  } catch (e) { vozUI('erro', e.message); }
}

async function mostrarRespostaVoz(ouvido, resposta, acoes) {
  $('#voz-dicas').hidden = true;
  const o = $('#voz-ouvido'); o.hidden = false; o.textContent = `“${ouvido}”`;
  const rr = $('#voz-resposta'); rr.hidden = false; rr.innerHTML = leve(resposta).replace(/\n/g, '<br>');
  const destino = executarAcoes(acoes);
  $('#voz-acoes').innerHTML = destino ? `<button class="btn primario largo" data-voz-ir="${esc(destino.ir)}">${esc(destino.rotulo)}</button>` : '';
  vozUI('respondendo', 'Toque no microfone para continuar');
  Voz.agenda = acoes.some((a) => /^agenda_|^lembrete_/.test(a.ferramenta));
  if (Voz.agenda) { Agenda.inicioSemana = null; if (/^#?hoje/.test(location.hash || '#hoje')) rota(); }
  const pergunta = /\?\s*$/.test(resposta.trim());
  if ($('#voz-falar-resp').checked) await falar(resposta);
  if ($('#voz').hidden) return;
  if (destino?.auto) { fecharVoz(); ir(destino.ir); if (destino.depois) setTimeout(destino.depois, 400); return; }
  if (pergunta) { ouvirComando(); return; }             // o Dimy perguntou algo: já escuta a resposta
  vozUI('respondendo', 'Toque no microfone para continuar');
}

/** Traduz o que o Dimy executou em navegação no app. Devolve o destino principal. */
function executarAcoes(acoes) {
  let destino = null;
  for (const a of acoes) {
    const d = a.dados || {};
    if (a.ferramenta === 'oraculo_pesquisar' && d.id) destino = { ir: `dossie/${d.id}`, rotulo: 'Ver a pesquisa', auto: true };
    else if (a.ferramenta === 'oraculo_ver' && d.dossie_id) destino = { ir: `dossie/${d.dossie_id}`, rotulo: 'Abrir dossiê', auto: true };
    else if (a.ferramenta === 'empresas_proximas' && d.empresas) {
      destino = { ir: 'oraculo', rotulo: 'Ver empresas', auto: true, depois: () => { mostrarPerto(d, d.segmento || ''); $('#form-perto')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
    } else if (a.ferramenta === 'app_comando') {
      if (d.acao === 'iniciar_gravacao') {
        destino = { ir: 'gravar', rotulo: 'Gravar', auto: true, depois: () => {
          const tipo = d.tipo_gravacao || 'reuniao';
          document.querySelector(`[data-tipo="${tipo}"]`)?.click();
          comecarGravacao().catch(() => aviso('Toque no botão vermelho para começar a gravar.'));
        } };
      } else if (d.tela) destino = { ir: d.tela === 'avisos' ? 'mais' : d.tela, rotulo: 'Abrir', auto: true };
    } else if (/^agenda_|^lembrete_/.test(a.ferramenta) && !destino) destino = { ir: 'hoje', rotulo: 'Ver agenda', auto: false };
    else if (a.ferramenta === 'whatsapp_conversa' && !destino) destino = { ir: 'whats', rotulo: 'Abrir WhatsApp', auto: false };
  }
  return destino;
}

// Antes de um comando, atualiza a localização (se já liberada) para "empresas perto de mim" sair certo.
async function atualizarLocalSilencioso() {
  if (!geoLigado() || !navigator.geolocation) return;
  try { const pos = await pegarPosicao(); await enviarLocal(pos); } catch { /* segue com a última */ }
}

// Botão do centro: toque = fala com fim automático; segurar = walkie-talkie.
const bVoz = $('#b-comando-voz');
bVoz.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  try { bVoz.setPointerCapture(e.pointerId); } catch { /* sem captura */ }
  Voz.apertou = performance.now();
  diag('voz-aperto', `${e.pointerType} estado=${Voz.estado}`);
  Voz.timerSegurar = setTimeout(() => { if (Voz.estado !== 'ouvindo') { Voz.segurando = true; ouvirComando(); } }, 350);
});
const soltarVoz = () => {
  clearTimeout(Voz.timerSegurar);
  if (Voz.segurando) { Voz.segurando = false; if (Voz.estado === 'ouvindo') pararEscuta(true); return; }
  if (performance.now() - Voz.apertou < 350) ouvirComando();
};
bVoz.addEventListener('pointerup', soltarVoz);
bVoz.addEventListener('pointercancel', () => { diag('voz-cancel', `segurando=${Voz.segurando}`); clearTimeout(Voz.timerSegurar); if (Voz.segurando) { Voz.segurando = false; pararEscuta(true); } });
bVoz.addEventListener('contextmenu', (e) => e.preventDefault());
$('#voz-orbe').addEventListener('click', () => ouvirComando());
$('#voz').addEventListener('click', (e) => {
  if (e.target.closest('[data-voz-fechar]')) { fecharVoz(); return; }
  const t = e.target.closest('[data-voz-texto]');
  if (t) { comandoTexto(t.dataset.vozTexto); return; }
  const irPara = e.target.closest('[data-voz-ir]');
  if (irPara) { const d = irPara.dataset.vozIr; fecharVoz(); ir(d); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && Voz.estado === 'ouvindo') pararEscuta(false); });
