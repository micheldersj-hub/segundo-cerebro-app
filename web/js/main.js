// Dimy Web — entrada: login, rotas, tema, contadores do menu e verificação de versão nova.
import { $, $$, api, aviso, ehDono, guardado, iniciais, Sessao, Sincronia, SUPA, VERSAO } from './base.js';
import * as Hoje from './hoje.js';
import * as Tarefas from './tarefas.js';
import * as Conversa from './conversa.js';
import * as Whats from './whats.js';
import * as Oraculo from './oraculo.js';
import * as Olho from './olho.js';

const TELAS = { hoje: Hoje, tarefas: Tarefas, conversa: Conversa, whats: Whats, oraculo: Oraculo, olho: Olho };
let atual = null;

async function rota() {
  const partes = (location.hash.replace(/^#\/?/, '') || 'hoje').split('/');
  let nome = TELAS[partes[0]] ? partes[0] : 'hoje';
  if (nome === 'whats' && !ehDono()) nome = 'hoje';
  $$('.menu a').forEach((a) => a.classList.toggle('on', a.dataset.menu === nome));
  const tela = TELAS[nome], el = $('#principal');
  if (atual !== nome) { atual = nome; el.className = `principal tela-${nome}`; el.innerHTML = '<p class="carregando">Carregando…</p>'; }
  document.title = `${tela.titulo} · Dimy Web`;
  try { await tela.abrir(el, partes.slice(1)); } catch (e) { aviso(e.message, 'erro'); if (/Carregando/.test(el.textContent)) el.innerHTML = `<p class="carregando">${e.message}</p>`; }
  Sincronia.ligar((silencioso) => tela.atualizar?.(silencioso).catch(() => {}));
  contadores().catch(() => {});
}

// Contadores do menu (mesmos números do app): espera no WhatsApp, avisos, tarefas abertas, alertas do Olho.
let contEm = 0;
export async function contadores(forcar = false) {
  if (!forcar && Date.now() - contEm < 25000) return;
  contEm = Date.now();
  const marca = (id, n) => { const b = $(id); b.hidden = !n; b.textContent = n > 99 ? '99+' : n; };
  const [h, t, o] = await Promise.allSettled([api('/hoje'), api('/tarefas'), api('/olho/painel')]);
  if (h.status === 'fulfilled') { marca('#b-whats', h.value.aguardando?.length || 0); marca('#b-hoje', (h.value.avisos || []).filter((a) => !a.read_at).length); }
  if (t.status === 'fulfilled') marca('#b-tarefas', t.value.tarefas.filter((x) => x.etapa !== 'feito').length + (t.value.atrasadas?.length || 0));
  if (o.status === 'fulfilled') { const a = o.value.kpis.alertas; marca('#b-olho', a.critico + a.alto + a.medio + a.baixo); }
}
setInterval(() => { if (!document.hidden && Sessao.logado) contadores(true).catch(() => {}); }, 60000);
document.addEventListener('dimy:mudou', () => contadores(true).catch(() => {}));   // telas avisam quando mudam algo

// ---- Tema ----
const TEMAS = ['auto', 'claro', 'escuro'], NOME_TEMA = { auto: 'Tema automático', claro: 'Tema claro', escuro: 'Tema escuro' };
function aplicarTema(t) { if (t === 'auto') delete document.documentElement.dataset.tema; else document.documentElement.dataset.tema = t; $('#tema-t').textContent = NOME_TEMA[t]; }
$('#b-tema').addEventListener('click', () => { const t = TEMAS[(TEMAS.indexOf(guardado.ler('dimyweb-tema') || 'auto') + 1) % 3]; guardado.gravar('dimyweb-tema', t === 'auto' ? null : t); aplicarTema(t); });
aplicarTema(guardado.ler('dimyweb-tema') || 'auto');

// ---- Login (mesmo login do app) ----
function mostrarEntrar(erro = '') { $('#app').hidden = true; $('#entrar').hidden = false; $('#entrar-erro').textContent = erro; setTimeout(() => $('#entrar-email').focus(), 30); }
async function carregarEu() { try { Sessao.eu = await api('/equipe/eu'); } catch { Sessao.eu = null; } }
function iniciar() {
  Sessao.logado = true;
  $('#entrar').hidden = true; $('#app').hidden = false;
  const u = Sessao.eu?.usuario;
  $('#eu-nome').textContent = u?.nome || 'Michelder';
  $('#eu-email').textContent = u?.email || (Sessao.chave ? 'chave de acesso' : '');
  $('#eu-av').textContent = iniciais(u?.nome || 'M').slice(0, 1);
  $$('.so-dono').forEach((el) => { el.hidden = !ehDono(); });
  if (!location.hash) location.hash = '#/hoje';
  rota();
}
$('#form-entrar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#entrar-email').value.trim().toLowerCase(), password = $('#entrar-senha').value, b = $('#entrar-btn');
  if (!email || !password) { $('#entrar-erro').textContent = 'Preencha e-mail e senha.'; return; }
  b.disabled = true; b.textContent = 'Entrando…'; $('#entrar-erro').textContent = '';
  try {
    const { data, error } = await SUPA.auth.signInWithPassword({ email, password });
    if (error) throw new Error(/invalid/i.test(error.message) ? 'E-mail ou senha incorretos.' : error.message);
    Sessao.sessao = data.session;
    await carregarEu();
    if (!Sessao.eu) { await SUPA.auth.signOut(); Sessao.sessao = null; throw new Error('Seu acesso não está liberado. Fale com o administrador.'); }
    $('#entrar-senha').value = '';
    iniciar();
  } catch (err) { $('#entrar-erro').textContent = err.message; }
  finally { b.disabled = false; b.textContent = 'Entrar'; }
});
$('#form-chave').addEventListener('submit', async (e) => {
  e.preventDefault();
  const k = $('#entrar-chave').value.trim(); if (!k) return;
  Sessao.chave = k;
  try { await api('/hoje'); guardado.gravar('cerebro-chave', k); $('#entrar-chave').value = ''; iniciar(); }
  catch { Sessao.chave = null; $('#entrar-erro').textContent = 'Chave não aceita.'; }
});
async function sair() {
  await SUPA.auth.signOut().catch(() => {});
  Sessao.sessao = null; Sessao.eu = null; Sessao.logado = false; Sessao.chave = null; guardado.gravar('cerebro-chave', null);
  mostrarEntrar();
}
$('#b-sair').addEventListener('click', () => { if (confirm('Sair do Dimy Web neste computador?')) sair(); });
document.addEventListener('dimy:sair', () => { if (Sessao.logado) { Sessao.logado = false; mostrarEntrar('Sua sessão expirou. Entre de novo.'); } });

