// WhatsApp (só o dono): contatos à esquerda, conversa e perfil à direita. Dentro das 24 h envia pelo número comercial;
// fora disso abre o WhatsApp Web com a mensagem pronta (regra da Meta). Rascunhos do Dimy para aprovar.
import { $, api, aviso, avatar, ehDono, esc, foneBonito, ha, IC, leve, nomeDe, nomeValido, quando, semAcento } from './base.js';

export const titulo = 'WhatsApp';
const W = { todos: [], atual: null, info: null, rascunho: null, q: '', seq: 0, timer: 0, assinatura: '' };
const RELACAO = { cliente: 'Cliente', prospect: 'Prospect', parceiro: 'Parceiro', fornecedor: 'Fornecedor', equipe: 'Equipe', familia: 'Família', amigo: 'Amigo', servico: 'Serviço', outro: 'Contato' };
let el = null;

export async function abrir(alvo, [wa]) {
  if (!ehDono()) { location.hash = '#/hoje'; return; }
  if (!$('#wa-lista')) {
    el = alvo; W.atual = null;
    el.innerHTML = `
      <div class="duas-colunas">
        <section class="col-lista cartao">
          <header class="lista-cab"><h1>WhatsApp</h1><span class="contador" id="wa-espera"></span></header>
          <form class="busca" id="wa-busca"><span>${IC.busca}</span><input id="wa-q" placeholder="Buscar nome, empresa, assunto ou número  ( / )" autocomplete="off" data-busca aria-label="Buscar contato"></form>
          <p class="dica" id="wa-status" hidden></p>
          <ul class="lista-pessoas rolavel" id="wa-lista"></ul>
        </section>
        <section class="col-detalhe cartao" id="wa-detalhe"><div class="vazio-grande">${IC.whats}<p>Escolha uma conversa à esquerda.</p></div></section>
      </div>`;
    $('#wa-q').addEventListener('input', (e) => buscar(e.target.value));
    $('#wa-busca').addEventListener('submit', (e) => { e.preventDefault(); buscar($('#wa-q').value); });
    el.onclick = clique;
    el.oninput = (e) => { if (e.target.id === 'wa-resposta') botoes(); };
    el.onkeydown = (e) => { if (e.target.id === 'wa-resposta' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $('#wa-enviar:not([hidden])')?.click(); } };
    await carregarLista();
  }
  if (wa && wa !== W.atual) await abrirContato(wa);
  marcarAtivo();
}
export async function atualizar() {
  if (!$('#wa-lista')) return;
  await carregarLista(true);
  if (W.atual && !document.activeElement?.matches('#wa-resposta')) await abrirContato(W.atual, true);
}

async function carregarLista() {
  const { contatos } = await api('/contatos');
  W.todos = contatos.filter((c) => c.name !== '[teste removido]' && new Date(c.last_seen).getFullYear() > 2001)
    .sort((a, b) => (b.awaiting_reply - a.awaiting_reply) || (new Date(b.last_seen) - new Date(a.last_seen)));
  const n = W.todos.filter((c) => c.awaiting_reply).length;
  $('#wa-espera').textContent = n ? `${n} esperando` : '';
  if (W.q) buscar(W.q, true); else desenhar(W.todos);
}
const linha = (c) => `<li><a class="pessoa ${c.wa_id === W.atual ? 'on' : ''}" href="#/whats/${esc(c.wa_id)}" data-wa="${esc(c.wa_id)}">${avatar(c)}
  <span class="pessoa-corpo"><b>${esc(nomeDe(c))}${c.muted ? ' <small>· silenciado</small>' : ''}</b><small>${esc([/unknown/i.test(c.empresa || '') ? '' : c.empresa, c.last_summary].filter(Boolean).join(' · ') || (nomeValido(c.name) ? foneBonito(c.wa_id) : ''))}</small></span>
  <span class="h">${c.awaiting_reply ? '<i class="etiqueta">espera</i>' : c.last_seen ? esc(quando(c.last_seen)) : ''}</span></a></li>`;
