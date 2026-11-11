// Segundo Cérebro — app do iPhone (PWA). Fala só com a função "app" do Supabase.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const API = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/app';
const GRAVADOR = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/gravador';
const ORACULO = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/oraculo';
const EQUIPE = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/equipe';
const EXTRA = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/extra';
const DOCUMENTO = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/documento';
const AGENDADOR = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/agendador';
const ATENDENTE = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/atendente';
const TAREFAS = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/tarefas';
const OLHO = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/olho';
const CONSUMO = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/consumo';
const CHAT = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/chat';
// Conta em uso na agenda e nas tarefas: null = a minha; senão o id de quem compartilhou comigo (ex.: secretária vendo a do chefe).
const Conta = { lista: [], agenda: null, tarefas: null };
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
const VERSAO = 'v49';
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
// Lê a sessão sem nunca travar o app: se a biblioteca de login demorar (já aconteceu no iPhone logo depois do link
// de convite), usa a sessão que o app já tem em mãos.
let sessaoTravada = false;   // a biblioteca já demorou uma vez nesta abertura do app: não espera de novo
async function sessaoAtual() {
  if (sessaoTravada && sessao) return sessao;
  try {
    const r = await Promise.race([SUPA.auth.getSession(), new Promise((ok) => setTimeout(() => ok(null), 4000))]);
    if (!r) { sessaoTravada = true; return sessao; }
    return r.data.session;
  } catch { return sessao; }
}
async function api(caminho, { metodo = 'GET', corpo, tipo } = {}) {
  const headers = {};
  sessao = await sessaoAtual();
  if (sessao) headers.authorization = `Bearer ${sessao.access_token}`;
  else if (chave) headers['x-app-key'] = chave;
  let body;
  if (corpo instanceof Blob) { body = corpo; headers['content-type'] = tipo || corpo.type || 'application/octet-stream'; }
  else if (corpo !== undefined) { body = JSON.stringify(corpo); headers['content-type'] = 'application/json'; }
  // Agenda/tarefas de quem compartilhou com você (ex.: secretária na agenda do chefe): o servidor confere a permissão.
  if (/^\/agenda/.test(caminho) && Conta.agenda) headers['x-conta'] = Conta.agenda;
  if (/^\/tarefas/.test(caminho) && Conta.tarefas) headers['x-conta'] = Conta.tarefas;
  if (/^\/chat\//.test(caminho)) {
    const r = await fetch(CHAT + caminho.replace(/^\/chat/, ''), { method: metodo, headers, body });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { sair(); throw new Error(d.erro || 'Sessão expirada. Entre de novo.'); }
    if (!r.ok) throw Object.assign(new Error(d.erro || `Erro ${r.status}`), { status: r.status });
    return d;
  }
  const ehEquipe = /^\/equipe/.test(caminho);
  if (ehEquipe) caminho = caminho.replace(/^\/equipe/, '');
  const base = ehEquipe ? EQUIPE : /^\/(gravacoes|voz)/.test(caminho) ? GRAVADOR : /^\/exportar/.test(caminho) ? EXTRA : /^\/documento/.test(caminho) ? DOCUMENTO : /^\/rascunhos/.test(caminho) ? AGENDADOR : /^\/atendente/.test(caminho) ? ATENDENTE : /^\/tarefas/.test(caminho) ? TAREFAS : /^\/olho/.test(caminho) ? OLHO : /^\/consumo/.test(caminho) ? CONSUMO : /^\/(dossies|local|proximas)/.test(caminho) ? ORACULO : API;
  if (base === TAREFAS) caminho = caminho.replace(/^\/tarefas/, '');
  if (base === OLHO) caminho = caminho.replace(/^\/olho/, '');
  if (base === CONSUMO) caminho = caminho.replace(/^\/consumo/, '');
  const ctrl = new AbortController(), limite = setTimeout(() => ctrl.abort(), /^\/(gravacoes|voz|documento|exportar)/.test(caminho) ? 300000 : 120000);
  let res;
  try { res = await fetch(base + caminho, { method: metodo, headers, body, signal: ctrl.signal }); }
  catch (err) { throw new Error(err.name === 'AbortError' ? 'O servidor demorou para responder. Confira a internet e tente de novo.' : 'Sem conexão com o servidor. Confira a internet.'); }
  finally { clearTimeout(limite); }
  const dados = await res.json().catch(() => ({}));
  if (res.status === 401) { sair(); throw new Error(dados.erro || 'Sessão expirada. Entre de novo.'); }
  if (!res.ok) throw Object.assign(new Error(dados.erro || `Erro ${res.status}`), { codigo: dados.codigo, status: res.status });
  return dados;
}

function aviso(msg) {
  if (SEM_CREDITO.test(String(msg))) msg = 'O Dimy está sem crédito de IA. Veja como resolver no Radar.';
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
/** Número legível: 5537996697777 → (37) 99669-7777; outros países ficam com +DDI. */
function foneBonito(wa) {
  const d = String(wa || '').replace(/\D/g, '');
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(d);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d ? `+${d}` : 'Contato';
}
const nomeValido = (n) => !!n && !/^<?unknown>?$/i.test(n.trim()) && !/^\+?\d[\d\s-]+$/.test(n.trim());
const nomeDe = (c) => (nomeValido(c?.name) ? c.name.trim() : foneBonito(c?.wa_id));
/** "agora", "há 12 min", "há 3 h", "ontem", "há 5 dias". */
function ha(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (!(s >= 0)) return '';
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  const dias = Math.round(s / 86400);
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}

// ---------------------------------------------------------------------------
// Navegação
// ---------------------------------------------------------------------------
const VISTAS = {
  hoje: '#v-hoje', conversa: '#v-conversa', gravar: '#v-gravar', gravando: '#v-gravando', gravacao: '#v-gravacao',
  whats: '#v-whats', contato: '#v-contato', tarefas: '#v-tarefas', mais: '#v-mais', oraculo: '#v-oraculo', dossie: '#v-dossie', radar: '#v-radar', olho: '#v-olho', config: '#v-config', equipe: '#v-equipe',
};
const ABA_DE = { whats: 'hoje', contato: 'hoje', gravando: 'gravar', gravacao: 'gravar', oraculo: 'hoje', dossie: 'hoje', radar: 'hoje', olho: 'hoje', config: 'mais', equipe: 'hoje' };

function ir(destino) { location.hash = destino; }

async function rota() {
  const [nome, arg] = (location.hash.slice(1) || 'hoje').split('/');
  let vista = nome === 'avisos' ? 'mais' : VISTAS[nome] ? nome : 'hoje';
  if ((vista === 'whats' || vista === 'contato' || vista === 'config') && eu && !eu.dono) vista = 'hoje';   // WhatsApp é só do dono
  for (const [k, sel] of Object.entries(VISTAS)) $(sel).hidden = k !== vista;
  document.querySelectorAll('.abas button').forEach((b) => b.classList.toggle('ativa', b.dataset.ir === (ABA_DE[vista] || vista)));
  $('#pilula-gravando').hidden = !Rec.ativo || vista === 'gravando';
  if (vista !== 'gravacao') pararDetalhe();
  if (vista !== 'dossie') clearTimeout(Oraculo.timer);
  if (vista !== 'equipe') { pararChat(); document.body.classList.remove('chat-aberto'); }
  window.scrollTo(0, 0);
  try {
    if (vista === 'hoje') await carregarHoje();
    if (vista === 'conversa') await carregarConversa();
    if (vista === 'tarefas') await carregarTarefas();
    if (vista === 'whats') await carregarContatos();
    if (vista === 'contato') await carregarContato(arg);
    if (vista === 'mais') await carregarMais();
    if (vista === 'gravar') await carregarGravacoes();
    if (vista === 'gravando') mostrarGravando();
    if (vista === 'gravacao') await carregarGravacao(arg);
    if (vista === 'oraculo') await carregarOraculo();
    if (vista === 'dossie') await carregarDossie(arg);
    if (vista === 'radar') await carregarRadar();
    if (vista === 'olho') await carregarOlho();
    if (vista === 'config') await carregarConfig();
    if (vista === 'equipe') await carregarChat(arg);
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
  for (const c of d.aguardando.filter((x) => Date.now() - Date.parse(x.last_in_at || x.last_seen) < 48 * 3600e3).slice(0, 4)) {
    itens.push({ tipo: 'whats', rotulo: 'Espera resposta', texto: `${nomeDe(c)}${c.last_summary ? `: ${c.last_summary}` : ' mandou mensagem.'}`, acao: 'Responder', ir: `contato/${c.wa_id}` });
  }
  for (const l of d.lembretes.filter((x) => new Date(x.due_at) - Date.now() < 6 * 3600e3).slice(0, 3)) {
    itens.push({ tipo: 'lembrete', rotulo: `Lembrete · ${hora(l.due_at)}`, texto: l.text });
  }
  for (const a of d.avisos.filter((x) => !x.read_at && x.kind !== 'urgente' && Date.now() - Date.parse(x.created_at) < 24 * 3600e3).slice(0, 4)) {
    itens.push({ tipo: 'aviso', rotulo: textoAviso(a.title).replace(/^\p{Extended_Pictographic}\s*/u, ''), texto: textoAviso(a.body), acao: 'Abrir', ir: destinoAviso(a, d.aguardando) });
  }
  if (!itens.length) itens.push({ tipo: 'calmo', rotulo: 'Agora', texto: 'Nada pedindo você agora. Se quiser, me conta como está o dia.', acao: 'Conversar', ir: 'conversa' });
  return itens;
}

// Para onde um aviso leva. Avisos antigos de "conversas novas" apontavam para a própria tela Hoje.
function destinoAviso(a, aguardando = []) {
  const url = a.data?.url || '';
  if (a.data?.contact) return `contato/${a.data.contact}`;
  if (url.startsWith('./#') && url !== './#hoje') return url.slice(3);
  if (a.kind === 'contatos') {
    const nomes = [...String(a.body || '').matchAll(/^•\s*(.+?)(?: \(espera resposta\))?:/gm)].map((m) => m[1].trim().toLowerCase());
    if (nomes.length === 1) {
      const c = (aguardando || []).find((x) => (x.name || '').trim().toLowerCase() === nomes[0] || `+${x.wa_id}` === nomes[0]);
      if (c) return `contato/${c.wa_id}`;
      if (/^\+\d+$/.test(nomes[0])) return `contato/${nomes[0].slice(1)}`;
    }
    return 'whats';
  }
  return url.startsWith('./#') ? url.slice(3) : 'avisos';
}
const TIPOS_MSG = { unsupported: 'mandou figurinha, reação ou outro tipo de mensagem', image: 'mandou uma foto', audio: 'mandou um áudio', video: 'mandou um vídeo', document: 'mandou um documento', sticker: 'mandou uma figurinha', location: 'mandou uma localização' };
const textoAviso = (t) => String(t || '').replace(/\[(\w+)\]/g, (m, k) => TIPOS_MSG[k.toLowerCase()] || m).replace(/(\d+) conversa\(s\) nova\(s\)/, (m, n) => (n === '1' ? '1 conversa nova' : `${n} conversas novas`));
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
// Rota só quando o "local" parece um lugar (número, via, vírgula ou nome curto); não para link/online nem para frase longa de anotação.
const eEndereco = (l) => {
  const t = String(l || '').trim(), palavras = t.split(/\s+/).length;
  if (t.length < 4 || t.length > 160 || /^https?:|meet\.|zoom|teams|google meet|online|whatsapp|liga[cç][aã]o|telefone|videochamada/i.test(t)) return false;
  return /\d/.test(t) || /\b(rua|r\.|av\.?|avenida|alameda|al\.|pra[cç]a|rodovia|rod\.|estrada|travessa|largo|bairro|shopping|centro|condom[ií]nio|edif[ií]cio|ed\.|padaria|loja|escrit[oó]rio|empresa|igreja|hotel|restaurante)\b/i.test(t)
    || (t.includes(',') && palavras <= 12) || palavras <= 5;
};
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
  olhoResumo().catch(() => {});
  api('/tarefas').then((d) => { const n = d.tarefas.filter((t) => t.etapa !== 'feito').length + d.atrasadas.length; $('#badge-tarefas').hidden = !n; $('#badge-tarefas').textContent = n; }).catch(() => {});
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

  desenharEspera(d.aguardando || []);
}

// "Esperando sua resposta": uma linha compacta; a lista só abre quando você toca.
const CORES_AV = ['azul', 'roxo', 'ambar', 'rosa', 'verde'];
const corDe = (wa) => CORES_AV[[...String(wa)].reduce((s, ch) => s + ch.charCodeAt(0), 0) % CORES_AV.length];
const avatar = (c, cls = '') => `<span class="av ${corDe(c.wa_id)} ${cls}">${nomeValido(c.name) ? esc(iniciais(c.name)) : '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'}</span>`;
function desenharEspera(esp) {
  const sec = $('#bloco-espera');
  sec.hidden = !esp.length;
  if (!esp.length) return;
  const t = (c) => c.last_in_at || c.last_seen;
  const ord = [...esp].sort((x, y) => Date.parse(t(y)) - Date.parse(t(x)));
  const novas = ord.filter((c) => Date.now() - Date.parse(t(c)) < 24 * 3600e3).length;
  $('#espera-avatares').innerHTML = ord.slice(0, 3).map((c) => avatar(c)).join('') + (ord.length > 3 ? `<span class="av mais">+${ord.length - 3}</span>` : '');
  $('#espera-titulo').textContent = `${ord.length} esperando você`;
  $('#espera-sub').textContent = novas ? `${novas} nova${novas > 1 ? 's' : ''} hoje · última ${ha(t(ord[0]))}` : `a mais recente ${ha(t(ord[0]))}`;
  $('#caixa-espera').classList.toggle('tem-nova', !!novas);
  $('#lista-espera').innerHTML = ord.slice(0, 6).map((c) => {
    const velha = Date.now() - Date.parse(t(c)) > 72 * 3600e3;
    return `<li class="${velha ? 'velha' : ''}"><button class="espera-item" data-ir="contato/${esc(c.wa_id)}">${avatar(c, 'p')}
      <span class="espera-corpo"><b>${esc(nomeDe(c))}</b><span>${esc(c.last_summary || 'Mandou mensagem')}</span></span>
      <span class="espera-h">${ha(t(c))}</span></button>
      <button class="espera-ok" data-resolver="${esc(c.wa_id)}" aria-label="Marcar como respondida"><svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg></button></li>`;
  }).join('');
}
try { if (localStorage.getItem('cerebro-espera-aberta') === '1') $('#caixa-espera').open = true; } catch { /* sem armazenamento */ }
$('#caixa-espera').addEventListener('toggle', (e) => { try { localStorage.setItem('cerebro-espera-aberta', e.currentTarget.open ? '1' : '0'); } catch { /* ok */ } });
$('#lista-espera').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-resolver]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const li = b.closest('li'); li.classList.add('saindo');
  try {
    await api(`/contatos/${b.dataset.resolver}/resolvido`, { metodo: 'POST' });
    setTimeout(() => { li.remove(); const resto = [...document.querySelectorAll('#lista-espera li')]; if (!resto.length) $('#bloco-espera').hidden = true; else $('#espera-titulo').textContent = `${resto.length} esperando você`; }, 220);
  } catch (err) { li.classList.remove('saindo'); aviso(err.message); }
});

const iniciais = (n) => n.replace(/^\+/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '•';
function quandoCurto(iso) {
  const dia = diaISO(iso), hoje = diaISO(new Date());
  const rot = dia === hoje ? 'Hoje' : dia === somaDias(hoje, 1) ? 'Amanhã' : nomeDia(dia, { day: '2-digit', month: 'short' }).replace('.', '');
  return `${rot}, ${horaISO(iso)}`;
}

async function carregarSemana() {
  const { ini, dias } = gradeAtual();
  desenharSeletorConta('agenda');
  const chave = `${Conta.agenda || ''}/${ini}/${dias}`;
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
    if (ac.dataset.acao === 'dimy') ir('conversa');
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
let folhaAcao = null, folhaTimer = 0;

let folhaBotao = 'Salvar';
// Folha de baixo genérica. Campos: data-hora, escolha (rádio), marcas (caixas), contato (lista com busca), html (bloco pronto), texto/e-mail/textarea.
// salvar(dados) pode devolver 'manter' para a folha continuar aberta (fluxos em duas etapas). aoAbrir(el) liga eventos extras.
function abrirFolha({ titulo, campos, salvar, apagar, botao = 'Salvar', ocupado, aoAbrir }) {
  clearTimeout(folhaTimer);
  $('#folha-titulo').textContent = titulo;
  folhaBotao = botao; $('#folha-salvar').textContent = botao; $('#folha-salvar').dataset.ocupado = ocupado || (botao === 'Salvar' ? 'Salvando…' : 'Enviando…');
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
      return `<div class="campo"><span>${c.rotulo}</span><div class="escolha${c.classe ? ` ${c.classe}` : ''}">${c.opcoes.map((o) => `<label><input type="${radio ? 'radio' : 'checkbox'}" name="${radio ? c.nome : o.nome}" value="${esc(o.valor ?? '1')}" ${o.marcado ? 'checked' : ''}><span>${esc(o.texto)}</span></label>`).join('')}</div></div>${c.dica ? `<p class="campo-dica" ${c.idDica ? `id="${c.idDica}"` : ''}>${esc(c.dica)}</p>` : ''}`;
    }
    if (c.tipo === 'html') return c.html;
    if (c.tipo === 'contato') {
      return `<div class="campo escolhe-contato" data-campo-contato><span>${c.rotulo}</span>
        <input type="hidden" name="${c.nome}" value="${esc(c.valor || '')}" data-nome-escolhido="${esc(c.nomeValor || '')}">
        <div class="contato-escolhido" hidden></div>
        <input type="text" name="busca_${c.nome}" class="contato-busca" placeholder="Nome ou número com DDD" autocomplete="off" autocapitalize="off" enterkeyhint="done" aria-label="Contato ou número">
        <p class="contato-status" aria-live="polite" hidden></p>
        <ul class="contato-lista" role="listbox"><li class="busca-vazio">Carregando seus contatos…</li></ul>
      </div>${c.dica ? `<p class="campo-dica">${esc(c.dica)}</p>` : ''}`;
    }
    if (c.tipoInput === 'textarea') return `<label class="campo"><span>${c.rotulo}</span><textarea name="${c.nome}" rows="${c.linhas || 3}" placeholder="${esc(c.placeholder || '')}">${esc(c.valor || '')}</textarea></label>${c.dica ? `<p class="campo-dica">${esc(c.dica)}</p>` : ''}`;
    return `<label class="campo"><span>${c.rotulo}</span><input name="${c.nome}" type="${c.tipoInput || 'text'}" value="${esc(c.valor || '')}" placeholder="${esc(c.placeholder || '')}" ${c.obrigatorio ? 'required' : ''} autocomplete="${c.autocomplete || 'off'}" ${c.tipoInput === 'email' ? 'autocapitalize="off" inputmode="email"' : ''}></label>${c.dica ? `<p class="campo-dica">${esc(c.dica)}</p>` : ''}`;
  }).join('');
  folhaMsg('');
  $('#folha-apagar').hidden = !apagar;
  $('#folha-apagar').onclick = apagar ? async () => { if (confirm('Apagar mesmo?')) { try { await apagar(); fecharFolha(); } catch (err) { folhaMsg(err.message); } } } : null;
  folhaAcao = salvar;
  $('#folha').hidden = false;
  if (aoAbrir) aoAbrir($('#folha-form'));
  requestAnimationFrame(() => $('#folha').classList.add('aberta'));
}
// Mensagem da folha: erro (vermelho) ou aviso neutro (cinza), ex.: "compartilhamento cancelado".
function folhaMsg(t, neutro = false) { const el = $('#folha-erro'); el.textContent = t || ''; el.classList.toggle('neutro', !!neutro); }
// Escolha de contato: sua lista do WhatsApp com busca por nome, ou número digitado (salvo ou não), validado e mostrado em formato internacional.
// opcoes.janela(): true quando só quem escreveu nas últimas 24 h pode ser escolhido (envio pelo número comercial).
const dentro24h = (c) => !!c.last_in_at && Date.now() - Date.parse(c.last_in_at) < 24 * 3600e3;
async function montarEscolhaContato(el, X, { janela = () => false, aoMudar = () => {} } = {}) {
  const oculto = el.querySelector('input[type=hidden]'), busca = el.querySelector('.contato-busca'), ul = el.querySelector('.contato-lista'), esc1 = el.querySelector('.contato-escolhido'), st = el.querySelector('.contato-status');
  let todos = Busca.todos;
  const status = (t, ok) => { st.hidden = !t; st.textContent = t || ''; st.classList.toggle('ok', !!ok); };
  const desenhar = () => {
    const q = busca.value.trim(), num = X.pareceTelefone(q), dig = q.replace(/\D/g, ''), ws = semAcentoCli(q).split(/\s+/).filter(Boolean), so24 = janela();
    let opNumero = '';
    if (num && dig.length >= 3) {
      const t = X.normalizarTelefone(q);
      if (t.ok) { status(`Número válido: ${t.exibicao}`, true); if (!todos.some((c) => c.wa_id === t.digitos)) opNumero = `<li><button type="button" class="contato-op" data-wa="${esc(t.digitos)}" data-nome="${esc(t.exibicao)}" data-avulso="1"><span class="av">#</span><span class="pessoa-corpo"><span class="t">Usar ${esc(t.exibicao)}</span><span class="d">${so24 ? 'Número digitado (só se te escreveu nas últimas 24 h)' : 'Número digitado: não precisa estar salvo'}</span></span></button></li>`; }
      else status(dig.length >= 8 ? t.erro : '', false);
    } else status('', false);
    const lista = todos.filter((c) => !q || (num ? dig.length >= 3 && c.wa_id.includes(dig.replace(/^0/, '')) : ws.every((w) => semAcentoCli(`${c.name || ''} ${c.empresa || ''}`).includes(w))))
      .sort((a, b) => (so24 ? dentro24h(b) - dentro24h(a) : 0) || (Date.parse(b.last_in_at || b.last_seen || 0) - Date.parse(a.last_in_at || a.last_seen || 0)));
    ul.innerHTML = opNumero + (lista.length ? lista.slice(0, 60).map((c) => {
      const ok = !so24 || dentro24h(c);
      return `<li><button type="button" class="contato-op" data-wa="${esc(c.wa_id)}" data-nome="${esc(nomeDe(c))}" ${ok ? '' : 'disabled'}>${avatar(c)}<span class="pessoa-corpo"><span class="t">${esc(nomeDe(c))}</span><span class="d">${ok ? esc(X.foneLegivel(c.wa_id)) : 'Não te escreveu nas últimas 24 h'}</span></span></button></li>`;
    }).join('') : (opNumero ? '' : `<li class="busca-vazio">${q ? (num ? 'Continue digitando o número com DDD.' : `Ninguém com "${esc(q)}". Digite o número.`) : 'Nenhum contato ainda. Digite o número.'}</li>`));
  };
  const escolher = (wa, nome) => {
    oculto.value = wa; oculto.dataset.nomeEscolhido = nome;
    esc1.innerHTML = `<span class="pessoa-corpo"><span class="t">${esc(nome)}</span><span class="d">${esc(X.foneLegivel(wa))}</span></span><button type="button" class="link" data-trocar>Trocar</button>`;
    esc1.hidden = false; busca.hidden = true; ul.hidden = true; status('', false); aoMudar();
  };
  const trocar = () => { oculto.value = ''; oculto.dataset.nomeEscolhido = ''; esc1.hidden = true; busca.hidden = false; ul.hidden = false; desenhar(); aoMudar(); };
  ul.addEventListener('click', (e) => { const b = e.target.closest('.contato-op'); if (b && !b.disabled) escolher(b.dataset.wa, b.dataset.nome); });
  esc1.addEventListener('click', (e) => { if (e.target.closest('[data-trocar]')) { trocar(); busca.focus(); } });
  busca.addEventListener('input', () => {
    const v = busca.value;   // máscara só quando digita um número no fim do campo (não atrapalha o cursor no meio)
    if (X.pareceTelefone(v) && busca.selectionStart === v.length && !/\s$/.test(v)) { const m = X.mascaraTelefone(v); if (m && m !== v) busca.value = m; }
    desenhar();
  });
  busca.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = ul.querySelector('.contato-op:not([disabled])'); if (b) b.click(); } });
  el.redesenhar = () => { if (oculto.value) { const c = todos.find((x) => x.wa_id === oculto.value); if (janela() && c && !dentro24h(c)) trocar(); } else desenhar(); };
  if (oculto.value) escolher(oculto.value, oculto.dataset.nomeEscolhido || X.foneLegivel(oculto.value)); else if (todos.length) desenhar();
  try {
    const { contatos } = await api('/contatos');
    todos = contatos.filter((c) => c.name !== '[teste removido]' && new Date(c.last_seen).getFullYear() > 2001);
    el.redesenhar();
  } catch { if (!todos.length && !oculto.value) ul.innerHTML = '<li class="busca-vazio">Não consegui carregar seus contatos agora. Digite o número com DDD.</li>'; }
}
function fecharFolha() { $('#folha').classList.remove('aberta'); clearTimeout(folhaTimer); folhaTimer = setTimeout(() => ($('#folha').hidden = true), 220); if (folhaFechou) { const f = folhaFechou; folhaFechou = null; f(); } }
let folhaFechou = null;
$('#folha').addEventListener('click', (e) => { if (e.target.closest('[data-fechar]')) fecharFolha(); });
$('#folha-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const b = $('#folha-salvar'); if (b.disabled) return;   // nunca dois envios ao mesmo tempo
  const dados = Object.fromEntries(new FormData(e.currentTarget));
  b.disabled = true; b.textContent = b.dataset.ocupado || 'Enviando…'; folhaMsg('');
  try { const r = await folhaAcao(dados); if (r !== 'manter') fecharFolha(); }
  catch (err) { folhaMsg(err.message, !!err.neutro); }
  finally { b.disabled = false; b.textContent = folhaBotao; }
});
// Troca o texto do botão principal (ex.: etapa 2 de um envio) e o texto mostrado enquanto trabalha.
function botaoFolha(t, ocupado) { folhaBotao = t; $('#folha-salvar').textContent = t; if (ocupado) $('#folha-salvar').dataset.ocupado = ocupado; }
const progressoFolha = (t) => { $('#folha-salvar').textContent = t; };

