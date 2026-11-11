// Oráculo: pesquisa de empresas (dossiês) e empresas perto de você. Lista à esquerda, dossiê à direita.
// Exportar PDF/CSV baixa direto no computador; e-mail sai pelo seu Gmail; WhatsApp pelo fluxo de encaminhar do servidor.
import { $, abrirJanela, api, aviso, diaISO, IC, editarEvento, editarLembrete, esc, hoje, iniciais, somaDias, TZ } from './base.js?v=w8';

export const titulo = 'Oráculo';
const O = { lista: [], atual: null, timer: 0, perto: null, aba: 'abordagem' };
const RISCO = { baixo: { t: 'Risco baixo', c: 'verde' }, medio: { t: 'Risco médio', c: 'ambar' }, alto: { t: 'Risco alto', c: 'vermelho' }, indefinido: { t: 'Risco indefinido', c: 'cinza' } };
const TIPO_SINAL = { divida_federal: 'Dívida federal', divida_estadual: 'Dívida estadual', divida_municipal: 'Dívida municipal', protesto: 'Protesto', credito: 'Crédito', recuperacao_judicial: 'Recuperação judicial', judicial: 'Processo', trabalhista: 'Trabalhista', reputacao: 'Reputação', cadastral: 'Cadastro', outro: 'Outro' };
const ETAPAS = ['Identificar empresa', 'Mercado e posicionamento', 'Reputação e finanças', 'Sócios e responsáveis', 'Dossiê e abordagem'];
const ABAS = [['abordagem', 'Abordagem', 'alvo'], ['socios', 'Sócios', 'pessoas'], ['empresa', 'Empresa e mercado', 'predio'], ['riscos', 'Riscos', 'escudo'], ['fontes', 'Fontes', 'link']];
const fmtCnpj = (c) => String(c || '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const fmtReais = (v) => (v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
const fmtData = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00-03:00`).toLocaleDateString('pt-BR', { timeZone: TZ }) : '');
const fmtDist = (m) => (m == null ? '' : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`);
const dominio = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const lis = (arr) => (arr || []).filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('');
const SEGMENTOS = ['Padarias', 'Restaurantes', 'Farmácias', 'Mercados', 'Lojas', 'Salões', 'Oficinas'];
let el = null;

export async function abrir(alvo, [id]) {
  if (!$('#or-lista')) {
    el = alvo; O.atual = null;
    el.innerHTML = `
      <div class="duas-colunas oraculo">
        <section class="col-lista cartao">
          <header class="lista-cab"><h1>Oráculo</h1></header>
          <form id="or-form" class="or-form">
            <input id="or-alvo" placeholder="Empresa: nome, CNPJ, site ou @  ( / )" autocomplete="off" data-busca aria-label="Empresa para pesquisar">
            <input id="or-ctx" placeholder="Contexto (opcional): cidade, o que você quer saber" autocomplete="off" aria-label="Contexto">
            <button class="btn roxo largo" id="or-ok">Pesquisar</button>
          </form>
          <details class="or-perto"><summary>📍 Empresas perto de mim</summary>
            <form id="or-perto-form" class="linha-form"><input id="or-seg" placeholder="Segmento (ex.: padarias)" autocomplete="off"><button class="btn claro">Buscar aqui</button></form>
            <div class="chips">${SEGMENTOS.map((s) => `<button class="chip" data-or-seg="${s}">${s}</button>`).join('')}</div>
            <p class="dica">Usa a localização deste computador (o navegador pergunta). No computador ela pode ser aproximada.</p></details>
          <h2 class="sec-tit">Dossiês</h2>
          <ul class="lista-pessoas rolavel" id="or-lista"></ul>
        </section>
        <section class="col-detalhe cartao" id="or-detalhe"><div class="vazio-grande"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><p>Pesquise uma empresa ou escolha um dossiê.</p></div></section>
      </div>`;
    el.onclick = clique; el.onsubmit = enviar;
    await carregarLista();
  }
  if (id === 'perto') { if (O.perto) desenharPerto(); }
  else if (id && id !== O.atual?.id) await abrirDossie(id);
  marcar();
}
export async function atualizar() {
  if (!$('#or-lista')) return;
  await carregarLista();
  if (O.atual && O.atual.status !== 'pronto') await abrirDossie(O.atual.id, true);
}
async function carregarLista() {
  const { dossies } = await api('/dossies');
  O.lista = dossies;
  $('#or-lista').innerHTML = dossies.length ? dossies.map((d) => {
    const r = RISCO[d.risco];
    const selo = d.status === 'pronto' ? (r ? `<i class="selo ${r.c}">${r.t.replace('Risco ', '')}</i>` : '') : d.status === 'erro' ? '<i class="selo vermelho">erro</i>' : '<i class="selo roxo pulsando">pesquisando</i>';
    return `<li><a class="pessoa" href="#/oraculo/${esc(d.id)}" data-or="${esc(d.id)}"><span class="av roxo">${esc(iniciais(d.nome || d.alvo))}</span>
      <span class="pessoa-corpo"><b>${esc(d.nome || d.alvo)}</b><small>${esc(d.status === 'pronto' ? d.resumo || '' : d.etapa || 'Na fila')}</small></span><span class="h">${selo}</span></a></li>`;
  }).join('') : '<li class="vazio">Nenhum dossiê ainda. Pesquise o primeiro cliente acima.</li>';
  marcar();
}
const marcar = () => el?.querySelectorAll('[data-or]').forEach((a) => a.classList.toggle('on', a.dataset.or === O.atual?.id));