function desenhar(lista, vazio = 'Nenhum contato.') { $('#wa-lista').innerHTML = lista.length ? lista.map(linha).join('') : `<li class="vazio">${esc(vazio)}</li>`; }
function marcarAtivo() { el.querySelectorAll('[data-wa]').forEach((a) => a.classList.toggle('on', a.dataset.wa === W.atual)); }
function buscar(texto, silencioso = false) {
  const q = texto.trim(); W.q = q; clearTimeout(W.timer);
  if (!q) { $('#wa-status').hidden = true; desenhar(W.todos); return; }
  const ws = semAcento(q).split(/\s+/).filter(Boolean), dig = q.replace(/\D/g, '');
  desenhar(W.todos.filter((c) => (dig.length >= 4 && c.wa_id.includes(dig)) || ws.every((w) => semAcento(`${c.name || ''} ${c.empresa || ''} ${c.last_summary || ''}`).includes(w))), 'Procurando…');
  if (silencioso) return;
  const seq = ++W.seq;
  W.timer = setTimeout(async () => {
    try {
      const { contatos } = await api(`/atendente/contatos?q=${encodeURIComponent(q)}`);
      if (seq !== W.seq) return;
      desenhar(contatos, `Nada encontrado para "${q}".`);
      $('#wa-status').hidden = !contatos.length; $('#wa-status').textContent = `${contatos.length} contato${contatos.length > 1 ? 's' : ''} para "${q}"`;
    } catch (e) { if (seq === W.seq) aviso(e.message, 'erro'); }
  }, 280);
}