function proximaHoraCheia() { const d = new Date(Date.now() + 3600e3); d.setMinutes(0); return horaISO(d); }

function editarEvento(ev, sug) {
  const dia = ev ? diaISO(ev.inicio) : Agenda.dia;
  const ini = ev && !ev.dia_inteiro ? horaISO(ev.inicio) : proximaHoraCheia();
  const fim = ev && ev.fim && !ev.dia_inteiro ? horaISO(ev.fim) : horaISO(new Date(Date.parse(montarISO(dia, ini)) + 3600e3));
  abrirFolha({
    titulo: `${ev ? 'Editar compromisso' : 'Novo compromisso'}${Conta.agenda ? ` · agenda de ${(Conta.lista.find((c) => c.dono === Conta.agenda)?.nome || '').split(' ')[0]}` : ''}`,
    campos: [
      { rotulo: 'O quê', nome: 'titulo', valor: ev?.titulo ?? sug?.titulo, placeholder: 'Visita – cliente', obrigatorio: true },
      { tipo: 'data-hora', data: 'dia', hora: 'inicio', hora2: 'fim', vData: dia, vHora: ini, vHora2: fim, rotuloHora: 'Início' },
      { rotulo: 'Onde', nome: 'local', valor: ev?.local ?? sug?.local, placeholder: 'Endereço (rua, número, cidade) para a rota no Waze/Maps' },
    ],
    salvar: async (f) => {
      if (!f.titulo?.trim() || !f.dia || !f.inicio) throw new Error('Preencha o quê, o dia e a hora.');
      let fimISO = montarISO(f.dia, f.fim || f.inicio);
      if (!f.fim || Date.parse(fimISO) <= Date.parse(montarISO(f.dia, f.inicio))) fimISO = new Date(Date.parse(montarISO(f.dia, f.inicio)) + 3600e3).toISOString();
      const corpo = { titulo: f.titulo.trim(), inicio: montarISO(f.dia, f.inicio), fim: fimISO, local: f.local?.trim() || '' };
      if (!Agenda.google) throw new Error(Conta.lista.some((c) => c.agenda) ? 'Sua agenda não tem o Google ligado. Para marcar na agenda de quem compartilhou com você, escolha o nome no topo do calendário.' : 'Sua agenda não tem o Google ligado. Conecte em Avisos › Ajustes › Conectar Google Agenda.');
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
  api('/chat/naolidas').then((r) => { $('#badge-equipe').hidden = !r.total; $('#badge-equipe').textContent = r.total > 99 ? '99+' : r.total; }).catch(() => {});
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
  const tem = !!texto.value.trim() || !!(Anexo.atual?.pronto && !Anexo.atual.enviado);
  $('#enviar').hidden = !tem; $('#mic').hidden = tem;
});
texto.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); $('#form-chat').requestSubmit(); }
});

$('#form-chat').addEventListener('submit', async (e) => {
  e.preventDefault();
  const t = texto.value.trim();
  if (Anexo.atual?.pronto) { enviarDocumento(t); return; }
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

// ---- Anexar documento: o Dimy analisa PDF, foto, Word, Excel, CSV e texto ----
// Enquanto o arquivo estiver no chip, as próximas perguntas da conversa também olham para ele.
const Anexo = { atual: null };
const TAM_MAX = 20 * 1024 * 1024;
const fmtTam = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
function mostrarAnexo() {
  const a = Anexo.atual, chip = $('#anexo-chip');
  $('#anexar').classList.toggle('ativo', !!a);
  if (!a) { chip.hidden = true; texto.placeholder = 'Escreva ou toque no microfone'; texto.dispatchEvent(new Event('input')); return; }
  chip.hidden = false;
  chip.classList.toggle('carregando', !a.pronto && !a.erro);
  $('#anexo-nome').textContent = a.nome;
  $('#anexo-estado').textContent = a.erro ? a.erro : !a.pronto ? 'Preparando' : a.enviado
    ? 'Pergunte mais sobre este arquivo, ou toque em ✕ para tirar' : `${fmtTam(a.tamanho)} · escreva o que quer saber ou só envie`;
  texto.placeholder = a.pronto ? 'O que você quer saber do arquivo?' : 'Escreva ou toque no microfone';
  texto.dispatchEvent(new Event('input'));
}
$('#anexar').addEventListener('click', () => { diag('anexo-toque'); $('#arquivo').click(); });
$('#anexo-tirar').addEventListener('click', () => { Anexo.atual = null; mostrarAnexo(); });
$('#arquivo').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  const a = { nome: f.name || 'arquivo', tamanho: f.size, id: crypto.randomUUID(), pronto: false, enviado: false };
  Anexo.atual = a; mostrarAnexo();
  try {
    if (f.size > TAM_MAX) throw new Error(`Arquivo grande demais (${fmtTam(f.size)}). O limite é 20 MB.`);
    Object.assign(a, await lerArquivo(f));
    a.pronto = true;
  } catch (err) {
    a.erro = err.message || 'Não consegui ler esse arquivo.';
    diag('anexo-erro', `${f.type} ${a.erro}`);
  }
  if (Anexo.atual === a) { mostrarAnexo(); if (a.pronto) texto.focus({ preventScroll: true }); }
});

function base64De(blob) {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] || '');
    r.onerror = () => erro(new Error('Não consegui ler o arquivo.'));
    r.readAsDataURL(blob);
  });
}
async function imagemReduzida(f) {
  const url = URL.createObjectURL(f);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const lado = 1568, k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
    if (!blob) throw new Error('Não consegui abrir a imagem.');
    return { tipo: 'image/jpeg', base64: await base64De(blob) };
  } finally { URL.revokeObjectURL(url); }
}
// Textos de XML (Word, PowerPoint, OpenDocument): parágrafo vira linha, célula vira tab.
const desXml = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
const xmlTexto = (xml) => desXml(xml
  .replace(/<(w:tab|text:tab)\/>/g, '\t').replace(/<(w:br|a:br|text:line-break)[^>]*\/>/g, '\n')
  .replace(/<\/(w:p|text:p)>\s*<\/(w:tc|table:table-cell)>/g, ' | ').replace(/<\/(w:tr|table:table-row)>/g, '\n')
  .replace(/<\/(w:p|a:p|text:p|text:h)>/g, '\n').replace(/<\/(w:tc|table:table-cell)>/g, ' | ')
  .replace(/<[^>]+>/g, '')).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
const fflate = () => import('https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm');
async function abrirZip(f) {
  const { unzipSync } = await fflate();
  try { return unzipSync(new Uint8Array(await f.arrayBuffer())); } catch { throw new Error('O arquivo parece corrompido ou protegido por senha.'); }
}
const ordemNatural = (a, b) => a.localeCompare(b, undefined, { numeric: true });
async function textoDoWord(f) {
  const { strFromU8 } = await fflate();
  const z = await abrirZip(f);
  const partes = Object.keys(z).filter((k) => /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/.test(k))
    .sort((a) => (a === 'word/document.xml' ? -1 : 1));
  if (!partes.length) throw new Error('Esse Word não abriu. Salve como PDF e tente de novo.');
  return partes.map((k) => xmlTexto(strFromU8(z[k]))).filter(Boolean).join('\n\n');
}
async function textoDoPowerPoint(f) {
  const { strFromU8 } = await fflate();
  const z = await abrirZip(f);
  const slides = Object.keys(z).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort(ordemNatural);
  if (!slides.length) throw new Error('Essa apresentação não abriu. Exporte em PDF e tente de novo.');
  return slides.map((k, n) => {
    const nota = z[k.replace('slides/slide', 'notesSlides/notesSlide')];
    return `--- Slide ${n + 1} ---\n${xmlTexto(strFromU8(z[k]))}${nota ? `\n[Notas] ${xmlTexto(strFromU8(nota))}` : ''}`;
  }).join('\n\n');
}
async function textoDoOpenDocument(f) {
  const { strFromU8 } = await fflate();
  const z = await abrirZip(f);
  if (!z['content.xml']) throw new Error('Esse arquivo não abriu. Exporte em PDF e tente de novo.');
  return xmlTexto(strFromU8(z['content.xml']).replace(/<\/draw:page>/g, '\n\n'));
}
async function textoDoExcel(f) {
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs');
  const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array', cellDates: true });
  return wb.SheetNames.map((n) => `### Aba: ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n], { FS: ';', blankrows: false })}`).join('\n\n');
}
// Pages, Numbers e Keynote (Apple) guardam uma prévia em PDF ou imagem dentro do pacote.
async function previaApple(f) {
  const z = await abrirZip(f);
  const pdf = Object.keys(z).find((k) => /(^|\/)(QuickLook\/)?Preview\.pdf$/i.test(k));
  if (pdf) return { tipo: 'application/pdf', base64: await base64De(new Blob([z[pdf]])) };
  const img = Object.keys(z).find((k) => /preview(-web)?\.(jpe?g|png)$/i.test(k));
  if (img) return imagemReduzida(new File([z[img]], img, { type: /png$/i.test(img) ? 'image/png' : 'image/jpeg' }));
  throw new Error('Não achei o conteúdo desse arquivo da Apple. No app, use Exportar → PDF e mande o PDF.');
}
// ZIP: lista o que tem dentro e lê os arquivos de texto (CSV, TXT, XML…).
async function textoDoZip(f) {
  const { strFromU8 } = await fflate();
  const z = await abrirZip(f);
  const nomes = Object.keys(z).filter((k) => !k.endsWith('/') && !k.startsWith('__MACOSX'));
  let total = 0;
  const textos = nomes.filter((k) => /\.(txt|csv|tsv|md|json|xml|html?|log|ics|vcf|eml|ya?ml|sql)$/i.test(k)).map((k) => {
    if (total > 150_000) return '';
    const t = strFromU8(z[k]).slice(0, 40_000); total += t.length;
    return `--- ${k} ---\n${t}`;
  }).filter(Boolean);
  return `Arquivos dentro do ZIP (${nomes.length}):\n${nomes.slice(0, 300).map((k) => `• ${k} (${fmtTam(z[k].length)})`).join('\n')}${textos.length ? `\n\n${textos.join('\n\n')}` : ''}`;
}
// RTF: lê o texto ignorando tabelas de fonte, cores, estilos e imagens.
function textoDoRtf(rtf) {
  const PULAR = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'xmlnstbl', 'themedata', 'colorschememapping', 'latentstyles', 'datastore', 'object', 'header', 'footer', 'headerl', 'headerr', 'footerl', 'footerr']);
  const pilha = []; let pular = false, out = '', i = 0, uc = 1, ignorarProx = 0;
  while (i < rtf.length) {
    const c = rtf[i];
    if (c === '{') { pilha.push(pular); i++; continue; }
    if (c === '}') { pular = pilha.pop() ?? false; i++; continue; }
    if (c === '\\') {
      const m = /^\\(?:([a-zA-Z]+)(-?\d+)? ?|'([0-9a-fA-F]{2})|([^a-zA-Z]))/.exec(rtf.slice(i, i + 40));
      if (!m) { i++; continue; }
      i += m[0].length;
      if (m[4]) { if (m[4] === '*') pular = true; else if (!pular && /[\\{}]/.test(m[4])) out += m[4]; else if (!pular && m[4] === '~') out += ' '; continue; }
      if (m[3]) { if (ignorarProx) { ignorarProx--; continue; } if (!pular) out += new TextDecoder('windows-1252').decode(new Uint8Array([parseInt(m[3], 16)])); continue; }
      const w = m[1], n = m[2];
      if (PULAR.has(w)) { pular = true; continue; }
      if (pular) continue;
      if (w === 'uc') uc = +n;
      else if (w === 'u') { out += String.fromCharCode(+n < 0 ? 65536 + +n : +n); ignorarProx = uc; }
      else if (w === 'par' || w === 'line' || w === 'row') out += '\n';
      else if (w === 'tab' || w === 'cell') out += w === 'cell' ? ' | ' : '\t';
      continue;
    }
    if (c === '\r' || c === '\n') { i++; continue; }
    if (!pular) { if (ignorarProx) ignorarProx--; else out += c; }
    i++;
  }
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
// Formatos binários antigos (.doc, .ppt, .msg…): recupera os trechos de texto legíveis.
function textoDeBinario(buf) {
  const b = new Uint8Array(buf);
  const RUIDO = /^(Root Entry|Normal|Heading \d|Default Paragraph Font|Table Normal|No List|WordDocument|SummaryInformation|DocumentSummaryInformation|CompObj|Times New Roman|Arial|Symbol|Calibri|Cambria|Liberation \w+|Microsoft Word.*|Title|Subtitle|.{1,40} Char|ListLabel \d+|Heading.{0,20}|Body Text.{0,4}|Caption|Header and Footer|Header|Footer|Strong|Emphasis|(Subtle|Intense) (Emphasis|Reference|Quote)|Book Title|Quote|Macro Text|List( Paragraph)?|Index|Contents \d+|Table Contents|Table Heading|Default.{0,30}|Hyperlink|Balloon Text|Footnote.{0,10}|Endnote.{0,10}|Page Number|Line Number|Placeholder Text)$/;
  const pedacos = (dec) => (dec.match(/[\p{Script=Latin}\p{N}\p{P}\p{Zs}\n\t€$%+=<>|]{6,}/gu) || [])
    .map((t) => t.replace(/(.)\1{4,}/gu, '$1').trim()).filter((t) => t.length >= 6 && /\p{L}{3}/u.test(t) && new Set(t.replace(/\P{L}/gu, '')).size >= 4 && !RUIDO.test(t));
  const u16 = pedacos(new TextDecoder('utf-16le').decode(b.length % 2 ? b.slice(0, -1) : b));
  const l1 = pedacos(new TextDecoder('windows-1252').decode(b));
  const melhor = u16.join('').length > l1.join('').length ? u16 : l1;
  return melhor.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
const pareceTexto = (buf) => {
  const b = new Uint8Array(buf.slice(0, 4096));
  if (!b.length) return false;
  let ruins = 0;
  for (const c of b) if (c === 0 || (c < 9) || (c > 13 && c < 32)) ruins++;
  return ruins / b.length < 0.02;
};
const decodificarTexto = (buf) => {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1252').decode(buf); }
};
const AUDIO = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', webm: 'audio/webm', flac: 'audio/flac', amr: 'audio/amr', caf: 'audio/x-caf' };
const VIDEO = { mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/mp4', webm: 'video/webm', mpeg: 'video/mpeg', mpg: 'video/mpeg' };
async function lerArquivo(f) {
  const nome = (f.name || '').toLowerCase(), tipo = f.type || '', ext = (nome.match(/\.([a-z0-9]+)$/) || [])[1] || '';
  const texto = (t) => { if (!String(t || '').trim()) throw new Error('Esse arquivo está vazio ou não tem texto que eu consiga ler.'); return { tipo: 'text/plain', texto: t }; };
  // Documentos
  if (tipo === 'application/pdf' || ext === 'pdf') return { tipo: 'application/pdf', base64: await base64De(f) };
  if (['docx', 'docm', 'dotx', 'dotm'].includes(ext)) return texto(await textoDoWord(f));
  if (['pptx', 'pptm', 'ppsx', 'potx'].includes(ext)) return texto(await textoDoPowerPoint(f));
  if (['xlsx', 'xlsm', 'xlsb', 'xls', 'ods', 'fods'].includes(ext)) return texto(await textoDoExcel(f));
  if (['odt', 'odp', 'odg'].includes(ext)) return texto(await textoDoOpenDocument(f));
  if (ext === 'numbers') { try { return texto(await textoDoExcel(f)); } catch { return previaApple(f); } }
  if (['pages', 'key'].includes(ext)) return previaApple(f);
  if (ext === 'rtf' || tipo === 'application/rtf') return texto(textoDoRtf(await f.text()));
  if (ext === 'zip' || tipo === 'application/zip') return texto(await textoDoZip(f));
  // Imagens (o iPhone converte HEIC ao abrir)
  if (tipo.startsWith('image/svg') || ext === 'svg') return texto(await f.text());
  if (tipo.startsWith('image/') || ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'avif'].includes(ext)) {
    try { return await imagemReduzida(f); } catch { throw new Error('Não consegui abrir essa imagem. Tire um print dela e mande o print.'); }
  }
  // Áudio e vídeo: o servidor transcreve (até 20 MB)
  if (tipo.startsWith('audio/') || AUDIO[ext]) return { tipo: AUDIO[ext] || tipo, base64: await base64De(f) };
  if (tipo.startsWith('video/') || VIDEO[ext]) return { tipo: VIDEO[ext] || tipo, base64: await base64De(f) };
  // Qualquer outro: se for texto (CSV, TXT, JSON, XML, HTML, e-mail, código…), lê como texto; se for binário, recupera o legível.
  const buf = await f.arrayBuffer();
  if (pareceTexto(buf)) {
    let t = decodificarTexto(buf);
    if (/^\s*<(!doctype html|html)/i.test(t)) t = new DOMParser().parseFromString(t, 'text/html').body?.innerText || t;
    return texto(t);
  }
  const rec = textoDeBinario(buf);
  if (rec.length < 40) throw new Error(`Não consegui tirar texto desse arquivo (.${ext || '?'}). Se puder, exporte em PDF e mande de novo.`);
  return texto(`[Texto recuperado de um arquivo .${ext || 'binário'}; a formatação pode ter se perdido]\n${rec}`);
}

async function enviarDocumento(pergunta) {
  const a = Anexo.atual;
  if (!a?.pronto || a.ocupado) return;
  a.ocupado = true;
  texto.value = ''; texto.dispatchEvent(new Event('input'));
  bolha('eu', `📎 ${a.nome}${pergunta ? `\n${pergunta}` : ''}`, new Date().toISOString());
  const pensando = bolha('ia', a.enviado ? 'Pensando' : /^(audio|video)\//.test(a.tipo) ? 'Ouvindo o arquivo' : 'Lendo o arquivo', null, 'pensando');
  diag('anexo-envio', `${a.tipo} ${a.tamanho}`);
  try {
    const r = await api('/documento', { metodo: 'POST', corpo: {
      nome: a.nome, tipo: a.tipo, base64: a.base64, texto: a.texto, pergunta, id: a.id, primeira: !a.enviado,
    } });
    const { resposta } = r;
    pensando.remove(); bolha('ia', resposta, new Date().toISOString());
    a.enviado = true;
    if (r.texto) { a.texto = r.texto; a.base64 = undefined; a.tipo = 'text/plain'; }
  } catch (err) {
    pensando.remove(); bolha('ia', `Não consegui analisar o arquivo: ${err.message}. Tente de novo.`);
  } finally {
    a.ocupado = false;
    if (Anexo.atual === a) mostrarAnexo();
  }
}

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
  Busca.todos = contatos;
  if ($('#busca-q').value.trim()) buscarContatos($('#busca-q').value); else desenharContatos(contatos);
}
const linhaContato = (c) => `<li><button class="pessoa" data-ir="contato/${esc(c.wa_id)}">${avatar(c, 'grande')}<span class="pessoa-corpo"><span class="t">${esc(nomeDe(c))}${c.muted ? ' · silenciado' : ''}</span><span class="d">${esc([/unknown/i.test(c.empresa || '') ? '' : c.empresa, c.last_summary].filter(Boolean).join(' · ') || (nomeValido(c.name) ? foneBonito(c.wa_id) : ''))}</span></span><span class="h">${c.awaiting_reply ? '<i class="etiqueta">espera</i>' : c.last_seen ? quando(c.last_seen) : ''}</span></button></li>`;
function desenharContatos(lista, vazio = '') {
  $('#lista-contatos').hidden = false;
  $('#lista-contatos').innerHTML = lista.length ? lista.map(linhaContato).join('') : `<li class="busca-vazio">${esc(vazio || 'Nenhum contato.')}</li>`;
}

// ---- Pesquisa de contatos: digitando (filtra na hora e busca no servidor) ou por voz ----
const Busca = { todos: [], timer: 0, seq: 0, gravando: null };
const semAcentoCli = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function filtroLocal(q) {
  const ws = semAcentoCli(q).split(/\s+/).filter(Boolean), dig = q.replace(/\D/g, '');
  return Busca.todos.filter((c) => {
    const alvo = semAcentoCli(`${c.name || ''} ${c.last_summary || ''}`);
    return (dig.length >= 4 && c.wa_id.includes(dig)) || (ws.length && ws.every((w) => alvo.includes(w)));
  });
}
function buscarContatos(texto) {
  const q = texto.trim();
  $('#busca-limpar').hidden = !q;
  clearTimeout(Busca.timer);
  if (!q) { $('#busca-status').hidden = true; desenharContatos(Busca.todos); return; }
  desenharContatos(filtroLocal(q), 'Procurando…');
  const seq = ++Busca.seq;
  Busca.timer = setTimeout(async () => {
    try {
      const { contatos } = await api(`/atendente/contatos?q=${encodeURIComponent(q)}`);
      if (seq !== Busca.seq) return;
      desenharContatos(contatos, `Nada encontrado para "${q}".`);
      $('#busca-status').hidden = false;
      $('#busca-status').textContent = contatos.length ? `${contatos.length} contato${contatos.length > 1 ? 's' : ''} para "${q}"` : '';
      if (contatos.length === 1 && Busca.porVoz) ir(`contato/${contatos[0].wa_id}`);
    } catch (e) { if (seq === Busca.seq) aviso(e.message); }
    finally { Busca.porVoz = false; }
  }, 250);
}
$('#busca-q').addEventListener('input', (e) => buscarContatos(e.target.value));
$('#busca-contatos').addEventListener('submit', (e) => { e.preventDefault(); $('#busca-q').blur(); buscarContatos($('#busca-q').value); });
$('#busca-limpar').addEventListener('click', () => { $('#busca-q').value = ''; buscarContatos(''); $('#busca-q').focus(); });
// Por voz: toque, fale o nome/empresa/número, toque de novo (ou pare de falar) e a busca roda.
const FALA_BUSCA = /^(?:dimy[,\s]+)?(?:me\s+)?(?:(?:procura|pesquisa|busca|acha|encontra|mostra|abre)r?\s+)?(?:(?:o|a|os|as)\s+)?(?:(?:contato|conversa)s?\s+)?(?:(?:do|da|dos|das|de|com(?:\s+[oa])?)\s+)?/i;
async function buscaPorVoz() {
  const b = $('#busca-voz');
  if (Busca.gravando) { Busca.gravando.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { aviso('Este aparelho não grava áudio pelo app.'); return; }
  try { speechSynthesis.cancel(); } catch { /* sem voz */ }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch { aviso('Libere o microfone para o app nos Ajustes do iPhone.'); return; }
  const tipo = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
  const mr = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined), pedacos = [];
  Busca.gravando = mr;
  const inicio = performance.now();
  let ctx, an, raf, falou = false, ultima = 0, base = 0.006;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); await ctx.resume?.(); an = ctx.createAnalyser(); an.fftSize = 1024; ctx.createMediaStreamSource(stream).connect(an); } catch { an = null; }
  const buf = an ? new Float32Array(1024) : null;
  const medir = () => {
    if (mr.state !== 'recording') return;
    const agora = performance.now();
    if (buf) {
      an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; const rms = Math.sqrt(s / buf.length);
      if (agora - inicio < 300) base = Math.max(base, rms * 0.9);
      if (rms > Math.max(0.015, base * 2.5)) { falou = true; ultima = agora; }
      b.style.setProperty('--nivel', Math.min(1, rms / 0.12).toFixed(2));
      if (falou && agora - ultima > 1200) { mr.stop(); return; }
      if (!falou && agora - inicio > 6000) { mr.stop(); return; }
    }
    if (agora - inicio > 12000) { mr.stop(); return; }
    raf = requestAnimationFrame(medir);
  };
  mr.ondataavailable = (ev) => ev.data.size && pedacos.push(ev.data);
  mr.onstop = async () => {
    cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); try { ctx?.close(); } catch { /* ok */ }
    Busca.gravando = null; b.classList.remove('ouvindo'); b.style.removeProperty('--nivel');
    const mime = (mr.mimeType || 'audio/mp4').split(';')[0];
    const audio = new Blob(pedacos, { type: mime });
    if ((buf && !falou) || audio.size < 1500) { $('#busca-q').placeholder = 'Nome, empresa, assunto ou número'; aviso('Não ouvi nada. Toque no microfone e fale o nome.'); return; }
    $('#busca-q').value = ''; $('#busca-q').placeholder = 'Entendendo…'; b.classList.add('pensando');
    try {
      const { texto } = await api('/atendente/transcrever', { metodo: 'POST', corpo: audio, tipo: mime });
      const q = String(texto || '').replace(/[.!?]+$/, '').replace(FALA_BUSCA, '').trim();
      if (!q) { aviso('Não entendi. Toque e fale o nome de novo.'); return; }
      $('#busca-q').value = q; Busca.porVoz = true; buscarContatos(q);
    } catch (e) { aviso(erroAmigavel(e.message)); }
    finally { b.classList.remove('pensando'); $('#busca-q').placeholder = 'Nome, empresa, assunto ou número'; }
  };
  mr.start(250);
  b.classList.add('ouvindo'); $('#busca-q').placeholder = 'Ouvindo… fale o nome';
  if (navigator.vibrate) navigator.vibrate(20);
  medir();
}
$('#busca-voz').addEventListener('click', () => buscaPorVoz().catch((e) => aviso(erroAmigavel(e.message))));

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
  carregarRascunho(wa);
}