function etapaAtual(d) {
  if (!d.cadastro) return 0;
  const e = d.etapa || '';
  if (/mercado/i.test(e) && !/pesquisado/i.test(e)) return 1;
  if (/Mercado pesquisado|reputação e sinais/i.test(e)) return 2;
  if (/Sinais financeiros pesquisados|sócios e responsáveis/i.test(e)) return 3;
  if (/Sócios pesquisados|Montando/i.test(e)) return 4;
  return 1;
}
async function abrirDossie(id, silencioso = false) {
  clearTimeout(O.timer);
  const det = $('#or-detalhe');
  if (!silencioso) det.innerHTML = '<p class="carregando">Carregando…</p>';
  const d = await api(`/dossies/${encodeURIComponent(id)}`);
  O.atual = d; marcar();
  const c = d.cadastro && !d.cadastro.nao_encontrado ? d.cadastro : null;
  const cab = `<header class="dos-cab"><span class="av roxo grande">${esc(iniciais(d.nome || d.alvo))}</span><div><h2>${esc(d.nome || d.alvo)}</h2><small>${esc([d.cnpj ? fmtCnpj(d.cnpj) : '', c?.municipio ? `${c.municipio}/${c.uf}` : ''].filter(Boolean).join(' · '))}</small></div>
    <div class="acoes"><button class="btn claro" data-or-acao="refazer">Pesquisar de novo</button><button class="btn claro perigo-txt" data-or-acao="apagar">Apagar</button></div></header>`;
  if (d.status !== 'pronto') {
    if (d.status === 'erro') { det.innerHTML = `${cab}<div class="processando"><p><b>Não consegui concluir a pesquisa.</b></p><p class="dica">${esc(d.error || '')}</p><button class="btn primario" data-or-acao="refazer">Tentar de novo</button></div>`; return; }
    const at = etapaAtual(d);
    det.innerHTML = `${cab}<div class="processando"><p class="po-titulo">${esc(d.etapa || 'Na fila')}…</p><ol class="etapas">${ETAPAS.map((t, i) => `<li class="${i < at ? 'feito' : i === at ? 'agora' : ''}">${t}</li>`).join('')}</ol><p class="dica">Pode sair desta tela: o dossiê continua sendo feito no servidor e aparece no app também.</p></div>`;
    O.timer = setTimeout(() => O.atual?.id === id && $('#or-detalhe') && abrirDossie(id, true).catch(() => {}), 7000);
    return;
  }
  const x = d.dossie || {}, fin = x.financeiro || {}, r = RISCO[d.risco] || RISCO.indefinido;
  const ficha = c ? [['Situação', c.situacao], ['Abertura', fmtData(c.abertura)], ['Porte', c.porte], ['Simples', c.simples == null ? '—' : c.simples ? (c.mei ? 'MEI' : 'Sim') : 'Não'], ['Capital', fmtReais(c.capital_social)], ['Atividade', c.cnae_fiscal_descricao]].filter(([, v]) => v) : [];
  det.innerHTML = `${cab}
    <div class="dos-topo">
      <article class="risco ${r.c}"><b>${r.t}</b><p>${esc(fin.resumo || '')}</p></article>
      <div><p class="resumo">${esc(x.resumo || '')}</p>
        ${ficha.length ? `<dl class="ficha">${ficha.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : '<p class="dica">CNPJ não identificado: dossiê feito só com o que é público na web.</p>'}</div>
    </div>
    <div class="exportar"><span>Exportar</span><button class="btn claro" data-exp="pdf">PDF</button><button class="btn claro" data-exp="csv">CSV</button><button class="btn claro" data-exp="email">E-mail</button><button class="btn claro" data-or-acao="encaminhar">WhatsApp</button>
      ${d.envio?.status === 'enviado' ? `<small class="ok">Enviado no WhatsApp para ${esc(d.envio.nome)}</small>` : ''}</div>
    <nav class="abas">${ABAS.map(([k, t, ic]) => `<button class="${O.aba === k ? 'on' : ''}" data-or-aba="${k}">${IC[ic]}${t}</button>`).join('')}</nav>
    <div class="dos-pane" id="or-pane">${pane(d, O.aba)}</div>`;
}

function pane(d, p) {
  const x = d.dossie || {}, ab = x.abordagem || {}, c = d.cadastro && !d.cadastro.nao_encontrado ? d.cadastro : null;
  if (p === 'abordagem') {
    const fone = String(c?.telefone || '').replace(/\D/g, '');
    return `<div class="grade-2">
      <div><div class="bloco"><h3>Por que abordar</h3><p>${esc(ab.tese || '')}</p>${ab.oferta_sugerida ? `<p><b>Oferta:</b> ${esc(ab.oferta_sugerida)}</p>` : ''}</div>
        <div class="bloco"><h3>Gancho</h3><p>${esc(ab.gancho || '')}</p><h3>Canal e quem</h3><p>${esc(ab.canal || '')}</p>${ab.momento ? `<p class="dica">🕐 ${esc(ab.momento)}</p>` : ''}</div>
        ${ab.roteiro?.length ? `<div class="bloco"><h3>Roteiro</h3><ol>${lis(ab.roteiro)}</ol></div>` : ''}</div>
      <div><div class="bloco msg-whats"><h3>Primeira mensagem <small>WhatsApp</small></h3><p>${esc(ab.mensagem_whatsapp || '')}</p>
          <div class="acoes"><button class="btn claro" data-or-acao="copiar">Copiar</button><a class="btn primario" target="_blank" rel="noopener" href="https://web.whatsapp.com/send?phone=${fone ? (fone.startsWith('55') ? fone : `55${fone}`) : ''}&text=${encodeURIComponent(ab.mensagem_whatsapp || '')}">Abrir no WhatsApp Web</a></div></div>
        <div class="acoes"><button class="btn claro" data-or-acao="visita">📅 Agendar visita</button><button class="btn claro" data-or-acao="followup">🔔 Lembrete</button></div>
        ${ab.perguntas?.length ? `<div class="bloco"><h3>Perguntas para descobrir</h3><ul>${lis(ab.perguntas)}</ul></div>` : ''}
        ${ab.objecoes?.length ? `<div class="bloco"><h3>Objeções prováveis</h3>${ab.objecoes.map((o) => `<details><summary>${esc(o.objecao)}</summary><p>${esc(o.resposta)}</p></details>`).join('')}</div>` : ''}
        ${ab.cuidados?.length ? `<div class="bloco alerta-suave"><h3>Cuidados</h3><ul>${lis(ab.cuidados)}</ul></div>` : ''}
        ${x.proximos_passos?.length ? `<div class="bloco"><h3>Próximos passos</h3><ul class="checks">${lis(x.proximos_passos)}</ul></div>` : ''}</div></div>`;
  }
  if (p === 'empresa') {
    const e = x.empresa || {}, m = x.mercado || {};
    const linhas = [['O que faz', e.o_que_faz], ['Público', e.publico], ['Porte', e.porte_estimado], ['Faturamento', e.faturamento_estimado], ['Como recebe hoje', e.como_recebe_hoje], ['Presença digital', e.presenca_digital]].filter(([, v]) => v);
    const chips = (arr) => (arr || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('');
    return `<div class="grade-2"><div class="bloco"><h3>A empresa</h3><dl class="def">${linhas.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>
      <div><div class="bloco"><h3>Posicionamento</h3><p>${esc(m.posicionamento || '')}</p>${m.diferenciais?.length ? `<p class="rot">Diferenciais</p><div class="chips">${chips(m.diferenciais)}</div>` : ''}${m.concorrentes?.length ? `<p class="rot">Concorrentes</p><div class="chips">${chips(m.concorrentes)}</div>` : ''}</div>
      ${x.dores_segmento?.length ? `<div class="bloco"><h3>Dores do segmento</h3>${x.dores_segmento.map((dd) => `<p><b>${esc(dd.dor)}</b>${dd.impacto ? ` — ${esc(dd.impacto)}` : ''}</p>`).join('')}</div>` : ''}
      ${m.tendencias?.length ? `<div class="bloco"><h3>Tendências do setor</h3><ul>${lis(m.tendencias)}</ul></div>` : ''}</div></div>`;
  }
  if (p === 'socios') {
    const pessoas = Array.isArray(x.socios) ? x.socios : [];
    if (!pessoas.length) return c?.socios?.length ? `<div class="bloco"><h3>Quadro societário (Receita)</h3><ul>${c.socios.map((s) => `<li>${esc(s.nome)}${s.qualificacao ? ` · ${esc(s.qualificacao)}` : ''}</li>`).join('')}</ul></div>` : '<p class="dica">Não encontrei sócios ou responsáveis em fontes públicas.</p>';
    const PAPEL = { decisor: ['Decide', 'verde'], influencia: ['Influencia', 'azul'], investidor: ['Investidor', 'cinza'], indefinido: ['Papel incerto', 'cinza'] };
    return `${x.quem_decide ? `<p class="destaque"><b>Com quem falar:</b> ${esc(x.quem_decide)}</p>` : ''}<div class="grade-2">${pessoas.map((pe) => {
      const [pt, pc] = PAPEL[pe.papel] || PAPEL.indefinido, fontes = (pe.fontes || []).filter((u) => /^https?:/.test(u));
      return `<article class="bloco socio"><header><span class="av roxo">${esc(iniciais(pe.nome))}</span><div><b>${esc(pe.nome)}</b><small>${esc([pe.cargo, pe.desde ? `desde ${pe.desde}` : ''].filter(Boolean).join(' · '))}</small></div><i class="selo ${pc}">${pt}</i></header>
        ${pe.confirmado === false ? '<p class="dica">Perfil público não confirmado: pode haver homônimos.</p>' : ''}${pe.perfil ? `<p>${esc(pe.perfil)}</p>` : ''}${pe.trajetoria ? `<p class="rot">Trajetória</p><p>${esc(pe.trajetoria)}</p>` : ''}
        ${pe.como_abordar ? `<p class="rot">Como abordar</p><p>${esc(pe.como_abordar)}</p>` : ''}${fontes.length ? `<p class="fontes">${fontes.slice(0, 4).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(dominio(u))} ›</a>`).join('')}</p>` : ''}</article>`;
    }).join('')}</div><p class="dica">Só perfil profissional público. Dados pessoais ficam de fora.</p>`;
  }
  if (p === 'riscos') {
    const f = x.financeiro || {}, cnpj = d.cnpj || '';
    const checar = [['Protestos (cartórios)', 'https://www.pesquisaprotesto.com.br/'], ['Dívida ativa da União (PGFN)', 'https://www.listadevedores.pgfn.gov.br/'], ['Certidão negativa federal', 'https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cnpj'], ['Processos (JusBrasil)', `https://www.jusbrasil.com.br/busca?q=${encodeURIComponent(cnpj ? fmtCnpj(cnpj) : d.nome || d.alvo)}`], ['Reclame Aqui', `https://www.reclameaqui.com.br/busca/?q=${encodeURIComponent(d.nome || d.alvo)}`]];
    return `<div class="grade-2"><div class="bloco"><h3>Sinais encontrados</h3>${f.sinais?.length ? f.sinais.map((s) => `<div class="sinal g-${esc(s.gravidade || 'media')}"><b>${esc(TIPO_SINAL[s.tipo] || s.tipo)}</b><p>${esc(s.descricao)}</p>${s.fonte && /^https?:/.test(s.fonte) ? `<a href="${esc(s.fonte)}" target="_blank" rel="noopener">${esc(dominio(s.fonte))} ›</a>` : ''}</div>`).join('') : '<p>Nenhum sinal financeiro ou jurídico encontrado em fontes públicas.</p>'}
      ${f.nao_encontrado?.length ? `<h3>Pesquisado, nada público</h3><ul class="checks">${lis(f.nao_encontrado)}</ul>` : ''}${x.reputacao ? `<h3>Reputação</h3><p>${esc(x.reputacao)}</p>` : ''}</div>
      <div class="bloco"><h3>Confirmar na fonte oficial</h3><p class="dica">Serasa e a lista completa de protestos não são públicos. ${cnpj ? `CNPJ: <b>${fmtCnpj(cnpj)}</b>` : ''}</p><div class="links">${checar.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${t} ›</a>`).join('')}</div></div></div>`;
  }
  const fontes = d.fontes || [];
  return `<div class="bloco"><h3>Fontes consultadas</h3>${fontes.length ? `<div class="links">${fontes.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(dominio(u))} ›</a>`).join('')}</div>` : '<p>Sem links registrados.</p>'}<p class="dica">Cadastro: dados públicos da Receita Federal (via BrasilAPI).</p></div>`;
}

