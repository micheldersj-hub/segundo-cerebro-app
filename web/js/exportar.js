// Exportação e compartilhamento do Oráculo — serviços independentes da tela (sem DOM), testáveis no Node.
//   Telefone   → normaliza e valida para E.164 (Brasil por padrão), máscara para digitação.
//   Email      → valida o endereço.
//   Dados      → valida e organiza as empresas em colunas fixas (as mesmas no PDF e no CSV).
//   Csv        → UTF-8 com BOM, ";" (Excel pt-BR), aspas/quebras de linha pelo RFC 4180, proteção contra fórmulas.
//   Pdf        → jsPDF local (vendor/), tabela própria: larguras pelo conteúdo, quebra de página, cabeçalho repetido.
//   Compartilhar → folha nativa do sistema (iPhone: Share Sheet) e link oficial do WhatsApp (wa.me, só texto).
// Erros sempre como ErroExportacao(codigo, mensagem): a tela mostra a mensagem certa para cada caso.

export class ErroExportacao extends Error {
  constructor(codigo, mensagem, causa) { super(mensagem); this.name = 'ErroExportacao'; this.codigo = codigo; if (causa) this.causa = causa; }
}
const falha = (codigo, mensagem, causa) => new ErroExportacao(codigo, mensagem, causa);

// ---------------------------------------------------------------------------
// Telefone
// ---------------------------------------------------------------------------
// DDDs válidos no Brasil (Anatel).
export const DDDS = new Set([11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99]);

// Aceita "31 99497-0760", "(31) 9 9497-0760", "031994970760", "+55 31 99497-0760", "5531994970760", "+351 912 345 678", "00 1 415 555 0100".
// Devolve { ok, e164: '+5531994970760', digitos: '5531994970760', exibicao } ou { ok: false, codigo, erro }.
export function normalizarTelefone(entrada, { pais = '55' } = {}) {
  const bruto = String(entrada ?? '').trim();
  if (!bruto) return { ok: false, codigo: 'vazio', erro: 'Digite o número com DDD.' };
  if (/[a-z]/i.test(bruto.replace(/\b(ramal|ext)\b.*$/i, ''))) return { ok: false, codigo: 'nao_numero', erro: 'Isso não parece um número de telefone.' };
  let d = bruto.replace(/\D/g, '');
  let internacional = bruto.startsWith('+');
  if (!internacional && d.startsWith('00')) { d = d.slice(2); internacional = true; }
  if (!internacional && pais === '55') {
    if (d.startsWith('0') && (d.length === 11 || d.length === 12)) d = d.slice(1);       // 0 + DDD (discagem nacional)
    if (d.length <= 9) return { ok: false, codigo: 'sem_ddd', erro: d.length >= 8 ? 'Falta o DDD. Ex.: 31 99497-0760.' : 'Número incompleto.' };
    if (d.length === 10 || d.length === 11) d = `55${d}`;
    else if (!(d.startsWith('55') && (d.length === 12 || d.length === 13))) return { ok: false, codigo: 'invalido', erro: 'Número com dígitos a mais ou a menos.' };
  }
  if (d.length < 8 || d.length > 15) return { ok: false, codigo: 'invalido', erro: 'Número internacional inválido (8 a 15 dígitos com o código do país).' };
  if (d.startsWith('55')) {
    const ddd = +d.slice(2, 4), resto = d.slice(4);
    if (!DDDS.has(ddd)) return { ok: false, codigo: 'ddd_invalido', erro: `DDD ${String(ddd).padStart(2, '0')} não existe.` };
    if (resto.length === 9 && resto[0] !== '9') return { ok: false, codigo: 'invalido', erro: 'Celular com 9 dígitos precisa começar com 9.' };
    if (resto.length !== 8 && resto.length !== 9) return { ok: false, codigo: 'invalido', erro: 'Número com dígitos a mais ou a menos.' };
  }
  return { ok: true, e164: `+${d}`, digitos: d, exibicao: foneLegivel(d) };
}
// "5531994970760" → "+55 (31) 99497-0760"; outros países: "+351 912345678".
export function foneLegivel(digitos) {
  const d = String(digitos ?? '').replace(/\D/g, '');
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  if (m) return `+55 (${m[1]}) ${m[2]}-${m[3]}`;
  return d ? `+${d}` : '';
}
// Máscara enquanto digita (só formata; quem valida é normalizarTelefone).
export function mascaraTelefone(entrada) {
  const bruto = String(entrada ?? '');
  if (bruto.trim().startsWith('+') && !bruto.replace(/\D/g, '').startsWith('55')) return `+${bruto.replace(/\D/g, '').slice(0, 15)}`;
  let d = bruto.replace(/\D/g, ''), pre = '';
  if (bruto.trim().startsWith('+') || (d.startsWith('55') && d.length > 11)) { pre = '+55 '; d = d.slice(2); }
  d = d.slice(0, 11);
  if (d.length <= 2) return pre + (d.length ? `(${d}` : '');
  const ddd = d.slice(0, 2), n = d.slice(2), corte = n.length > 8 ? 5 : 4;
  return `${pre}(${ddd}) ${n.length > corte ? `${n.slice(0, corte)}-${n.slice(corte)}` : n}`;
}
// Parece telefone (para a busca decidir entre nome e número)?
export const pareceTelefone = (t) => /^\+?[\d\s().-]{3,}$/.test(String(t ?? '').trim());

