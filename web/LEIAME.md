# Dimy Web

Versão para computador do Segundo Cérebro (Dimy). Código separado do app do celular, mas usa o mesmo login e as mesmas
funções do servidor (Supabase), então tudo o que muda aqui aparece no app e vice-versa.

- `js/base.js`: conexão com o servidor, login, utilidades, janela de formulário, sincronização (30 s, foco, volta da internet).
- `js/main.js`: rotas (`#/hoje`, `#/tarefas`, `#/conversa`, `#/whats/<numero>`, `#/oraculo/<id>`, `#/olho/<aba>`), tema, contadores, atalhos (g+h/t/c/w/o/e, "/").
- Telas: `hoje.js`, `tarefas.js` (quadro com arrastar e soltar), `conversa.js`, `whats.js`, `oraculo.js`, `olho.js`.
- `js/exportar.js` e `vendor/` vêm do app (mesmo gerador de PDF/CSV).
- Versão: `VERSAO` em `js/base.js` e `versao.json` (o site recarrega sozinho quando muda); `?v=` em `index.html`.
- Testes: `segundo-c-rebro/tools/ui/web_telas.mjs` (1440 e 1280 px, claro e escuro).
