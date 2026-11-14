# Painel das Lojas · Brasileiríssima

Lista da vez, metas, indicadores, ranking e vendas do TOTVS Moda, por loja.

- Endereço: `https://msantosnordeste-dev.github.io/gestaodepessoas/salao/`
- Login: o RH entra com o mesmo usuário do Gestão de Pessoas. Cada loja recebe um login criado em **Cadastros › Logins do painel**.
- Dados: Supabase (tabela `painel_docs`, em tempo real). As regras de acesso ficam no banco: login de loja só altera dados da própria loja e não vê CPFs, validação nem RH.
- Vendas: a função `totvs-sync` busca no TOTVS a cada 10 minutos e a rotina `painel_importar_totvs()` (a cada 5 minutos, dentro do banco) cadastra lojas e vendedores e monta o resumo de vendas por loja/dia. Nada disso usa o Claude.
- Filiais `xx` e `1xx` do TOTVS são a mesma loja (ex.: 20 e 120).

Arquivos: `index.html` (o painel) e `ponte.js` (login e ligação com o Supabase). A configuração do Supabase vem de `../config.js`.
