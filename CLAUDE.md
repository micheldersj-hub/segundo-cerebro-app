# Segundo Cérebro — app (PWA no GitHub Pages)

Backend e regras completas: repositório `micheldersj-hub/segundo-c-rebro` (`CLAUDE.md`, `docs/MAPA.md`, `docs/ESTADO.md`).

- Arquivos: `index.html` (telas `section.vista`), `app.js` (~4k linhas), `exportar.js` (serviços de PDF/CSV/telefone/e-mail/compartilhar, sem DOM, carregado sob demanda), `vendor/` (jsPDF 4.2.1 oficial, com SRI), `style.css`, `sw.js`.
- Exportação: não volte a importar bibliotecas UMD pela CDN com `+esm` (foi a causa do `autoTable is not a function`). Testes: `node --test tools/ui/exportar.test.mjs` e `tools/ui/interacao_envio.mjs`.
- O app confere a versão ao voltar para a tela (`verificarVersao`, lê o `CACHE` do sw.js) e recarrega sozinho.
- `web/`: Dimy Web (versão para computador, código próprio, mesmas rotas do servidor). Veja `web/LEIAME.md`; testes em `tools/ui/web_telas.mjs`.
- Ache por âncora, não leia tudo: seções `grep -n '^// [A-Z]' app.js`; telas `#v-<nome>`; rota em `function rota()`.
- A cada publicação suba a versão nos três lugares: `VERSAO` (app.js), `CACHE` (sw.js), `?v=` (index.html, 2 vezes).
- Antes de publicar: `node --check` numa cópia `.mjs` e os testes de tela em `segundo-c-rebro/tools/ui` (320 e 390 px, claro e escuro).
- Nunca coloque chaves ou segredos aqui: o repositório é público. A chave anônima do Supabase no app.js é pública por design.
- Textos da interface em português simples, sem termos técnicos nem JSON na tela.
- Equipe: chat interno (`/chat/...` → função `chat`; cuidado: `/chat` sozinho é a conversa com o Dimy na função `app`) e conta compartilhada (`Conta` + header `x-conta` só em /agenda e /tarefas). Testes: `tools/ui/interacao_equipe.mjs`.
