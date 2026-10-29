// Segundo Cérebro — app do iPhone (PWA). Fala só com a função "app" do Supabase.
const API = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/app';
const GRAVADOR = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/gravador';
const CHAVE = 'cerebro-chave';
const $ = (s) => document.querySelector(s);

const guardado = {
  ler(k) { try { return localStorage.getItem(k); } catch { return null; } },
  gravar(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
};
let chave = guardado.ler(CHAVE);

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
async function api(caminho, { metodo = 'GET', corpo, tipo } = {}) {
  const headers = { 'x-app-key': chave || '' };
  let body;
  if (corpo instanceof Blob) { body = corpo; headers['content-type'] = tipo || corpo.type || 'application/octet-stream'; }
  else if (corpo !== undefined) { body = JSON.stringify(corpo); headers['content-type'] = 'application/json'; }
  const base = /^\/(gravacoes|voz)/.test(caminho) ? GRAVADOR : API;
  const res = await fetch(base + caminho, { method: metodo, headers, body });
  const dados = await res.json().catch(() => ({}));
  if (res.status === 401) { sair(); throw new Error('Chave inválida.'); }
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
  whats: '#v-whats', contato: '#v-contato', mais: '#v-mais',
};
const ABA_DE = { contato: 'whats', gravando: 'gravar', gravacao: 'gravar' };

function ir(destino) { location.hash = destino; }

async function rota() {
  const [nome, arg] = (location.hash.slice(1) || 'hoje').split('/');
  const vista = nome === 'avisos' ? 'mais' : VISTAS[nome] ? nome : 'hoje';
  for (const [k, sel] of Object.entries(VISTAS)) $(sel).hidden = k !== vista;
  document.querySelectorAll('.abas button').forEach((b) => b.classList.toggle('ativa', b.dataset.ir === (ABA_DE[vista] || vista)));
  $('#pilula-gravando').hidden = !Rec.ativo || vista === 'gravando';
  if (vista !== 'gravacao') pararDetalhe();
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
  return h < 12 ? 'Bom dia, Michelder' : h < 18 ? 'Boa tarde, Michelder' : 'Boa noite, Michelder';
}

// A âncora: uma coisa só, a mais importante agora.
function escolherAncora(d) {
  const urgente = d.avisos.find((a) => a.kind === 'urgente' && !a.read_at);
  if (urgente) return { texto: `${urgente.title.replace(/^🚨\s*/, '')}: ${urgente.body}`, acao: 'Ver conversa', ir: urgente.data?.contact ? `contato/${urgente.data.contact}` : 'mais' };
  if (d.perguntas.length) return { texto: d.perguntas[0].question, acao: 'Responder', ir: 'conversa' };
  const agenda = Array.isArray(d.agenda) ? d.agenda : [];
  const proximo = agenda.find((e) => new Date(e.inicio) - Date.now() < 2 * 3600e3 && new Date(e.inicio) > Date.now() - 15 * 60e3);
  if (proximo) return { texto: `${proximo.titulo} às ${hora(proximo.inicio)}${proximo.local ? `, em ${proximo.local}` : ''}.` };
  if (d.aguardando.length) {
    const c = d.aguardando[0];
    return { texto: `${nomeDe(c)} espera sua resposta${c.last_summary ? `: ${c.last_summary}` : '.'}`, acao: 'Responder', ir: `contato/${c.wa_id}` };
  }
  const lembrete = d.lembretes.find((l) => new Date(l.due_at) - Date.now() < 3 * 3600e3);
  if (lembrete) return { texto: `${lembrete.text} às ${hora(lembrete.due_at)}.` };
  return { texto: 'Nada pedindo você agora. Se quiser, me conta como está o dia.', acao: 'Conversar', ir: 'conversa' };
}

// ---- Datas no fuso de São Paulo ----
const TZ = 'America/Sao_Paulo';
const diaISO = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d instanceof Date ? d : new Date(d));
const horaISO = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d instanceof Date ? d : new Date(d));
const montarISO = (dia, hm) => `${dia}T${hm}:00-03:00`;
const somaDias = (dia, n) => diaISO(new Date(Date.parse(`${dia}T12:00:00-03:00`) + n * 864e5));
const diaSemana = (dia) => new Date(`${dia}T12:00:00-03:00`).getUTCDay(); // 0 = domingo
const nomeDia = (dia, opts) => new Date(`${dia}T12:00:00-03:00`).toLocaleDateString('pt-BR', { timeZone: TZ, ...opts });

const Agenda = { dia: diaISO(new Date()), inicioSemana: null, eventos: [], google: true };
function inicioDaSemana(dia) { return somaDias(dia, -((diaSemana(dia) + 6) % 7)); } // segunda-feira