// ---- Perto de mim ----
async function buscarPerto(segmento) {
  if (!navigator.geolocation) { aviso('Este navegador não informa a localização.', 'erro'); return; }
  const det = $('#or-detalhe'); O.atual = null; marcar();
  det.innerHTML = '<p class="carregando">📍 Localizando e procurando empresas por perto… pode levar até 1 minuto.</p>';
  try {
    const pos = await new Promise((ok, erro) => navigator.geolocation.getCurrentPosition(ok, erro, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }))
      .catch((e) => { throw new Error(e?.code === 1 ? 'O navegador bloqueou a localização. Libere no cadeado ao lado do endereço do site.' : 'Não consegui pegar a localização deste computador.'); });
    const { local } = await api('/local', { metodo: 'POST', corpo: { lat: pos.coords.latitude, lng: pos.coords.longitude, precisao: Math.round(pos.coords.accuracy || 0) } });
    const r = await api('/proximas', { metodo: 'POST', corpo: { segmento } });
    O.perto = { ...r, local: r.local || local, segmento: segmento || r.segmento || '' };
    if (location.hash !== '#/oraculo/perto') history.replaceState(null, '', '#/oraculo/perto');
    desenharPerto();
  } catch (err) { det.innerHTML = `<p class="carregando">${esc(err.message)}</p>`; }
}
function desenharPerto() {
  const p = O.perto, l = p.local || {}, emp = p.empresas || [];
  $('#or-detalhe').innerHTML = `<header class="dos-cab"><span class="av verde grande">📍</span><div><h2>${emp.length} empresa${emp.length === 1 ? '' : 's'}${p.segmento ? ` de ${esc(p.segmento)}` : ''} por perto</h2><small>${esc(l.endereco || [l.bairro, l.cidade].filter(Boolean).join(', ') || '')}</small></div></header>
    ${emp.length ? `<div class="exportar"><span>Exportar a lista</span><button class="btn claro" data-exp="pdf" data-exp-alvo="perto">PDF</button><button class="btn claro" data-exp="csv" data-exp-alvo="perto">CSV</button><button class="btn claro" data-exp="email" data-exp-alvo="perto">E-mail</button></div>` : ''}
    <table class="tabela"><thead><tr><th>Empresa</th><th>Segmento</th><th>Distância</th><th>Endereço</th><th>Telefone</th><th></th></tr></thead><tbody>
    ${emp.map((e, i) => `<tr><td><b>${esc(e.nome)}</b>${e.motivo ? `<small>${esc(e.motivo)}</small>` : ''}</td><td>${esc(e.categoria || '')}</td><td>${e.distancia_m != null ? fmtDist(e.distancia_m) : e.fonte === 'web' ? 'da web' : ''}</td><td>${esc(e.endereco || '')}</td><td>${esc(e.telefone || '')}</td>
      <td class="acoes"><button class="btn mini roxo" data-or-perto="${i}">Oráculo</button>${e.lat || e.endereco ? `<a class="btn mini claro" target="_blank" rel="noopener" href="${esc(e.lat ? `https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(e.endereco)}`)}">Mapa</a>` : ''}</td></tr>`).join('') || `<tr><td colspan="6" class="vazio">Não achei empresas${p.segmento ? ` de "${esc(p.segmento)}"` : ''} por aqui.</td></tr>`}</tbody></table>`;
}

