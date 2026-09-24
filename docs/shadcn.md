# Skill shadcn

O [shadcn/ui](https://ui.shadcn.com) é uma coleção de componentes de interface para sites em React, como botões, formulários, janelas, abas e tabelas. Com ele, o código de cada componente é copiado para dentro do projeto, e dá para mudar o visual à vontade.

A skill em `.claude/skills/shadcn/` ensina o Claude a usar esses componentes do jeito certo:
- adicionar componentes pelo CLI (`npx shadcn@latest add ...`);
- seguir as regras de estilo (cores da marca como tokens e espaçamento com `gap`);
- compor telas a partir de componentes prontos.

## Quando ela entra em ação

Só em projetos que já usam shadcn, ou seja, que têm um arquivo `components.json`. O site alfa da AlphaHome (`site/`) é HTML puro, então a skill ainda não faz nada nele. Ela vai ser útil quando o site virar um projeto React na versão beta, por exemplo no formulário de orçamento e no painel dos projetos.

Ao carregar, a skill roda `npx shadcn@latest info --json` para ler a configuração do projeto. Fora de um projeto shadcn, esse comando só mostra um erro e não altera nada.

## Origem

Copiada sem alterações de `skills/shadcn` do repositório [shadcn-ui/ui](https://github.com/shadcn-ui/ui), sob a licença MIT (© 2023 shadcn).