// Resposta do agendador que espera aprovação (o Dimy não envia sozinho quando há dúvida ou você está na conversa).
let rascunhoAtual = null;
async function carregarRascunho(wa) {
  const card = $('#contato-rascunho');
  card.hidden = true; rascunhoAtual = null;
  if (eu && !eu.dono) return;
  try {
    const { rascunhos } = await api(`/rascunhos?wa=${encodeURIComponent(wa)}`);
    const r = rascunhos?.[0];
    if (!r || contatoAtual !== wa) return;
    rascunhoAtual = r;
    $('#rascunho-motivo').textContent = r.motivo || '';
    $('#rascunho-texto').textContent = r.texto;
    card.hidden = false;
    card.scrollIntoView({ block: 'start', behavior: 'smooth' });
  } catch { /* sem rascunho */ }
}
async function decidirRascunho(enviar) {
  const r = rascunhoAtual; if (!r) return;
  const b1 = $('#b-rascunho-enviar'), b2 = $('#b-rascunho-descartar');
  b1.disabled = b2.disabled = true;
  try {
    const { mensagem } = await api(`/rascunhos/${r.id}/${enviar ? 'enviar' : 'descartar'}`, { metodo: 'POST', corpo: {} });
    aviso(mensagem);
    $('#contato-rascunho').hidden = true; rascunhoAtual = null;
    if (enviar && contatoAtual) carregarContato(contatoAtual);
  } catch (e) { aviso(e.message); } finally { b1.disabled = b2.disabled = false; }
}
$('#b-rascunho-enviar').addEventListener('click', () => decidirRascunho(true));
$('#b-rascunho-descartar').addEventListener('click', () => decidirRascunho(false));

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
  const tem = !!$('#resposta').value.trim(), direto = podeEnviar();
  // Dentro das 24 h o app envia direto; fora delas o WhatsApp só aceita pelo próprio app (sem modelo aprovado).
  $('#b-enviar-wa').hidden = !direto;
  $('#b-enviar-wa').disabled = !tem;
  $('#b-abrir').hidden = direto;
  $('#b-abrir').classList.toggle('desativado', !tem);
  $('#dica-24h').hidden = direto || !tem;
}
$('#b-enviar-wa').addEventListener('click', async (e) => {
  const texto = $('#resposta').value.trim(); if (!texto) return;
  const b = e.currentTarget; b.disabled = true; b.textContent = 'Enviando…';
  try { const { ok } = await api(`/contatos/${contatoAtual}/responder`, { metodo: 'POST', corpo: { texto } }); aviso(ok || 'Enviado.'); await carregarContato(contatoAtual); }
  catch (err) { aviso(err.message); }
  finally { b.textContent = 'Enviar'; b.disabled = false; linkWhats(); }
});
$('#resposta').addEventListener('input', linkWhats);

