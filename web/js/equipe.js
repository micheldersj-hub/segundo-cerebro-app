// Equipe: chat interno privado (conversas a dois e o grupo "Equipe"), com fotos e arquivos.
// Só quem participa de uma conversa a vê — nem o administrador lê conversa dos outros. Mesmo servidor do app: o que se fala aqui
// aparece no celular, e quem estiver com o app recebe aviso. Aqui também o dono compartilha a agenda e as tarefas (ex.: secretária).
import { $, abrirJanela, api, aviso, esc, ha, IC, iniciais, leve } from './base.js';

export const titulo = 'Equipe';
const E = { conversas: [], atual: null, msgs: [], ultima: null, mais: false, pessoas: null, timer: 0, enviando: false, lidoOutros: null };
let el = null;

export async function abrir(alvo, [id] = []) {
  if (!$('#eq-lista') || el !== alvo) {
    el = alvo; E.atual = null;
    el.innerHTML = `
      <div class="duas-colunas eq">
        <section class="col-lista cartao">
          <header class="lista-cab"><h1>Equipe</h1><span class="flex"></span>
            <button class="ic-btn" data-eq="nova" title="Nova conversa" aria-label="Nova conversa">${IC.mais}</button></header>
          <p class="dica eq-priv">${IC.escudo}Conversas privadas: só quem participa vê.</p>
          <ul class="lista-pessoas rolavel" id="eq-lista"></ul>
          <footer class="eq-pe" id="eq-pe"></footer>
        </section>
        <section class="col-detalhe cartao eq-conversa" id="eq-detalhe"><div class="vazio-grande">${IC.pessoas}<b>Escolha uma conversa</b><span>O grupo "Equipe" tem todo mundo. Para falar só com uma pessoa, clique no +.</span></div></section>
      </div>`;
    el.onclick = clique;
    el.onkeydown = (e) => { if (e.target.id === 'eq-texto' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } };
    el.oninput = (e) => { if (e.target.id === 'eq-texto') { e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`; } };
    el.ondragover = (e) => { if (E.atual && e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); $('#eq-detalhe')?.classList.add('soltar'); } };
    el.ondragleave = (e) => { if (!e.relatedTarget || !el.contains(e.relatedTarget)) $('#eq-detalhe')?.classList.remove('soltar'); };
    el.ondrop = (e) => { if (!E.atual || !e.dataTransfer?.files?.length) return; e.preventDefault(); $('#eq-detalhe')?.classList.remove('soltar'); enviarArquivos([...e.dataTransfer.files]); };
    el.onpaste = (e) => { const f = [...(e.clipboardData?.files || [])]; if (E.atual && f.length) { e.preventDefault(); enviarArquivos(f); } };
    await Promise.all([carregarConversas(), carregarPessoas()]);
  }
  const alvoId = id || (!E.atual && E.conversas[0]?.id);
  if (alvoId && alvoId !== E.atual) await abrirConversa(alvoId);
  marcarAtivo();
  vigiar();
}
export async function atualizar() {
  if (!$('#eq-lista')) return;
  await carregarConversas();
  if (E.atual) await buscarNovas();
}
// Com a conversa aberta, confere mensagens novas a cada 4 s (a sincronia geral do site é a cada 30 s).
function vigiar() {
  clearInterval(E.timer);
  E.timer = setInterval(() => {
    if (!$('#eq-lista')) { clearInterval(E.timer); return; }
    if (!document.hidden && E.atual) buscarNovas().catch(() => {});
  }, 4000);
}

async function carregarPessoas() {
  try { E.pessoas = await api('/chat/pessoas'); } catch { E.pessoas = null; }
  desenharPe();
}
async function carregarConversas() {
  const { conversas } = await api('/chat/conversas');
  E.conversas = conversas;
  $('#eq-lista').innerHTML = conversas.map((c) => `<li><a class="pessoa ${c.id === E.atual ? 'on' : ''}" href="#/equipe/${esc(c.id)}" data-eq-conv="${esc(c.id)}">
      ${c.tipo === 'grupo' ? `<span class="av grupo">${IC.pessoas}</span>` : `<span class="av ${c.ativo ? '' : 'inativo'}">${esc(iniciais(c.nome))}</span>`}
      <span class="pessoa-corpo"><b>${esc(c.nome)}</b><small>${c.ultima ? `${c.ultima.autor ? `${esc(c.ultima.autor)}: ` : ''}${esc(c.ultima.texto)}` : c.tipo === 'grupo' ? `${c.participantes} pessoa${c.participantes > 1 ? 's' : ''}` : 'Comece a conversa'}</small></span>
      <span class="eq-meta">${c.ultima ? `<span class="h">${ha(c.ultima.em)}</span>` : ''}${c.nao_lidas ? `<i class="badge">${c.nao_lidas}</i>` : ''}</span></a></li>`).join('')
    || '<li class="vazio">Nenhuma conversa ainda.</li>';
}
function marcarAtivo() { el.querySelectorAll('[data-eq-conv]').forEach((a) => a.classList.toggle('on', a.dataset.eqConv === E.atual)); }

// ---------- Conversa aberta ----------
async function abrirConversa(id) {
  E.atual = id; E.msgs = []; E.ultima = null;
  const c = E.conversas.find((x) => x.id === id);
  $('#eq-detalhe').innerHTML = `
    <header class="eq-cab">${c?.tipo === 'grupo' ? `<span class="av grupo">${IC.pessoas}</span>` : `<span class="av">${esc(iniciais(c?.nome || ''))}</span>`}
      <div><b>${esc(c?.nome || 'Conversa')}</b><small>${c?.tipo === 'grupo' ? `${c.participantes} pessoas · todos da equipe` : 'Conversa privada'}</small></div></header>
    <div class="chat-msgs eq-msgs" id="eq-msgs" aria-live="polite"><p class="carregando">Carregando…</p></div>
    <form class="chat-form eq-form" id="eq-form" onsubmit="return false">
      <label class="ic-btn eq-anexar" title="Enviar foto ou arquivo (ou arraste para cá)">${IC.clipe}<input type="file" id="eq-arquivo" multiple hidden></label>
      <textarea id="eq-texto" rows="1" placeholder="Escreva uma mensagem…" title="Enter envia · Shift+Enter quebra a linha" aria-label="Mensagem"></textarea>
      <button type="button" class="btn primario" data-eq="enviar">Enviar</button>
    </form>`;
  $('#eq-arquivo').onchange = (e) => { const f = [...e.target.files]; e.target.value = ''; if (f.length) enviarArquivos(f); };
  const r = await api(`/chat/conversas/${id}/mensagens`);
  if (E.atual !== id) return;
  E.msgs = r.mensagens; E.mais = r.mais; E.lidoOutros = r.lido_pelos_outros;
  E.ultima = E.msgs.at(-1)?.criado_em || null;
  desenharMsgs(true);
  marcarLida(id);
  $('#eq-texto').focus();
}
async function buscarNovas() {
  const id = E.atual; if (!id) return;
  const r = await api(`/chat/conversas/${id}/mensagens${E.ultima ? `?depois=${encodeURIComponent(E.ultima)}` : ''}`);
  if (E.atual !== id) return;
  const ids = new Set(E.msgs.map((m) => m.id)), novas = r.mensagens.filter((m) => !ids.has(m.id));
  const mudouVisto = r.lido_pelos_outros !== E.lidoOutros; E.lidoOutros = r.lido_pelos_outros;
  if (!novas.length && !mudouVisto) return;
  const box = $('#eq-msgs'), noFim = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  E.msgs.push(...novas); E.ultima = E.msgs.at(-1)?.criado_em || E.ultima;
  desenharMsgs(noFim);
  if (novas.some((m) => !m.minha)) { marcarLida(id); if (!noFim) aviso('Mensagem nova abaixo.'); }
}
async function marcarLida(id) {
  try { await api(`/chat/conversas/${id}/lido`, { metodo: 'POST' }); } catch { /* tenta de novo na próxima */ }
  const c = E.conversas.find((x) => x.id === id); if (c?.nao_lidas) { c.nao_lidas = 0; carregarConversas().catch(() => {}); }
  document.dispatchEvent(new Event('dimy:mudou'));
}
const ehImagem = (m) => /^image\//.test(m.anexo_tipo || '');
const tamanho = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
function desenharMsgs(rolarFim) {
  const box = $('#eq-msgs'); if (!box) return;
  const grupo = E.conversas.find((x) => x.id === E.atual)?.tipo === 'grupo';
  let dia = '', html = E.mais ? '<button class="link eq-antigas" data-eq="antigas">Ver mensagens anteriores</button>' : '';
  E.msgs.forEach((m, i) => {
    const d = new Date(m.criado_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long' });
    if (d !== dia) { dia = d; html += `<p class="eq-dia"><span>${esc(d)}</span></p>`; }
    const ant = E.msgs[i - 1], seguida = ant && ant.autor === m.autor && Date.parse(m.criado_em) - Date.parse(ant.criado_em) < 5 * 60e3;
    const hora = new Date(m.criado_em).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
    const visto = m.minha && E.lidoOutros && E.lidoOutros >= m.criado_em;
    if (m.apagada) { html += `<div class="bolha ${m.minha ? 'eu' : ''} apagada"><i>Mensagem apagada</i><span class="quando">${hora}</span></div>`; return; }
    const anexo = m.anexo_nome ? (ehImagem(m)
      ? `<button class="eq-foto" data-eq-anexo="${esc(m.id)}" data-tipo="img" title="Abrir ${esc(m.anexo_nome)}"><span>${IC.imagem}${esc(m.anexo_nome)}</span><small>Clique para ver</small></button>`
      : `<button class="eq-arq" data-eq-anexo="${esc(m.id)}" title="Baixar"><span class="eq-arq-ic">${IC.arquivo}</span><span><b>${esc(m.anexo_nome)}</b><small>${tamanho(m.anexo_tamanho || 0)} · baixar</small></span></button>`) : '';
    html += `<div class="bolha ${m.minha ? 'eu' : ''} ${seguida ? 'seguida' : ''}" data-msg="${esc(m.id)}">
      ${grupo && !m.minha && !seguida ? `<b class="eq-autor">${esc(m.autor_nome)}</b>` : ''}${anexo}${m.texto ? `<span class="eq-txt">${leve(m.texto)}</span>` : ''}
      <span class="quando">${hora}${m.minha ? ` <span class="eq-visto ${visto ? 'lido' : ''}" title="${visto ? 'Visto' : 'Enviado'}">${visto ? '✓✓' : '✓'}</span>` : ''}</span>
      ${m.minha ? `<button class="eq-apagar" data-eq-apagar="${esc(m.id)}" title="Apagar para todos" aria-label="Apagar mensagem">${IC.lixeira}</button>` : ''}</div>`;
  });
  box.innerHTML = html || `<div class="vazio-grande">${IC.pessoas}<b>Nenhuma mensagem ainda</b><span>Diga um oi.</span></div>`;
  if (rolarFim) box.scrollTop = box.scrollHeight;
  // Fotos: carregam o link temporário só quando aparecem na tela
  box.querySelectorAll('.eq-foto:not(.ok)').forEach((b) => miniatura(b));
}
const cacheLink = new Map();
async function linkAnexo(id, baixar = false) {
  const k = `${id}/${baixar}`, c = cacheLink.get(k); if (c && c.ate > Date.now()) return c;
  const r = await api(`/chat/anexo/${id}${baixar ? '?baixar=1' : ''}`); const v = { ...r, ate: Date.now() + 8 * 60e3 }; cacheLink.set(k, v); return v;
}
async function miniatura(b) {
  try { const { url } = await linkAnexo(b.dataset.eqAnexo); b.classList.add('ok'); b.innerHTML = `<img src="${esc(url)}" alt="Foto enviada" loading="lazy">`; b.querySelector('img').onload = () => { const box = $('#eq-msgs'); if (box && box.scrollHeight - box.scrollTop - box.clientHeight < 400) box.scrollTop = box.scrollHeight; }; }
  catch { /* fica o nome do arquivo */ }
}

// ---------- Enviar ----------
async function enviar() {
  const t = $('#eq-texto'), texto = t?.value.trim(); if (!texto || E.enviando || !E.atual) return;
  E.enviando = true; t.value = ''; t.style.height = 'auto';
  try {
    const { mensagem } = await api(`/chat/conversas/${E.atual}/mensagens`, { metodo: 'POST', corpo: { texto } });
    E.msgs.push(mensagem); E.ultima = mensagem.criado_em; desenharMsgs(true); carregarConversas().catch(() => {});
  } catch (err) { t.value = texto; aviso(`Não foi: ${err.message}`, 'erro'); }
  finally { E.enviando = false; t.focus(); }
}
async function enviarArquivos(arquivos) {
  const conv = E.atual;
  for (const f of arquivos) {
    if (f.size > 25 * 1024 * 1024) { aviso(`${f.name}: grande demais (máximo 25 MB).`, 'erro'); continue; }
    aviso(`Enviando ${f.name}…`);
    try {
      const { mensagem } = await api(`/chat/conversas/${conv}/mensagens?nome=${encodeURIComponent(f.name)}`, { metodo: 'POST', corpo: f, tipo: f.type || 'application/octet-stream' });
      if (E.atual === conv) { E.msgs.push(mensagem); E.ultima = mensagem.criado_em; desenharMsgs(true); }
    } catch (err) { aviso(`${f.name}: ${err.message}`, 'erro'); }
  }
  carregarConversas().catch(() => {});
}

// ---------- Nova conversa e compartilhamento ----------
function desenharPe() {
  const p = E.pessoas; if (!p) { $('#eq-pe').innerHTML = ''; return; }
  const comigo = p.compartilhadas || [];
  $('#eq-pe').innerHTML = `${comigo.length ? `<p class="dica">${IC.link}<span>Compartilhado com você: ${comigo.map((c) => `<b>${esc(c.nome.split(' ')[0])}</b> (${[c.agenda && 'agenda', c.tarefas && 'tarefas'].filter(Boolean).join(' e ')})`).join(', ')}. Escolha a pessoa no topo da Agenda e das Tarefas.</span></p>` : ''}
    <button class="btn claro largo" data-eq="compartilhar">${IC.link}Compartilhar minha agenda e tarefas</button>
    ${p.eu?.admin ? `<button class="btn claro largo" data-eq="convidar">${IC.pessoas}Convidar ou gerar novo link</button>` : ''}`;
}
function novaConversa() {
  const equipe = E.pessoas?.equipe || [];
  if (!equipe.length) { aviso(E.pessoas?.eu?.admin ? 'Ainda não há mais ninguém na equipe. Convide alguém primeiro.' : 'Ainda não há mais ninguém na equipe.'); return; }
  abrirJanela({
    titulo: 'Conversar com…', botao: 'Abrir conversa',
    campos: [{ tipo: 'escolha', rotulo: 'Pessoa', nome: 'com', opcoes: equipe.map((m, i) => ({ valor: m.id, texto: m.nome, marcado: i === 0 })) }],
    salvar: async (f) => { const r = await api('/chat/conversas', { metodo: 'POST', corpo: { com: f.com } }); await carregarConversas(); location.hash = `#/equipe/${r.id}`; },
  });
}
async function compartilhar() {
  const equipe = E.pessoas?.equipe || [];
  if (!equipe.length) { aviso(E.pessoas?.eu?.admin ? 'Convide a pessoa para a equipe primeiro; depois volte aqui para compartilhar.' : 'Ainda não há mais ninguém na equipe.'); return; }
  const { acessos } = await api('/chat/acessos');
  const tem = new Map(acessos.map((a) => [a.membro, a]));
  abrirJanela({
    titulo: 'Compartilhar minha agenda e tarefas', largura: 'larga',
    campos: [
      { tipo: 'html', html: '<p class="dica">Quem você marcar poderá <b>ver e mexer</b>: marcar, mudar e cancelar compromissos; criar, editar, concluir e mandar tarefas para a lixeira. Tudo fica registrado com o nome da pessoa. Excluir tarefas de vez continua só com você. Para tirar o acesso, desmarque.</p>' },
      ...equipe.map((m) => ({ tipo: 'marcas', rotulo: m.nome, opcoes: [{ nome: `agenda_${m.id}`, texto: 'Minha agenda', marcado: !!tem.get(m.id)?.agenda }, { nome: `tarefas_${m.id}`, texto: 'Minhas tarefas', marcado: !!tem.get(m.id)?.tarefas }] })),
      { tipo: 'html', html: '<p class="dica">O Oráculo já é do time: todos da equipe veem e pedem dossiês.</p>' },
    ],
    salvar: async (f) => {
      for (const m of equipe) {
        const agenda = !!f[`agenda_${m.id}`], tarefas = !!f[`tarefas_${m.id}`], antes = tem.get(m.id);
        if (!!antes?.agenda === agenda && !!antes?.tarefas === tarefas) continue;
        if (!agenda && !tarefas) await api(`/chat/acessos/${m.id}/remover`, { metodo: 'POST' });
        else await api('/chat/acessos', { metodo: 'POST', corpo: { membro: m.id, agenda, tarefas } });
      }
      aviso('Compartilhamento atualizado.');
    },
  });
}
function convidar() {
  abrirJanela({
    titulo: 'Convidar ou gerar novo link',
    campos: [
      { rotulo: 'Nome', nome: 'nome', obrigatorio: true, placeholder: 'Ex.: Ana Souza' },
      { rotulo: 'E-mail', nome: 'email', tipoInput: 'email', obrigatorio: true, placeholder: 'ana@empresa.com.br' },
      { tipo: 'html', html: '<p class="dica">Gero um link para a pessoa criar a senha. Ela terá o próprio Dimy (agenda, memória, lembretes), o chat da equipe e o Oráculo. Sua agenda e suas tarefas só se você compartilhar depois. O WhatsApp continua só com você.</p>' },
    ],
    botao: 'Convidar',
    salvar: async (f) => {
      const email = String(f.email || '').trim().toLowerCase();
      let r;
      try { r = await api('/equipe/convidar', { metodo: 'POST', corpo: { nome: f.nome?.trim(), email } }); }
      catch (err) {
        // Já está na equipe (ex.: o primeiro link venceu ou já foi usado): gera um link novo para a mesma pessoa.
        if (err.status !== 409) throw err;
        const { membros } = await api('/equipe');
        const m = (membros || []).find((x) => String(x.email).toLowerCase() === email);
        if (!m) throw err;
        if (!m.ativo) throw new Error('Essa pessoa está bloqueada na equipe. Libere o acesso dela no app (Avisos › Equipe) e tente de novo.');
        r = { ...(await api(`/equipe/${m.user_id}/link`, { metodo: 'POST' })), nome: m.nome, jaNaEquipe: true };
      }
      await carregarPessoas(); await carregarConversas();
      const link = r.link || '';
      abrirJanela({
        titulo: 'Convite criado', botao: 'Copiar link',
        campos: [{ tipo: 'html', html: `<p>${r.jaNaEquipe ? `Gerei um <b>link novo</b> para <b>${esc(r.nome)}</b> (os anteriores deixam de valer).` : `<b>${esc(r.nome)}</b> já está na equipe.`} Agora mande para ela este link (por WhatsApp ou e-mail). Ela abre no celular, cria a senha e já entra. <b>O link vale ${r.validade_min || 60} minutos</b>; se vencer, gere outro no app em Avisos › Equipe › "Novo link".</p>${link ? `<p class="eq-link">${esc(link)}</p>` : ''}<p class="dica">Depois que ela entrar, use "Compartilhar minha agenda e tarefas". No computador ela entra no Dimy Web com o mesmo e-mail e senha.</p>` }],
        salvar: link ? async () => { await navigator.clipboard.writeText(link); aviso('Link copiado.'); return 'manter'; } : null,
      });
      return 'manter';
    },
  });
}

async function clique(e) {
  const conv = e.target.closest('[data-eq-conv]');
  if (conv) return;   // o link troca a rota; abrir() abre a conversa
  const an = e.target.closest('[data-eq-anexo]');
  if (an) {
    try { const img = an.dataset.tipo === 'img', { url } = await linkAnexo(an.dataset.eqAnexo, !img); window.open(url, '_blank', 'noopener'); }
    catch (err) { aviso(err.message, 'erro'); }
    return;
  }
  const ap = e.target.closest('[data-eq-apagar]');
  if (ap) {
    if (!confirm('Apagar esta mensagem para todos?')) return;
    try { await api(`/chat/mensagens/${ap.dataset.eqApagar}/apagar`, { metodo: 'POST' }); const m = E.msgs.find((x) => x.id === ap.dataset.eqApagar); if (m) Object.assign(m, { apagada: true, texto: null, anexo_nome: null }); desenharMsgs(false); }
    catch (err) { aviso(err.message, 'erro'); }
    return;
  }
  const b = e.target.closest('[data-eq]'); if (!b) return;
  const a = b.dataset.eq;
  if (a === 'enviar') enviar();
  if (a === 'nova') novaConversa();
  if (a === 'compartilhar') compartilhar().catch((err) => aviso(err.message, 'erro'));
  if (a === 'convidar') convidar();
  if (a === 'antigas') {
    const box = $('#eq-msgs'), alt = box.scrollHeight;
    const r = await api(`/chat/conversas/${E.atual}/mensagens?antes=${encodeURIComponent(E.msgs[0]?.criado_em || '')}`);
    E.msgs.unshift(...r.mensagens); E.mais = r.mais; desenharMsgs(false); box.scrollTop = box.scrollHeight - alt;
  }
}
// Conta em uso e pessoas mudam quando o dono compartilha: a lista do Conta é atualizada pelo main.js.
export { carregarPessoas };