// ---------------------------------------------------------------------------
// E-mail
// ---------------------------------------------------------------------------
export function validarEmail(entrada) {
  const e = String(entrada ?? '').trim().toLowerCase();
  if (!e) return { ok: false, codigo: 'vazio', erro: 'Digite o e-mail de quem recebe.' };
  if (/[\s,;]/.test(e)) return { ok: false, codigo: 'invalido', erro: 'Um e-mail por vez, sem espaços nem vírgulas.' };
  const m = e.match(/^([^@]+)@([^@]+)$/);
  if (!m) return { ok: false, codigo: 'invalido', erro: 'Falta o @ no e-mail.' };
  const [, local, dom] = m;
  if (local.length > 64 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) || /^\.|\.$|\.\./.test(local)) return { ok: false, codigo: 'invalido', erro: 'A parte antes do @ tem caracteres inválidos.' };
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(dom)) return { ok: false, codigo: 'invalido', erro: `O domínio "${dom}" não parece certo (ex.: empresa.com.br).` };
  return { ok: true, email: e };
}

// ---------------------------------------------------------------------------
// Dados: empresas → colunas fixas
// ---------------------------------------------------------------------------
const limpa = (v) => String(v ?? '').normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
export const distancia = (m) => (m == null || m === '' || !Number.isFinite(+m) ? '' : +m < 1000 ? `${Math.round(+m / 10) * 10} m` : `${(+m / 1000).toFixed(1).replace('.', ',')} km`);
export const COLUNAS_EMPRESAS = [
  { chave: 'n', titulo: '#', peso: 0.35, min: 18, csv: false, inteiro: true },
  { chave: 'nome', titulo: 'Empresa', peso: 3, min: 90 },
  { chave: 'segmento', titulo: 'Segmento', peso: 1.6, min: 60 },
  { chave: 'distancia', titulo: 'Distância', peso: 0.9, min: 44, inteiro: true },
  { chave: 'endereco', titulo: 'Endereço', peso: 3, min: 90 },
  { chave: 'telefone', titulo: 'Telefone', peso: 1.4, min: 70, inteiro: true },
  { chave: 'site', titulo: 'Site', peso: 1.8, min: 60 },
  { chave: 'motivo', titulo: 'Por que abordar', peso: 3.2, min: 90 },
];
// Valida a lista recebida: ignora o que não é empresa, garante nome e textos limpos. Nunca inventa registros.
export function prepararEmpresas(lista) {
  if (!Array.isArray(lista)) throw falha('dados_invalidos', 'A lista de empresas veio num formato inesperado. Busque de novo.');
  const ok = lista.filter((e) => e && typeof e === 'object');
  if (!ok.length) throw falha('vazio', 'Não há empresas para exportar. Faça a busca primeiro.');
  return ok.map((e, i) => ({
    n: String(i + 1),
    nome: limpa(e.nome) || '(sem nome)',
    segmento: limpa(e.categoria ?? e.segmento),
    distancia: distancia(e.distancia_m),
    endereco: limpa(e.endereco),
    telefone: limpa(e.telefone),
    site: limpa(e.site),
    motivo: limpa(e.motivo),
    lat: Number.isFinite(+e.lat) && e.lat !== null && e.lat !== '' ? String(+e.lat) : '',
    lng: Number.isFinite(+e.lng) && e.lng !== null && e.lng !== '' ? String(+e.lng) : '',
  }));
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
export const BOM = '﻿';
// Célula: aspas quando precisa (";", aspas, quebra de linha, espaço nas pontas); textos que começam com = + - @ ganham ' na frente
// para o Excel/Planilhas não executarem como fórmula (dados vêm da internet).
export function celulaCsv(v, sep = ';') {
  let t = String(v ?? '').normalize('NFC').replace(/\r\n?/g, '\n');
  if (/^[=+\-@\t\r]/.test(t) && !/^-?\d+([.,]\d+)?$/.test(t)) t = `'${t}`;
  return t.includes(sep) || /["\n]/.test(t) || /^\s|\s$/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
export function gerarCsv(cabecalho, linhas, { sep = ';' } = {}) {
  if (!Array.isArray(cabecalho) || !cabecalho.length) throw falha('dados_invalidos', 'Planilha sem colunas.');
  const n = cabecalho.length;
  const corpo = [cabecalho, ...linhas.map((l) => Array.from({ length: n }, (_, k) => l?.[k] ?? ''))];
  return BOM + corpo.map((l) => l.map((c) => celulaCsv(c, sep)).join(sep)).join('\r\n') + '\r\n';
}
export function csvEmpresas(empresas) {
  const cols = COLUNAS_EMPRESAS.filter((c) => c.csv !== false);
  return gerarCsv([...cols.map((c) => c.titulo), 'Latitude', 'Longitude'], empresas.map((e) => [...cols.map((c) => e[c.chave]), e.lat, e.lng]));
}
export const TIPO_CSV = 'text/csv;charset=utf-8';

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
// Fontes padrão do PDF usam WinAnsi: cobrem todo o português (á ã ç é ê í ó õ ô ú ü), aspas curvas, travessão, reticências e €.
// O resto (emoji, ideogramas) sai do texto em vez de virar símbolo quebrado.
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
export const textoPdf = (s) => [...String(s ?? '').normalize('NFC').replace(/\*\*/g, '').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ').replace(/ /g, ' ')]
  .filter((ch) => ch === '\n' || (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) <= 255) || WINANSI_EXTRA.includes(ch)).join('').replace(/[ \t]+/g, ' ').trim();

const COR = { marca: [109, 40, 217], tinta: [18, 22, 28], suave: [107, 114, 128], faixa: [245, 243, 255], linha: [226, 223, 240] };
export const idRelatorio = (agora = new Date()) => `OR-${agora.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const dataHora = (d) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const pausa = () => new Promise((ok) => setTimeout(ok, 0));

// Documento com cabeçalho, título, subtítulo, data e identificação; seções, parágrafos, listas e tabelas; rodapé numerado.
export function criarDocumento(jsPDF, { titulo, subtitulo = '', paisagem = false, agora = new Date(), id = idRelatorio(agora), rotulo = 'Segundo Cérebro · Oráculo' } = {}) {
  if (typeof jsPDF !== 'function') throw falha('biblioteca', 'O gerador de PDF não carregou. Confira a internet e tente de novo.');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: paisagem ? 'landscape' : 'portrait', compress: true });
  doc.setProperties({ title: textoPdf(titulo), subject: textoPdf(subtitulo), creator: 'Segundo Cérebro', author: 'Segundo Cérebro' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = paisagem ? 32 : 44, L = W - 2 * M, BASE = H - M - 14;
  let y = M;
  const cor = (c, f = 'setTextColor') => doc[f](c[0], c[1], c[2]);
  const novaPagina = () => { doc.addPage(); faixa(); y = M; };
  const faixa = () => { cor(COR.marca, 'setFillColor'); doc.rect(0, 0, W, 6, 'F'); };
  const cabe = (h) => { if (y + h > BASE) novaPagina(); };
  const linhas = (txt, larg) => doc.splitTextToSize(textoPdf(txt) || ' ', larg);
  faixa();
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); cor(COR.suave);
  doc.text(rotulo, M, y + 4); doc.text(`Relatório ${id}`, W - M, y + 4, { align: 'right' }); y += 18;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(paisagem ? 17 : 18); cor(COR.tinta);
  for (const l of linhas(titulo, L)) { cabe(22); doc.text(l, M, y + 14); y += 22; }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); cor(COR.suave);
  for (const l of linhas([subtitulo, `Gerado em ${dataHora(agora)}`].filter(Boolean).join(' · '), L)) { cabe(13); doc.text(l, M, y + 8); y += 13; }
  y += 8; cor(COR.linha, 'setDrawColor'); doc.setLineWidth(0.6); doc.line(M, y, W - M, y); y += 10;

  const api = {
    doc, id, get y() { return y; },
    secao(t) { y += 8; cabe(30); doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); cor(COR.marca); doc.text(textoPdf(t), M, y + 10); y += 20; cor(COR.tinta); },
    p(t, { negrito = false, tam = 10.5 } = {}) {
      if (!textoPdf(t)) return;
      doc.setFont('helvetica', negrito ? 'bold' : 'normal'); doc.setFontSize(tam); cor(COR.tinta);
      for (const l of linhas(t, L)) { cabe(15); doc.text(l, M, y + 10); y += 14; }
      y += 4;
    },
    campo(k, v) { if (v == null || v === '') return; api.p(`${k}: ${v}`); },
    lista(arr) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); cor(COR.tinta);
      for (const t of (arr || []).filter((x) => textoPdf(x))) { linhas(t, L - 14).forEach((l, k) => { cabe(15); if (!k) doc.text('-', M, y + 10); doc.text(l, M + 12, y + 10); y += 14; }); y += 2; }
    },
    // colunas: [{ titulo, peso?, min? }] ou strings; linhas: arrays de textos. Assíncrona: cede a vez à tela a cada 40 linhas.
    async tabela(colunas, linhasTab, { fonte = 8.5 } = {}) {
      const cols = colunas.map((c) => (typeof c === 'string' ? { titulo: c } : c));
      const PAD = 4, LH = fonte * 1.22;
      doc.setFontSize(fonte);
      const larguras = largurasColunas(doc, cols, linhasTab, L, PAD, fonte);
      const quebrar = (t, k, negrito) => { doc.setFont('helvetica', negrito ? 'bold' : 'normal'); return doc.splitTextToSize(textoPdf(t) || '', larguras[k] - 2 * PAD); };
      const desenharLinha = (cel, negrito, fundo) => {
        const alt = Math.max(...cel.map((ls) => ls.length || 1)) * LH + 2 * PAD;
        if (fundo) { cor(fundo, 'setFillColor'); doc.rect(M, y, L, alt, 'F'); }
        doc.setFont('helvetica', negrito ? 'bold' : 'normal'); doc.setFontSize(fonte); cor(negrito ? [255, 255, 255] : COR.tinta);
        let x = M;
        cel.forEach((ls, k) => { ls.forEach((l, j) => doc.text(l, x + PAD, y + PAD + fonte * 0.95 + j * LH)); x += larguras[k]; });
        cor(COR.linha, 'setDrawColor'); doc.setLineWidth(0.4); doc.line(M, y + alt, M + L, y + alt);
        y += alt;
      };
      const cab = cols.map((c, k) => quebrar(c.titulo, k, true));
      const altCab = Math.max(...cab.map((l) => l.length)) * LH + 2 * PAD;
      const cabecalho = () => desenharLinha(cab, true, COR.marca);
      cabe(altCab + LH + 2 * PAD); cabecalho();
      const maxLinhas = Math.floor((BASE - M - altCab - 2 * PAD) / LH);   // uma linha nunca passa de uma página
      for (let i = 0; i < linhasTab.length; i++) {
        let cel = cols.map((_, k) => quebrar(linhasTab[i][k], k, false));
        cel = cel.map((ls) => (ls.length > maxLinhas ? [...ls.slice(0, maxLinhas - 1), `${ls[maxLinhas - 1].replace(/.{0,3}$/, '')}...`] : ls));
        const alt = Math.max(...cel.map((ls) => ls.length || 1)) * LH + 2 * PAD;
        if (y + alt > BASE) { novaPagina(); cabecalho(); }
        desenharLinha(cel, false, i % 2 ? COR.faixa : null);
        if (i % 40 === 39) await pausa();
      }
      y += 10;
    },
    // Fecha o documento: rodapé "página k de n" e confere se o arquivo saiu de verdade.
    finalizar() {
      const n = doc.getNumberOfPages();
      for (let k = 1; k <= n; k++) {
        doc.setPage(k); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); cor([156, 163, 175]);
        doc.text(`${rotulo} · ${id} · ${dataHora(agora)}`, M, H - 18);
        doc.text(`Página ${k} de ${n}`, W - M, H - 18, { align: 'right' });
      }
      let buf;
      try { buf = doc.output('arraybuffer'); } catch (e) { throw falha('geracao', 'O PDF não pôde ser montado. Tente de novo.', e); }
      validarPdf(buf);
      return buf;
    },
  };
  return api;
}
// Larguras pelo conteúdo: cada coluna pede a largura natural (cabeçalho e textos numa linha só);
// se tudo cabe, sobra é dividida pelos pesos; se não cabe, colunas curtas ficam com o que precisam e as longas dividem o resto.
export function largurasColunas(doc, cols, linhas, total, pad, fonte) {
  doc.setFontSize(fonte);
  const nat = cols.map((c, k) => {
    doc.setFont('helvetica', 'bold');
    let w = Math.max(...textoPdf(c.titulo).split(/\s+/).map((p) => doc.getTextWidth(p)));
    doc.setFont('helvetica', 'normal');
    for (let i = 0; i < Math.min(linhas.length, 300); i++) w = Math.max(w, doc.getTextWidth(textoPdf(linhas[i][k])));
    return w + 2 * pad + 1;   // +1: folga de arredondamento (senão o texto do tamanho exato quebra)
  });
  // Colunas curtas marcadas "inteiro" (número, distância, telefone) nunca quebram: ficam com a largura natural (até 1/6 da página).
  const fixas = cols.map((c, k) => (c.inteiro ? Math.min(nat[k], total / 6) : null));
  if (fixas.some((w) => w != null)) {
    const resto = cols.map((c, k) => k).filter((k) => fixas[k] == null);
    const sub = largurasColunas(doc, resto.map((k) => cols[k]), linhas.map((l) => resto.map((k) => l[k])), total - fixas.reduce((a, w) => a + (w || 0), 0), pad, fonte);
    return fixas.map((w, k) => w ?? sub[resto.indexOf(k)]);
  }
  const min = cols.map((c, k) => Math.min(nat[k], c.min ?? 30));
  const peso = cols.map((c) => c.peso ?? 1);
  const soma = nat.reduce((a, b) => a + b, 0);
  if (soma <= total) { const ps = peso.reduce((a, b) => a + b, 0); return nat.map((w, k) => w + ((total - soma) * peso[k]) / ps); }
  const larg = new Array(cols.length).fill(null);
  let resto = total, livres = cols.map((_, k) => k);
  for (let mudou = true; mudou;) {     // enchimento: quem precisa menos que a sua parte fica com o natural
    mudou = false;
    const ps = livres.reduce((a, k) => a + peso[k], 0);
    for (const k of livres) if (nat[k] <= (resto * peso[k]) / ps) { larg[k] = nat[k]; resto -= nat[k]; livres = livres.filter((x) => x !== k); mudou = true; break; }
  }
  const ps = livres.reduce((a, k) => a + peso[k], 0);
  for (const k of livres) larg[k] = (resto * peso[k]) / ps;
  // mínimo de cada coluna: o que faltar sai só das colunas que têm folga acima do próprio mínimo
  let falta = 0;
  for (const k of livres) if (larg[k] < min[k]) { falta += min[k] - larg[k]; larg[k] = min[k]; }
  const folga = livres.filter((k) => larg[k] > min[k]), totalFolga = folga.reduce((a, k) => a + larg[k] - min[k], 0);
  if (falta > 0 && totalFolga > 0) for (const k of folga) larg[k] -= (falta * (larg[k] - min[k])) / totalFolga;
  return larg;
}
export function validarPdf(buf) {
  const b = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  const ini = b && b.length > 800 ? String.fromCharCode(...b.slice(0, 5)) : '';
  const fim = ini ? String.fromCharCode(...b.slice(-1024)) : '';
  if (ini !== '%PDF-' || !fim.includes('%%EOF')) throw falha('geracao', 'O PDF saiu vazio ou incompleto. Tente de novo.');
  return true;
}
export async function pdfEmpresas(jsPDF, empresas, { titulo, subtitulo, agora } = {}) {
  const pdf = criarDocumento(jsPDF, { titulo: titulo || 'Empresas', subtitulo: [subtitulo, `${empresas.length} empresa${empresas.length === 1 ? '' : 's'}`].filter(Boolean).join(' · '), paisagem: true, agora });
  await pdf.tabela(COLUNAS_EMPRESAS, empresas.map((e) => COLUNAS_EMPRESAS.map((c) => e[c.chave])));
  return pdf.finalizar();
}

// Carrega o jsPDF guardado no próprio app (vendor/), com conferência de integridade. Só no navegador.
let carregando = null;
export function carregarJsPDF(url, integridade) {
  if (globalThis.jspdf?.jsPDF) return Promise.resolve(globalThis.jspdf.jsPDF);
  carregando ??= new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = url; s.async = true; if (integridade) { s.integrity = integridade; s.crossOrigin = 'anonymous'; }
    s.onload = () => (typeof globalThis.jspdf?.jsPDF === 'function' ? ok(globalThis.jspdf.jsPDF) : erro(falha('biblioteca', 'O gerador de PDF veio incompleto. Feche e abra o app.')));
    s.onerror = () => erro(falha('biblioteca', 'Não consegui carregar o gerador de PDF. Confira a internet e tente de novo.'));
    document.head.append(s);
  }).catch((e) => { carregando = null; throw e; });
  return carregando;
}

// ---------------------------------------------------------------------------
// Nomes de arquivo
// ---------------------------------------------------------------------------
export const nomeArquivo = (s, ext) => `${String(s || 'oraculo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60) || 'oraculo'}${ext ? `.${ext}` : ''}`;
export const tamanhoLegivel = (n) => (n < 1024 ? `${n} bytes` : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

// ---------------------------------------------------------------------------
// Compartilhar
// ---------------------------------------------------------------------------
// Folha nativa (iPhone: Share Sheet). Precisa ser chamada direto do toque: o iOS recusa se passou tempo demais (NotAllowedError).
export function podeCompartilharArquivos(nav, arquivos) {
  try { return !!nav?.canShare && nav.canShare({ files: arquivos }); } catch { return false; }
}
export async function compartilharArquivos(nav, { arquivos, texto, titulo }) {
  if (!podeCompartilharArquivos(nav, arquivos)) throw falha('sem_compartilhar', 'Este aparelho não deixa compartilhar arquivos daqui. Use "Baixar" e envie pelo app que quiser.');
  try {
    await nav.share({ files: arquivos, ...(texto ? { text: texto } : {}), ...(titulo ? { title: titulo } : {}) });
    return 'compartilhado';
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelado';
    if (e?.name === 'NotAllowedError') throw falha('sem_gesto', 'O iPhone pediu um toque novo. Toque de novo em compartilhar.', e);
    if (e?.name === 'DataError' || e?.name === 'TypeError') throw falha('arquivo_recusado', 'O sistema recusou este tipo de arquivo. Use "Baixar".', e);
    throw falha('compartilhar_falhou', 'O compartilhamento não abriu. Tente de novo ou use "Baixar".', e);
  }
}
// Link oficial do WhatsApp: abre a conversa com o número (salvo ou não na agenda) e a mensagem pronta. Só leva texto, nunca arquivo.
export function linkWhatsApp(telefone, texto = '') {
  const t = normalizarTelefone(telefone);
  if (!t.ok) throw falha('telefone_invalido', t.erro);
  return `https://wa.me/${t.digitos}${texto ? `?text=${encodeURIComponent(String(texto).slice(0, 1800))}` : ''}`;
}

// ---------------------------------------------------------------------------
// Envio pelo servidor (WhatsApp comercial e e-mail): traduz cada falha numa mensagem própria.
// ---------------------------------------------------------------------------
const MENSAGENS_ENVIO = {
  sem_internet: 'Sem internet agora. Os dados continuam aqui: tente de novo quando a conexão voltar.',
  sessao: 'Sua sessão expirou. Entre de novo e repita o envio.',
  fora_janela: 'Essa pessoa não te escreveu nas últimas 24 h, e a Meta não deixa o número comercial mandar arquivo assim. Use "Pelo meu celular".',
  nunca_escreveu: 'Essa pessoa nunca escreveu para o número comercial; a Meta só permite começar a conversa com modelo aprovado. Use "Pelo meu celular".',
  telefone_incompleto: 'Falta o DDD no número.',
  telefone_invalido: 'Número inválido.',
  contato_ambiguo: 'Mais de um contato com esse nome. Escolha na lista.',
  contato_nao_encontrado: 'Não achei esse contato. Escolha na lista ou digite o número com DDD.',
  so_administrador: 'O envio pelo número comercial é só do administrador.',
  whatsapp_falhou: 'O WhatsApp comercial recusou o envio. Tente de novo em instantes.',
  parcial: 'A mensagem saiu, mas um arquivo não foi. Tente de novo.',
  email_invalido: 'E-mail inválido.',
  email_falhou: 'O Gmail não aceitou o envio. Tente de novo; se repetir, reconecte o Google na Configuração.',
  arquivo_grande: 'Arquivos grandes demais para enviar (máx. 10 MB). Envie só o CSV ou use "Pelo meu celular".',
};
export function erroDeEnvio(err) {
  if (err instanceof ErroExportacao) return err;
  const msg = String(err?.message || '');
  if (err?.name === 'TypeError' && /fetch|load failed|network/i.test(msg)) return falha('sem_internet', MENSAGENS_ENVIO.sem_internet, err);
  if (err?.status === 401) return falha('sessao', MENSAGENS_ENVIO.sessao, err);
  const cod = err?.codigo;
  if (cod && MENSAGENS_ENVIO[cod]) return falha(cod, ['contato_ambiguo', 'telefone_invalido', 'telefone_incompleto', 'parcial', 'email_invalido'].includes(cod) && msg ? msg : MENSAGENS_ENVIO[cod], err);
  return falha('envio', msg && msg.length < 160 && !/[{}<>]/.test(msg) ? msg : 'O envio falhou. Tente de novo.', err);
}