$('#b-sugerir').addEventListener('click', async (e) => {
  const b = e.currentTarget; b.disabled = true; b.textContent = 'Escrevendo…';
  try { const { sugestao } = await api(`/contatos/${contatoAtual}/sugerir`, { metodo: 'POST' }); $('#resposta').value = sugestao; linkWhats(); }
  catch (err) { aviso(err.message); }
  finally { b.disabled = false; b.textContent = 'Dimy, responda'; }
});
$('#b-abrir').addEventListener('click', (e) => {
  if (!$('#resposta').value.trim()) { e.preventDefault(); aviso('Escreva a resposta ou toque em "Dimy, responda".'); return; }
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
    ? avisos.map((a) => `<li class="${a.read_at ? '' : 'novo'}" data-ir="${esc(destinoAviso(a))}"><p class="t">${esc(textoAviso(a.title))}</p><p class="d">${leve(textoAviso(a.body))}</p><p class="h">${quando(a.created_at)}</p></li>`).join('')
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
  if (st.dono !== false) { carregarAgendador().catch(() => {}); carregarAtendente().catch(() => {}); }
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
  carregarContas().finally(rota);
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

// Criar a senha (link de convite ou de nova senha). Grava pelo servidor (/equipe/senha), não pela biblioteca de login:
// no iPhone ela chegou a travar nesse passo depois do link, e o botão ficava parado sem enviar nada.
$('#form-senha').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget, erro = form.querySelector('[data-erro]'), bt = form.querySelector('button[type=submit]');
  if (bt.disabled) return;
  const a = $('#nova-senha').value, b = $('#nova-senha2').value;
  erro.textContent = '';
  if (a.length < 8) { erro.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; return; }
  if (a !== b) { erro.textContent = 'As duas senhas não estão iguais.'; return; }
  if (!sessao) { mostrarEntrar('login', 'Este link expirou. Peça um novo ao administrador.'); return; }
  bt.disabled = true; bt.textContent = 'Salvando…';
  try {
    await api('/equipe/senha', { metodo: 'POST', corpo: { senha: a } });
    $('#nova-senha').value = ''; $('#nova-senha2').value = '';
    await carregarEu();
    aviso('Senha criada. Bem-vindo!');
    iniciar();
  } catch (err) {
    erro.textContent = /expirada/i.test(err.message) ? 'Este link expirou. Peça um novo ao administrador.' : err.message;
  } finally { bt.disabled = false; bt.textContent = 'Salvar e entrar'; }
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

// ---- Atendimento automático por IA no WhatsApp (só o dono) ----
function mostrarAtendente({ config: c, ultimas }) {
  if (!c) return;
  $('#atendente-sec').hidden = false;
  $('#at-ativo').checked = c.ativo;
  const sel = (id, v) => { const el = $(id); if (![...el.options].some((o) => o.value === String(v))) el.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`); el.value = String(v); };
  sel('#at-espera', c.espera_min); sel('#at-max', c.max_auto_6h);
  if (document.activeElement !== $('#at-conhecimento')) $('#at-conhecimento').value = c.conhecimento || '';
  $('#at-lista').innerHTML = ultimas?.length
    ? `<li class="ag-tit">Últimas respostas</li>` + ultimas.map((u) => `<li><b>${esc(u.nome || '+' + u.wa_id)} · ${u.resultado === 'enviado' ? 'respondi' : 'rascunho para você'}</b>
        <span>${quando(u.created_at)}${u.texto ? ` · ${esc(u.texto.slice(0, 140))}${u.texto.length > 140 ? '…' : ''}` : ''}</span></li>`).join('')
    : '';
}
async function carregarAtendente() { mostrarAtendente(await api('/atendente/config')); }
async function salvarAtendente(campos, msg = 'Atendimento atualizado.') {
  try { mostrarAtendente(await api('/atendente/config', { metodo: 'POST', corpo: campos })); aviso(msg); }
  catch (e) { aviso(e.message); carregarAtendente().catch(() => {}); }
}
$('#at-ativo').addEventListener('change', (e) => salvarAtendente({ ativo: e.target.checked }, e.target.checked ? 'Atendimento automático ligado.' : 'Atendimento automático desligado.'));
$('#at-espera').addEventListener('change', (e) => salvarAtendente({ espera_min: Number(e.target.value) }));
$('#at-max').addEventListener('change', (e) => salvarAtendente({ max_auto_6h: Number(e.target.value) }));
$('#b-at-salvar').addEventListener('click', () => salvarAtendente({ conhecimento: $('#at-conhecimento').value }, 'Base de conhecimento salva.'));

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
  sessao = await sessaoAtual();
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
    // Toque duplo rápido ou microfone mudo: nem envia, explica o que fazer.
    if (performance.now() - VozO.inicio < 700 || audio.size < 800) {
      marcarVoz(''); aviso('Segure um pouco: toque no microfone, fale o nome da empresa e toque de novo.'); return;
    }
    VozO.enviando = true; marcarVoz('enviando');
    try {
      const r = await api('/dossies/voz', { metodo: 'POST', corpo: audio, tipo: mime });
      aviso(`Pesquisando: ${r.alvo}`);
      ir(`dossie/${r.id}`);
    } catch (err) {
      // Mensagens do servidor já vêm em português; falha de rede vira algo compreensível.
      const tecnico = /load failed|failed to fetch|networkerror|network request|^erro \d+$/i.test(err.message || '');
      aviso(tecnico ? 'Sem conexão para enviar o áudio. Confira a internet e tente de novo.' : err.message);
      diag('oraculo-voz-falhou', String(err.message || ''));
    }
    finally { VozO.enviando = false; marcarVoz(''); }
  };
  VozO.mr.start();
  VozO.inicio = performance.now();
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
// Exportar: PDF e CSV do Oráculo (dossiê e empresas por perto) e envio por e-mail ou WhatsApp.
// Os serviços (PDF, CSV, telefone, e-mail, compartilhar) ficam em exportar.js, carregado na primeira exportação;
// aqui ficam só a orquestração e as telas. Os dados são copiados no toque: o arquivo sai exatamente com o que estava na tela.
// ---------------------------------------------------------------------------
const IC_PDF = '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6V3Z"/><path d="M15 3v4h4M9 13h6M9 17h4"/></svg>';
const IC_CSV = '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/></svg>';
const IC_MAIL = '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
const JSPDF = { url: './vendor/jspdf-4.2.1.umd.min.js', sri: 'sha384-qovJwSBbRDPP5cEjCp8S0UP66wrvnjaa60XMOGzTNanrThcrGfXfnZkvgY8N1KT3' };
let modExp = null;
const Xp = () => (modExp ??= import(`./exportar.js?${VERSAO}`).catch((e) => { modExp = null; throw Object.assign(new Error('Não consegui abrir a exportação. Confira a internet e tente de novo.'), { codigo: 'modulo', causa: e }); }));
const Exp = { ocupado: false, rascunho: {} };
function blocoExportar(alvo, titulo = 'Exportar e enviar') {
  return `<div class="exportar"><p>${titulo}</p><div class="exp-botoes">
    <button class="exp-btn pdf" data-exp="pdf" data-exp-alvo="${alvo}">${IC_PDF}PDF</button>
    <button class="exp-btn csv" data-exp="csv" data-exp-alvo="${alvo}">${IC_CSV}CSV</button>
    <button class="exp-btn email" data-exp="email" data-exp-alvo="${alvo}">${IC_MAIL}E-mail</button>
    <button class="exp-btn wa" data-exp="whatsapp" data-exp-alvo="${alvo}">${IC_WHATS}WhatsApp</button></div></div>`;
}

// Dossiê → PDF / CSV
async function pdfDossie(d, X, jsPDF) {
  const x = d.dossie || {}, c = d.cadastro && !d.cadastro.nao_encontrado ? d.cadastro : null, f = x.financeiro || {}, ab = x.abordagem || {}, e = x.empresa || {}, m = x.mercado || {};
  const pdf = X.criarDocumento(jsPDF, { titulo: `Oráculo · ${d.nome || d.alvo}`, subtitulo: [d.cnpj ? `CNPJ ${fmtCnpj(d.cnpj)}` : '', c?.municipio ? `${c.municipio}/${c.uf}` : ''].filter(Boolean).join(' · ') });
  pdf.secao(`${(RISCO[d.risco] || RISCO.indefinido).t}`); pdf.p(f.resumo);
  pdf.secao('Resumo'); pdf.p(x.resumo);
  if (c) { pdf.secao('Cadastro (Receita Federal)'); await pdf.tabela([{ titulo: 'Campo', peso: 1 }, { titulo: 'Valor', peso: 3 }], [['Situação', c.situacao], ['Abertura', fmtData(c.abertura)], ['Porte', c.porte], ['Simples', c.simples == null ? '-' : c.simples ? (c.mei ? 'MEI' : 'Sim') : 'Não'], ['Capital social', fmtReais(c.capital_social)], ['Atividade', c.cnae_fiscal_descricao], ['Telefone', c.telefone], ['Endereço', [c.logradouro, c.numero, c.bairro, c.municipio && `${c.municipio}/${c.uf}`].filter(Boolean).join(', ')]].filter(([, v]) => v)); }
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
  return pdf.finalizar();
}
function csvDossie(d, X) {
  const x = d.dossie || {}, c = d.cadastro && !d.cadastro.nao_encontrado ? d.cadastro : null, f = x.financeiro || {}, ab = x.abordagem || {}, e = x.empresa || {}, m = x.mercado || {};
  const L = [['Empresa', 'Nome', d.nome || d.alvo], ['Empresa', 'CNPJ', d.cnpj ? fmtCnpj(d.cnpj) : ''], ['Empresa', 'Cidade', c?.municipio ? `${c.municipio}/${c.uf}` : ''],
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
  return X.gerarCsv(['Seção', 'Campo', 'Valor'], L.filter((l) => l[2]));
}

// Pacote de exportação: cópia dos dados no momento do toque + geração de cada arquivo uma única vez (reaproveitada no envio).
async function pacoteExport(alvo) {
  const X = await Xp();
  let base, assunto, texto, resumo, gerarPdf, gerarCsv;
  if (alvo === 'dossie') {
    if (!Oraculo.atual) throw new X.ErroExportacao('vazio', 'Abra um dossiê primeiro.');
    const d = structuredClone(Oraculo.atual), nome = d.nome || d.alvo;
    base = `oraculo-${nome}`; assunto = `Oráculo · ${nome}`; resumo = `Dossiê de ${nome}`;
    texto = `Segue o dossiê do Oráculo sobre ${nome}.${d.dossie?.resumo ? `\n\n${d.dossie.resumo}` : ''}`;
    gerarPdf = async () => pdfDossie(d, X, await X.carregarJsPDF(JSPDF.url, JSPDF.sri));
    gerarCsv = () => csvDossie(d, X);
  } else {
    const empresas = X.prepararEmpresas(Geo.empresas), onde = { ...(Geo.ultimo?.local || {}) }, seg = Geo.segmento || '';
    const lugar = onde.bairro || onde.cidade || 'você', n = empresas.length, plural = `${n} empresa${n === 1 ? '' : 's'}`;
    base = `empresas-perto-${onde.bairro || onde.cidade || 'aqui'}${seg ? `-${seg}` : ''}`;
    assunto = `Empresas perto de ${lugar === 'você' ? 'mim' : lugar}${seg ? ` (${seg})` : ''}`; resumo = `${plural}${seg ? ` de ${seg}` : ''}`;
    texto = `Segue a lista de ${plural}${seg ? ` de ${seg}` : ''} perto de ${onde.endereco || lugar}.`;
    gerarPdf = async () => X.pdfEmpresas(await X.carregarJsPDF(JSPDF.url, JSPDF.sri), empresas, { titulo: `Empresas perto de ${lugar}${seg ? ` · ${seg}` : ''}`, subtitulo: onde.endereco });
    gerarCsv = () => X.csvEmpresas(empresas);
  }
  const prontos = {};
  const arquivo = (tipo) => (prontos[tipo] ??= (async () => {
    const dados = tipo === 'pdf' ? await gerarPdf() : gerarCsv();
    const f = new File([dados], X.nomeArquivo(base, tipo), { type: tipo === 'pdf' ? 'application/pdf' : X.TIPO_CSV });
    if (!f.size) throw new X.ErroExportacao('geracao', `O ${tipo.toUpperCase()} saiu vazio. Tente de novo.`);
    return f;
  })().catch((e) => { delete prontos[tipo]; throw e; }));
  return { X, alvo, base, assunto, texto, resumo, arquivo };
}
const paraBase64 = (blob) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => erro(new Error('Não consegui ler o arquivo gerado.')); r.readAsDataURL(blob); });
const cartaoArquivo = (X, f, resumo) => `<div class="arq-cartao"><span class="arq-ic ${/pdf$/.test(f.name) ? 'pdf' : 'csv'}">${/pdf$/.test(f.name) ? IC_PDF : IC_CSV}</span><span class="pessoa-corpo"><span class="t">${esc(f.name)}</span><span class="d">${esc(resumo)} · ${X.tamanhoLegivel(f.size)}</span></span></div>`;
// Erro de exportação: mensagem legível + registro técnico curto (sem dados das empresas).
function falhaExport(onde, err, X) {
  const e = X ? X.erroDeEnvio(err) : err;
  const tec = String(err?.causa?.message || err?.message || '').replace(/\+?\d[\d\s().-]{6,}\d/g, '<número>').replace(/\S+@\S+/g, '<e-mail>').replace(/"[^"]*"/g, '"…"').replace(/^.{0,60}? (não escreve|nunca escreveu)/, '<contato> $1');
  diag(`exportar-${onde}`, `${e.codigo || ''} ${tec.slice(0, 160)}`);
  return e;
}

// Arquivo pronto: compartilhar pela folha nativa (iPhone: Share Sheet → WhatsApp, Mail, Arquivos…) ou baixar.
// O toque em "Compartilhar" é novo (o iOS exige), por isso o arquivo é gerado antes e só depois esta folha aparece.
function folhaArquivoPronto(pk, f) {
  const X = pk.X, url = URL.createObjectURL(f), podeComp = X.podeCompartilharArquivos(navigator, [f]);
  folhaFechou = () => setTimeout(() => URL.revokeObjectURL(url), 60000);
  abrirFolha({
    titulo: /pdf$/.test(f.name) ? 'PDF pronto' : 'Planilha pronta', botao: podeComp ? 'Compartilhar' : 'Baixar', ocupado: 'Abrindo…',
    campos: [{ tipo: 'html', html: `${cartaoArquivo(X, f, pk.resumo)}
      <p class="campo-dica">${podeComp ? 'Escolha WhatsApp, Mail, Arquivos ou outro app. Se preferir, ' : 'Este aparelho não compartilha arquivos daqui. '}<a class="link" href="${url}" download="${esc(f.name)}" data-baixar>baixe o arquivo</a>.</p>` }],
    salvar: async () => {
      if (!podeComp) { $('#folha [data-baixar]').click(); return; }
      const r = await X.compartilharArquivos(navigator, { arquivos: [f], titulo: f.name });
      if (r === 'cancelado') throw Object.assign(new Error('Compartilhamento cancelado. Toque de novo quando quiser.'), { neutro: true });
      aviso('Arquivo entregue ao app escolhido.');
    },
  });
}

// E-mail: sai do seu Gmail (servidor), com PDF e/ou CSV anexados. Só diz "enviado" quando o Gmail confirma.
function folhaEmail(pk) {
  const X = pk.X, r = (Exp.rascunho[`email-${pk.alvo}`] ??= { para: guardado.ler('cerebro-ultimo-email') || '', pdf: true, csv: true, texto: pk.texto });
  abrirFolha({
    titulo: 'Enviar por e-mail', botao: 'Enviar e-mail', ocupado: 'Enviando…',
    campos: [
      { rotulo: 'E-mail de quem recebe', nome: 'para', tipoInput: 'email', valor: r.para, placeholder: 'nome@empresa.com.br' },
      { tipo: 'marcas', rotulo: 'Anexar', opcoes: [{ nome: 'pdf', texto: 'PDF', marcado: r.pdf }, { nome: 'csv', texto: 'CSV (planilha)', marcado: r.csv }] },
      { tipo: 'html', html: `<p class="campo-dica">Assunto: <b>${esc(pk.assunto)}</b> · ${esc(pk.resumo)}. Sai do seu Gmail.</p>` },
      { rotulo: 'Mensagem', nome: 'texto', tipoInput: 'textarea', linhas: 4, valor: r.texto },
    ],
    aoAbrir: (form) => form.addEventListener('input', () => Object.assign(r, { para: form.para.value, pdf: form.pdf.checked, csv: form.csv.checked, texto: form.texto.value })),
    salvar: async (f) => {
      const em = X.validarEmail(f.para);
      if (!em.ok) throw new Error(em.erro);
      if (!f.pdf && !f.csv) throw new Error('Marque PDF, CSV ou os dois.');
      const arquivos = [];
      try {
        for (const t of ['pdf', 'csv'].filter((t) => f[t])) { progressoFolha(`Gerando ${t.toUpperCase()}…`); const a = await pk.arquivo(t); arquivos.push({ nome: a.name, tipo: t === 'pdf' ? 'application/pdf' : 'text/csv', base64: await paraBase64(a) }); }
        progressoFolha('Enviando…');
        const res = await api('/exportar', { metodo: 'POST', corpo: { canal: 'email', para: em.email, assunto: pk.assunto, texto: f.texto, arquivos } });
        if (!res?.enviado) throw new X.ErroExportacao('envio', 'O servidor não confirmou o envio. Confira na pasta Enviados do Gmail antes de repetir.');
        guardado.gravar('cerebro-ultimo-email', em.email);
        aviso(res.mensagem || `E-mail enviado para ${em.email}.`);
      } catch (err) { throw falhaExport('email', err, X); }
    },
  });
}

// WhatsApp, dois caminhos com regras diferentes (não se misturam):
//  • Pelo meu celular: abre a conversa pelo link oficial wa.me (qualquer número, salvo ou não; só texto) e manda o arquivo pela
//    folha nativa do iPhone (o link do WhatsApp não carrega arquivo). Nada é "enviado" pelo app: quem envia é você, no WhatsApp.
//  • Pelo número comercial: o servidor envia pela API oficial (YCloud/Meta). A Meta só deixa mandar arquivo a quem escreveu
//    nas últimas 24 h; fora disso exige modelo aprovado — o app avisa e não tenta contornar.
function folhaWhatsApp(pk) {
  const X = pk.X, r = (Exp.rascunho[`wa-${pk.alvo}`] ??= { modo: guardado.ler('cerebro-wa-modo') || 'celular', para: '', nome: '', pdf: true, csv: false, texto: pk.texto, conversaAberta: '' });
  const DICA = {
    celular: 'Sai do WhatsApp do seu iPhone. O número não precisa estar salvo. 1º abre a conversa com a mensagem; 2º você manda o arquivo.',
    comercial: 'Sai direto do número comercial, com o arquivo anexado. A Meta só permite para quem te escreveu nas últimas 24 h.',
  };
  let form, campo;
  const modo = () => form?.modo?.value || r.modo;
  const ajustar = () => {
    const dig = form.para.value || (X.normalizarTelefone(form.busca_para?.value || '').digitos ?? ''), m = modo(), temNum = !!dig, aberta = m === 'celular' && temNum && r.conversaAberta === dig;
    $('#wa-dica').textContent = DICA[m];
    if (m === 'comercial') botaoFolha('Enviar agora', 'Enviando…');
    else if (temNum && !aberta) botaoFolha('1. Abrir conversa no WhatsApp', 'Abrindo…');
    else botaoFolha(temNum ? '2. Mandar o arquivo' : 'Compartilhar no WhatsApp', 'Abrindo…');
    $('#wa-etapas').hidden = !(m === 'celular' && temNum);
    $('#wa-etapas').innerHTML = `<li class="${aberta ? 'feito' : 'atual'}">Abrir a conversa com a mensagem pronta</li><li class="${aberta ? 'atual' : ''}">Mandar o arquivo: escolha WhatsApp e a conversa</li>`;
    campo?.redesenhar?.();
    Object.assign(r, { modo: m, para: form.para.value, nome: form.para.dataset.nomeEscolhido || '', pdf: form.pdf.checked, csv: form.csv.checked, texto: form.texto.value });
    guardado.gravar('cerebro-wa-modo', m);
    if (m === 'celular') arquivosEscolhidos().catch(() => {});   // já deixa os arquivos prontos para o toque de compartilhar
  };
  const arquivosEscolhidos = () => Promise.all(['pdf', 'csv'].filter((t) => form[t].checked).map((t) => pk.arquivo(t)));
  abrirFolha({
    titulo: 'Enviar no WhatsApp', botao: 'Compartilhar no WhatsApp',
    campos: [
      { tipo: 'escolha', nome: 'modo', rotulo: 'Enviar', classe: 'duas', opcoes: [{ valor: 'celular', texto: 'Pelo meu celular', marcado: r.modo === 'celular' }, { valor: 'comercial', texto: 'Pelo número comercial', marcado: r.modo === 'comercial' }] },
      { tipo: 'html', html: '<p class="campo-dica" id="wa-dica"></p>' },
      { tipo: 'contato', rotulo: 'Para quem', nome: 'para', valor: r.para, nomeValor: r.nome },
      { tipo: 'marcas', rotulo: 'Arquivo', opcoes: [{ nome: 'pdf', texto: 'PDF', marcado: r.pdf }, { nome: 'csv', texto: 'CSV (planilha)', marcado: r.csv }] },
      { tipo: 'html', html: `<p class="campo-dica">${esc(pk.resumo)} · ${esc(X.nomeArquivo(pk.base, 'pdf').replace(/\.pdf$/, ''))}</p>` },
      { rotulo: 'Mensagem', nome: 'texto', tipoInput: 'textarea', linhas: 3, valor: r.texto },
      { tipo: 'html', html: '<ol class="wa-etapas" id="wa-etapas" hidden></ol>' },
    ],
    aoAbrir: (f) => {
      form = f; campo = f.querySelector('[data-campo-contato]');
      montarEscolhaContato(campo, X, { janela: () => modo() === 'comercial', aoMudar: () => form && ajustar() });
      // só rádios e caixas: o "change" do campo de busca chega ao tocar num contato e redesenhar ali engoliria o toque
      f.addEventListener('change', (e) => { if (e.target.matches('input[type=radio], input[type=checkbox]')) ajustar(); }); f.texto.addEventListener('input', () => { r.texto = f.texto.value; });
      f.busca_para.addEventListener('input', () => { const m = modo(); if (m === 'celular') ajustar(); });
      ajustar();
    },
    salvar: async (f) => {
      if (!f.pdf && !f.csv) throw new Error('Marque PDF, CSV ou os dois.');
      const digitado = (f.busca_para || '').trim();
      if (!f.para && digitado && !X.pareceTelefone(digitado)) throw new Error('Toque no contato na lista para escolher.');
      const bruto = f.para || digitado, para = bruto ? X.normalizarTelefone(bruto) : null;
      if (para && !para.ok) throw new Error(para.erro);
      if (f.modo === 'comercial') {
        if (!para) throw new Error('Escolha o contato ou digite o número com DDD.');
        try {
          const arquivos = [];
          for (const t of ['pdf', 'csv'].filter((t) => f[t])) { progressoFolha(`Gerando ${t.toUpperCase()}…`); const a = await pk.arquivo(t); arquivos.push({ nome: a.name, tipo: t === 'pdf' ? 'application/pdf' : 'text/csv', base64: await paraBase64(a) }); }
          progressoFolha('Enviando…');
          const res = await api('/exportar', { metodo: 'POST', corpo: { canal: 'whatsapp', para: para.digitos, assunto: pk.assunto, texto: f.texto, arquivos } });
          if (!res?.enviado) throw new X.ErroExportacao('envio', 'O servidor não confirmou o envio. Confira a conversa antes de repetir.');
          aviso(res.mensagem || 'Enviado no WhatsApp.');
          return;
        } catch (err) { throw falhaExport('whatsapp', err, X); }
      }
      // Pelo meu celular — etapa 1: abrir a conversa (link oficial, dentro do toque para o iPhone não bloquear).
      if (para && r.conversaAberta !== para.digitos) {
        const a = document.createElement('a'); a.href = X.linkWhatsApp(para.digitos, f.texto); a.target = '_blank'; a.rel = 'noopener';
        document.body.append(a); a.click(); a.remove();
        r.conversaAberta = para.digitos; ajustar();
        throw Object.assign(new Error('Conversa aberta no WhatsApp com a mensagem pronta (confira e toque em enviar lá). Volte aqui e toque em "2. Mandar o arquivo".'), { neutro: true });
      }
      // Etapa 2 (ou direto, sem número): folha nativa com o arquivo; no WhatsApp, você escolhe a conversa.
      let arquivos;
      try { arquivos = await arquivosEscolhidos(); } catch (err) { throw falhaExport('arquivo', err, X); }
      try {
        const res = await X.compartilharArquivos(navigator, { arquivos, texto: para ? '' : f.texto, titulo: pk.assunto });
        if (res === 'cancelado') throw Object.assign(new Error('Compartilhamento cancelado. Os dados continuam aqui: toque de novo quando quiser.'), { neutro: true });
      } catch (err) {
        if (err.neutro) throw err;
        if (err.codigo === 'sem_compartilhar') throw new Error('Este aparelho não deixa compartilhar arquivos daqui. Feche e use o botão PDF ou CSV para baixar o arquivo.');
        throw falhaExport('compartilhar', err, X);
      }
      Exp.rascunho[`wa-${pk.alvo}`] = null;
      aviso('Arquivo entregue ao WhatsApp. Confira lá se a mensagem foi enviada.');
    },
  });
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-exp]'); if (!b) return;
  if (Exp.ocupado) return;                       // um toque por vez
  const alvo = b.dataset.expAlvo, acao = b.dataset.exp, t = b.innerHTML;
  Exp.ocupado = true; b.disabled = true; b.classList.add('ocupado');
  let X = null;
  try {
    const pk = await pacoteExport(alvo); X = pk.X;
    if (acao === 'pdf' || acao === 'csv') { b.textContent = 'Gerando…'; folhaArquivoPronto(pk, await pk.arquivo(acao)); }
    else if (acao === 'email') folhaEmail(pk);
    else folhaWhatsApp(pk);
  } catch (err) {
    const er = falhaExport(acao, err, X);
    aviso(acao === 'pdf' || acao === 'csv' ? `Não consegui gerar o ${acao.toUpperCase()}. ${er.message}` : er.message);
  } finally { Exp.ocupado = false; b.disabled = false; b.classList.remove('ocupado'); b.innerHTML = t; }
});

// ---------------------------------------------------------------------------
// Radar: o Dimy conectado à internet (notícias, mercado, aprendizado)
// ---------------------------------------------------------------------------
const Radar = { timer: null };
// Mapa neural do Dimy: núcleo luminoso, axônios curvos até cada fonte, dendritos e impulsos de luz correndo pelas conexões.
// Malha de fundo com semente fixa (sempre o mesmo desenho); animação só por SVG/CSS e desligada com "reduzir movimento".
function desenharMapa() {
  const W = 360, H = 250, cx = 180, cy = 124;
  let semente = 7;
  const rnd = () => { semente = (semente * 16807) % 2147483647; return (semente - 1) / 2147483646; };
  const fontes = [
    ['Notícias', 56, 46, 'web'], ['Mercado', 304, 46, 'web'], ['Concorrentes', 42, 120, 'web'], ['Regulação', 318, 120, 'web'],
    ['Memória', 66, 190, 'voce'], ['WhatsApp', 138, 210, 'voce'], ['Agenda', 222, 210, 'voce'], ['Oráculo', 294, 190, 'voce'],
  ];
  // malha de fundo: neurônios pequenos ligados aos vizinhos mais próximos
  const pts = Array.from({ length: 46 }, () => [8 + rnd() * (W - 16), 10 + rnd() * (H - 20)]).filter(([x, y]) => Math.hypot(x - cx, y - cy) > 40);
  const malha = [];
  pts.forEach(([x, y], a) => {
    pts.map(([u, v], b) => [Math.hypot(u - x, v - y), b]).filter(([d, b]) => b > a && d < 58).sort((m, n) => m[0] - n[0]).slice(0, 2)
      .forEach(([, b]) => malha.push(`M${x.toFixed(1)} ${y.toFixed(1)}L${pts[b][0].toFixed(1)} ${pts[b][1].toFixed(1)}`));
  });
  // axônio curvo do núcleo até a fonte (controle deslocado na perpendicular)
  const axonio = (x, y, k) => {
    const mx = (cx + x) / 2, my = (cy + y) / 2, dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy) || 1, curva = (k % 2 ? 1 : -1) * 18;
    return `M${cx} ${cy}Q${(mx - (dy / L) * curva).toFixed(1)} ${(my + (dx / L) * curva).toFixed(1)} ${x} ${y}`;
  };
  const dendritos = (x, y) => Array.from({ length: 3 }, (_, i) => {
    const ang = Math.atan2(y - cy, x - cx) + (i - 1) * 0.75 + (rnd() - 0.5) * 0.3, r = 10 + rnd() * 7;
    const ex = x + Math.cos(ang) * r, ey = y + Math.sin(ang) * r;
    return `<path d="M${x} ${y}Q${(x + Math.cos(ang + 0.4) * r * 0.6).toFixed(1)} ${(y + Math.sin(ang + 0.4) * r * 0.6).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}"/><circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="1.3"/>`;
  }).join('');
  const caminhos = fontes.map(([, x, y], k) => `<path id="ax${k}" d="${axonio(x, y, k)}"/>`).join('');
  const sinais = fontes.map(([, , , g], k) => {
    const dur = (2.4 + (k % 3) * 0.45).toFixed(2), ini = (k * 0.37).toFixed(2);
    const ida = `<circle r="2.6" class="sinal ${g}"><animateMotion dur="${dur}s" begin="${ini}s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear"><mpath href="#ax${k}"/></animateMotion></circle>`;
    const volta = g === 'voce' ? `<circle r="2" class="sinal volta"><animateMotion dur="${(+dur + 0.8).toFixed(2)}s" begin="${(+ini + 1.2).toFixed(2)}s" repeatCount="indefinite"><mpath href="#ax${k}"/></animateMotion></circle>` : '';
    return ida + volta;
  }).join('');
  const nos = fontes.map(([t, x, y, g], k) => `<g class="neuronio ${g}" style="--d:${(k * 0.29).toFixed(2)}s">
      <g class="dend">${dendritos(x, y)}</g>
      <circle class="halo" cx="${x}" cy="${y}" r="11"/><circle class="soma" cx="${x}" cy="${y}" r="5.2"/>
      <text x="${Math.min(W - 40, Math.max(40, x))}" y="${y + (y > cy ? 19 : -12)}" text-anchor="middle">${t}</text></g>`).join('');
  $('#radar-mapa').innerHTML = `
    <defs>
      <radialGradient id="nucleo" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#E6FFFB"/><stop offset=".35" stop-color="#5EEAD4"/><stop offset=".75" stop-color="#0E9384"/><stop offset="1" stop-color="#075E57"/></radialGradient>
      <radialGradient id="aura"><stop offset="0" stop-color="#2DD4BF" stop-opacity=".55"/><stop offset="1" stop-color="#2DD4BF" stop-opacity="0"/></radialGradient>
      <filter id="brilho" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <path class="malha" d="${malha.join('')}"/>
    <g class="malha-nos">${pts.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.8 + (i % 3) * 0.45).toFixed(2)}" style="--d:${((i * 0.53) % 4).toFixed(2)}s"/>`).join('')}</g>
    <text class="legenda" x="${cx}" y="16" text-anchor="middle">INTERNET</text><text class="legenda" x="${cx}" y="245" text-anchor="middle">VOCÊ</text>
    <g class="axonios">${caminhos}</g>
    <g filter="url(#brilho)">${sinais}</g>
    ${nos}
    <g class="nucleo">
      <circle cx="${cx}" cy="${cy}" r="58" fill="url(#aura)" class="aura"/>
      <circle cx="${cx}" cy="${cy}" r="30" class="onda"/><circle cx="${cx}" cy="${cy}" r="30" class="onda o2"/>
      <circle cx="${cx}" cy="${cy}" r="31" class="orbita"/>
      <circle cx="${cx}" cy="${cy}" r="27" fill="url(#nucleo)" filter="url(#brilho)"/>
      <path class="sulcos" d="M${cx - 15} ${cy - 6}q6-10 15-5q9-6 15 4M${cx - 17} ${cy + 5}q8 6 16 0q9 6 17-1M${cx} ${cy - 11}v22"/>
      <text x="${cx}" y="${cy + 4.5}" text-anchor="middle">Dimy</text>
    </g>`;
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
  if (e.status === 'erro') {
    const credito = SEM_CREDITO.test(e.erro || '');
    box.innerHTML = credito
      ? `<div class="processando aviso-credito"><p><b>A leitura de hoje está esperando crédito de IA.</b></p><p class="dica">A conta da Anthropic, que o Dimy usa para pesquisar e pensar, ficou sem saldo. Recarregue em <b>console.anthropic.com › Plans &amp; Billing</b>. Depois disso, o Radar é refeito sozinho em até 30 minutos (das 7h às 20h) e as mensagens que chegaram enquanto isso entram na memória, sem perder nada.</p>${botoes}</div>`
      : `<div class="processando"><p><b>A última leitura falhou.</b></p><p class="dica">${esc(erroAmigavelTexto(e.erro))}</p>${botoes}</div>`;
    return;
  }
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
// Versão nova publicada: o iPhone mantém o app vivo por dias e, ao voltar, continuava rodando o código antigo (foi o que manteve
// o erro do PDF na tela depois da correção). Ao voltar para o app, confere a versão no servidor e recarrega se mudou —
// só quando não há nada em andamento (folha aberta, gravação, digitação, exportação).
async function verificarVersao() {
  try {
    const t = await (await fetch(`./sw.js?c=${Date.now()}`, { cache: 'no-store' })).text();
    const nova = +(t.match(/cerebro-v(\d+)/)?.[1] || 0), atual = +VERSAO.replace(/\D/g, '');
    if (!(nova > atual)) return;
    if (!$('#folha').hidden || Exp.ocupado || (typeof Rec !== 'undefined' && Rec.ativo) || document.activeElement?.matches?.('input, textarea')) return;
    diag('atualizou', `${VERSAO} -> v${nova}`);
    const reg = await navigator.serviceWorker?.getRegistration?.();
    await reg?.update?.().catch(() => {});
    location.reload();
  } catch { /* sem rede: tenta na próxima volta */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) verificarVersao(); });
setTimeout(verificarVersao, 4000);
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
  catch (e) { diag('voz-erro', e?.message || String(e)); vozUI('erro', erroAmigavel(e?.message)); Voz.estado = 'parado'; }
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
  let falava = false;
  try { falava = speechSynthesis.speaking; speechSynthesis.cancel(); } catch { /* sem voz */ }
  // iPhone: gravar enquanto a voz ainda está saindo corrompe o áudio; espera a sessão de som trocar.
  if (falava) await new Promise((r) => setTimeout(r, 400));
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
  } catch (e) { diag('voz-envio', e.message); vozUI('erro', erroAmigavel(e.message)); }
}

/** Nunca mostra erro técnico (JSON, código HTTP, nome de serviço) na tela. */
// Falta de crédito da IA: explica em português, sem JSON técnico.
const SEM_CREDITO = /credit balance|purchase credits|insufficient.{0,20}(credit|quota)/i;
const MSG_SEM_CREDITO = 'O Dimy está sem crédito de IA (conta da Anthropic). Recarregue em console.anthropic.com › Plans & Billing; o que chegou enquanto isso não se perde e é processado sozinho depois.';
function erroAmigavel(m) {
  const t = String(m || '');
  if (SEM_CREDITO.test(t)) return MSG_SEM_CREDITO;
  if (!t || /whisper|openai|invalid|format|\{|\d{3}:|error|failed|exception/i.test(t)) {
    return /load failed|network|fetch|conex/i.test(t) ? 'Sem conexão. Confira a internet e toque de novo.' : 'Não consegui entender o áudio. Toque e fale de novo.';
  }
  return t;
}

// Erro técnico genérico (sem JSON na tela).
function erroAmigavelTexto(t) {
  t = String(t || '');
  if (SEM_CREDITO.test(t)) return MSG_SEM_CREDITO;
  if (/\{|"type"|\b\d{3}:/.test(t)) return 'Um serviço externo não respondeu. Toque em Atualizar agora para tentar de novo.';
  return t || 'Erro desconhecido.';
}

async function comandoTexto(texto) {
  if (Voz.estado === 'ouvindo') pararEscuta(false);
  abrirVoz();
  vozUI('pensando', 'Entendendo…');
  try {
    const r = await api('/chat', { metodo: 'POST', corpo: { texto, voz: true, id: `voz-${Date.now()}` } });
    await mostrarRespostaVoz(texto, r.resposta, r.acoes || []);
  } catch (e) { vozUI('erro', erroAmigavel(e.message)); }
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
    else if (a.ferramenta === 'olho_consultar' && !destino) destino = { ir: d.empresa_id ? `olho/empresa/${d.empresa_id}` : 'olho', rotulo: 'Abrir Olho de Deus', auto: false };
    else if (/^tarefa/.test(a.ferramenta) && !destino) { if (d.dia) TF.dia = d.dia; if (location.hash === '#tarefas') carregarTarefas().catch(() => {}); destino = { ir: 'tarefas', rotulo: 'Ver tarefas', auto: false }; }
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
document.addEventListener('visibilitychange', () => {
  if (document.hidden && Voz.estado === 'ouvindo') pararEscuta(false);
  // Voltou ao app com um comando "pensando" há muito tempo (o iPhone corta a conexão em segundo plano): libera o botão.
  if (!document.hidden && Voz.estado === 'pensando' && Date.now() - (Voz.desde || 0) > 90000) {
    diag('voz-preso', `${Math.round((Date.now() - Voz.desde) / 1000)}s`);
    vozUI('parado', 'A resposta não chegou (o app ficou em segundo plano). Toque e fale de novo.');
  }
});


// ---------------------------------------------------------------------------
// Tarefas: funil do dia (A fazer → Fazendo → Feito), adiar para o próximo dia útil
// ---------------------------------------------------------------------------
const TF = { dia: null, dados: null, prioridade: 2 };
const ETAPAS_TF = [
  { id: 'a_fazer', nome: 'A fazer', cor: 'azul', vazio: 'Nada para começar. Escreva acima o que precisa sair hoje.' },
  { id: 'fazendo', nome: 'Fazendo', cor: 'ambar', vazio: 'Toque em ▶ numa tarefa para começar.' },
  { id: 'feito', nome: 'Feito', cor: 'verde', vazio: 'O que você concluir aparece aqui.' },
];
const PROXIMA = { a_fazer: 'fazendo', fazendo: 'feito' };
const proxUtil = (d) => { let n = somaDias(d, 1); while ([0, 6].includes(new Date(`${n}T12:00:00-03:00`).getDay())) n = somaDias(n, 1); return n; };
function rotuloDia(d) {
  const hoje = diaISO(new Date());
  const nome = d === hoje ? 'Hoje' : d === somaDias(hoje, 1) ? 'Amanhã' : d === somaDias(hoje, -1) ? 'Ontem' : nomeDia(d, { weekday: 'long' }).replace(/^./, (c) => c.toUpperCase());
  return `${nome}, ${nomeDia(d, { day: '2-digit', month: 'short' }).replace('.', '')}`;
}
async function carregarTarefas(dia) {
  TF.dia = dia || TF.dia || diaISO(new Date());
  desenharSeletorConta('tarefas');
  desenharTarefas(await api(`/tarefas?dia=${TF.dia}`));
}
function cartaoTarefa(t, atrasada = false) {
  const pri = t.prioridade === 1 ? '<span class="tf-tag alta">Prioridade</span>' : '';
  const adi = t.adiada_vezes ? `<span class="tf-tag">adiada ${t.adiada_vezes}×</span>` : '';
  const atr = atrasada ? `<span class="tf-tag atr">${t.dia > diaISO(new Date()) ? 'marcada p/' : 'de'} ${nomeDia(t.dia, { day: '2-digit', month: 'short' }).replace('.', '')}</span>` : '';
  const feito = t.etapa === 'feito';
  const extras = tagsTarefa(t, feito);
  return `<li class="tf-card ${feito ? 'feito' : ''} ${t.prioridade === 1 ? 'p1' : ''}" data-tf="${esc(t.id)}">
    <button class="tf-check" data-tf-acao="${feito ? 'reabrir' : 'concluir'}" aria-label="${feito ? 'Reabrir' : 'Concluir'}"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"/></svg></button>
    <button class="tf-corpo" data-tf-acao="editar"><span class="tf-t">${esc(t.titulo)}</span>${pri || adi || atr || extras || t.notas ? `<span class="tf-meta">${pri}${extras}${atr}${adi}${t.notas ? `<span class="tf-nota">${esc(t.notas)}</span>` : ''}</span>` : ''}</button>
    ${feito ? '' : `<div class="tf-acoes">
      ${atrasada ? '<button data-tf-acao="hoje" aria-label="Trazer para hoje" title="Trazer para hoje"><svg viewBox="0 0 24 24"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button>'
        : `${t.etapa === 'fazendo' ? '<button data-tf-acao="voltar" aria-label="Voltar para A fazer" title="Voltar para A fazer"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>' : ''}<button data-tf-acao="avancar" aria-label="${t.etapa === 'a_fazer' ? 'Começar' : 'Concluir'}" title="${t.etapa === 'a_fazer' ? 'Começar' : 'Concluir'}"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7Z"/></svg></button>`}
      <button data-tf-acao="adiar" aria-label="Passar para o próximo dia" title="Próximo dia"><svg viewBox="0 0 24 24"><path d="M5 12h12m-5-6 6 6-6 6"/></svg></button>
    </div>`}
  </li>`;
}
function desenharTarefas(d) {
  TF.dados = d;
  const hoje = d.hoje;
  $('#tf-dia-rotulo').textContent = rotuloDia(d.dia);
  $('#tf-dia-rotulo').classList.toggle('fora', d.dia !== hoje);
  // faixa da semana com bolinhas de quantidade
  const ini = somaDias(d.dia, -3);
  $('#tf-semana').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const dd = somaDias(ini, i), c = d.contagem?.[dd];
    const pend = c ? c.total - c.feitas : 0;
    return `<button class="tf-sd ${dd === d.dia ? 'on' : ''} ${dd === hoje ? 'hoje' : ''}" data-tf-ir="${dd}"><small>${nomeDia(dd, { weekday: 'short' }).replace('.', '').slice(0, 3)}</small><b>${dd.slice(8)}</b><i class="${c ? (pend ? 'pend' : 'ok') : ''}"></i></button>`;
  }).join('');
  const ts = d.tarefas;
  const feitas = ts.filter((t) => t.etapa === 'feito').length;
  const pct = ts.length ? Math.round((feitas / ts.length) * 100) : 0;
  $('#tf-barra').style.width = `${pct}%`;
  $('#tf-progresso-txt').textContent = ts.length ? `${feitas} de ${ts.length} feitas` : 'Nenhuma tarefa neste dia';
  // prazos chegando (vencidos, hoje e próximos 2 dias) que não estão na lista do dia
  const noDia = new Set([...ts, ...d.atrasadas].map((t) => t.id));
  const prazos = (d.prazos || []).filter((t) => !noDia.has(t.id));
  $('#tf-prazos').hidden = !prazos.length || d.dia !== hoje;
  $('#tf-lista-prazos').innerHTML = prazos.map((t) => cartaoTarefa(t, true)).join('');
  const nSug = d.sugestoes_pendentes || 0;
  $('#tf-b-sug').hidden = !nSug;
  $('#tf-b-sug').textContent = `✨ ${nSug} sugest${nSug > 1 ? 'ões' : 'ão'} do Dimy`;
  // atrasadas (só em hoje)
  $('#tf-atrasadas').hidden = !d.atrasadas.length;
  $('#tf-lista-atrasadas').innerHTML = d.atrasadas.map((t) => cartaoTarefa(t, true)).join('');
  // funil
  $('#tf-funil').innerHTML = ETAPAS_TF.map((e, i) => {
    const lista = ts.filter((t) => t.etapa === e.id).sort((x, y) => (x.prioridade - y.prioridade) || (x.ordem - y.ordem));
    return `<section class="tf-etapa ${e.cor}" style="--i:${i}">
      <div class="tf-boca"><span>${e.nome}</span><b>${lista.length}</b></div>
      ${lista.length ? `<ul class="tf-cards">${lista.map((t) => cartaoTarefa(t)).join('')}</ul>` : `<p class="tf-vazio">${e.vazio}</p>`}
    </section>`;
  }).join('');
  const pend = ts.filter((t) => t.etapa !== 'feito').length + (d.dia === hoje ? d.atrasadas.length : 0);
  const b = $('#tf-adiar-pendentes');
  b.hidden = !pend || d.dia < hoje;
  b.textContent = `Passar ${pend} pendente${pend > 1 ? 's' : ''} para ${rotuloDia(proxUtil(d.dia < hoje ? hoje : d.dia)).split(',')[0].toLowerCase()}`;
  const bt = $('#badge-tarefas');
  if (d.dia === hoje) { const n = ts.filter((t) => t.etapa !== 'feito').length + d.atrasadas.length; bt.hidden = !n; bt.textContent = n; }
}
const tarefaPorId = (id) => [...(TF.dados?.tarefas || []), ...(TF.dados?.atrasadas || []), ...(TF.dados?.prazos || [])].find((t) => t.id === id);
async function mudarTarefa(id, corpo, msg) {
  await api(`/tarefas/${id}`, { metodo: 'POST', corpo });
  if (msg) aviso(msg);
  await carregarTarefas();
}
function editarTarefa(t) {
  abrirFolha({
    titulo: t ? 'Editar tarefa' : 'Nova tarefa',
    campos: [
      { rotulo: 'Tarefa', nome: 'titulo', valor: t?.titulo, obrigatorio: true, placeholder: 'Ligar para o Bruno' },
      { rotulo: 'Detalhes', nome: 'notas', valor: t?.notas || '', placeholder: 'Opcional' },
      { rotulo: 'Dia', nome: 'dia', tipoInput: 'date', valor: t?.dia || TF.dia },
      { tipo: 'escolha', rotulo: 'Prioridade', nome: 'prioridade', opcoes: [{ texto: 'Alta', valor: '1', marcado: t?.prioridade === 1 }, { texto: 'Normal', valor: '2', marcado: !t || t.prioridade === 2 }, { texto: 'Baixa', valor: '3', marcado: t?.prioridade === 3 }] },
      { tipo: 'escolha', rotulo: 'Etapa', nome: 'etapa', opcoes: ETAPAS_TF.map((e) => ({ texto: e.nome, valor: e.id, marcado: (t?.etapa || 'a_fazer') === e.id })) },
      { rotulo: 'Prazo final', nome: 'prazo', tipoInput: 'date', valor: t?.prazo || '', dica: 'Opcional. O dia acima é quando você vai fazer; o prazo é a data-limite.' },
      { tipo: 'escolha', rotulo: 'Repetir', nome: 'recorrencia', opcoes: [['', 'Não repete'], ['diaria', 'Todo dia'], ['dias_uteis', 'Dias úteis'], ['semanal', 'Toda semana'], ['mensal', 'Todo mês']].map(([v, x]) => ({ texto: x, valor: v, marcado: (t?.recorrencia || '') === v })) },
      { rotulo: 'Projeto', nome: 'projeto', valor: t?.projeto || '', placeholder: 'Ex.: Expansão BH, Rede Payments' },
      { rotulo: 'Área', nome: 'area', valor: t?.area || '', placeholder: 'Ex.: Comercial, Financeiro, Parcerias' },
      { rotulo: 'Empresa / cliente', nome: 'empresa', valor: t?.empresa || '', placeholder: 'Opcional' },
    ],
    salvar: async (f) => {
      const corpo = { titulo: f.titulo, notas: f.notas || '', dia: f.dia || TF.dia, prioridade: Number(f.prioridade || 2), etapa: f.etapa || 'a_fazer',
        prazo: f.prazo || null, recorrencia: f.recorrencia || null, projeto: f.projeto || null, area: f.area || null, empresa: f.empresa || null };
      if (t) await mudarTarefa(t.id, corpo, 'Tarefa atualizada.');
      else { await api('/tarefas', { metodo: 'POST', corpo }); await carregarTarefas(); }
    },
    apagar: t ? async () => { await api(`/tarefas/${t.id}/arquivar`, { metodo: 'POST' }); aviso('Foi para a lixeira. Dá para restaurar em Lixeira.'); await carregarTarefas(); } : null,
  });
}
$('#tf-nova').addEventListener('submit', async (e) => {
  e.preventDefault();
  const titulo = $('#tf-titulo').value.trim(); if (!titulo) return;
  $('#tf-titulo').value = '';
  try { await api('/tarefas', { metodo: 'POST', corpo: { titulo, dia: TF.dia, prioridade: TF.prioridade } }); TF.prioridade = 2; $('#tf-prioridade').dataset.p = '2'; await carregarTarefas(); }
  catch (err) { $('#tf-titulo').value = titulo; aviso(err.message); }
});
$('#tf-prioridade').addEventListener('click', (e) => {
  TF.prioridade = TF.prioridade === 1 ? 2 : 1;
  e.currentTarget.dataset.p = String(TF.prioridade);
  e.currentTarget.setAttribute('aria-label', TF.prioridade === 1 ? 'Prioridade alta' : 'Prioridade normal');
  aviso(TF.prioridade === 1 ? 'A próxima tarefa entra como prioridade.' : 'Prioridade normal.');
});
$('#v-tarefas').addEventListener('click', async (e) => {
  const seta = e.target.closest('[data-tf-dia]');
  if (seta) { carregarTarefas(somaDias(TF.dia, Number(seta.dataset.tfDia))).catch((x) => aviso(x.message)); return; }
  const sd = e.target.closest('[data-tf-ir]');
  if (sd) { carregarTarefas(sd.dataset.tfIr).catch((x) => aviso(x.message)); return; }
  if (e.target.closest('#tf-dia-rotulo')) { carregarTarefas(diaISO(new Date())).catch((x) => aviso(x.message)); return; }
  const b = e.target.closest('[data-tf-acao]'); if (!b) return;
  const li = b.closest('[data-tf]'), t = tarefaPorId(li?.dataset.tf); if (!t) return;
  const acao = b.dataset.tfAcao;
  if (acao === 'editar') { abrirMenuTarefa(t); return; }
  li.classList.add('mexendo');
  try {
    if (acao === 'concluir') await mudarTarefa(t.id, { etapa: 'feito' }, 'Feito! ✅');
    if (acao === 'reabrir') await mudarTarefa(t.id, { etapa: 'a_fazer' });
    if (acao === 'voltar') await mudarTarefa(t.id, { etapa: 'a_fazer' }, 'Voltou para A fazer.');
    if (acao === 'avancar') await mudarTarefa(t.id, { etapa: PROXIMA[t.etapa] }, t.etapa === 'fazendo' ? 'Feito! ✅' : null);
    if (acao === 'hoje') await mudarTarefa(t.id, { dia: TF.dados.hoje }, 'Trouxe para hoje.');
    if (acao === 'adiar') {
      const r = await api(`/tarefas/${t.id}/adiar`, { metodo: 'POST' });
      aviso(`Passei para ${rotuloDia(r.tarefa?.dia || proxUtil(TF.dia)).toLowerCase()}.`);
      await carregarTarefas();
    }
  } catch (err) { li.classList.remove('mexendo'); aviso(err.message); }
});
$('#tf-trazer-todas').addEventListener('click', async () => {
  const lista = TF.dados?.atrasadas || [];
  try { for (const t of lista) await api(`/tarefas/${t.id}`, { metodo: 'POST', corpo: { dia: TF.dados.hoje } }); aviso('Trouxe tudo para hoje.'); await carregarTarefas(TF.dados.hoje); }
  catch (err) { aviso(err.message); }
});
$('#tf-adiar-pendentes').addEventListener('click', async (e) => {
  const b = e.currentTarget; b.disabled = true;
  try { const r = await api('/tarefas/adiar-pendentes', { metodo: 'POST', corpo: { dia: TF.dia } }); aviso(`${r.movidas} tarefa${r.movidas > 1 ? 's' : ''} para ${rotuloDia(r.para).toLowerCase()}.`); await carregarTarefas(); }
  catch (err) { aviso(err.message); } finally { b.disabled = false; }
});

// Menu da tarefa: mover para qualquer etapa (inclusive voltar), trazer para hoje, adiar, editar, remover.
let tfMenuAtual = null;
const NOME_ETAPA = { a_fazer: 'A fazer', fazendo: 'Fazendo', feito: 'Feito' };
function abrirMenuTarefa(t) {
  tfMenuAtual = t;
  const hoje = TF.dados?.hoje || diaISO(new Date());
  $('#tf-menu-titulo').textContent = t.titulo;
  $('#tf-menu-sub').textContent = [`Está em ${NOME_ETAPA[t.etapa]}`, rotuloDia(t.dia), t.adiada_vezes ? `adiada ${t.adiada_vezes}×` : '', t.notas || ''].filter(Boolean).join(' · ');
  document.querySelectorAll('[data-tf-etapa]').forEach((b) => { b.classList.toggle('atual', b.dataset.tfEtapa === t.etapa); b.disabled = b.dataset.tfEtapa === t.etapa; });
  document.querySelector('[data-tf-menu="hoje"]').hidden = t.dia === hoje;
  document.querySelector('[data-tf-menu="adiar"]').hidden = t.etapa === 'feito';
  const m = $('#tf-menu'); m.hidden = false; requestAnimationFrame(() => m.classList.add('aberta'));
}
function fecharMenuTarefa() { const m = $('#tf-menu'); m.classList.remove('aberta'); setTimeout(() => (m.hidden = true), 220); }
$('#tf-menu').addEventListener('click', async (e) => {
  if (e.target.closest('[data-tf-fechar]')) { fecharMenuTarefa(); return; }
  const t = tfMenuAtual; if (!t) return;
  const et = e.target.closest('[data-tf-etapa]'), ac = e.target.closest('[data-tf-menu]');
  if (!et && !ac) return;
  try {
    if (et) { fecharMenuTarefa(); await mudarTarefa(t.id, { etapa: et.dataset.tfEtapa }, `Movida para ${NOME_ETAPA[et.dataset.tfEtapa]}.`); return; }
    const acao = ac.dataset.tfMenu;
    fecharMenuTarefa();
    if (acao === 'editar') { setTimeout(() => editarTarefa(t), 230); return; }
    if (acao === 'detalhe') { setTimeout(() => abrirDetalheTarefa(t.id), 230); return; }
    if (acao === 'hoje') await mudarTarefa(t.id, { dia: TF.dados?.hoje || diaISO(new Date()) }, 'Trouxe para hoje.');
    if (acao === 'adiar') { const r = await api(`/tarefas/${t.id}/adiar`, { metodo: 'POST' }); aviso(`Passei para ${rotuloDia(r.tarefa?.dia || proxUtil(TF.dia)).toLowerCase()}.`); await carregarTarefas(); }
    if (acao === 'arquivar') { await api(`/tarefas/${t.id}/arquivar`, { metodo: 'POST' }); aviso('Foi para a lixeira. Dá para restaurar em Lixeira.'); await carregarTarefas(); }
  } catch (err) { aviso(err.message); }
});
// ---------------------------------------------------------------------------
// Tarefas 2.0: projeto, prazo, repetição, subtarefas, histórico, lixeira, sugestões
// ---------------------------------------------------------------------------
const NOME_REPETE = { diaria: 'todo dia', dias_uteis: 'dias úteis', semanal: 'toda semana', mensal: 'todo mês' };
const dataCurta = (d) => nomeDia(d, { day: '2-digit', month: 'short' }).replace('.', '');
function rotuloPrazo(prazo, hoje = diaISO(new Date())) {
  if (prazo < hoje) return { classe: 'venc', texto: `venceu ${dataCurta(prazo)}` };
  if (prazo === hoje) return { classe: 'hoje', texto: 'vence hoje' };
  if (prazo === somaDias(hoje, 1)) return { classe: 'perto', texto: 'vence amanhã' };
  return { classe: '', texto: `prazo ${dataCurta(prazo)}` };
}
function tagsTarefa(t, feito) {
  const tags = [];
  if (t.projeto) tags.push(`<span class="tf-tag proj">${esc(t.projeto)}</span>`);
  if (t.prazo && !feito) { const p = rotuloPrazo(t.prazo); tags.push(`<span class="tf-tag prazo ${p.classe}">${p.texto}</span>`); }
  if (t.recorrencia) tags.push(`<span class="tf-tag rep" title="Repete ${NOME_REPETE[t.recorrencia]}">↻ ${NOME_REPETE[t.recorrencia]}</span>`);
  if (t.subtarefas?.total) tags.push(`<span class="tf-tag sub ${t.subtarefas.feitas === t.subtarefas.total ? 'ok' : ''}">☑ ${t.subtarefas.feitas}/${t.subtarefas.total}</span>`);
  if (t.empresa) tags.push(`<span class="tf-tag emp">${esc(t.empresa)}</span>`);
  if (t.origem === 'olho') tags.push('<span class="tf-tag olho" title="Criada a partir do Olho de Deus">👁</span>');
  return tags.join('');
}

const TFP = { modo: null, id: null };
function abrirPainelTf(titulo) {
  $('#tfp-titulo').textContent = titulo;
  $('#tfp-corpo').innerHTML = '<p class="dica centro">Carregando…</p>';
  const m = $('#tf-painel'); m.hidden = false; requestAnimationFrame(() => m.classList.add('aberta'));
}
function fecharPainelTf() { const m = $('#tf-painel'); m.classList.remove('aberta'); setTimeout(() => (m.hidden = true), 220); TFP.modo = null; }
const NOME_ACAO_HIST = { criada: 'Criada', etapa: 'Etapa', dia: 'Dia', prazo: 'Prazo', editada: 'Editada', arquivada: 'Para a lixeira', restaurada: 'Restaurada', recorrencia: 'Repetição', nota: 'Anotação', subtarefa: 'Subtarefa' };
const POR_HIST = { app: '', voz: 'por voz', sugestao: 'sugestão aceita', olho: 'Olho de Deus', sistema: 'automático', recorrencia: 'repetição', dimy: 'Dimy' };

async function abrirDetalheTarefa(id) {
  TFP.modo = 'detalhe'; TFP.id = id;
  abrirPainelTf('Tarefa');
  await desenharDetalheTarefa();
}
async function desenharDetalheTarefa() {
  const { tarefa: t, subtarefas: subs, historico: hist } = await api(`/tarefas/${TFP.id}/detalhe`);
  $('#tfp-titulo').textContent = t.titulo;
  const feitas = subs.filter((x) => x.feita).length;
  const pct = subs.length ? Math.round((feitas / subs.length) * 100) : 0;
  $('#tfp-corpo').innerHTML = `
    <p class="dica">${[NOME_ETAPA[t.etapa], rotuloDia(t.dia), t.prazo ? rotuloPrazo(t.prazo).texto : '', t.recorrencia ? `repete ${NOME_REPETE[t.recorrencia]}` : '', t.projeto ? `projeto ${esc(t.projeto)}` : '', t.area ? esc(t.area) : '', t.empresa ? esc(t.empresa) : ''].filter(Boolean).join(' · ')}</p>
    ${t.notas ? `<p class="tfp-notas">${leve(t.notas)}</p>` : ''}
    <h3 class="tfp-sec">Subtarefas ${subs.length ? `<small>${feitas}/${subs.length}</small>` : ''}</h3>
    ${subs.length ? `<div class="tf-barra fina"><span style="width:${pct}%"></span></div>` : ''}
    <ul class="tfp-subs">${subs.map((x) => `<li class="${x.feita ? 'feita' : ''}">
      <button class="tfp-check" data-tfs-feita="${esc(x.id)}" data-v="${x.feita ? '0' : '1'}" aria-label="${x.feita ? 'Desmarcar' : 'Marcar como feita'}"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"/></svg></button>
      <span>${esc(x.titulo)}</span>
      <button class="tfp-del" data-tfs-apagar="${esc(x.id)}" aria-label="Apagar subtarefa">×</button></li>`).join('')}</ul>
    <form id="tfs-nova" class="tfp-form"><input name="titulo" maxlength="200" placeholder="Nova subtarefa…" autocomplete="off" aria-label="Nova subtarefa"><button class="btn primario">Adicionar</button></form>
    <h3 class="tfp-sec">Anotações e histórico</h3>
    <form id="tfs-nota" class="tfp-form"><input name="texto" maxlength="1000" placeholder="Escreva uma anotação…" autocomplete="off" aria-label="Nova anotação"><button class="btn claro">Anotar</button></form>
    <ol class="tfp-hist">${hist.map((h) => `<li class="${h.acao === 'nota' ? 'nota' : ''}"><b>${NOME_ACAO_HIST[h.acao] || esc(h.acao)}</b>${h.detalhe ? ` <span>${esc(h.detalhe)}</span>` : ''}<small>${quando(h.created_at)}${POR_HIST[h.por] ? ` · ${POR_HIST[h.por]}` : ''}</small></li>`).join('') || '<li class="dica">Sem registros ainda.</li>'}</ol>`;
}
async function desenharProjetos() {
  const { projetos } = await api('/tarefas/projetos');
  $('#tfp-corpo').innerHTML = projetos.length
    ? `<p class="dica">Toque num projeto para ver as tarefas abertas dele (de todos os dias).</p><ul class="tfp-proj">${projetos.map((p) => `<li><button data-tfp-projeto="${esc(p.projeto)}"><b>${esc(p.projeto)}</b><small>${p.abertas} aberta${p.abertas === 1 ? '' : 's'} · ${p.feitas} feita${p.feitas === 1 ? '' : 's'}${p.vencidas ? ` · <em>${p.vencidas} com prazo vencido</em>` : ''}${p.areas.length ? ` · ${p.areas.map(esc).join(', ')}` : ''}</small></button></li>`).join('')}</ul>`
    : '<p class="dica centro">Nenhum projeto ainda. Ao editar uma tarefa, preencha o campo “Projeto” para agrupá-la aqui.</p>';
}
async function desenharTarefasDoProjeto(projeto) {
  $('#tfp-titulo').textContent = projeto;
  const { tarefas } = await api(`/tarefas/buscar?projeto=${encodeURIComponent(projeto)}`);
  $('#tfp-corpo').innerHTML = `<button class="link" data-tf-painel="projetos">‹ Todos os projetos</button>
    <ul class="tfp-proj">${tarefas.map((t) => `<li><button data-tfp-ir-dia="${esc(t.dia)}"><b>${esc(t.titulo)}</b><small>${NOME_ETAPA[t.etapa]} · ${rotuloDia(t.dia)}${t.prazo ? ` · ${rotuloPrazo(t.prazo).texto}` : ''}</small></button></li>`).join('') || '<li class="dica">Nenhuma tarefa aberta neste projeto.</li>'}</ul>`;
}
async function desenharLixeira() {
  const { tarefas } = await api('/tarefas/lixeira');
  $('#tfp-corpo').innerHTML = tarefas.length
    ? `<p class="dica">Tarefas removidas nos últimos 60 dias. Restaure ou exclua de vez.</p><ul class="tfp-lixo">${tarefas.map((t) => `<li><div><b>${esc(t.titulo)}</b><small>${rotuloDia(t.dia)}${t.projeto ? ` · ${esc(t.projeto)}` : ''} · removida ${ha(t.arquivada_em || t.updated_at)}</small></div>
      <button class="btn claro" data-tfp-restaurar="${esc(t.id)}">Restaurar</button><button class="link perigo" data-tfp-excluir="${esc(t.id)}">Excluir de vez</button></li>`).join('')}</ul>`
    : '<p class="dica centro">A lixeira está vazia.</p>';
}
async function desenharSugestoes() {
  const { sugestoes } = await api('/tarefas/sugestoes');
  $('#tfp-corpo').innerHTML = sugestoes.length
    ? `<p class="dica">O Dimy só sugere quando há ação concreta, compromisso ou prazo, e a tarefa ainda não existe. Nada vira tarefa sem o seu “Aceitar”.</p>
      <ul class="tfp-sug">${sugestoes.map((s) => `<li>
        <span class="tfp-origem ${s.origem}">${s.origem === 'olho' ? '👁 Olho de Deus' : '💬 Das suas conversas'}</span>
        <b>${esc(s.titulo)}</b>
        ${s.motivo ? `<p>${esc(s.motivo)}</p>` : ''}
        ${s.notas ? `<p class="dica">${esc(s.notas)}</p>` : ''}
        <small>${[s.prazo ? rotuloPrazo(s.prazo).texto : '', s.projeto, s.empresa, ha(s.created_at)].filter(Boolean).map(esc).join(' · ')}</small>
        <div class="tfp-sug-acoes"><button class="btn primario" data-tfp-aceitar="${esc(s.id)}">Aceitar</button><button class="btn claro" data-tfp-descartar="${esc(s.id)}">Descartar</button></div>
      </li>`).join('')}</ul>`
    : '<p class="dica centro">Nenhuma sugestão pendente.</p>';
}
async function abrirPainelTarefas(modo) {
  TFP.modo = modo;
  abrirPainelTf({ projetos: 'Projetos', lixeira: 'Lixeira', sugestoes: 'Sugestões do Dimy' }[modo]);
  if (modo === 'projetos') await desenharProjetos();
  if (modo === 'lixeira') await desenharLixeira();
  if (modo === 'sugestoes') await desenharSugestoes();
}
$('#v-tarefas').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tf-painel]'); if (!b) return;
  abrirPainelTarefas(b.dataset.tfPainel).catch((x) => { $('#tfp-corpo').innerHTML = `<p class="dica centro">${esc(x.message)}</p>`; });
});
$('#tf-painel').addEventListener('click', async (e) => {
  if (e.target.closest('[data-tfp-fechar]')) { fecharPainelTf(); return; }
  const el = e.target.closest('[data-tf-painel],[data-tfp-projeto],[data-tfp-ir-dia],[data-tfp-restaurar],[data-tfp-excluir],[data-tfp-aceitar],[data-tfp-descartar],[data-tfs-feita],[data-tfs-apagar]');
  if (!el) return;
  const d = el.dataset;
  try {
    el.disabled = true;
    if (d.tfPainel) { await abrirPainelTarefas(d.tfPainel); return; }
    if (d.tfpProjeto) { await desenharTarefasDoProjeto(d.tfpProjeto); return; }
    if (d.tfpIrDia) { fecharPainelTf(); await carregarTarefas(d.tfpIrDia); return; }
    if (d.tfpRestaurar) { await api(`/tarefas/${d.tfpRestaurar}/restaurar`, { metodo: 'POST' }); aviso('Tarefa restaurada.'); await desenharLixeira(); carregarTarefas().catch(() => {}); return; }
    if (d.tfpExcluir) {
      if (!confirm('Excluir esta tarefa de vez? Não dá para desfazer.')) { el.disabled = false; return; }
      await api(`/tarefas/${d.tfpExcluir}/excluir`, { metodo: 'POST', corpo: { confirmar: true } }); aviso('Excluída.'); await desenharLixeira(); return;
    }
    if (d.tfpAceitar) { const r = await api(`/tarefas/sugestoes/${d.tfpAceitar}/aceitar`, { metodo: 'POST' }); aviso(`Tarefa criada para ${rotuloDia(r.tarefa.dia).toLowerCase()}.`); await desenharSugestoes(); carregarTarefas().catch(() => {}); return; }
    if (d.tfpDescartar) { await api(`/tarefas/sugestoes/${d.tfpDescartar}/descartar`, { metodo: 'POST' }); await desenharSugestoes(); carregarTarefas().catch(() => {}); return; }
    if (d.tfsFeita) { await api(`/tarefas/${TFP.id}/subtarefas/${d.tfsFeita}`, { metodo: 'POST', corpo: { feita: d.v === '1' } }); await desenharDetalheTarefa(); carregarTarefas().catch(() => {}); return; }
    if (d.tfsApagar) { await api(`/tarefas/${TFP.id}/subtarefas/${d.tfsApagar}/apagar`, { metodo: 'POST' }); await desenharDetalheTarefa(); carregarTarefas().catch(() => {}); }
  } catch (err) { el.disabled = false; aviso(err.message); }
});
$('#tf-painel').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, v = (new FormData(f).get(f.id === 'tfs-nova' ? 'titulo' : 'texto') || '').trim();
  if (!v) return;
  try {
    if (f.id === 'tfs-nova') await api(`/tarefas/${TFP.id}/subtarefas`, { metodo: 'POST', corpo: { titulo: v } });
    if (f.id === 'tfs-nota') await api(`/tarefas/${TFP.id}/nota`, { metodo: 'POST', corpo: { texto: v } });
    await desenharDetalheTarefa();
    $(`#${f.id} input`)?.focus();
    carregarTarefas().catch(() => {});
  } catch (err) { aviso(err.message); }
});