async function carregarHoje() {
  $('#hoje-saudacao').textContent = saudacao();
  const hoje = diaISO(new Date());
  $('#hoje-data').textContent = nomeDia(hoje, { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase());
  const [d] = await Promise.all([api('/hoje'), carregarSemana()]);
  atualizarBadges(d);

  const a = escolherAncora(d);
  $('#ancora').hidden = false;
  $('#ancora-texto').textContent = a.texto;
  const bt = $('#ancora-acao');
  bt.hidden = !a.acao; bt.textContent = a.acao || '';
  bt.onclick = () => a.ir && ir(a.ir);

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
  const ini = inicioDaSemana(Agenda.dia);
  if (ini !== Agenda.inicioSemana) {
    Agenda.inicioSemana = ini;
    try {
      const r = await api(`/agenda?de=${ini}&dias=7`);
      Agenda.google = r.google; Agenda.eventos = r.eventos;
    } catch (e) { Agenda.eventos = []; aviso(`Agenda: ${e.message}`); }
  }
  desenharSemana(); desenharLinhaTempo();
}

function desenharSemana() {
  const ini = Agenda.inicioSemana, hoje = diaISO(new Date());
  const meio = somaDias(ini, 3);
  $('#sem-mes').textContent = nomeDia(meio, { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase());
  const letras = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  $('#semana').innerHTML = Array.from({ length: 7 }, (_, k) => {
    const dia = somaDias(ini, k);
    const n = Agenda.eventos.filter((e) => diaISO(e.inicio) === dia).length;
    return `<button class="dia ${dia === Agenda.dia ? 'sel' : ''} ${dia === hoje ? 'hoje' : ''}" data-dia="${dia}" role="tab" aria-selected="${dia === Agenda.dia}">
      <span class="dia-l">${letras[k]}</span><span class="dia-n">${Number(dia.slice(8))}</span><span class="pontos">${'<i></i>'.repeat(Math.min(n, 3))}</span></button>`;
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
    return `${linha}<div class="evento ${passou ? 'passou' : ''}">
      <div class="ev-hora">${e.dia_inteiro ? '•' : horaISO(e.inicio)}</div>
      <button class="ev-cartao ${cores[k % cores.length]}" data-evento="${esc(e.id)}">
        <span class="ev-t">${esc(e.titulo)}</span>
        <span class="ev-meta"><span class="pilula-hora"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${hora}</span>${e.local ? `<span class="ev-local"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-12a7 7 0 1 1 14 0c0 5.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>${esc(e.local)}</span>` : ''}</span>
        <span class="ev-editar" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/></svg></span>
      </button></div>`;
  }).join('') + (!marcouAgora ? `<div class="agora-linha"><span>${horaISO(new Date())}</span></div>` : '');
}

document.addEventListener('click', async (e) => {
  const d = e.target.closest('.dia[data-dia]');
  if (d) { Agenda.dia = d.dataset.dia; desenharSemana(); desenharLinhaTempo(); return; }
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
$('#sem-ant').addEventListener('click', () => { Agenda.dia = somaDias(Agenda.inicioSemana, -7); carregarSemana(); });
$('#sem-prox').addEventListener('click', () => { Agenda.dia = somaDias(Agenda.inicioSemana, 7); carregarSemana(); });

// ---------------------------------------------------------------------------
// Folha de edição: calendário (data) e relógio (hora) nativos do iPhone
// ---------------------------------------------------------------------------
const IC_CAL = '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
const IC_REL = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
let folhaAcao = null;

function abrirFolha({ titulo, campos, salvar, apagar }) {
  $('#folha-titulo').textContent = titulo;
  $('#folha-campos').innerHTML = campos.map((c) => {
    if (c.tipo === 'data-hora') {
      return `<div class="linha-campos">
        <label class="campo ic-campo"><span>${IC_CAL}${c.rotuloData || 'Data'}</span><input type="date" name="${c.data}" value="${esc(c.vData)}" required></label>
        <label class="campo ic-campo"><span>${IC_REL}${c.rotuloHora || 'Hora'}</span><input type="time" name="${c.hora}" value="${esc(c.vHora)}" required></label>
        ${c.hora2 ? `<label class="campo ic-campo"><span>${IC_REL}Até</span><input type="time" name="${c.hora2}" value="${esc(c.vHora2)}"></label>` : ''}
      </div>`;
    }
    return `<label class="campo"><span>${c.rotulo}</span><input name="${c.nome}" value="${esc(c.valor || '')}" placeholder="${esc(c.placeholder || '')}" ${c.obrigatorio ? 'required' : ''} autocomplete="off"></label>`;
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
  const b = $('#folha-salvar'); b.disabled = true; b.textContent = 'Salvando…';
  try { await folhaAcao(dados); fecharFolha(); }
  catch (err) { $('#folha-erro').textContent = err.message; }
  finally { b.disabled = false; b.textContent = 'Salvar'; }
});

function proximaHoraCheia() { const d = new Date(Date.now() + 3600e3); d.setMinutes(0); return horaISO(d); }

function editarEvento(ev) {
  const dia = ev ? diaISO(ev.inicio) : Agenda.dia;
  const ini = ev && !ev.dia_inteiro ? horaISO(ev.inicio) : proximaHoraCheia();
  const fim = ev && ev.fim && !ev.dia_inteiro ? horaISO(ev.fim) : horaISO(new Date(Date.parse(montarISO(dia, ini)) + 3600e3));
  abrirFolha({
    titulo: ev ? 'Editar compromisso' : 'Novo compromisso',
    campos: [
      { rotulo: 'O quê', nome: 'titulo', valor: ev?.titulo, placeholder: 'Visita – cliente', obrigatorio: true },
      { tipo: 'data-hora', data: 'dia', hora: 'inicio', hora2: 'fim', vData: dia, vHora: ini, vHora2: fim, rotuloHora: 'Início' },
      { rotulo: 'Onde', nome: 'local', valor: ev?.local, placeholder: 'Opcional' },
    ],
    salvar: async (f) => {
      if (!f.titulo?.trim() || !f.dia || !f.inicio) throw new Error('Preencha o quê, o dia e a hora.');
      let fimISO = montarISO(f.dia, f.fim || f.inicio);
      if (!f.fim || Date.parse(fimISO) <= Date.parse(montarISO(f.dia, f.inicio))) fimISO = new Date(Date.parse(montarISO(f.dia, f.inicio)) + 3600e3).toISOString();
      const corpo = { titulo: f.titulo.trim(), inicio: montarISO(f.dia, f.inicio), fim: fimISO, local: f.local?.trim() || '' };
      await api(ev ? `/agenda/${encodeURIComponent(ev.id)}` : '/agenda', { metodo: 'POST', corpo });
      aviso(ev ? 'Compromisso atualizado.' : 'Compromisso marcado. O alarme toca 20 min antes.');
      Agenda.dia = f.dia; Agenda.inicioSemana = null; await carregarSemana();
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
  const { contato, mensagens } = await api(`/contatos/${encodeURIComponent(wa)}`);
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

function linkWhats() {
  $('#b-abrir').href = `https://wa.me/${contatoAtual}?text=${encodeURIComponent($('#resposta').value)}`;
}
$('#resposta').addEventListener('input', linkWhats);

$('#b-sugerir').addEventListener('click', async (e) => {
  const b = e.currentTarget; b.disabled = true; b.textContent = 'Pensando…';
  try { const { sugestao } = await api(`/contatos/${contatoAtual}/sugerir`, { metodo: 'POST' }); $('#resposta').value = sugestao; linkWhats(); }
  catch (err) { aviso(err.message); }
  finally { b.disabled = false; b.textContent = 'Sugerir resposta'; }
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
    [!!st.whatsapp_ultima, st.whatsapp_ultima ? `WhatsApp Business (última mensagem ${quando(st.whatsapp_ultima)})` : 'WhatsApp Business (aguardando conexão)'],
  ];
  $('#status').innerHTML = itens.map(([ok, t]) => `<li class="${ok ? 'ok' : ''}">${esc(t)}</li>`).join('');
  if (st.antecedencia_alarme) $('#alarme-min').textContent = st.antecedencia_alarme;
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
$('#b-copiar-chave').addEventListener('click', () => copiar(chave || '', 'Chave copiada.'));

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
  guardado.gravar(CHAVE, null); chave = null;
  $('#app').hidden = true; $('#entrar').hidden = false;
}
$('#b-sair').addEventListener('click', () => { if (confirm('Sair deste aparelho? Você vai precisar da chave de novo.')) sair(); });

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
  if (enviando || !chave) return;
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
$('#form-chave').addEventListener('submit', async (e) => {
  e.preventDefault();
  chave = $('#chave').value.trim();
  try {
    await api('/status');
    guardado.gravar(CHAVE, chave);
    iniciar();
  } catch { $('#erro-chave').textContent = 'Essa chave não abriu o app. Confira se copiou inteira, sem espaços.'; chave = null; }
});

function iniciar() {
  $('#entrar').hidden = true; $('#app').hidden = false;
  window.addEventListener('hashchange', rota);
  rota();
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
// Ao voltar para o app, atualiza a tela atual.
document.addEventListener('visibilitychange', () => { if (!document.hidden && chave) rota(); });

if (chave) iniciar(); else $('#entrar').hidden = false;
