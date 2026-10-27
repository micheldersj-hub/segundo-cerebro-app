// Segundo Cérebro — app do iPhone (PWA). Fala só com a função "app" do Supabase.
const API = 'https://mavjbevuhzalkqyxaajw.supabase.co/functions/v1/app';
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
  const res = await fetch(API + caminho, { method: metodo, headers, body });
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
const VISTAS = { hoje: '#v-hoje', conversa: '#v-conversa', whats: '#v-whats', contato: '#v-contato', mais: '#v-mais' };

function ir(destino) { location.hash = destino; }

async function rota() {
  const [nome, arg] = (location.hash.slice(1) || 'hoje').split('/');
  const vista = nome === 'avisos' ? 'mais' : VISTAS[nome] ? nome : 'hoje';
  for (const [k, sel] of Object.entries(VISTAS)) $(sel).hidden = k !== vista;
  document.querySelectorAll('.abas button').forEach((b) => b.classList.toggle('ativa', b.dataset.ir === vista || (vista === 'contato' && b.dataset.ir === 'whats')));
  window.scrollTo(0, 0);
  try {
    if (vista === 'hoje') await carregarHoje();
    if (vista === 'conversa') await carregarConversa();
    if (vista === 'whats') await carregarContatos();
    if (vista === 'contato') await carregarContato(arg);
    if (vista === 'mais') await carregarMais();
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

async function carregarHoje() {
  $('#hoje-saudacao').textContent = saudacao();
  $('#hoje-data').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' });
  const d = await api('/hoje');
  atualizarBadges(d);

  const a = escolherAncora(d);
  $('#ancora').hidden = false;
  $('#ancora-texto').textContent = a.texto;
  const bt = $('#ancora-acao');
  bt.hidden = !a.acao; bt.textContent = a.acao || '';
  bt.onclick = () => a.ir && ir(a.ir);

  const blocos = [];
  // Agenda
  if (d.google) {
    const ev = Array.isArray(d.agenda) ? d.agenda : [];
    blocos.push(`<div class="bloco"><h2>Agenda de hoje</h2>${ev.length
      ? `<ul class="lista agenda">${ev.map((e) => `<li><div class="item"><span class="h">${hora(e.inicio)}</span><span class="t">${esc(e.titulo)}</span>${e.local ? `<span class="d">${esc(e.local)}</span>` : ''}</div></li>`).join('')}</ul>`
      : `<p class="vazio">${d.agenda?.erro ? 'Não consegui ler a agenda agora.' : 'Nenhum compromisso pelo resto do dia.'}</p>`}</div>`);
  } else {
    blocos.push(`<div class="bloco"><h2>Agenda de hoje</h2><p class="vazio">Conecte o Google em Avisos → Ajustes para eu ver sua agenda.</p></div>`);
  }
  // Esperando resposta
  blocos.push(`<div class="bloco"><h2>Esperando sua resposta</h2>${d.aguardando.length
    ? `<ul class="lista">${d.aguardando.slice(0, 6).map((c) => `<li><button class="item espera" data-ir="contato/${esc(c.wa_id)}"><span class="t">${esc(nomeDe(c))}</span><span class="h">${quando(c.last_in_at || c.last_seen)}</span><span class="d">${esc(c.last_summary || '')}</span></button></li>`).join('')}</ul>`
    : '<p class="vazio">Ninguém esperando. Bom sinal.</p>'}</div>`);
  // Lembretes
  if (d.lembretes.length) {
    blocos.push(`<div class="bloco"><h2>Lembretes</h2><ul class="lista">${d.lembretes.slice(0, 5).map((l) => `<li><div class="item"><span class="t">${esc(l.text)}</span><span class="h">${quando(l.due_at)}</span></div></li>`).join('')}</ul></div>`);
  }
  $('#hoje-blocos').innerHTML = blocos.join('');
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
  const { contatos } = await api('/contatos');
  contatos.sort((a, b) => (b.awaiting_reply - a.awaiting_reply) || (new Date(b.last_seen) - new Date(a.last_seen)));
  $('#lista-contatos').innerHTML = contatos.length
    ? contatos.map((c) => `<li><button class="item ${c.awaiting_reply ? 'espera' : ''}" data-ir="contato/${esc(c.wa_id)}"><span class="t">${esc(nomeDe(c))}${c.muted ? ' (silenciado)' : ''}</span><span class="h">${quando(c.last_seen)}</span><span class="d">${esc(c.last_summary || '')}</span></button></li>`).join('')
    : '<li><p class="vazio">Assim que o seu WhatsApp Business for conectado, as conversas aparecem aqui.</p></li>';
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
  const g = $('#b-google');
  g.hidden = st.google || !st.google_conectar; if (st.google_conectar) g.href = st.google_conectar;

  const dica = $('#push-dica'), bp = $('#b-push');
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    bp.hidden = true; dica.textContent = instalado() ? 'Este aparelho não suporta notificações.' : 'Para receber notificações no iPhone, primeiro adicione o app à Tela de Início (Compartilhar → Adicionar à Tela de Início) e abra por lá.';
  } else if (Notification.permission === 'granted') {
    bp.textContent = 'Notificações ativas'; bp.disabled = true; dica.textContent = '';
  } else { bp.hidden = false; dica.textContent = ''; }
}

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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
// Ao voltar para o app, atualiza a tela atual.
document.addEventListener('visibilitychange', () => { if (!document.hidden && chave) rota(); });

if (chave) iniciar(); else $('#entrar').hidden = false;
