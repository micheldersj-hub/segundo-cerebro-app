# Dimy Web

Versão para computador do Segundo Cérebro (Dimy). Código separado do app do celular, mas usa o mesmo login e as mesmas
funções do servidor (Supabase), então tudo o que muda aqui aparece no app e vice-versa.

- `js/base.js`: conexão com o servidor, login, utilidades, janela de formulário, sincronização (30 s, foco, volta da internet).
- `js/main.js`: rotas (`#/hoje`, `#/tarefas`, `#/conversa`, `#/whats/<numero>`, `#/oraculo/<id>`, `#/olho/<aba>`), tema, contadores, atalhos (g+h/t/c/w/o/e, "/").
- Telas: `hoje.js`, `tarefas.js` (quadro com arrastar e soltar), `conversa.js`, `whats.js`, `oraculo.js`, `olho.js`.
- `js/exportar.js` e `vendor/` vêm do app (mesmo gerador de PDF/CSV).
- Versão: `VERSAO` em `js/base.js` e `versao.json` (o site recarrega sozinho quando muda); `?v=` em `index.html`.
- Testes: `segundo-c-rebro/tools/ui/web_telas.mjs` (1440 e 1280 px, claro e escuro).

## w2 (11/11)
- Tela **Agenda** no menu (dia, semana e mês; clique num horário vazio para marcar). Atalho g + a.
- Tarefas mostra os compromissos do dia escolhido acima do quadro.
- Menu em grupos (Seu dia, Conversas, Inteligência) e ícones nas abas.
- Correção: cartão com anotação longa não passa mais por cima da coluna vizinha.

## w3 (11/11)
- Tela **Hoje** refeita como painel do dia: resumo clicável no topo e três colunas da mesma altura (Agenda e Lembretes · Pede você · Tarefas e Esperando). Em tela de computador tudo cabe na janela; cada bloco rola por dentro.
- "Pede você" com abas Urgentes / Dúvidas / Avisos; cada aviso tem **Resolvido** (servidor: `POST /avisos/<id>/lido`).
- Tarefas concluídas com um clique; atrasadas agrupadas; "Já respondi" para quem espera no WhatsApp.
- "Rota no mapa" só aparece quando o local parece um endereço.
- O calendário do mês saiu de Hoje: está na tela Agenda.

## w4 (11/11)
- **Equipe**: chat interno privado (conversa a dois e grupo "Equipe"), com fotos e arquivos, ✓✓ de visto e aviso no celular. Função `chat` no servidor; só quem participa lê.
- **Compartilhar agenda e tarefas** (ex.: secretária): o dono marca em Equipe › "Compartilhar minha agenda e tarefas". Quem recebe escolhe "Minha | Fulano" no topo da Agenda e das Tarefas (header `x-conta`, conferido no servidor). Histórico das tarefas mostra "por <nome>"; compromissos marcados por ela levam "Marcado por <nome> pelo Dimy".

## Publicar uma versão nova (obrigatório)
Rode `./versao.sh wN` (dentro de `web/`, ou em `dimy-web/` e copie). Ele sobe a versão em `base.js`, `versao.json`, `index.html`
e em TODOS os `import` dos `.js` (`?v=wN`, igual em todos). Sem isso, o navegador mantém telas antigas por até 10 minutos.