addEventListener('hashchange', () => { if (Sessao.logado) rota(); });
// Atalhos de teclado: g + h/t/c/w/o/e para trocar de tela; "/" busca na tela atual.
let g = 0;
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey || $('#janela').open) return;
  if (e.key === '/') { const b = $('#principal [data-busca]'); if (b) { e.preventDefault(); b.focus(); } return; }
  if (e.key === 'g') { g = Date.now(); return; }
  if (Date.now() - g < 1200) { const destino = { h: 'hoje', t: 'tarefas', c: 'conversa', w: 'whats', o: 'oraculo', e: 'olho' }[e.key]; if (destino) location.hash = `#/${destino}`; g = 0; }
});

// Versão nova publicada: recarrega quando a aba volta ao foco e não há nada aberto.
async function verificarVersao() {
  try {
    const v = (await (await fetch(`versao.json?c=${Date.now()}`, { cache: 'no-store' })).json()).versao;
    if (v && v !== VERSAO && !$('#janela').open && !document.activeElement?.matches?.('input, textarea')) location.reload();
  } catch { /* sem rede */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) verificarVersao(); });

(async function comecar() {
  try { Sessao.sessao = (await SUPA.auth.getSession()).data.session; } catch { Sessao.sessao = null; }
  if (Sessao.sessao) { await carregarEu(); if (Sessao.eu) { iniciar(); return; } await SUPA.auth.signOut().catch(() => {}); Sessao.sessao = null; }
  if (Sessao.chave) { try { await api('/hoje'); iniciar(); return; } catch { Sessao.chave = null; } }
  mostrarEntrar();
})();