// ---------------------------------------------------------------------------
// Olho de Deus: inteligência de mercado (concorrentes, similares, regulação, alertas)
// Tudo vem do servidor; não há dado de demonstração. Coleta programada, não "tempo real".
// ---------------------------------------------------------------------------
const Olho = { aba: 'visao', cfg: null, admin: false, empresas: [], resumoEm: 0, fEmp: { categoria: '', segmento: '', q: '' }, fMov: { relevancia: '', filtro: '', dias: '30', segmento: '', categoria: '' }, fAl: { nivel: '', nao_lidos: '1' } };
const ABAS_OLHO = ['visao', 'alertas', 'empresas', 'movimentos', 'historico', 'ajustes'];
const NIVEL_OLHO = { critico: 'Crítico', alto: 'Alto', medio: 'Médio', baixo: 'Baixo' };
const CAT_OLHO = { concorrente: 'Concorrente', similar: 'Similar', candidata: 'Em análise', descartada: 'Descartada' };
const TIPO_MOV = { produto: 'Produto', preco_taxa: 'Preço/taxa', parceria: 'Parceria', expansao: 'Expansão', campanha: 'Campanha', estrategia: 'Estratégia', infraestrutura: 'Infraestrutura', regulatorio: 'Regulação', mercado: 'Mercado', oportunidade: 'Oportunidade' };
const TIPO_EXEC = { empresa: 'Empresa', setor: 'Setor', regulatorio: 'Regulação', descoberta: 'Novas empresas' };
const PASSO_EXEC = { inicio: 'na fila', pesquisar: 'pesquisando', extrair: 'estruturando', analisar: 'analisando', gravar: 'gravando', fim: 'concluída' };
const CAMPOS_OLHO = [['identificacao', 'Identificação'], ['site_redes', 'Site e redes'], ['produtos', 'Produtos e serviços'], ['diferenciais', 'Diferenciais'], ['publico_alvo', 'Público-alvo'],
  ['infraestrutura', 'Infraestrutura e tecnologia'], ['parceiros', 'Parceiros e instituições'], ['taxas_condicoes', 'Taxas e condições'], ['lancamentos', 'Lançamentos'], ['mudancas_estrategicas', 'Mudanças estratégicas'],
  ['campanhas', 'Campanhas'], ['expansao', 'Expansão comercial'], ['parcerias_anunciadas', 'Parcerias anunciadas'], ['regulatorio', 'Regulatório/operacional']];
const urlSegura = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');
const hostDe = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };
const dataBR = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00-03:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '') : '');
const valorPerfil = (v) => (Array.isArray(v) ? v.filter(Boolean).map((x) => `<li>${/^https?:\/\//.test(x) ? `<a href="${esc(x)}" target="_blank" rel="noopener">${esc(hostDe(x) || x)}</a>` : esc(x)}</li>`).join('') : esc(v ?? ''));

async function olhoResumo() {
  if (Date.now() - Olho.resumoEm < 5 * 60e3) return;
  const p = await api('/olho/painel');
  Olho.resumoEm = Date.now(); Olho.painel = p;
  const k = p.kpis, a = k.alertas, n = a.critico + a.alto + a.medio + a.baixo;
  const total = k.concorrentes + k.similares + k.candidatas;
  $('#olho-entrada-sub').textContent = total
    ? `${k.concorrentes} concorrente${k.concorrentes === 1 ? '' : 's'} · ${k.similares} similar${k.similares === 1 ? '' : 'es'} · ${k.movimentos_30d} movimento${k.movimentos_30d === 1 ? '' : 's'} em 30 dias`
    : (p.status.em_andamento ? 'Primeira coleta em andamento…' : 'Inteligência de mercado · concorrentes, regulação, oportunidades');
  const b = $('#olho-entrada-alertas');
  b.hidden = !n; b.textContent = n; b.className = `olho-entrada-n ${a.critico ? 'critico' : a.alto ? 'alto' : 'medio'}`;
}

