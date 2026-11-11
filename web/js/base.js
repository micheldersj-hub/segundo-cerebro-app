// Dimy Web — base: conexão com o servidor (as mesmas funções do app), login, utilidades, janela, avisos e sincronização.
// Nada de dado fica só aqui: tudo é lido e gravado no mesmo servidor do app, por isso o que muda num aparece no outro.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

export const VERSAO = 'w1';
const PROJ = 'https://mavjbevuhzalkqyxaajw.supabase.co';
const F = (n) => `${PROJ}/functions/v1/${n}`;
// Chave anônima: pública por design (só permite entrar); os dados passam pelas funções, que conferem o login.
export const SUPA = createClient(PROJ,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hdmpiZXZ1aHphbGtxeXhhYWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5ODg5OTQsImV4cCI6MjEwNjU2NDk5NH0.BGSKd3B2B0m2MuDUmdJHEVOPS6l551axEP7DVAxfidA',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'cerebro-sessao' } });

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const guardado = {
  ler(k) { try { return localStorage.getItem(k); } catch { return null; } },
  gravar(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
};
export const Sessao = { sessao: null, chave: guardado.ler('cerebro-chave'), eu: null };
export const ehDono = () => !Sessao.eu || !!Sessao.eu.dono;

// ---- API: mesmas rotas e mesma divisão por função que o app usa ----
const ROTAS = [
  [/^\/equipe/, 'equipe', /^\/equipe/], [/^\/(gravacoes|voz)/, 'gravador'], [/^\/exportar/, 'extra'], [/^\/documento/, 'documento'],
  [/^\/rascunhos/, 'agendador'], [/^\/atendente/, 'atendente'], [/^\/tarefas/, 'tarefas', /^\/tarefas/], [/^\/olho/, 'olho', /^\/olho/],
  [/^\/consumo/, 'consumo', /^\/consumo/], [/^\/(dossies|local|proximas)/, 'oraculo'],
];
export async function api(caminho, { metodo = 'GET', corpo, tipo } = {}) {
  const headers = {};
  try { Sessao.sessao = (await SUPA.auth.getSession()).data.session; } catch { Sessao.sessao = null; }
  if (Sessao.sessao) headers.authorization = `Bearer ${Sessao.sessao.access_token}`;
  else if (Sessao.chave) headers['x-app-key'] = Sessao.chave;
  let body;
  if (corpo instanceof Blob) { body = corpo; headers['content-type'] = tipo || corpo.type || 'application/octet-stream'; }
  else if (corpo !== undefined) { body = JSON.stringify(corpo); headers['content-type'] = 'application/json'; }
  let base = F('app');
  for (const [re, fn, tira] of ROTAS) if (re.test(caminho)) { base = F(fn); if (tira) caminho = caminho.replace(tira, '') || '/'; break; }
  if (caminho === '/' ) caminho = '';
  let res;
  try { res = await fetch(base + caminho, { method: metodo, headers, body }); }
  catch { Sincronia.falhou(); throw new Error('Sem conexão com o servidor. Confira a internet.'); }
  const dados = await res.json().catch(() => ({}));
  if (res.status === 401) { Sincronia.falhou(); document.dispatchEvent(new CustomEvent('dimy:sair')); throw new Error(dados.erro || 'Sessão expirada. Entre de novo.'); }
  if (!res.ok) throw Object.assign(new Error(textoErro(dados.erro || `Erro ${res.status}`)), { codigo: dados.codigo, status: res.status });
  if (metodo === 'GET') Sincronia.ok();
  return dados;
}
const textoErro = (m) => (/credit balance|crédito/i.test(m) ? 'O Dimy está sem crédito de IA. Veja Configuração › Consumo no app.' : /[{}]/.test(m) ? 'O servidor não conseguiu fazer isso agora. Tente de novo.' : m);

// ---- Sincronização: o app e o site leem o mesmo servidor; aqui a tela atual se atualiza sozinha ----
export const Sincronia = {
  em: 0, erro: false, timer: 0, recarregar: null,
  ok() { this.em = Date.now(); this.erro = false; this.pintar(); },
  falhou() { this.erro = true; this.pintar(); },
  pintar() {
    const el = $('#sincronia'); if (!el) return;
    el.classList.toggle('erro', this.erro);
    el.querySelector('span').textContent = this.erro ? 'Sem conexão' : this.em ? `Sincronizado ${haCurto(this.em)}` : 'Sincronizando…';
  },
  // A cada 30 s (com a aba visível), ao voltar para a aba e ao recuperar a internet, a tela atual busca o que mudou.
  ligar(fn) {
    this.recarregar = fn;
    clearInterval(this.timer);
    this.timer = setInterval(() => { this.pintar(); if (!document.hidden && !algoAberto()) fn?.(true); }, 30000);
  },
};
const algoAberto = () => $('#janela')?.open || document.activeElement?.matches?.('input, textarea, select');
document.addEventListener('visibilitychange', () => { if (!document.hidden && !algoAberto()) Sincronia.recarregar?.(true); });
addEventListener('online', () => Sincronia.recarregar?.(true));
setInterval(() => Sincronia.pintar(), 15000);

// ---- Utilidades ----
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const leve = (s) => esc(s).replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
export const TZ = 'America/Sao_Paulo';
export const diaISO = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d instanceof Date ? d : new Date(d));
export const horaISO = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d instanceof Date ? d : new Date(d));
export const montarISO = (dia, hm) => `${dia}T${hm}:00-03:00`;
export const somaDias = (dia, n) => diaISO(new Date(Date.parse(`${dia}T12:00:00-03:00`) + n * 864e5));
export const diaSemana = (dia) => new Date(`${dia}T12:00:00-03:00`).getUTCDay();
export const nomeDia = (dia, opts) => new Date(`${dia}T12:00:00-03:00`).toLocaleDateString('pt-BR', { timeZone: TZ, ...opts });
export const maiuscula = (s) => String(s).replace(/^./, (c) => c.toUpperCase());
export const hoje = () => diaISO(new Date());
export function quando(iso) {
  if (!iso) return '';
  const mesmoDia = diaISO(iso) === hoje();
  return mesmoDia ? horaISO(iso) : `${new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: TZ }).replace('.', '')} ${horaISO(iso)}`;
}
export function ha(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (!(s >= 0)) return '';
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400); return d === 1 ? 'ontem' : `há ${d} dias`;
}
const haCurto = (t) => { const s = (Date.now() - t) / 1000; return s < 45 ? 'agora' : s < 3600 ? `há ${Math.round(s / 60)} min` : `há ${Math.round(s / 3600)} h`; };
export function foneBonito(wa) {
  const d = String(wa || '').replace(/\D/g, '');
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(d);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d ? `+${d}` : 'Contato';
}
export const nomeValido = (n) => !!n && !/^<?unknown>?$/i.test(n.trim()) && !/^\+?\d[\d\s-]+$/.test(n.trim());
export const nomeDe = (c) => (nomeValido(c?.name) ? c.name.trim() : foneBonito(c?.wa_id));
export const iniciais = (n) => String(n || '').replace(/^\+/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '•';
const CORES = ['azul', 'roxo', 'ambar', 'rosa', 'verde'];
export const corDe = (s) => CORES[[...String(s)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % CORES.length];
export const avatar = (c, cls = '') => `<span class="av ${corDe(c.wa_id || c.nome || '')} ${cls}">${nomeValido(c.name ?? c.nome) ? esc(iniciais(c.name ?? c.nome)) : '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'}</span>`;
export const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---- Avisos (toast) ----
export function aviso(msg, tipo = '') {
  const t = $('#toast'); t.textContent = msg; t.className = `toast ${tipo}`; t.hidden = false;
  clearTimeout(aviso.t); aviso.t = setTimeout(() => (t.hidden = true), 3600);
}

// ---- Janela de formulário (substitui a "folha" do celular) ----
let acaoJanela = null, botaoJanela = 'Salvar';
export function abrirJanela({ titulo, campos, salvar, apagar, botao = 'Salvar', largura = '' }) {
  const d = $('#janela');
  $('#janela-titulo').textContent = titulo;
  d.className = `janela ${largura}`;
  botaoJanela = botao; $('#janela-ok').textContent = botao; $('#janela-ok').hidden = !salvar;
  $('#janela-campos').innerHTML = campos.map(campoHTML).join('');
  $('#janela-erro').textContent = '';
  $('#janela-apagar').hidden = !apagar;
  $('#janela-apagar').onclick = apagar ? async () => { if (!confirm('Apagar mesmo?')) return; try { await apagar(); d.close(); } catch (e) { $('#janela-erro').textContent = e.message; } } : null;
  acaoJanela = salvar;
  d.showModal();
  setTimeout(() => $('#janela-campos input:not([type=hidden]), #janela-campos textarea')?.focus(), 30);
}
function campoHTML(c) {
  if (c.tipo === 'html') return c.html;
  if (c.tipo === 'linha') return `<div class="linha-campos">${c.campos.map(campoHTML).join('')}</div>`;
  if (c.tipo === 'escolha') return `<div class="campo"><span>${c.rotulo}</span><div class="escolha">${c.opcoes.map((o) => `<label><input type="radio" name="${c.nome}" value="${esc(o.valor)}" ${o.marcado ? 'checked' : ''}><span>${esc(o.texto)}</span></label>`).join('')}</div></div>`;
  if (c.tipo === 'marcas') return `<div class="campo"><span>${c.rotulo}</span><div class="escolha">${c.opcoes.map((o) => `<label><input type="checkbox" name="${o.nome}" value="1" ${o.marcado ? 'checked' : ''}><span>${esc(o.texto)}</span></label>`).join('')}</div></div>`;
  if (c.tipoInput === 'textarea') return `<label class="campo"><span>${c.rotulo}</span><textarea name="${c.nome}" rows="${c.linhas || 3}" placeholder="${esc(c.placeholder || '')}">${esc(c.valor || '')}</textarea></label>${c.dica ? `<p class="dica">${esc(c.dica)}</p>` : ''}`;
  return `<label class="campo ${c.classe || ''}"><span>${c.rotulo}</span><input name="${c.nome}" type="${c.tipoInput || 'text'}" value="${esc(c.valor ?? '')}" placeholder="${esc(c.placeholder || '')}" ${c.obrigatorio ? 'required' : ''} autocomplete="off"></label>${c.dica ? `<p class="dica">${esc(c.dica)}</p>` : ''}`;
}
$('#janela').addEventListener('click', (e) => { if (e.target.closest('[data-fechar]') || e.target === e.currentTarget) e.currentTarget.close(); });
$('#janela-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!acaoJanela) return;
  const b = $('#janela-ok'); if (b.disabled) return;
  const dados = Object.fromEntries(new FormData(e.currentTarget));
  b.disabled = true; b.textContent = 'Salvando…'; $('#janela-erro').textContent = '';
  try { const r = await acaoJanela(dados); if (r !== 'manter') $('#janela').close(); }
  catch (err) { $('#janela-erro').textContent = err.message; }
  finally { b.disabled = false; b.textContent = botaoJanela; }
});

// ---- Agenda e lembretes (usados por Hoje e Oráculo) ----
export const proximaHoraCheia = () => { const h = Number(horaISO(new Date()).slice(0, 2)) + 1; return `${String(Math.min(h, 22)).padStart(2, '0')}:00`; };
export function editarEvento(ev, { dia, sugestao, depois } = {}) {
  const d0 = ev ? diaISO(ev.inicio) : dia || hoje();
  const ini = ev && !ev.dia_inteiro ? horaISO(ev.inicio) : proximaHoraCheia();
  const fim = ev && ev.fim && !ev.dia_inteiro ? horaISO(ev.fim) : horaISO(new Date(Date.parse(montarISO(d0, ini)) + 3600e3));
  abrirJanela({
    titulo: ev ? 'Editar compromisso' : 'Novo compromisso',
    campos: [
      { rotulo: 'O quê', nome: 'titulo', valor: ev?.titulo ?? sugestao?.titulo, placeholder: 'Visita – cliente', obrigatorio: true },
      { tipo: 'linha', campos: [{ rotulo: 'Dia', nome: 'dia', tipoInput: 'date', valor: d0 }, { rotulo: 'Início', nome: 'inicio', tipoInput: 'time', valor: ini }, { rotulo: 'Fim', nome: 'fim', tipoInput: 'time', valor: fim }] },
      { rotulo: 'Onde', nome: 'local', valor: ev?.local ?? sugestao?.local, placeholder: 'Opcional' },
    ],
    salvar: async (f) => {
      if (!f.titulo?.trim() || !f.dia || !f.inicio) throw new Error('Preencha o quê, o dia e a hora.');
      let fimISO = montarISO(f.dia, f.fim || f.inicio);
      if (!f.fim || Date.parse(fimISO) <= Date.parse(montarISO(f.dia, f.inicio))) fimISO = new Date(Date.parse(montarISO(f.dia, f.inicio)) + 3600e3).toISOString();
      await api(ev ? `/agenda/${encodeURIComponent(ev.id)}` : '/agenda', { metodo: 'POST', corpo: { titulo: f.titulo.trim(), inicio: montarISO(f.dia, f.inicio), fim: fimISO, local: f.local?.trim() || '' } });
      aviso(ev ? 'Compromisso atualizado.' : 'Compromisso marcado. O alarme toca 20 min antes.');
      depois?.(f.dia);
    },
    apagar: ev ? async () => { await api(`/agenda/${encodeURIComponent(ev.id)}/apagar`, { metodo: 'POST' }); aviso('Compromisso apagado.'); depois?.(); } : null,
  });
}
export function editarLembrete(l, { sugestao, depois } = {}) {
  const q = l ? new Date(l.due_at) : null;
  abrirJanela({
    titulo: l ? 'Editar lembrete' : 'Novo lembrete',
    campos: [
      { rotulo: 'Lembrar de', nome: 'texto', valor: l?.text ?? sugestao?.texto, placeholder: 'Ligar para o cliente', obrigatorio: true },
      { tipo: 'linha', campos: [{ rotulo: 'Dia', nome: 'dia', tipoInput: 'date', valor: q ? diaISO(q) : sugestao?.dia || hoje() }, { rotulo: 'Hora', nome: 'hora', tipoInput: 'time', valor: q ? horaISO(q) : sugestao?.hora || proximaHoraCheia() }] },
    ],
    salvar: async (f) => {
      if (!f.texto?.trim() || !f.dia || !f.hora) throw new Error('Preencha o texto, o dia e a hora.');
      await api(l ? `/lembretes/${encodeURIComponent(l.id)}` : '/lembretes', { metodo: 'POST', corpo: { texto: f.texto.trim(), quando: montarISO(f.dia, f.hora) } });
      aviso(l ? 'Lembrete atualizado.' : 'Lembrete criado. Toca no celular na hora.');
      depois?.();
    },
    apagar: l ? async () => { await api(`/lembretes/${encodeURIComponent(l.id)}/cancelar`, { metodo: 'POST' }); aviso('Lembrete cancelado.'); depois?.(); } : null,
  });
}
export const eEndereco = (l) => !!l && l.trim().length >= 6 && !/^https?:|meet\.|zoom|teams|google meet|online|whatsapp|liga[cç][aã]o|telefone|videochamada/i.test(l);
export const linkMapa = (l) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(l)}`;
export const IC = {
  mais: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  rel: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  local: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-12a7 7 0 1 1 14 0c0 5.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  sino: '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8Zm4 11a2 2 0 0 0 4 0"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  esq: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  dir: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  ok: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
  whats: '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z"/></svg>',
  busca: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  atualizar: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
};
