// Conversa com o Dimy: o mesmo histórico do app (o que você fala aqui aparece lá e vice-versa).
import { $, api, esc, leve, quando } from './base.js?v=w7';

export const titulo = 'Conversa com o Dimy';
let el = null, enviando = false, ultimo = '';

export async function abrir(alvo) {
  el = alvo;
  el.innerHTML = `
    <header class="cab"><div><p class="cab-sup">Conversa</p><h1>Dimy</h1></div><p class="dica">O mesmo histórico do app. Enter envia; Shift+Enter quebra a linha.</p></header>
    <section class="chat cartao">
      <div class="chat-msgs" id="cv-msgs" aria-live="polite"></div>
      <form class="chat-form" id="cv-form"><textarea id="cv-texto" rows="1" placeholder="Fale com o Dimy… (o que fazer, lembrar, marcar, pesquisar)" data-busca aria-label="Mensagem para o Dimy"></textarea>
        <button class="btn primario" id="cv-enviar">Enviar</button></form>
    </section>`;
  const t = $('#cv-texto');
  t.addEventListener('input', () => { t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight, 200)}px`; });
  t.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#cv-form').requestSubmit(); } });
  $('#cv-form').addEventListener('submit', enviar);
  try { const r = sessionStorage.getItem('dimy-rascunho'); if (r) { t.value = r; sessionStorage.removeItem('dimy-rascunho'); } } catch { /* sem armazenamento */ }
  await atualizar(); t.focus(); t.setSelectionRange(t.value.length, t.value.length);
}
export async function atualizar() {
  if (!el?.isConnected || enviando) return;
  const { turnos } = await api('/conversa');
  const assinatura = turnos.map((x) => x.created_at).join('|');
  if (assinatura === ultimo) return;           // nada novo: não mexe na rolagem
  ultimo = assinatura;
  const box = $('#cv-msgs');
  box.innerHTML = turnos.length ? turnos.map((x) => bolha(x.role === 'user' ? 'eu' : 'ia', x.content, x.created_at)).join('')
    : bolha('ia', 'Oi, Michelder. Pode me contar qualquer coisa: do trabalho, da família, uma ideia solta. Eu guardo e organizo.');
  box.scrollTop = box.scrollHeight;
}
const bolha = (papel, texto, iso, extra = '') => `<div class="bolha ${papel} ${extra}">${leve(texto)}${iso ? `<span class="quando">${esc(quando(iso))}</span>` : ''}</div>`;
async function enviar(e) {
  e.preventDefault();
  const t = $('#cv-texto'), texto = t.value.trim(); if (!texto || enviando) return;
  enviando = true; t.value = ''; t.style.height = 'auto';
  const box = $('#cv-msgs');
  box.insertAdjacentHTML('beforeend', bolha('eu', texto, new Date().toISOString()) + bolha('ia', 'Pensando', null, 'pensando'));
  box.scrollTop = box.scrollHeight;
  try {
    const { resposta } = await api('/chat', { metodo: 'POST', corpo: { texto, id: crypto.randomUUID() } });
    box.querySelector('.pensando')?.remove(); box.insertAdjacentHTML('beforeend', bolha('ia', resposta, new Date().toISOString()));
    document.dispatchEvent(new Event('dimy:mudou'));
  } catch (err) {
    box.querySelector('.pensando')?.remove(); box.insertAdjacentHTML('beforeend', bolha('ia', `Não consegui responder: ${err.message} Sua mensagem não se perdeu; tente de novo.`));
    t.value = texto;
  } finally { enviando = false; ultimo = ''; box.scrollTop = box.scrollHeight; t.focus(); }
}