async function carregarOlho() {
  const [, a, b] = location.hash.slice(1).split('/');
  const sub = a === 'empresa' || a === 'movimento';
  $('#olho-abas').hidden = sub;
  $('#olho-voltar').dataset.ir = sub ? `olho/${Olho.aba}` : 'hoje';
  if (sub && b) { $('#olho-corpo').innerHTML = '<p class="dica centro">Carregando…</p>'; return a === 'empresa' ? olhoEmpresa(b) : olhoMovimento(b); }
  Olho.aba = ABAS_OLHO.includes(a) ? a : Olho.aba;
  document.querySelectorAll('[data-olho-aba]').forEach((x) => x.classList.toggle('on', x.dataset.olhoAba === Olho.aba));
  $('#olho-titulo').textContent = 'Olho de Deus';
  $('#olho-subtitulo').textContent = 'Inteligência de mercado da B2B PAY';
  if (!Olho.cfg) { const c = await api('/olho/config'); Olho.cfg = c.config; Olho.admin = c.admin; }
  const r = { visao: olhoVisao, alertas: olhoAlertas, empresas: olhoEmpresas, movimentos: olhoMovimentos, historico: olhoHistorico, ajustes: olhoAjustes }[Olho.aba];
  await r();
}
function cartaoMovOlho(m) {
  return `<button class="olho-mov n-${m.relevancia}" data-olho-mov="${esc(m.id)}">
    <span class="olho-dot n-${m.relevancia}" title="${NIVEL_OLHO[m.relevancia]}"></span>
    <span class="olho-mov-t"><b>${esc(m.titulo)}</b><small>${[m.empresa || 'Mercado', TIPO_MOV[m.tipo] || m.tipo, m.data_evento ? dataBR(m.data_evento) : `detectado ${ha(m.created_at)}`, m.fonte || hostDe(m.url)].filter(Boolean).map(esc).join(' · ')}</small></span>
    ${m.ameaca ? '<i class="olho-flag ameaca">ameaça</i>' : ''}${m.oportunidade ? '<i class="olho-flag oport">oportunidade</i>' : ''}
  </button>`;
}
function cartaoAlertaOlho(a) {
  const u = urlSegura(a.url);
  return `<article class="olho-alerta n-${a.nivel} ${a.lido_em ? 'lido' : ''}">
    <header><span class="olho-nivel n-${a.nivel}">${NIVEL_OLHO[a.nivel]}</span><small>${a.quando ? `${dataBR(a.quando)} · ` : ''}detectado ${ha(a.created_at)}</small></header>
    <h3>${esc(a.titulo)}</h3>
    <p class="olho-alerta-emp">${esc(a.empresa || 'Mercado')}${u ? ` · <a href="${esc(u)}" target="_blank" rel="noopener">${esc(a.fonte || hostDe(u))}</a>` : ''}</p>
    <dl>${a.porque ? `<dt>Por que importa</dt><dd>${esc(a.porque)}</dd>` : ''}${a.impacto ? `<dt>Impacto</dt><dd>${esc(a.impacto)}</dd>` : ''}${a.acao ? `<dt>Ação recomendada</dt><dd>${esc(a.acao)}</dd>` : ''}</dl>
    <div class="olho-acoes"><button class="btn claro" data-olho-mov="${esc(a.movimento_id)}">Análise completa</button><button class="btn claro" data-olho-tarefa="${esc(a.movimento_id)}">Criar tarefa</button>${a.lido_em ? '' : `<button class="link" data-olho-lido="${esc(a.id)}">Marcar como lido</button>`}</div>
  </article>`;
}
const linhaExec = (x) => `<li class="olho-exec ${x.status}"><span class="olho-exec-st">${{ fila: 'Na fila', rodando: PASSO_EXEC[x.passo] || 'rodando', ok: 'Concluída', erro: 'Falhou', pulada: 'Pulada' }[x.status]}</span>
  <b>${TIPO_EXEC[x.tipo]}${x.empresa ? `: ${esc(x.empresa)}` : ''}</b>
  <small>${[ha(x.created_at), x.fontes ? `${x.fontes} fontes` : '', x.status === 'ok' ? `${x.novidades} novidade${x.novidades === 1 ? '' : 's'}` : '', x.resumo && x.status === 'ok' ? x.resumo : ''].filter(Boolean).map(esc).join(' · ')}</small>
  ${x.erro && x.status !== 'ok' ? `<small class="olho-erro">${esc(x.erro)}</small>` : ''}</li>`;

async function olhoVisao() {
  const p = await api('/olho/painel'); Olho.painel = p; Olho.resumoEm = Date.now();
  const s = p.status, k = p.kpis, n = k.alertas;
  const andamento = p.execucoes.filter((x) => ['fila', 'rodando'].includes(x.status));
  const nAl = n.critico + n.alto + n.medio + n.baixo;
  const kpi = (rot, val, ir, cls = '') => `<button class="olho-kpi ${cls}" data-olho-ir="${ir}"><b>${val}</b><small>${rot}</small></button>`;
  const vazio = !k.concorrentes && !k.similares && !k.candidatas && !k.movimentos_30d;
  $('#olho-n-alertas').textContent = nAl || '';
  $('#olho-corpo').innerHTML = `
    <section class="olho-hero ${s.ativo ? '' : 'pausado'}">
      <div class="olho-radar" aria-hidden="true"><i></i><i></i><i></i><span></span></div>
      <div class="olho-hero-txt">
        <p class="olho-hero-t">${s.ativo ? (andamento.length ? 'Pesquisando agora' : 'Monitorando') : 'Monitoramento pausado'}</p>
        <p class="olho-hero-s">Última coleta concluída ${s.ultima_coleta ? ha(s.ultima_coleta) : ': ainda nenhuma'}${andamento.length ? ` · ${andamento.length} na fila` : ''}</p>
        <p class="olho-hero-f">Coleta programada, não em tempo real: cada empresa a cada ${s.frequencia.empresas_h} h · setor e regulação 1×/dia (7h–22h) · novas empresas 1×/semana · até ${s.limite_dia} pesquisas/dia.</p>
      </div>
    </section>
    ${vazio ? '<p class="olho-aviso">A primeira coleta real está em andamento. Os números abaixo aparecem conforme as pesquisas terminam (cada uma leva de 4 a 8 minutos). Nada aqui é ilustrativo.</p>' : ''}
    <div class="olho-kpis">
      ${kpi('Concorrentes', k.concorrentes, 'empresas:concorrente')}
      ${kpi('Empresas similares', k.similares, 'empresas:similar')}
      ${kpi('Em análise', k.candidatas, 'empresas:candidata')}
      ${kpi('Movimentos 30 dias', k.movimentos_30d, 'movimentos:')}
      ${kpi('Ameaças', k.ameacas, 'movimentos:ameacas', 'ameaca')}
      ${kpi('Oportunidades', k.oportunidades, 'movimentos:oportunidades', 'oport')}
    </div>
    <div class="olho-niveis" role="list" aria-label="Alertas não lidos por nível">
      ${['critico', 'alto', 'medio', 'baixo'].map((x) => `<button role="listitem" class="olho-nv n-${x}" data-olho-ir="alertas:${x}"><b>${n[x]}</b>${NIVEL_OLHO[x]}</button>`).join('')}
    </div>
    ${p.alertas.length ? `<h2 class="secao">Alertas não lidos</h2>${p.alertas.slice(0, 4).map(cartaoAlertaOlho).join('')}${p.alertas.length > 4 ? '<button class="btn claro largo" data-olho-ir="alertas:">Ver todos os alertas</button>' : ''}` : ''}
    ${p.ameacas.length ? `<h2 class="secao">Ameaças</h2><div class="olho-movs">${p.ameacas.map(cartaoMovOlho).join('')}</div>` : ''}
    ${p.oportunidades.length ? `<h2 class="secao">Oportunidades</h2><div class="olho-movs">${p.oportunidades.map(cartaoMovOlho).join('')}</div>` : ''}
    <h2 class="secao">Últimas movimentações</h2>
    ${p.movimentos.length ? `<div class="olho-movs">${p.movimentos.slice(0, 12).map(cartaoMovOlho).join('')}</div>` : '<p class="dica">Ainda nenhuma movimentação registrada.</p>'}
    ${k.sugestoes ? `<button class="btn claro largo" data-ir="tarefas">✨ ${k.sugestoes} sugest${k.sugestoes > 1 ? 'ões' : 'ão'} de tarefa do Olho em Tarefas</button>` : ''}
    <h2 class="secao">Pesquisas recentes</h2>
    <ul class="olho-execs">${p.execucoes.slice(0, 6).map(linhaExec).join('') || '<li class="dica">Nenhuma ainda.</li>'}</ul>
    ${Olho.admin ? '<button class="btn claro largo" data-olho-descobrir>Buscar novas empresas agora</button>' : ''}`;
}

async function olhoAlertas() {
  const f = Olho.fAl;
  const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { alertas } = await api(`/olho/alertas${q ? `?${q}` : ''}`);
  const chip = (campo, v, rot) => `<button class="olho-chip ${f[campo] === v ? 'on' : ''}" data-olho-f="fAl.${campo}" data-v="${v}">${rot}</button>`;
  $('#olho-corpo').innerHTML = `
    <div class="olho-filtros">${chip('nao_lidos', '1', 'Não lidos')}${chip('nao_lidos', '', 'Todos')}<span class="sep"></span>${chip('nivel', '', 'Qualquer nível')}${chip('nivel', 'medio', 'Médio+')}${chip('nivel', 'alto', 'Alto+')}${chip('nivel', 'critico', 'Crítico')}</div>
    ${alertas.some((a) => !a.lido_em) ? '<button class="link" data-olho-todos-lidos>Marcar todos como lidos</button>' : ''}
    ${alertas.map(cartaoAlertaOlho).join('') || '<p class="dica centro">Nenhum alerta com esse filtro. Os alertas são gerados quando uma pesquisa encontra algo novo e relevante; repetidos são descartados.</p>'}`;
}

