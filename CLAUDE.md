# Segundo Cérebro — app (PWA no GitHub Pages)

Backend e regras completas: repositório `micheldersj-hub/segundo-c-rebro` (`CLAUDE.md`, `docs/MAPA.md`, `docs/ESTADO.md`).

- Arquivos: `index.html` (telas `section.vista`), `app.js` (~4k linhas, módulo único), `style.css`, `sw.js`.
- Ache por âncora, não leia tudo: seções `grep -n '^// [A-Z]' app.js`; telas `#v-<nome>`; rota em `function rota()`.
- A cada publicação suba a versão nos três lugares: `VERSAO` (app.js), `CACHE` (sw.js), `?v=` (index.html, 2 vezes).
- Antes de publicar: `node --check` numa cópia `.mjs` e os testes de tela em `segundo-c-rebro/tools/ui` (320 e 390 px, claro e escuro).
- Nunca coloque chaves ou segredos aqui: o repositório é público. A chave anônima do Supabase no app.js é pública por design.
- Textos da interface em português simples, sem termos técnicos nem JSON na tela.