// ---- Exportar (mesmos serviços do app: exportar.js + jsPDF local) ----
let modExp = null;
const Xp = () => (modExp ??= import('./exportar.js?v=w8').catch((e) => { modExp = null; throw e; }));
const JSPDF = { url: './vendor/jspdf-4.2.1.umd.min.js', sri: 'sha384-qovJwSBbRDPP5cEjCp8S0UP66wrvnjaa60XMOGzTNanrThcrGfXfnZkvgY8N1KT3' };
async function pacote(alvo) {
  const X = await Xp();
  if (alvo === 'perto') {
    const empresas = X.prepararEmpresas(O.perto?.empresas || []), l = O.perto?.local || {}, seg = O.perto?.segmento || '', lugar = l.bairro || l.cidade || 'mim';
    return { X, base: `empresas-perto-${l.bairro || l.cidade || 'aqui'}${seg ? `-${seg}` : ''}`, assunto: `Empresas perto de ${lugar}${seg ? ` (${seg})` : ''}`, texto: `Segue a lista de ${empresas.length} empresas${seg ? ` de ${seg}` : ''} perto de ${l.endereco || lugar}.`,
      pdf: async () => X.pdfEmpresas(await X.carregarJsPDF(JSPDF.url, JSPDF.sri), empresas, { titulo: `Empresas perto de ${lugar}${seg ? ` · ${seg}` : ''}`, subtitulo: l.endereco }), csv: () => X.csvEmpresas(empresas) };
  }
  const d = structuredClone(O.atual), nome = d.nome || d.alvo;
  return { X, base: `oraculo-${nome}`, assunto: `Oráculo · ${nome}`, texto: `Segue o dossiê do Oráculo sobre ${nome}.${d.dossie?.resumo ? `\n\n${d.dossie.resumo}` : ''}`,
    pdf: async () => pdfDossie(d, X, await X.carregarJsPDF(JSPDF.url, JSPDF.sri)), csv: () => csvDossie(d, X) };
}
async function arquivo(pk, tipo) { const dados = tipo === 'pdf' ? await pk.pdf() : pk.csv(); return new File([dados], pk.X.nomeArquivo(pk.base, tipo), { type: tipo === 'pdf' ? 'application/pdf' : pk.X.TIPO_CSV }); }
function baixar(f) { const u = URL.createObjectURL(f), a = document.createElement('a'); a.href = u; a.download = f.name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); }
const paraBase64 = (blob) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => erro(new Error('Não consegui ler o arquivo gerado.')); r.readAsDataURL(blob); });
async function pdfDossie(d, X, jsPDF) {
  const x = d.dossie || {}, c = d.cadastro && !d.cadastro.nao_encontrado ? d.cadastro : null, f = x.financeiro || {}, ab = x.abordagem || {}, e = x.empresa || {}, m = x.mercado || {};
  const pdf = X.criarDocumento(jsPDF, { titulo: `Oráculo · ${d.nome || d.alvo}`, subtitulo: [d.cnpj ? `CNPJ ${fmtCnpj(d.cnpj)}` : '', c?.municipio ? `${c.municipio}/${c.uf}` : ''].filter(Boolean).join(' · ') });
  pdf.secao((RISCO[d.risco] || RISCO.indefinido).t); pdf.p(f.resumo); pdf.secao('Resumo'); pdf.p(x.resumo);
  if (c) { pdf.secao('Cadastro (Receita Federal)'); await pdf.tabela([{ titulo: 'Campo', peso: 1 }, { titulo: 'Valor', peso: 3 }], [['Situação', c.situacao], ['Abertura', fmtData(c.abertura)], ['Porte', c.porte], ['Capital social', fmtReais(c.capital_social)], ['Atividade', c.cnae_fiscal_descricao], ['Telefone', c.telefone], ['Endereço', [c.logradouro, c.numero, c.bairro, c.municipio && `${c.municipio}/${c.uf}`].filter(Boolean).join(', ')]].filter(([, v]) => v)); }
  pdf.secao('Abordagem'); pdf.p(ab.tese); pdf.campo('Oferta', ab.oferta_sugerida); pdf.campo('Gancho', ab.gancho); pdf.campo('Canal e quem', ab.canal); pdf.campo('Momento', ab.momento);
  if (ab.mensagem_whatsapp) { pdf.p('Primeira mensagem:', { negrito: true }); pdf.p(ab.mensagem_whatsapp); }
  if (ab.roteiro?.length) { pdf.p('Roteiro', { negrito: true }); pdf.lista(ab.roteiro); }
  if (ab.objecoes?.length) { pdf.p('Objeções prováveis', { negrito: true }); pdf.lista(ab.objecoes.map((o) => `${o.objecao} -> ${o.resposta}`)); }
  if (x.socios?.length) { pdf.secao('Sócios e responsáveis'); pdf.p(x.quem_decide); for (const s of x.socios) { pdf.p(`${s.nome}${s.cargo ? ` (${s.cargo})` : ''}`, { negrito: true }); pdf.p(s.perfil); pdf.campo('Como abordar', s.como_abordar); } }
  pdf.secao('Empresa e mercado'); pdf.campo('O que faz', e.o_que_faz); pdf.campo('Faturamento estimado', e.faturamento_estimado); pdf.campo('Como recebe hoje', e.como_recebe_hoje); pdf.campo('Posicionamento', m.posicionamento);
  pdf.secao('Riscos e sinais financeiros'); if (f.sinais?.length) pdf.lista(f.sinais.map((g) => `${TIPO_SINAL[g.tipo] || g.tipo}: ${g.descricao}`)); else pdf.p('Nenhum sinal encontrado em fontes públicas.');
  if (x.proximos_passos?.length) { pdf.secao('Próximos passos'); pdf.lista(x.proximos_passos); }
  if (d.fontes?.length) { pdf.secao('Fontes'); pdf.lista(d.fontes); }
  return pdf.finalizar();
}
function csvDossie(d, X) {
  const x = d.dossie || {}, c = d.cadastro && !d.cadastro.nao_encontrado ? d.cadastro : null, f = x.financeiro || {}, ab = x.abordagem || {};
  const L = [['Empresa', 'Nome', d.nome || d.alvo], ['Empresa', 'CNPJ', d.cnpj ? fmtCnpj(d.cnpj) : ''], ['Empresa', 'Cidade', c?.municipio ? `${c.municipio}/${c.uf}` : ''], ['Empresa', 'Situação', c?.situacao], ['Empresa', 'Telefone', c?.telefone],
    ['Resumo', 'Resumo', x.resumo], ['Risco', 'Nível', (RISCO[d.risco] || RISCO.indefinido).t], ['Risco', 'Resumo', f.resumo], ...(f.sinais || []).map((g) => ['Risco', TIPO_SINAL[g.tipo] || g.tipo, g.descricao]),
    ['Abordagem', 'Tese', ab.tese], ['Abordagem', 'Oferta', ab.oferta_sugerida], ['Abordagem', 'Mensagem WhatsApp', ab.mensagem_whatsapp], ...(x.socios || []).map((s) => ['Sócio', s.nome, [s.cargo, s.perfil].filter(Boolean).join(' | ')]),
    ...(x.proximos_passos || []).map((t, k) => ['Próximo passo', String(k + 1), t]), ...(d.fontes || []).map((u, k) => ['Fonte', String(k + 1), u])];
  return X.gerarCsv(['Seção', 'Campo', 'Valor'], L.filter((l) => l[2]));
}
async function exportar(acao, alvo, b) {
  const pk = await pacote(alvo);
  if (acao === 'pdf' || acao === 'csv') { b.textContent = 'Gerando…'; baixar(await arquivo(pk, acao)); aviso(`${acao.toUpperCase()} baixado.`); return; }
  abrirJanela({
    titulo: 'Enviar por e-mail', botao: 'Enviar e-mail',
    campos: [{ rotulo: 'E-mail de quem recebe', nome: 'para', tipoInput: 'email', valor: localStorage.getItem('cerebro-ultimo-email') || '', placeholder: 'nome@empresa.com.br' },
      { tipo: 'marcas', rotulo: 'Anexar', opcoes: [{ nome: 'pdf', texto: 'PDF', marcado: true }, { nome: 'csv', texto: 'CSV (planilha)', marcado: true }] },
      { tipo: 'html', html: `<p class="dica">Assunto: <b>${esc(pk.assunto)}</b>. Sai do seu Gmail.</p>` },
      { rotulo: 'Mensagem', nome: 'texto', tipoInput: 'textarea', linhas: 4, valor: pk.texto }],
    salvar: async (f) => {
      const em = pk.X.validarEmail(f.para); if (!em.ok) throw new Error(em.erro);
      if (!f.pdf && !f.csv) throw new Error('Marque PDF, CSV ou os dois.');
      const arquivos = [];
      for (const t of ['pdf', 'csv'].filter((t) => f[t])) { const a = await arquivo(pk, t); arquivos.push({ nome: a.name, tipo: t === 'pdf' ? 'application/pdf' : 'text/csv', base64: await paraBase64(a) }); }
      try {
        const r = await api('/exportar', { metodo: 'POST', corpo: { canal: 'email', para: em.email, assunto: pk.assunto, texto: f.texto, arquivos } });
        if (!r?.enviado) throw new Error('O servidor não confirmou o envio. Confira a pasta Enviados do Gmail antes de repetir.');
        try { localStorage.setItem('cerebro-ultimo-email', em.email); } catch { /* ok */ }
        aviso(r.mensagem || `E-mail enviado para ${em.email}.`);
      } catch (err) { throw pk.X.erroDeEnvio(err); }
    },
  });
}