async function olhoEmpresas() {
  const f = Olho.fEmp;
  const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { empresas } = await api(`/olho/empresas${q ? `?${q}` : ''}`);
  Olho.empresas = empresas;
  const chip = (v, rot) => `<button class="olho-chip ${f.categoria === v ? 'on' : ''}" data-olho-f="fEmp.categoria" data-v="${v}">${rot}</button>`;
  const segs = Olho.cfg?.segmentos || [];
  $('#olho-corpo').innerHTML = `
    <form class="olho-busca" data-olho-busca="fEmp"><input name="q" value="${esc(f.q)}" placeholder="Buscar empresa" autocomplete="off" enterkeyhint="search" aria-label="Buscar empresa">
      <select name="segmento" aria-label="Segmento"><option value="">Todos os segmentos</option>${segs.map((x) => `<option ${f.segmento === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></form>
    <div class="olho-filtros">${chip('', 'Ativas')}${chip('concorrente', 'Concorrentes')}${chip('similar', 'Similares')}${chip('candidata', 'Em análise')}${chip('descartada', 'Descartadas')}</div>
    ${Olho.admin ? '<button class="btn claro largo" data-olho-nova-empresa>+ Acompanhar uma empresa</button>' : ''}
    <div class="olho-emps">${empresas.map((e) => `<button class="olho-emp" data-olho-emp="${esc(e.id)}">
      <span class="olho-emp-cab"><b>${esc(e.nome)}</b><span class="olho-cat ${e.categoria}">${CAT_OLHO[e.categoria]}</span>${e.nivel_ameaca ? `<span class="olho-nivel n-${e.nivel_ameaca}" title="Nível de ameaça">${NIVEL_OLHO[e.nivel_ameaca]}</span>` : ''}</span>
      ${e.resumo ? `<span class="olho-emp-res">${esc(e.resumo)}</span>` : ''}
      ${(e.classificacoes || []).length ? `<span class="olho-rotulos">${e.classificacoes.slice(0, 3).map((c) => `<i>${esc(c.rotulo)} · ${Math.round(c.confianca * 100)}%</i>`).join('')}</span>` : ''}
      <small>${e.ultima_em ? `analisada ${ha(e.ultima_em)}` : 'aguardando a primeira análise'}${e.silenciada ? ' · alertas silenciados' : ''}${e.ativo ? '' : ' · monitoramento pausado'}${(e.segmentos || []).length ? ` · ${e.segmentos.slice(0, 3).map(esc).join(', ')}` : ''}</small>
    </button>`).join('') || '<p class="dica centro">Nenhuma empresa com esse filtro.</p>'}</div>`;
}

async function olhoEmpresa(id) {
  const { empresa: e, historico, movimentos, execucoes } = await api(`/olho/empresas/${id}`);
  $('#olho-titulo').textContent = e.nome;
  $('#olho-subtitulo').textContent = `${CAT_OLHO[e.categoria]}${e.ultima_em ? ` · analisada ${ha(e.ultima_em)}` : ' · aguardando a primeira análise'}`;
  const site = urlSegura(e.site);
  const perfil = e.perfil || {};
  const preenchidos = CAMPOS_OLHO.filter(([c]) => perfil[c] != null && String(perfil[c]).trim() && !(Array.isArray(perfil[c]) && !perfil[c].length));
  const abertas = execucoes.filter((x) => ['fila', 'rodando'].includes(x.status));
  $('#olho-corpo').innerHTML = `
    <section class="olho-ficha">
      <div class="olho-emp-cab"><span class="olho-cat ${e.categoria}">${CAT_OLHO[e.categoria]}</span>${e.nivel_ameaca ? `<span class="olho-nivel n-${e.nivel_ameaca}">Ameaça ${NIVEL_OLHO[e.nivel_ameaca].toLowerCase()}</span>` : ''}${site ? `<a href="${esc(site)}" target="_blank" rel="noopener">${esc(hostDe(site))}</a>` : ''}</div>
      ${e.resumo ? `<p>${esc(e.resumo)}</p>` : ''}
      ${e.motivo_inclusao ? `<p class="dica"><b>Por que está aqui:</b> ${esc(e.motivo_inclusao)}</p>` : ''}
      ${abertas.length ? `<p class="olho-aviso">Pesquisa em andamento (${PASSO_EXEC[abertas[0].passo] || 'na fila'}). Atualize em alguns minutos.</p>` : ''}
      ${Olho.admin ? `<div class="olho-acoes">
        <button class="btn primario" data-olho-atualizar="${esc(e.id)}" ${abertas.length ? 'disabled' : ''}>Atualizar agora</button>
        <select data-olho-categoria="${esc(e.id)}" aria-label="Categoria">${Object.entries(CAT_OLHO).map(([k, v]) => `<option value="${k}" ${e.categoria === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <button class="btn claro" data-olho-alternar="${esc(e.id)}" data-campo="silenciada" data-v="${e.silenciada ? '0' : '1'}">${e.silenciada ? 'Reativar alertas' : 'Silenciar alertas'}</button>
        <button class="btn claro" data-olho-alternar="${esc(e.id)}" data-campo="ativo" data-v="${e.ativo ? '0' : '1'}">${e.ativo ? 'Pausar monitoramento' : 'Retomar monitoramento'}</button>
      </div>` : ''}
    </section>
    <h2 class="secao">Promessa × comprovação</h2>
    <p class="dica">Classificação técnica com base em fontes públicas. Não é acusação. ✓ = a URL da evidência apareceu de fato na pesquisa; sem ✓ a confiança é limitada a 30%.</p>
    ${(e.classificacoes || []).map((c) => `<article class="olho-classe">
      <header><b>${esc(c.rotulo)}</b><span class="olho-conf"><span style="width:${Math.round(c.confianca * 100)}%"></span></span><small>${Math.round(c.confianca * 100)}%</small></header>
      ${c.conclusao ? `<p>${esc(c.conclusao)}</p>` : ''}
      <ul class="olho-evid">${(c.evidencias || []).map((v) => `<li class="${v.verificada ? 'ok' : ''}"><span>${v.verificada ? '✓' : '·'}</span><div>${esc(v.afirmacao)}${urlSegura(v.url) ? ` <a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.fonte || hostDe(v.url))}</a>` : ''}</div></li>`).join('')}</ul>
      ${c.a_investigar ? `<p class="dica"><b>A investigar:</b> ${esc(c.a_investigar)}</p>` : ''}
    </article>`).join('') || '<p class="dica">Ainda sem classificação: ela sai na primeira análise completa.</p>'}
    <h2 class="secao">O que acompanhamos (${preenchidos.length} de 14 itens com informação)</h2>
    <dl class="olho-perfil">${preenchidos.map(([c, rot]) => `<dt>${rot}</dt><dd>${Array.isArray(perfil[c]) ? `<ul>${valorPerfil(perfil[c])}</ul>` : valorPerfil(perfil[c])}</dd>`).join('') || '<dd class="dica">Nada coletado ainda.</dd>'}</dl>
    <h2 class="secao">Linha do tempo</h2>
    <div class="olho-movs">${movimentos.map((m) => cartaoMovOlho({ ...m, empresa: e.nome })).join('') || '<p class="dica">Nenhuma movimentação registrada.</p>'}</div>
    <h2 class="secao">Histórico de mudanças</h2>
    <ol class="olho-mudancas">${historico.map((h) => `<li><small>${quando(h.created_at)}</small>${(h.mudancas || []).length ? `<ul>${h.mudancas.map((m) => `<li><b>${esc((CAMPOS_OLHO.find(([c]) => c === m.campo) || [, m.campo])[1])}</b> mudou</li>`).join('')}</ul>` : '<span class="dica">Sem mudanças em relação à coleta anterior.</span>'}</li>`).join('') || '<li class="dica">Ainda não há duas coletas para comparar.</li>'}</ol>
    <h2 class="secao">Pesquisas desta empresa</h2>
    <ul class="olho-execs">${execucoes.map((x) => linhaExec({ ...x, tipo: 'empresa' })).join('') || '<li class="dica">Nenhuma ainda.</li>'}</ul>`;
}

async function olhoMovimento(id) {
  const { movimento: m } = await api(`/olho/movimentos/${id}`);
  const a = m.analise || {}, u = urlSegura(m.url);
  $('#olho-titulo').textContent = TIPO_MOV[m.tipo] || 'Movimento';
  $('#olho-subtitulo').textContent = `${m.empresa || 'Mercado'} · ${m.data_evento ? dataBR(m.data_evento) : `detectado ${ha(m.created_at)}`}`;
  const bloco = (rot, txt) => (txt ? `<dt>${rot}</dt><dd>${esc(txt)}</dd>` : '');
  $('#olho-corpo').innerHTML = `
    <article class="olho-ficha">
      <div class="olho-emp-cab"><span class="olho-nivel n-${m.relevancia}">${NIVEL_OLHO[m.relevancia]}</span>${m.ameaca ? '<i class="olho-flag ameaca">ameaça</i>' : ''}${m.oportunidade ? '<i class="olho-flag oport">oportunidade</i>' : ''}</div>
      <h2 class="olho-mov-tit">${esc(m.titulo)}</h2>
      ${m.resumo ? `<p>${esc(m.resumo)}</p>` : ''}
      <p class="dica">Fonte: ${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(m.fonte || hostDe(u))}</a>` : esc(m.fonte || '—')} · registrado ${quando(m.created_at)}</p>
      <div class="olho-acoes"><button class="btn primario" data-olho-tarefa="${esc(m.id)}">Criar tarefa</button>${m.empresa_id ? `<button class="btn claro" data-olho-emp="${esc(m.empresa_id)}">Ver empresa</button>` : ''}</div>
    </article>
    <h2 class="secao">Análise estratégica</h2>
    <dl class="olho-analise">
      ${bloco('O que significa para a B2B PAY', a.o_que_significa)}${bloco('Comparação com a sua oferta', a.comparacao)}${bloco('Vantagens do outro lado', a.vantagens_concorrente)}
      ${bloco('Ameaças', a.ameacas)}${bloco('Impacto comercial', a.impacto_comercial)}${bloco('Como se posicionar', a.posicionamento)}${bloco('Como se diferenciar', a.diferenciacao)}
      ${a.acao_recomendada ? `<dt>Ação recomendada</dt><dd class="olho-acao">${esc(a.acao_recomendada)}</dd>` : ''}
    </dl>
    <p class="dica">Análise gerada por IA a partir da fonte citada. Confira a fonte antes de decidir.</p>`;
}

async function olhoMovimentos() {
  const f = Olho.fMov;
  const p = new URLSearchParams();
  if (f.relevancia) p.set('relevancia', f.relevancia);
  if (f.filtro) p.set('filtro', f.filtro);
  if (f.dias) p.set('desde', new Date(Date.now() - Number(f.dias) * 864e5).toISOString());
  if (f.segmento) p.set('segmento', f.segmento);
  if (f.categoria) p.set('categoria', f.categoria);
  const { movimentos } = await api(`/olho/movimentos?${p}`);
  const chip = (campo, v, rot) => `<button class="olho-chip ${f[campo] === v ? 'on' : ''}" data-olho-f="fMov.${campo}" data-v="${v}">${rot}</button>`;
  const segs = Olho.cfg?.segmentos || [];
  $('#olho-corpo').innerHTML = `
    <div class="olho-filtros">${chip('filtro', '', 'Tudo')}${chip('filtro', 'ameacas', 'Ameaças')}${chip('filtro', 'oportunidades', 'Oportunidades')}<span class="sep"></span>${chip('categoria', '', 'Todas as empresas')}${chip('categoria', 'concorrente', 'Concorrentes')}${chip('categoria', 'similar', 'Similares')}</div>
    <div class="olho-filtros">${chip('relevancia', '', 'Qualquer relevância')}${chip('relevancia', 'medio', 'Médio+')}${chip('relevancia', 'alto', 'Alto+')}${chip('relevancia', 'critico', 'Crítico')}<span class="sep"></span>${chip('dias', '7', '7 dias')}${chip('dias', '30', '30 dias')}${chip('dias', '90', '90 dias')}${chip('dias', '', 'Tudo')}</div>
    <form class="olho-busca" data-olho-busca="fMov"><select name="segmento" aria-label="Segmento"><option value="">Todos os segmentos</option>${segs.map((x) => `<option ${f.segmento === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></form>
    <div class="olho-movs">${movimentos.map(cartaoMovOlho).join('') || '<p class="dica centro">Nada com esses filtros.</p>'}</div>`;
}

async function olhoHistorico() {
  const [{ execucoes }, { empresas }] = await Promise.all([api('/olho/execucoes'), Olho.empresas.length ? { empresas: Olho.empresas } : api('/olho/empresas?categoria=')]);
  const nomes = Object.fromEntries((empresas || []).map((e) => [e.id, e.nome]));
  const ok = execucoes.filter((x) => x.status === 'ok').length, erro = execucoes.filter((x) => x.status === 'erro').length;
  $('#olho-corpo').innerHTML = `
    <p class="dica">Histórico real das pesquisas: cada linha é uma execução no servidor (pesquisa na web → estruturação → análise → gravação). ${ok} concluída${ok === 1 ? '' : 's'}, ${erro} com falha nas últimas ${execucoes.length}.</p>
    ${Olho.admin ? '<button class="btn claro largo" data-olho-descobrir>Buscar novas empresas agora</button>' : ''}
    <ul class="olho-execs">${execucoes.map((x) => linhaExec({ ...x, empresa: nomes[x.empresa_id] })).join('') || '<li class="dica">Nenhuma pesquisa ainda.</li>'}</ul>`;
}

async function olhoAjustes() {
  const { config: c, admin } = await api('/olho/config'); Olho.cfg = c; Olho.admin = admin;
  const sel = (nome, v) => `<select name="${nome}" ${admin ? '' : 'disabled'}>${Object.entries(NIVEL_OLHO).map(([k, t]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${t}${k === 'baixo' ? '' : ' ou mais'}</option>`).join('')}</select>`;
  $('#olho-corpo').innerHTML = `
    <form id="olho-ajustes" class="olho-ajustes">
      ${admin ? '' : '<p class="olho-aviso">Só o administrador altera estes ajustes.</p>'}
      <label class="olho-linha"><input type="checkbox" name="ativo" ${c.ativo ? 'checked' : ''} ${admin ? '' : 'disabled'}><span><b>Monitoramento ligado</b><small>Desligado, nenhuma pesquisa nova é feita.</small></span></label>
      <label class="campo"><span>Gerar alerta a partir de</span>${sel('nivel_minimo_alerta', c.nivel_minimo_alerta)}</label>
      <label class="campo"><span>Avisar no celular a partir de</span>${sel('nivel_push', c.nivel_push)}</label>
      <label class="campo"><span>Assuntos que geram alerta (um por linha; vazio = todos)</span><textarea name="temas_alerta" rows="3" placeholder="split de pagamentos&#10;Pix automático" ${admin ? '' : 'disabled'}>${esc((c.temas_alerta || []).join('\n'))}</textarea></label>
      <p class="campo-dica">Crítico sempre gera alerta, mesmo fora dos assuntos. Para silenciar uma empresa, abra a página dela.</p>
      <label class="campo"><span>Segmentos monitorados (um por linha)</span><textarea name="segmentos" rows="5" ${admin ? '' : 'disabled'}>${esc((c.segmentos || []).join('\n'))}</textarea></label>
      <div class="linha-campos">
        <label class="campo"><span>Reanalisar cada empresa a cada (horas)</span><input type="number" name="frequencia_empresa_h" min="12" max="720" value="${c.frequencia_empresa_h}" ${admin ? '' : 'disabled'}></label>
        <label class="campo"><span>Limite de pesquisas por dia</span><input type="number" name="max_execucoes_dia" min="1" max="200" value="${c.max_execucoes_dia}" ${admin ? '' : 'disabled'}></label>
      </div>
      <label class="campo"><span>Seu negócio (base de toda comparação)</span><textarea name="meu_negocio" rows="6" ${admin ? '' : 'disabled'}>${esc(c.meu_negocio)}</textarea></label>
      ${admin ? '<button class="btn primario largo">Salvar ajustes</button>' : ''}
    </form>`;
}

$('#olho-abas').addEventListener('click', (e) => { const b = e.target.closest('[data-olho-aba]'); if (b) ir(`olho/${b.dataset.olhoAba}`); });
$('#v-olho').addEventListener('click', async (e) => {
  const el = e.target.closest('[data-olho-ir],[data-olho-mov],[data-olho-emp],[data-olho-tarefa],[data-olho-lido],[data-olho-todos-lidos],[data-olho-f],[data-olho-descobrir],[data-olho-atualizar],[data-olho-alternar],[data-olho-nova-empresa]');
  if (!el || el.tagName === 'SELECT') return;
  const d = el.dataset;
  try {
    if (d.olhoIr) {
      const [aba, v] = d.olhoIr.split(':');
      if (aba === 'empresas') Olho.fEmp = { ...Olho.fEmp, categoria: v || '' };
      if (aba === 'movimentos') Olho.fMov = { ...Olho.fMov, filtro: v || '', dias: '30' };
      if (aba === 'alertas') Olho.fAl = { nivel: v || '', nao_lidos: '1' };
      ir(`olho/${aba}`); return;
    }
    if (d.olhoMov) { ir(`olho/movimento/${d.olhoMov}`); return; }
    if (d.olhoEmp) { ir(`olho/empresa/${d.olhoEmp}`); return; }
    if (d.olhoF) { const [obj, campo] = d.olhoF.split('.'); Olho[obj][campo] = d.v; await carregarOlho(); return; }
    el.disabled = true;
    if (d.olhoTarefa) { await api(`/olho/movimentos/${d.olhoTarefa}/tarefa`, { metodo: 'POST' }); aviso('Tarefa criada para hoje, no projeto “Inteligência de mercado”.'); el.textContent = 'Tarefa criada ✓'; return; }
    if (d.olhoLido) { await api(`/olho/alertas/${d.olhoLido}/lido`, { metodo: 'POST' }); Olho.resumoEm = 0; await carregarOlho(); return; }
    if (d.olhoTodosLidos !== undefined) { await api('/olho/alertas/lidos', { metodo: 'POST' }); Olho.resumoEm = 0; await carregarOlho(); return; }
    if (d.olhoDescobrir !== undefined) { const r = await api('/olho/descobrir', { metodo: 'POST' }); aviso(r.mensagem); await carregarOlho(); return; }
    if (d.olhoAtualizar) { const r = await api(`/olho/empresas/${d.olhoAtualizar}/atualizar`, { metodo: 'POST' }); aviso(r.mensagem); await carregarOlho(); return; }
    if (d.olhoAlternar) { await api(`/olho/empresas/${d.olhoAlternar}`, { metodo: 'POST', corpo: { [d.campo]: d.v === '1' } }); await carregarOlho(); return; }
    if (d.olhoNovaEmpresa !== undefined) {
      el.disabled = false;
      abrirFolha({
        titulo: 'Acompanhar empresa', botao: 'Acompanhar',
        campos: [
          { rotulo: 'Nome', nome: 'nome', obrigatorio: true, placeholder: 'Ex.: Asaas' },
          { rotulo: 'Site oficial', nome: 'site', placeholder: 'https://…', tipoInput: 'url' },
          { tipo: 'escolha', rotulo: 'Categoria', nome: 'categoria', opcoes: [{ texto: 'Deixar a análise decidir', valor: '', marcado: true }, { texto: 'Concorrente', valor: 'concorrente' }, { texto: 'Similar', valor: 'similar' }] },
        ],
        salvar: async (f) => { const r = await api('/olho/empresas', { metodo: 'POST', corpo: f }); aviso('Empresa no radar. A primeira análise sai em 4 a 8 minutos.'); ir(`olho/empresa/${r.id}`); },
      });
    }
  } catch (err) { el.disabled = false; aviso(err.message); }
});
$('#v-olho').addEventListener('change', async (e) => {
  const s = e.target;
  try {
    if (s.dataset.olhoCategoria) { await api(`/olho/empresas/${s.dataset.olhoCategoria}`, { metodo: 'POST', corpo: { categoria: s.value } }); aviso(`Categoria: ${CAT_OLHO[s.value]}.`); await carregarOlho(); return; }
    const f = s.closest('[data-olho-busca]');
    if (f && s.tagName === 'SELECT') { Olho[f.dataset.olhoBusca][s.name] = s.value; await carregarOlho(); }
  } catch (err) { aviso(err.message); }
});
$('#v-olho').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    if (f.dataset.olhoBusca) { const v = new FormData(f); Olho[f.dataset.olhoBusca].q = String(v.get('q') || '').trim(); await carregarOlho(); return; }
    if (f.id === 'olho-ajustes') {
      const v = new FormData(f), linhas = (k) => String(v.get(k) || '').split('\n').map((x) => x.trim()).filter(Boolean);
      const corpo = { ativo: !!v.get('ativo'), nivel_minimo_alerta: v.get('nivel_minimo_alerta'), nivel_push: v.get('nivel_push'), temas_alerta: linhas('temas_alerta'), segmentos: linhas('segmentos'), frequencia_empresa_h: Number(v.get('frequencia_empresa_h')), max_execucoes_dia: Number(v.get('max_execucoes_dia')), meu_negocio: String(v.get('meu_negocio') || '') };
      const r = await api('/olho/config', { metodo: 'POST', corpo }); Olho.cfg = r.config; aviso('Ajustes salvos.'); await carregarOlho();
    }
  } catch (err) { aviso(err.message); }
});

// ---------------------------------------------------------------------------
// Configuração: consumo de IA (Anthropic), temporizadores das rotinas e alertas de crédito
// ---------------------------------------------------------------------------
const Cfg = { aba: 'consumo', p: null, sel: null };
const usd = (v, casas) => {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  const n = Number(v), c = casas ?? (n > 0 && n < 0.01 ? 3 : 2);
  return 'US$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
};
const diaCurto = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const duracao = (d) => (d === null || d === undefined ? null : d >= 365 ? 'mais de 1 ano' : d >= 60 ? `~${Math.round(d / 30)} meses` : d >= 1.5 ? `~${Math.round(d)} dias` : d >= 1 ? '~1 dia' : `~${Math.max(1, Math.round(d * 24))} h`);

async function carregarConfig() {
  const [, aba] = location.hash.slice(1).split('/');
  Cfg.aba = ['consumo', 'economia', 'alertas', 'conexoes'].includes(aba) ? aba : 'consumo';
  document.querySelectorAll('#cfg-abas [data-cfg-aba]').forEach((b) => b.classList.toggle('on', b.dataset.cfgAba === Cfg.aba));
  if (!Cfg.p || Date.now() - Date.parse(Cfg.p.atualizado_em) > 20000) {
    if (!Cfg.p) $('#cfg-corpo').innerHTML = '<p class="dica centro">Carregando…</p>';
    Cfg.p = await api('/consumo/painel');
  }
  desenharConfig();
}
function desenharConfig() {
  const p = Cfg.p; if (!p) return;
  $('#cfg-corpo').innerHTML = cfgFaixaConexoes(p) + (Cfg.aba === 'economia' ? cfgEconomia(p) : Cfg.aba === 'alertas' ? cfgAlertas(p) : Cfg.aba === 'conexoes' ? cfgConexoes(p) : cfgConsumo(p));
}

function cfgHero(p) {
  const s = p.saldo, temSaldo = s.estimado !== null && s.estimado !== undefined;
  const frac = temSaldo && s.informado > 0 ? Math.max(0, Math.min(1, s.estimado / s.informado)) : 0;
  const nivel = !temSaldo ? 'vazio' : p.sem_credito || s.estimado <= 0 ? 'zerado' : (p.dias_restantes !== null && p.dias_restantes <= p.alertas.dias) || s.estimado <= p.alertas.saldo_usd ? 'baixo' : 'ok';
  const R = 46, C = 2 * Math.PI * R;
  const dura = duracao(p.dias_restantes);
  const fim = p.acaba_em ? new Date(p.acaba_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' }) : null;
  return `
  <section class="cfg-hero ${nivel}">
    ${p.sem_credito ? '<p class="cfg-alerta">O crédito acabou: a Anthropic está recusando as chamadas. Recarregue em <b>console.anthropic.com › Plans &amp; Billing</b>.</p>' : ''}
    <div class="cfg-hero-linha">
      <svg class="cfg-anel" viewBox="0 0 110 110" aria-hidden="true">
        <circle cx="55" cy="55" r="${R}" class="trilho"/>
        ${frac > 0 ? `<circle cx="55" cy="55" r="${R}" class="carga" stroke-dasharray="${(C * frac).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 55 55)"/>` : ''}
        <text x="55" y="52" class="pct">${temSaldo ? Math.round(frac * 100) + '%' : '?'}</text>
        <text x="55" y="68" class="pct-sub">${temSaldo ? 'restante' : 'sem saldo'}</text>
      </svg>
      <div class="cfg-hero-txt">
        <small>Saldo estimado</small>
        <b>${temSaldo ? usd(Math.max(0, s.estimado), 2) : '—'}</b>
        <span>${temSaldo ? (dura ? `Dura ${dura}${fim ? ` · até ${fim}` : ''}` : 'Ainda medindo o ritmo de uso') : 'Informe o saldo da conta para eu calcular quanto dura.'}</span>
        <span class="ritmo">${p.ritmo_dia !== null ? `Ritmo: ${usd(p.ritmo_dia)}/dia` : 'Ritmo: coletando dados'}</span>
      </div>
    </div>
    <div class="cfg-hero-acoes">
      <button class="btn pequeno" data-cfg-form="recarga">${temSaldo ? 'Recarreguei' : 'Informar saldo'}</button>
      ${temSaldo ? '<button class="btn pequeno claro" data-cfg-form="conferir">Conferir saldo</button>' : ''}
    </div>
    <div id="cfg-form-saldo"></div>
  </section>`;
}
function cfgFormSaldo(tipo) {
  const recarga = tipo === 'recarga';
  return `<form class="cfg-saldo-form" data-cfg-saldo="${tipo}">
    <label class="campo"><span>${recarga ? 'Saldo da conta agora (US$)' : 'O console mostra agora um saldo de (US$)'}</span>
      <input name="v" inputmode="decimal" placeholder="ex.: 25,00" autocomplete="off" required></label>
    <p class="campo-dica">${recarga ? 'A partir de agora eu desconto o que o Dimy gastar.' : 'Comparo com o que medi desde a última vez e ajusto as estimativas.'} O saldo fica em console.anthropic.com › Plans &amp; Billing.</p>
    <div class="cfg-form-acoes"><button class="btn primario pequeno">Salvar</button><button type="button" class="link" data-cfg-form="">Cancelar</button></div>
  </form>`;
}

function cfgGrafico(dias) {
  const W = 330, H = 120, base = 100, n = dias.length || 1, larg = W / n;
  const max = Math.max(0.01, ...dias.map((d) => Math.max(Number(d.usd) || 0, Number(d.oficial) || 0)));
  const hoje = dias.at(-1)?.dia;
  const barras = dias.map((d, i) => {
    const v = Number(d.usd) || 0, h = v > 0 ? Math.max(2, (v / max) * (base - 8)) : 0;
    const of = d.oficial !== null && d.oficial !== undefined ? Number(d.oficial) : null;
    return `<g class="cfg-dia${d.dia === hoje ? ' hoje' : ''}${Cfg.sel === d.dia ? ' sel' : ''}" data-cfg-dia="${d.dia}">
      <rect x="${i * larg}" y="0" width="${larg}" height="${base}" class="alvo"/>
      ${h ? `<rect x="${(i * larg + larg * 0.18).toFixed(1)}" y="${(base - h).toFixed(1)}" width="${(larg * 0.64).toFixed(1)}" height="${h.toFixed(1)}" rx="2" class="barra"/>` : ''}
      ${of !== null ? `<circle cx="${(i * larg + larg / 2).toFixed(1)}" cy="${(base - Math.max(2, (of / max) * (base - 8))).toFixed(1)}" r="2.4" class="oficial"/>` : ''}
    </g>`;
  }).join('');
  const rotulos = dias.map((d, i) => (i % 7 === 2 || i === n - 1) ? `<text x="${(i * larg + larg / 2).toFixed(1)}" y="${H - 4}" class="eixo">${i === n - 1 ? 'hoje' : diaCurto(d.dia)}</text>` : '').join('');
  const sel = dias.find((d) => d.dia === Cfg.sel);
  return `<div class="cfg-grafico">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gasto por dia nos últimos 30 dias">
      <line x1="0" x2="${W}" y1="${base}" y2="${base}" class="base"/>
      <text x="${W}" y="10" class="eixo topo">${usd(max)}</text>
      ${barras}${rotulos}
    </svg>
    <p class="cfg-grafico-leg">${sel ? `<b>${diaCurto(sel.dia)}</b>: ${usd(sel.usd)} medido em ${sel.chamadas} chamada(s)${sel.oficial !== null && sel.oficial !== undefined ? ` · oficial ${usd(sel.oficial)}` : ''}` : 'Toque numa barra para ver o dia.'}${dias.some((d) => d.oficial !== null && d.oficial !== undefined) ? ' <span class="leg-of">● oficial</span>' : ''}</p>
  </div>`;
}

function cfgConsumo(p) {
  const per = p.periodos, cob = p.cobertura || {};
  const rotinas = [...p.por_rotina];
  const totalDia = rotinas.reduce((a, r) => a + (Number(r.gasto_dia) || 0), 0) + (Number(cob.outras_dia) || 0);
  const linhas = rotinas.map((r) => ({ nome: r.nome, dia: Number(r.gasto_dia) || 0, ch: r.chamadas7, bu: Number(r.buscas7) || 0 }));
  if (cob.outras_dia > 0) linhas.push({ nome: 'Funções ainda não medidas (estimado)', dia: Number(cob.outras_dia), ch: null, bu: 0, outras: true });
  linhas.sort((a, b) => b.dia - a.dia);
  const medidas = (cob.medidas || []).length, total = medidas + (cob.nao_medidas || []).length;
  return `
  ${cfgHero(p)}
  <div class="olho-kpis cfg-kpis">
    <div class="olho-kpi"><b>${usd(per.hoje.usd)}</b><small>hoje · ${per.hoje.chamadas} chamadas</small></div>
    <div class="olho-kpi"><b>${usd(per.d7.usd)}</b><small>7 dias · ${per.d7.buscas} buscas web</small></div>
    <div class="olho-kpi"><b>${usd(per.d30.usd)}</b><small>30 dias${p.oficial.total_30d ? ` · oficial ${usd(p.oficial.total_30d)}` : ''}</small></div>
  </div>
  <h2 class="secao">Gasto por dia</h2>
  ${cfgGrafico(p.por_dia)}
  <h2 class="secao">Para onde vai o crédito</h2>
  ${linhas.length ? `<ul class="cfg-rotinas">${linhas.map((l) => `
    <li class="${l.outras ? 'outras' : ''}">
      <div class="cfg-rot-cab"><b>${esc(l.nome)}</b><span>${usd(l.dia)}/dia</span></div>
      <div class="cfg-rot-barra"><i style="width:${totalDia ? Math.max(2, (l.dia / totalDia) * 100).toFixed(1) : 0}%"></i></div>
      <small>${totalDia ? Math.round((l.dia / totalDia) * 100) : 0}% do gasto${l.ch !== null ? ` · ${l.ch} chamadas em 7 dias` : ''}${l.bu ? ` · ${l.bu} buscas na web` : ''}</small>
    </li>`).join('')}</ul>` : '<p class="olho-aviso">Ainda não há consumo medido. Os números aparecem assim que o Dimy fizer as próximas leituras.</p>'}
  <p class="campo-dica cfg-nota">Medição real das chamadas (tokens e buscas que a Anthropic devolve), com preços de tabela. ${medidas < total
    ? `Parte das funções ainda não grava o consumo; cada uma passa a gravar quando for atualizada.${cob.fator ? ` O total já está corrigido pela ${cob.origem === 'oficial' ? 'conta oficial' : 'conferência de saldo'} (×${String(cob.fator).replace('.', ',')}).` : ' Para o total exato, use “Conferir saldo” de vez em quando.'}`
    : 'Todas as funções estão sendo medidas.'}</p>
  ${p.por_modelo.length ? `<div class="cfg-modelos">${p.por_modelo.map((m) => `<span><b>${esc(m.modelo)}</b> ${usd(m.usd)} · ${m.chamadas} chamadas</span>`).join('')}</div>` : ''}
  <button class="btn claro largo cfg-ir-economia" data-cfg-aba-ir="economia">Reduzir o consumo →</button>`;
}

function cfgEconomia(p) {
  const presets = p.presets.map((m) => `
    <button class="cfg-preset${p.preset === m.id ? ' on' : ''}" data-cfg-preset="${m.id}">
      <b>${esc(m.nome)}</b><small>${esc(m.descricao)}</small>
      <span>${m.ritmo_dia !== null ? `≈ ${usd(m.ritmo_dia)}/dia` : 'estimativa após 3 h de uso'}</span>${m.dias !== null && m.dias !== undefined ? `<em>dura ${duracao(m.dias)}</em>` : ''}
    </button>`).join('');
  const tempo = p.temporizadores.map((t) => `
    <div class="cfg-tempo">
      <div class="cfg-tempo-cab"><b>${esc(t.nome)}</b>${t.gasto_dia ? `<span>${usd(t.gasto_dia)}/dia</span>` : ''}</div>
      <p>${esc(t.descricao)}</p>
      <select data-cfg-tempo="${t.rotina}" aria-label="Temporizador: ${esc(t.nome)}">
        ${t.atual === 'personalizado' ? '<option value="" selected>Personalizado (ajustado à mão)</option>' : ''}
        ${t.opcoes.map((o) => `<option value="${o.id}" ${t.atual === o.id ? 'selected' : ''}>${esc(o.rotulo)}${o.id === t.padrao ? ' (padrão)' : ''}${o.estimativa_dia !== null && o.estimativa_dia !== undefined && o.id !== t.atual ? ` · ≈ ${usd(o.estimativa_dia)}/dia` : ''}</option>`).join('')}
      </select>
    </div>`).join('');
  return `
  <p class="olho-aviso">Espaçar as rotinas é o jeito mais simples de o crédito durar mais. Cada mudança vale na hora.</p>
  <h2 class="secao">Modo de uso</h2>
  <div class="cfg-presets">${presets}</div>
  ${p.preset === 'personalizado' ? '<p class="campo-dica">Agora: personalizado (escolhas abaixo).</p>' : ''}
  <h2 class="secao">Temporizadores</h2>
  <div class="cfg-tempos">${tempo}</div>
  <p class="campo-dica cfg-nota">Conversa com o Dimy, atendimento, agendamento e memória não têm temporizador: só gastam quando chega mensagem ou quando você usa. As estimativas comparam com o gasto medido nos últimos 7 dias.</p>`;
}

function cfgAlertas(p) {
  const a = p.alertas, o = p.oficial;
  const num = (v) => (v === null || v === undefined ? '' : String(v).replace('.', ','));
  return `
  <form id="cfg-alertas" class="cfg-form">
    <h2 class="secao">Avisos no celular</h2>
    <div class="ajustes">
      <label class="campo"><span>Avisar quando o saldo estimado ficar abaixo de (US$)</span><input name="alerta_saldo_usd" inputmode="decimal" value="${num(a.saldo_usd)}"></label>
      <label class="campo"><span>Avisar quando faltarem (dias) para acabar</span><input name="alerta_dias" inputmode="numeric" value="${num(a.dias)}"></label>
      <label class="campo"><span>Avisar se o gasto do dia passar de (US$) — vazio = não avisar</span><input name="alerta_dia_usd" inputmode="decimal" value="${num(a.dia_usd)}" placeholder="ex.: 3,00"></label>
      <label class="linha-switch"><span><b>Economia automática</b><small>Se o saldo estimado cair abaixo do limite, eu passo sozinho para o modo Econômico e te aviso.</small></span>
        <input type="checkbox" name="economia_auto" class="switch" ${a.economia_auto ? 'checked' : ''}></label>
      <label class="campo"><span>Limite da economia automática (US$)</span><input name="economia_auto_usd" inputmode="decimal" value="${num(a.economia_auto_usd)}"></label>
      <button class="btn primario">Salvar avisos</button>
      <p class="campo-dica">Também aviso na hora se a Anthropic recusar as chamadas por falta de crédito.</p>
    </div>
  </form>
  <h2 class="secao">Saldo da conta</h2>
  <div class="ajustes">
    <p class="dica">${p.saldo.informado !== null && p.saldo.informado !== undefined ? `Informado: <b>${usd(p.saldo.informado)}</b> em ${quando(p.saldo.informado_em)}. Desde então: ${usd(p.saldo.gasto_desde)}.` : 'Você ainda não informou o saldo.'} A Anthropic não mostra o saldo para aplicativos; ele fica em console.anthropic.com › Plans &amp; Billing.</p>
    <div class="cfg-hero-acoes"><button class="btn pequeno" data-cfg-form="recarga">Recarreguei</button><button class="btn pequeno claro" data-cfg-form="conferir">Conferir saldo</button></div>
    <div id="cfg-form-saldo"></div>
    ${(p.cobertura?.conferencias || []).length ? `<ul class="cfg-conf">${p.cobertura.conferencias.slice().reverse().map((c) => `<li>${quando(c.em)}: ${usd(c.agora)}${c.fator ? ` · gasto real ${usd((c.antes ?? 0) - c.agora)} vs medido ${usd(c.medido)}` : ''}</li>`).join('')}</ul>` : ''}
  </div>
  <h2 class="secao">Conta oficial (opcional)</h2>
  <div class="ajustes">
    <p class="dica">${o.ativo ? `Ligado. O custo oficial de cada dia aparece no gráfico${o.atualizado_em ? ` (atualizado ${quando(o.atualizado_em)})` : ''}.` : 'Com uma chave de administrador da Anthropic, eu trago o custo oficial de cada dia e acerto as estimativas sozinho.'}${o.erro ? ` <span class="erro-txt">Último erro: ${esc(o.erro)}</span>` : ''}</p>
    <form id="cfg-chave" class="cfg-chave">
      <input name="chave" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${o.ativo ? 'Chave guardada' : 'sk-ant-admin…'}">
      <button class="btn claro">${o.ativo ? 'Trocar' : 'Ligar'}</button>
    </form>
    ${o.ativo ? '<button class="link perigo" data-cfg-tirar-chave>Desligar e apagar a chave</button>' : ''}
    <p class="campo-dica">A chave fica no cofre do servidor, nunca no celular. Só contas com organização criam essa chave: console.anthropic.com › Settings › Admin keys.</p>
  </div>
  <p class="campo-dica cfg-nota">Preços usados (US$ por milhão de tokens): ${(p.precos || []).map((x) => `${x.modelo.replace('claude-', '')}: entrada ${String(x.entrada).replace('.', ',')}, saída ${String(x.saida).replace('.', ',')}`).join(' · ')} · busca na web: US$ 10 por mil.</p>`;
}

// Conexões: estado das chaves dos serviços (conferidas a cada 10 min no servidor), validade, saldo e troca da chave
// direto daqui — a chave é testada no fornecedor antes de ser gravada no cofre; nunca volta para a tela.
const quandoCnx = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const CONEXAO_DICA = {
  anthropic: 'Crie em console.anthropic.com › Settings › API Keys › Create Key. Em validade (Expiration), escolha <b>Never</b>: assim ela não vence.',
  openai: 'Crie em platform.openai.com/api-keys › Create new secret key. Se aparecer validade, escolha a mais longa ou sem validade.',
  ycloud: 'Copie em YCloud › Developers › API Keys.',
};
function cfgFaixaConexoes(p) {
  const fora = (p.chaves || []).filter((c) => c.usado && c.essencial && !c.ok);
  if (!fora.length || Cfg.aba === 'conexoes') return '';
  return `<button class="cfg-faixa-fora" data-cfg-aba-ir="conexoes">⚠️ ${fora.map((c) => esc(c.nome)).join(', ')} ${fora.length > 1 ? 'pararam' : 'parou'}. Toque para resolver.</button>`;
}
function cfgConexoes(p) {
  const lista = (p.chaves || []).filter((c) => c.usado || !c.ok);
  if (!lista.length) return '<p class="dica centro">A primeira conferência das conexões ainda não rodou. Toque em "Conferir agora".</p><div class="centro"><button class="btn pequeno" data-cfg-testar>Conferir agora</button></div>';
  const ult = lista.reduce((m, c) => (c.verificado_em > m ? c.verificado_em : m), '');
  const temAdmin = (p.chaves || []).some((c) => c.servico === 'anthropic_admin');
  const linha = (c) => {
    const dias = c.expira_em ? (Date.parse(c.expira_em) - Date.now()) / 864e5 : null;
    const estado = !c.ok ? 'fora' : dias !== null && dias <= 7 ? 'atencao' : 'ok';
    const sub = !c.ok ? `Parou em ${quandoCnx(c.desde)}. ${esc(c.detalhe || '')}`
      : [esc(c.detalhe || 'Funcionando'), c.expira_em ? `vence em ${quandoCnx(c.expira_em)}${dias !== null && dias <= 7 ? ` (${Math.max(0, Math.ceil(dias))} dia${Math.ceil(dias) === 1 ? '' : 's'})` : ''}` : '', c.saldo !== null && c.saldo !== undefined ? `saldo ${usd(c.saldo)}` : ''].filter(Boolean).join(' · ');
    return `<li class="cnx ${estado}"><span class="cnx-ponto" aria-hidden="true"></span>
      <span class="cnx-corpo"><b>${esc(c.nome)}</b><small>${sub}</small></span>
      ${c.troca ? `<button class="btn pequeno ${c.ok ? 'claro' : ''}" data-cfg-trocar="${c.servico}">${c.ok ? 'Trocar' : 'Trocar chave'}</button>` : ''}</li>`;
  };
  return `<section class="ajustes cfg-conexoes">
    <p class="dica">Conferidas sozinhas a cada 10 minutos, sem gastar crédito. Se uma chave parar ou estiver para vencer, você recebe um aviso no celular, e nada se perde: as mensagens esperam e são processadas quando a conexão volta.</p>
    <ul class="cnx-lista">${lista.map(linha).join('')}</ul>
    <div class="cfg-form-acoes"><button class="btn pequeno claro" data-cfg-testar>Conferir agora</button><small class="dica">Última conferência: ${ult ? quandoCnx(ult) : '—'}</small></div>
    ${temAdmin ? '' : '<p class="campo-dica">Para eu avisar <b>antes</b> de a chave do Claude vencer, ligue a "conta oficial" em <a href="#config/alertas" class="link">Alertas e saldo</a> com uma chave de administrador (crie com validade Never).</p>'}
  </section>`;
}
function folhaTrocarChave(servico) {
  const c = (Cfg.p?.chaves || []).find((x) => x.servico === servico); if (!c) return;
  abrirFolha({
    titulo: `Trocar chave · ${c.nome}`, botao: 'Testar e salvar', ocupado: 'Testando…',
    campos: [
      { tipo: 'html', html: `<p class="campo-dica">${CONEXAO_DICA[servico] || ''} Cole aqui: eu testo no fornecedor e só gravo se funcionar. A chave fica no cofre do servidor e não aparece mais na tela.</p>` },
      { rotulo: 'Chave nova', nome: 'chave', tipoInput: 'password', placeholder: servico === 'anthropic' ? 'sk-ant-…' : servico === 'openai' ? 'sk-…' : '', autocomplete: 'off' },
    ],
    salvar: async (f) => {
      const chave = String(f.chave || '').trim();
      if (!chave) throw new Error('Cole a chave nova.');
      Cfg.p = await api('/consumo/chave', { metodo: 'POST', corpo: { servico, chave } });
      aviso(`Chave de ${c.nome} trocada e funcionando.`);
      desenharConfig();
    },
  });
}
$('#cfg-abas').addEventListener('click', (e) => { const b = e.target.closest('[data-cfg-aba]'); if (b) ir(`config/${b.dataset.cfgAba}`); });
$('#v-config').addEventListener('click', async (e) => {
  const el = e.target.closest('[data-cfg-form],[data-cfg-preset],[data-cfg-dia],[data-cfg-aba-ir],[data-cfg-tirar-chave],[data-cfg-trocar],[data-cfg-testar]');
  if (!el) return;
  const d = el.dataset;
  if (d.cfgAbaIr) { ir(`config/${d.cfgAbaIr}`); return; }
  if (d.cfgTrocar) { folhaTrocarChave(d.cfgTrocar); return; }
  if (d.cfgDia) { Cfg.sel = Cfg.sel === d.cfgDia ? null : d.cfgDia; const g = $('.cfg-grafico'); if (g) g.outerHTML = cfgGrafico(Cfg.p.por_dia); return; }
  if (d.cfgForm !== undefined) {
    e.preventDefault();
    const alvo = el.closest('.cfg-hero, .ajustes')?.querySelector('#cfg-form-saldo') || $('#cfg-form-saldo');
    if (alvo) { alvo.innerHTML = d.cfgForm ? cfgFormSaldo(d.cfgForm) : ''; alvo.querySelector('input')?.focus(); }
    return;
  }
  try {
    if (d.cfgPreset) {
      if (Cfg.p.preset === d.cfgPreset) return;
      document.querySelectorAll('.cfg-preset').forEach((b) => (b.disabled = true));
      Cfg.p = await api('/consumo/preset', { metodo: 'POST', corpo: { preset: d.cfgPreset } });
      aviso(`Modo ${Cfg.p.presets.find((m) => m.id === d.cfgPreset)?.nome ?? ''} ligado.`); desenharConfig(); return;
    }
    if (d.cfgTestar !== undefined) {
      el.disabled = true; el.textContent = 'Conferindo…';
      Cfg.p = await api('/consumo/chaves-testar', { metodo: 'POST', corpo: {} });
      const fora = (Cfg.p.chaves || []).filter((c) => c.usado && !c.ok);
      aviso(fora.length ? `${fora.length} conexão(ões) com problema.` : 'Todas as conexões funcionando.'); desenharConfig(); return;
    }
    if (d.cfgTirarChave !== undefined) {
      el.disabled = true;
      Cfg.p = await api('/consumo/chave-admin', { metodo: 'POST', corpo: { chave: '' } });
      aviso('Conta oficial desligada e chave apagada.'); desenharConfig();
    }
  } catch (err) { aviso(err.message); desenharConfig(); }
});
$('#v-config').addEventListener('change', async (e) => {
  const s = e.target.closest('[data-cfg-tempo]');
  if (!s || !s.value) return;
  s.disabled = true;
  try {
    Cfg.p = await api('/consumo/temporizador', { metodo: 'POST', corpo: { rotina: s.dataset.cfgTempo, opcao: s.value } });
    aviso('Temporizador atualizado.'); desenharConfig();
  } catch (err) { aviso(err.message); desenharConfig(); }
});
$('#v-config').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, b = f.querySelector('button:not([type=button])');
  if (b) b.disabled = true;
  try {
    if (f.dataset.cfgSaldo) {
      const v = f.querySelector('input').value.trim();
      const chave = f.dataset.cfgSaldo === 'recarga' ? 'saldo_usd' : 'conferir_saldo_usd';
      Cfg.p = await api('/consumo/config', { metodo: 'POST', corpo: { [chave]: v } });
      aviso(f.dataset.cfgSaldo === 'recarga' ? 'Saldo registrado. Agora eu acompanho o gasto.' : 'Saldo conferido. Estimativas ajustadas.');
    } else if (f.id === 'cfg-alertas') {
      const v = new FormData(f);
      Cfg.p = await api('/consumo/config', { metodo: 'POST', corpo: {
        alerta_saldo_usd: v.get('alerta_saldo_usd'), alerta_dias: v.get('alerta_dias'), alerta_dia_usd: v.get('alerta_dia_usd'),
        economia_auto: !!v.get('economia_auto'), economia_auto_usd: v.get('economia_auto_usd') } });
      aviso('Avisos salvos.');
    } else if (f.id === 'cfg-chave') {
      const chave = new FormData(f).get('chave');
      if (!String(chave || '').trim()) { aviso('Cole a chave de administrador.'); if (b) b.disabled = false; return; }
      Cfg.p = await api('/consumo/chave-admin', { metodo: 'POST', corpo: { chave } });
      aviso('Conta oficial ligada.');
    }
    desenharConfig();
  } catch (err) { aviso(err.message); if (b) b.disabled = false; }
});

// ---------------------------------------------------------------------------
// Barra de baixo presa ao fundo de verdade (iPhone): depois que o teclado abre e fecha, o iOS às vezes continua
// medindo a tela como se o teclado estivesse lá, e tudo que é "fixo no fundo" passa a andar junto com a rolagem.
// Aqui a barra segue a área visível (visualViewport) e some enquanto você digita; os painéis de resposta sobem
// junto com o teclado.
// ---------------------------------------------------------------------------
(function fundoEstavel() {
  const vv = window.visualViewport;
  if (!vv) return;
  const raiz = document.documentElement;
  const digitando = () => { const a = document.activeElement; return !!a && (a.isContentEditable || /^(TEXTAREA|SELECT)$/.test(a.tagName) || (a.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|range|file)$/i.test(a.type))); };
  let quadro = 0;
  const ajustar = () => {
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(() => {
      // > 0: o fundo visível está abaixo do que o navegador acha (bug do iOS) → desce a barra
      // < 0: o teclado cobre o fundo → esconde a barra e sobe o painel de resposta
      const desloc = Math.round(vv.offsetTop + vv.height - window.innerHeight);
      const teclado = desloc < -80 && digitando();
      raiz.classList.toggle('teclado', teclado);
      raiz.style.setProperty('--vv-desloc', `${teclado ? 0 : Math.max(0, desloc)}px`);
      raiz.style.setProperty('--vv-teclado', `${teclado ? desloc : 0}px`);
    });
  };
  vv.addEventListener('resize', ajustar);
  vv.addEventListener('scroll', ajustar);
  window.addEventListener('resize', ajustar);
  window.addEventListener('scroll', ajustar, { passive: true });
  document.addEventListener('focusin', () => setTimeout(ajustar, 350));
  document.addEventListener('focusout', () => setTimeout(() => {
    if (!digitando()) window.scrollTo(window.scrollX, window.scrollY);   // força o iOS a refazer as medidas da tela
    ajustar();
  }, 150));
  window.addEventListener('pageshow', ajustar);
  document.addEventListener('visibilitychange', ajustar);
  ajustar();
})();

// ---------------------------------------------------------------------------
// Equipe: chat interno privado (conversas a dois e o grupo "Equipe") e compartilhamento de agenda e tarefas
// Só quem participa vê a conversa (o servidor confere a cada pedido). Avisos chegam no celular de quem tem notificação ligada.
// ---------------------------------------------------------------------------
async function carregarContas() {
  try { Conta.lista = (await api('/chat/pessoas')).compartilhadas || []; } catch { Conta.lista = []; }
  for (const o of ['agenda', 'tarefas']) {
    const g = guardado.ler(`cerebro-conta-${o}`);
    Conta[o] = Conta.lista.some((c) => c.dono === g && c[o]) ? g : null;
  }
  // Quem recebeu a agenda de alguém (ex.: secretária) e não tem Google próprio abre direto a agenda compartilhada,
  // a menos que já tenha escolhido "Minha agenda" antes. Sem isso, ela marcava na própria agenda (sem Google) e falhava.
  const compartilhada = Conta.lista.find((c) => c.agenda);
  if (!Conta.agenda && compartilhada && guardado.ler('cerebro-conta-agenda') !== 'minha') {
    try { const r = await api(`/agenda?de=${diaISO(new Date())}&dias=1`); if (r.google === false) Conta.agenda = compartilhada.dono; } catch { /* fica na própria */ }
  }
}
function desenharSeletorConta(o) {
  const box = $(`#conta-${o}`); if (!box) return;
  const outras = Conta.lista.filter((c) => c[o]);
  box.hidden = !outras.length; if (!outras.length) return;
  box.innerHTML = [{ dono: '', nome: 'Minha' }, ...outras].map((c) => `<button data-conta-${o}="${esc(c.dono)}" class="${(Conta[o] || '') === c.dono ? 'on' : ''}">${c.dono ? `${o === 'agenda' ? 'Agenda' : 'Tarefas'} de ${esc(c.nome.split(' ')[0])}` : `${o === 'agenda' ? 'Minha agenda' : 'Minhas tarefas'}`}</button>`).join('');
}
document.addEventListener('click', (e) => {
  for (const o of ['agenda', 'tarefas']) {
    const b = e.target.closest(`[data-conta-${o}]`); if (!b) continue;
    Conta[o] = b.getAttribute(`data-conta-${o}`) || null;
    guardado.gravar(`cerebro-conta-${o}`, Conta[o] || 'minha');   // "minha" = escolheu a própria de propósito
    if (o === 'agenda') { Agenda.inicioSemana = null; carregarSemana().catch((err) => aviso(err.message)); }
    else carregarTarefas().catch((err) => aviso(err.message));
    return;
  }
});