const podeEnviar = () => !!W.info?.last_in_at && Date.now() - Date.parse(W.info.last_in_at) < 24 * 3600e3;
async function abrirContato(wa, silencioso = false) {
  const det = $('#wa-detalhe');
  if (!silencioso || W.atual !== wa) { W.atual = wa; W.assinatura = ''; det.innerHTML = '<p class="carregando">Carregando…</p>'; }
  const { contato, mensagens, perfil } = await api(`/contatos/${encodeURIComponent(wa)}`);
  const ass = `${mensagens.length}|${mensagens.at(-1)?.occurred_at}|${contato?.muted}|${contato?.awaiting_reply}`;
  if (silencioso && ass === W.assinatura) return;
  const rascunhoDigitado = $('#wa-resposta')?.value || '';
  W.assinatura = ass; W.info = contato;
  det.innerHTML = `
    <header class="conv-cab">${avatar(contato || { wa_id: wa })}
      <div class="conv-t"><h2>${esc(nomeDe(contato || { wa_id: wa }))}</h2><small>${esc(foneBonito(wa))}${contato?.last_summary ? ` · ${esc(contato.last_summary)}` : ''}</small></div>
      <div class="acoes"><button class="btn claro" data-wa-acao="resolvido">${IC.ok}Respondida</button><button class="btn claro" data-wa-acao="silenciar" data-muted="${contato?.muted ? '1' : ''}">${contato?.muted ? 'Voltar a avisar' : 'Silenciar'}</button></div>
    </header>
    <div class="conv-corpo">
      <div class="conv-msgs" id="wa-msgs">${mensagens.map((m) => `<div class="bolha ${m.direction === 'out' ? 'eu' : 'ia'}">${leve(m.body || `[${m.type}]`)}<span class="quando">${esc(quando(m.occurred_at))}</span></div>`).join('') || '<p class="vazio">Sem mensagens registradas.</p>'}</div>
      <aside class="conv-perfil" id="wa-perfil">${perfilHTML(perfil)}</aside>
    </div>
    <div class="rascunho" id="wa-rascunho" hidden></div>
    <div class="conv-resp">
      <textarea id="wa-resposta" rows="2" placeholder="Escreva a resposta… (Ctrl+Enter envia)">${esc(rascunhoDigitado)}</textarea>
      <div class="acoes"><button class="btn claro" data-wa-acao="sugerir">✨ Dimy, responda</button>
        <button class="btn primario" id="wa-enviar" data-wa-acao="enviar">Enviar</button>
        <a class="btn primario" id="wa-abrir" target="_blank" rel="noopener">Abrir no WhatsApp</a></div>
      <p class="dica" id="wa-dica24"></p>
    </div>`;
  const box = $('#wa-msgs'); box.scrollTop = box.scrollHeight;
  botoes(); carregarRascunho(wa); marcarAtivo();
}
function perfilHTML(p) {
  if (!p) return '<h3>Perfil</h3><p class="dica">Ainda aprendendo sobre este contato.</p><button class="btn claro" data-wa-acao="perfilar">Aprender agora</button>';
  return `<h3>${esc(RELACAO[p.relacao] || 'Contato')}${p.empresa ? ` · ${esc(p.empresa)}` : ''}</h3>
    ${p.resumo ? `<p>${esc(p.resumo)}</p>` : ''}
    ${p.temas?.length ? `<p class="rot">Assuntos</p><div class="chips">${p.temas.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
    ${p.pendencias?.length ? `<p class="rot">Em aberto</p><ul class="checks">${p.pendencias.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    ${p.tom ? `<p class="rot">Como você fala com ele</p><p class="dica">${esc(p.tom)}</p>` : ''}
    <p class="dica">Aprendido de ${p.msgs_analisadas} mensagens · ${esc(quando(p.atualizado_em))}</p>`;
}
function botoes() {
  const r = $('#wa-resposta'); if (!r) return;
  const tem = !!r.value.trim(), direto = podeEnviar();
  $('#wa-enviar').hidden = !direto; $('#wa-enviar').disabled = !tem;
  $('#wa-abrir').hidden = direto; $('#wa-abrir').classList.toggle('desativado', !tem);
  $('#wa-abrir').href = `https://web.whatsapp.com/send?phone=${W.atual}&text=${encodeURIComponent(r.value)}`;
  $('#wa-dica24').textContent = direto ? `Sai pelo número comercial (dentro das 24 h desde a última mensagem dele, ${ha(W.info.last_in_at)}).` : 'Já passou de 24 h da última mensagem dele: a Meta só deixa responder pelo seu WhatsApp. O botão abre o WhatsApp Web com o texto pronto.';
}
async function carregarRascunho(wa) {
  const card = $('#wa-rascunho'); card.hidden = true; W.rascunho = null;
  try {
    const { rascunhos } = await api(`/rascunhos?wa=${encodeURIComponent(wa)}`);
    const r = rascunhos?.[0]; if (!r || W.atual !== wa) return;
    W.rascunho = r;
    card.innerHTML = `<b>Resposta do Dimy esperando você</b>${r.motivo ? `<small>${esc(r.motivo)}</small>` : ''}<p>${leve(r.texto)}</p>
      <div class="acoes"><button class="btn primario" data-wa-acao="rascunho-enviar">Enviar</button><button class="btn claro" data-wa-acao="rascunho-descartar">Descartar</button></div>`;
    card.hidden = false;
  } catch { /* sem rascunho */ }
}

async function clique(e) {
  const b = e.target.closest('[data-wa-acao]');
  if (e.target.closest('#wa-abrir')) {
    if (!$('#wa-resposta').value.trim()) { e.preventDefault(); aviso('Escreva a resposta ou peça "Dimy, responda".'); return; }
    api(`/contatos/${W.atual}/resolvido`, { metodo: 'POST' }).catch(() => {});
    return;
  }
  if (!b) return;
  const a = b.dataset.waAcao, txt = b.textContent;
  b.disabled = true;
  try {
    if (a === 'sugerir') { b.textContent = 'Escrevendo…'; const { sugestao } = await api(`/contatos/${W.atual}/sugerir`, { metodo: 'POST' }); $('#wa-resposta').value = sugestao; botoes(); $('#wa-resposta').focus(); }
    if (a === 'enviar') { const texto = $('#wa-resposta').value.trim(); if (!texto) return; b.textContent = 'Enviando…'; const { ok } = await api(`/contatos/${W.atual}/responder`, { metodo: 'POST', corpo: { texto } }); aviso(ok || 'Enviado.'); $('#wa-resposta').value = ''; await abrirContato(W.atual); document.dispatchEvent(new Event('dimy:mudou')); }
    if (a === 'resolvido') { await api(`/contatos/${W.atual}/resolvido`, { metodo: 'POST' }); aviso('Tirei da lista de espera.'); await carregarLista(); document.dispatchEvent(new Event('dimy:mudou')); }
    if (a === 'silenciar') { const s = !b.dataset.muted; await api(`/contatos/${W.atual}/silenciar`, { metodo: 'POST', corpo: { silenciar: s } }); aviso(s ? 'Não aviso mais sobre esse contato.' : 'Voltei a avisar sobre esse contato.'); await abrirContato(W.atual); }
    if (a === 'perfilar') { b.textContent = 'Lendo as conversas…'; const { perfil } = await api(`/contatos/${W.atual}/perfil`, { metodo: 'POST' }); $('#wa-perfil').innerHTML = perfilHTML(perfil); }
    if (a === 'rascunho-enviar' || a === 'rascunho-descartar') {
      const { mensagem } = await api(`/rascunhos/${W.rascunho.id}/${a === 'rascunho-enviar' ? 'enviar' : 'descartar'}`, { metodo: 'POST', corpo: {} });
      aviso(mensagem); $('#wa-rascunho').hidden = true; if (a === 'rascunho-enviar') await abrirContato(W.atual);
    }
  } catch (err) { aviso(err.message, 'erro'); }
  finally { if (b.isConnected) { b.disabled = false; if (/…$/.test(b.textContent)) b.textContent = txt; } }
}