async function clique(e) {
  const seg = e.target.closest('[data-or-seg]'); if (seg) { $('#or-seg').value = seg.dataset.orSeg; buscarPerto(seg.dataset.orSeg); return; }
  const aba = e.target.closest('[data-or-aba]'); if (aba) { O.aba = aba.dataset.orAba; el.querySelectorAll('[data-or-aba]').forEach((x) => x.classList.toggle('on', x === aba)); $('#or-pane').innerHTML = pane(O.atual, O.aba); return; }
  const ex = e.target.closest('[data-exp]');
  if (ex) { const t = ex.textContent; ex.disabled = true; try { await exportar(ex.dataset.exp, ex.dataset.expAlvo || 'dossie', ex); } catch (err) { aviso(`Não consegui: ${err.message}`, 'erro'); } finally { ex.disabled = false; ex.textContent = t; } return; }
  const pt = e.target.closest('[data-or-perto]');
  if (pt) {
    const em = O.perto.empresas[Number(pt.dataset.orPerto)], l = O.perto.local || {};
    pt.disabled = true;
    try {
      const { id } = await api('/dossies', { metodo: 'POST', corpo: { alvo: `${em.nome}${l.cidade ? `, ${l.cidade}${l.uf ? `/${l.uf}` : ''}` : ''}`, contexto: [`${em.categoria || ''} encontrada perto de mim`, em.endereco ? `Endereço: ${em.endereco}` : '', em.telefone ? `Telefone: ${em.telefone}` : '', em.site ? `Site: ${em.site}` : ''].filter(Boolean).join('. ') } });
      await carregarLista(); location.hash = `#/oraculo/${id}`;
    } catch (err) { pt.disabled = false; aviso(err.message, 'erro'); }
    return;
  }
  const b = e.target.closest('[data-or-acao]'); if (!b) return;
  const d = O.atual, nome = d?.nome || d?.alvo;
  try {
    switch (b.dataset.orAcao) {
      case 'copiar': await navigator.clipboard.writeText(d.dossie?.abordagem?.mensagem_whatsapp || ''); aviso('Mensagem copiada.'); break;
      case 'visita': editarEvento(null, { dia: somaDias(hoje(), 1), sugestao: { titulo: `Visita – ${nome}`, local: [d.cadastro?.bairro, d.cadastro?.municipio].filter(Boolean).join(', ') } }); break;
      case 'followup': editarLembrete(null, { sugestao: { texto: `Falar com ${nome}`, dia: somaDias(diaISO(new Date()), 1), hora: '10:00' } }); break;
      case 'refazer': b.disabled = true; await api(`/dossies/${d.id}/refazer`, { metodo: 'POST' }); aviso('Pesquisando de novo.'); await abrirDossie(d.id); await carregarLista(); break;
      case 'apagar': if (!confirm(`Apagar o dossiê de ${nome}?`)) return; await api(`/dossies/${d.id}/apagar`, { metodo: 'POST' }); aviso('Dossiê apagado.'); O.atual = null; location.hash = '#/oraculo'; $('#or-detalhe').innerHTML = '<div class="vazio-grande"><p>Escolha um dossiê.</p></div>'; await carregarLista(); break;
      case 'encaminhar':
        abrirJanela({ titulo: 'Encaminhar no WhatsApp', botao: 'Enviar', campos: [{ rotulo: 'Para quem (nome ou número com DDD)', nome: 'para', valor: d.enviar_para || '', placeholder: 'Ex.: Bruno ou 31 99999-0000' }, { tipo: 'html', html: '<p class="dica">Sai pelo número comercial quando a pessoa te escreveu nas últimas 24 h; senão abro o WhatsApp Web com o texto pronto.</p>' }],
          salvar: async (f) => {
            const para = (f.para || '').trim();
            if (!para) { open(`https://web.whatsapp.com/send?text=${encodeURIComponent(d.texto_whatsapp || '')}`, '_blank', 'noopener'); return; }
            const r = await api(`/dossies/${d.id}/enviar`, { metodo: 'POST', corpo: { para } });
            if (r.status === 'enviado') { aviso(`Enviado para ${r.nome}.`); await abrirDossie(d.id, true); return; }
            open((r.link || `https://wa.me/?text=${encodeURIComponent(d.texto_whatsapp || '')}`).replace('https://wa.me/', 'https://web.whatsapp.com/send?phone=').replace('?text=', '&text='), '_blank', 'noopener');
          } });
        break;
    }
  } catch (err) { b.disabled = false; aviso(err.message, 'erro'); }
}
async function enviar(e) {
  e.preventDefault();
  if (e.target.id === 'or-form') {
    const alvo = $('#or-alvo').value.trim(); if (!alvo) return;
    const b = $('#or-ok'); b.disabled = true; b.textContent = 'Enviando…';
    try { const { id } = await api('/dossies', { metodo: 'POST', corpo: { alvo, contexto: $('#or-ctx').value.trim() } }); $('#or-alvo').value = ''; $('#or-ctx').value = ''; await carregarLista(); location.hash = `#/oraculo/${id}`; }
    catch (err) { aviso(err.message, 'erro'); } finally { b.disabled = false; b.textContent = 'Pesquisar'; }
  }
  if (e.target.id === 'or-perto-form') buscarPerto($('#or-seg').value.trim());
}