const Chat = { conversas: [], atual: null, msgs: [], ultima: null, mais: false, timer: 0, enviando: false, lidoOutros: null, pessoas: null };
function pararChat() { clearInterval(Chat.timer); Chat.timer = 0; }
// A conversa ocupa exatamente o espaço visível (inclusive com o teclado do iPhone aberto), com a caixa de texto sempre embaixo.
function ajustarAlturaChat() {
  const c = $('#ch-conversa'); if (!c || c.hidden || $('#v-equipe').hidden) return;
  const vv = window.visualViewport, alto = vv ? vv.height + vv.offsetTop : innerHeight;
  const box = $('#ch-msgs'), noFim = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  c.style.height = `${Math.max(220, Math.floor(alto - c.getBoundingClientRect().top))}px`;
  if (noFim) box.scrollTop = box.scrollHeight;
}
window.visualViewport?.addEventListener('resize', ajustarAlturaChat);
window.addEventListener('resize', ajustarAlturaChat);
async function carregarChat(id) {
  Chat.atual = id || null;
  $('#ch-lista-box').hidden = !!id; $('#ch-conversa').hidden = !id; $('#ch-nova').hidden = !!id;
  document.body.classList.toggle('chat-aberto', !!id);
  if (id) requestAnimationFrame(ajustarAlturaChat);
  const [r] = await Promise.all([api('/chat/conversas'), Chat.pessoas ? null : api('/chat/pessoas').then((p) => (Chat.pessoas = p)).catch(() => {})]);
  Chat.conversas = r.conversas;
  if (!id) {
    $('#ch-titulo').textContent = 'Equipe'; $('#ch-sub').textContent = 'Conversas privadas: só quem participa vê';
    desenharListaChat(); desenharPeChat(); pararChat();
    Chat.timer = setInterval(() => { if (!document.hidden && !Chat.atual) api('/chat/conversas').then((x) => { Chat.conversas = x.conversas; desenharListaChat(); }).catch(() => {}); }, 15000);
    return;
  }
  const c = Chat.conversas.find((x) => x.id === id);
  $('#ch-titulo').textContent = c?.nome || 'Conversa';
  $('#ch-sub').textContent = c?.tipo === 'grupo' ? `${c.participantes} pessoas · todos da equipe` : 'Conversa privada';
  $('#ch-msgs').innerHTML = '<p class="dica centro">Carregando…</p>';
  const m = await api(`/chat/conversas/${id}/mensagens`);
  if (Chat.atual !== id) return;
  Chat.msgs = m.mensagens; Chat.mais = m.mais; Chat.lidoOutros = m.lido_pelos_outros; Chat.ultima = Chat.msgs.at(-1)?.criado_em || null;
  ajustarAlturaChat(); desenharMsgsChat(true); lidaChat(id);
  pararChat();
  Chat.timer = setInterval(() => { if (!document.hidden && Chat.atual === id) novasChat().catch(() => {}); }, 4000);
}
const iniciaisChat = (n) => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '•';
function desenharListaChat() {
  $('#ch-lista').innerHTML = Chat.conversas.map((c) => `<li><button class="ch-item" data-ir="equipe/${esc(c.id)}">
    <span class="ch-av ${c.tipo === 'grupo' ? 'grupo' : ''}">${c.tipo === 'grupo' ? '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M18 13.5a6 6 0 0 1 4 6"/></svg>' : esc(iniciaisChat(c.nome))}</span>
    <span class="ch-corpo"><b>${esc(c.nome)}</b><small>${c.ultima ? `${c.ultima.autor ? `${esc(c.ultima.autor)}: ` : ''}${esc(c.ultima.texto)}` : c.tipo === 'grupo' ? `${c.participantes} pessoa${c.participantes > 1 ? 's' : ''}` : 'Comece a conversa'}</small></span>
    <span class="ch-meta">${c.ultima ? `<small>${ha(c.ultima.em)}</small>` : ''}${c.nao_lidas ? `<i class="badge">${c.nao_lidas}</i>` : ''}</span></button></li>`).join('') || '<li class="dica centro">Nenhuma conversa ainda.</li>';
}
function desenharPeChat() {
  const p = Chat.pessoas, comigo = p?.compartilhadas || [];
  $('#ch-pe').innerHTML = `${comigo.length ? `<p class="dica">Compartilhado com você: ${comigo.map((c) => `<b>${esc(c.nome.split(' ')[0])}</b> (${[c.agenda && 'agenda', c.tarefas && 'tarefas'].filter(Boolean).join(' e ')})`).join(', ')}. Escolha no topo do calendário e das Tarefas.</p>` : ''}
    <button class="btn claro" id="ch-compartilhar">Compartilhar minha agenda e tarefas</button>`;
}
const horaChat = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const tamanhoChat = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
function desenharMsgsChat(rolarFim) {
  const box = $('#ch-msgs'), grupo = Chat.conversas.find((x) => x.id === Chat.atual)?.tipo === 'grupo';
  let dia = '', html = Chat.mais ? '<button class="link ch-antigas" id="ch-antigas">Ver mensagens anteriores</button>' : '';
  Chat.msgs.forEach((m, i) => {
    const d = new Date(m.criado_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long' });
    if (d !== dia) { dia = d; html += `<p class="ch-dia"><span>${esc(d)}</span></p>`; }
    const ant = Chat.msgs[i - 1], seguida = ant && ant.autor === m.autor && Date.parse(m.criado_em) - Date.parse(ant.criado_em) < 5 * 60e3;
    if (m.apagada) { html += `<div class="ch-bolha ${m.minha ? 'eu' : ''} apagada"><i>Mensagem apagada</i><small>${horaChat(m.criado_em)}</small></div>`; return; }
    const visto = m.minha && Chat.lidoOutros && Chat.lidoOutros >= m.criado_em;
    const anexo = m.anexo_nome ? (/^image\//.test(m.anexo_tipo || '')
      ? `<button class="ch-foto" data-ch-anexo="${esc(m.id)}" data-img="1">📷 ${esc(m.anexo_nome)}</button>`
      : `<button class="ch-arq" data-ch-anexo="${esc(m.id)}"><b>📎 ${esc(m.anexo_nome)}</b><small>${tamanhoChat(m.anexo_tamanho || 0)} · abrir</small></button>`) : '';
    html += `<div class="ch-bolha ${m.minha ? 'eu' : ''} ${seguida ? 'seguida' : ''}" ${m.minha ? `data-ch-minha="${esc(m.id)}"` : ''}>
      ${grupo && !m.minha && !seguida ? `<b class="ch-autor">${esc(m.autor_nome)}</b>` : ''}${anexo}${m.texto ? `<span>${leve(m.texto).replace(/\n/g, '<br>')}</span>` : ''}
      <small>${horaChat(m.criado_em)}${m.minha ? ` <span class="ch-visto ${visto ? 'lido' : ''}">${visto ? '✓✓' : '✓'}</span>` : ''}</small></div>`;
  });
  box.innerHTML = html || '<p class="dica centro">Nenhuma mensagem ainda. Diga um oi.</p>';
  if (rolarFim) box.scrollTop = box.scrollHeight;
  box.querySelectorAll('.ch-foto:not(.ok)').forEach(async (b) => {
    try { const { url } = await api(`/chat/anexo/${b.dataset.chAnexo}`); b.classList.add('ok'); b.innerHTML = `<img src="${esc(url)}" alt="Foto enviada" loading="lazy">`; b.querySelector('img').onload = () => { if (box.scrollHeight - box.scrollTop - box.clientHeight < 400) box.scrollTop = box.scrollHeight; }; } catch { /* fica o nome */ }
  });
}
async function novasChat() {
  const id = Chat.atual; if (!id) return;
  const r = await api(`/chat/conversas/${id}/mensagens${Chat.ultima ? `?depois=${encodeURIComponent(Chat.ultima)}` : ''}`);
  if (Chat.atual !== id) return;
  const ids = new Set(Chat.msgs.map((m) => m.id)), novas = r.mensagens.filter((m) => !ids.has(m.id));
  const mudou = r.lido_pelos_outros !== Chat.lidoOutros; Chat.lidoOutros = r.lido_pelos_outros;
  if (!novas.length && !mudou) return;
  const box = $('#ch-msgs'), noFim = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  Chat.msgs.push(...novas); Chat.ultima = Chat.msgs.at(-1)?.criado_em || Chat.ultima;
  desenharMsgsChat(noFim);
  if (novas.some((m) => !m.minha)) lidaChat(id);
}
function lidaChat(id) { api(`/chat/conversas/${id}/lido`, { metodo: 'POST' }).then(() => api('/chat/naolidas')).then((r) => { $('#badge-equipe').hidden = !r.total; $('#badge-equipe').textContent = r.total; }).catch(() => {}); }
async function enviarChat() {
  const t = $('#ch-texto'), texto = t.value.trim(); if (!texto || Chat.enviando || !Chat.atual) return;
  Chat.enviando = true; t.value = ''; t.style.height = '';
  try { const { mensagem } = await api(`/chat/conversas/${Chat.atual}/mensagens`, { metodo: 'POST', corpo: { texto } }); Chat.msgs.push(mensagem); Chat.ultima = mensagem.criado_em; desenharMsgsChat(true); }
  catch (err) { t.value = texto; aviso(`Não foi: ${err.message}`); }
  finally { Chat.enviando = false; }
}
async function enviarArquivosChat(lista) {
  const conv = Chat.atual;
  for (let f of lista) {
    if (/^image\//.test(f.type) && f.size > 1.5e6) { try { f = await reduzirFotoChat(f); } catch { /* manda o original */ } }
    if (f.size > 25 * 1024 * 1024) { aviso(`${f.name}: grande demais (máx. 25 MB).`); continue; }
    aviso(`Enviando ${f.name}…`);
    try { const { mensagem } = await api(`/chat/conversas/${conv}/mensagens?nome=${encodeURIComponent(f.name)}`, { metodo: 'POST', corpo: f, tipo: f.type || 'application/octet-stream' }); if (Chat.atual === conv) { Chat.msgs.push(mensagem); Chat.ultima = mensagem.criado_em; desenharMsgsChat(true); } }
    catch (err) { aviso(`${f.name}: ${err.message}`); }
  }
}
// Foto grande do iPhone: reduz para no máx. 1600 px antes de enviar (mais rápido no 4G).
async function reduzirFotoChat(f) {
  const img = await createImageBitmap(f), k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const b = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
  return new File([b], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}
$('#ch-form').addEventListener('submit', (e) => { e.preventDefault(); enviarChat(); });
$('#ch-texto').addEventListener('input', (e) => { e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`; });
$('#ch-arquivo').addEventListener('change', (e) => { const f = [...e.target.files]; e.target.value = ''; if (f.length) enviarArquivosChat(f); });
$('#ch-voltar').addEventListener('click', () => ir(Chat.atual ? 'equipe' : 'hoje'));
$('#v-equipe').addEventListener('click', async (e) => {
  const an = e.target.closest('[data-ch-anexo]');
  if (an) { try { const { url } = await api(`/chat/anexo/${an.dataset.chAnexo}${an.dataset.img ? '' : '?baixar=1'}`); window.open(url, '_blank', 'noopener'); } catch (err) { aviso(err.message); } return; }
  if (e.target.closest('#ch-antigas')) {
    const box = $('#ch-msgs'), alt = box.scrollHeight;
    const r = await api(`/chat/conversas/${Chat.atual}/mensagens?antes=${encodeURIComponent(Chat.msgs[0]?.criado_em || '')}`);
    Chat.msgs.unshift(...r.mensagens); Chat.mais = r.mais; desenharMsgsChat(false); box.scrollTop = box.scrollHeight - alt; return;
  }
  if (e.target.closest('#ch-nova')) {
    const equipe = Chat.pessoas?.equipe || [];
    if (!equipe.length) { aviso(eu?.usuario?.papel === 'admin' ? 'Ainda não há mais ninguém na equipe. Convide em Avisos › Equipe.' : 'Ainda não há mais ninguém na equipe.'); return; }
    abrirFolha({ titulo: 'Conversar com…', botao: 'Abrir conversa', campos: [{ tipo: 'escolha', rotulo: 'Pessoa', nome: 'com', opcoes: equipe.map((m, i) => ({ valor: m.id, texto: m.nome, marcado: i === 0 })) }],
      salvar: async (f) => { const r = await api('/chat/conversas', { metodo: 'POST', corpo: { com: f.com } }); ir(`equipe/${r.id}`); } });
    return;
  }
  if (e.target.closest('#ch-compartilhar')) {
    const equipe = Chat.pessoas?.equipe || [];
    if (!equipe.length) { aviso(eu?.usuario?.papel === 'admin' ? 'Convide a pessoa para a equipe primeiro (Avisos › Equipe).' : 'Ainda não há mais ninguém na equipe.'); return; }
    try {
      const { acessos } = await api('/chat/acessos'), tem = new Map(acessos.map((a) => [a.membro, a]));
      abrirFolha({ titulo: 'Compartilhar agenda e tarefas', campos: [
        { tipo: 'html', html: '<p class="campo-dica">Quem você marcar poderá ver e mexer: marcar, mudar e cancelar compromissos; criar, editar e concluir tarefas. Fica registrado com o nome da pessoa. Excluir tarefa de vez continua só com você.</p>' },
        ...equipe.map((m) => ({ tipo: 'marcas', rotulo: m.nome, opcoes: [{ nome: `agenda_${m.id}`, texto: 'Minha agenda', marcado: !!tem.get(m.id)?.agenda }, { nome: `tarefas_${m.id}`, texto: 'Minhas tarefas', marcado: !!tem.get(m.id)?.tarefas }] })),
      ], salvar: async (f) => {
        for (const m of equipe) {
          const agenda = !!f[`agenda_${m.id}`], tarefas = !!f[`tarefas_${m.id}`], antes = tem.get(m.id);
          if (!!antes?.agenda === agenda && !!antes?.tarefas === tarefas) continue;
          if (!agenda && !tarefas) await api(`/chat/acessos/${m.id}/remover`, { metodo: 'POST' });
          else await api('/chat/acessos', { metodo: 'POST', corpo: { membro: m.id, agenda, tarefas } });
        }
        aviso('Compartilhamento atualizado.');
      } });
    } catch (err) { aviso(err.message); }
  }
});
