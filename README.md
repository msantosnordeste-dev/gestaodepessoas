# Gestão de Pessoas · Brasileiríssima

Portal de RH e Departamento Pessoal da rede Brasileiríssima. Cada pessoa entra só com **usuário e senha** criados pelo RH.

| Perfil | O que vê e faz |
|---|---|
| **RH** | Tudo: colaboradores, ficha de registro, folha, férias, escalas, benefícios, desligamentos, eSocial, usuários, log de acesso. Aprova os registros dos gerentes. |
| **Gerente** | Só as lojas marcadas no cadastro dele (uma ou várias): equipe, experiência 45/90, escala, banco de horas, férias e aviso de férias em PDF. Não vê salário, CPF nem ficha de registro. O que ele registra vai para aprovação do RH. |

A separação por perfil e por loja é feita **no próprio banco de dados** (regras de acesso do Supabase), não só na tela.

> **Situação desta versão:** a pasta raiz é a versão para internet (GitHub Pages + Supabase). Ela ainda **não tem** os menus criados depois na versão Claude: Rotatividade, Prestadores PJ, Medidas disciplinares, exportação personalizada, desligamento programado, chamado SULTS e importação da planilha de fichas. A versão completa atual está em `versao-claude/vitrine-rh.html` (funciona só dentro do Claude) e serve de referência para a migração.

## O que tem nesta pasta

```
index.html                 o portal (versão internet)
config.js                  endereço e chave pública do Supabase (você preenche)
.nojekyll                  faz o GitHub Pages servir os arquivos como estão
vercel.json, _headers      usados só se um dia publicar na Vercel ou Netlify
supabase/
  schema.sql               tabelas e regras de acesso (rodar uma vez)
  functions/usuarios/      função do servidor que cria e altera usuários e senhas
versao-claude/
  vitrine-rh.html          portal completo atual (artifact do Claude), para referência
```

**Nunca** coloque neste repositório: a `service_role key` do Supabase, senhas, backups ou planilhas com dados de colaboradores.

## Publicar no GitHub (sem instalar nada)

1. Entre em **github.com** → **New repository**. Nome: `gestao-de-pessoas`.
   - Para usar o GitHub Pages grátis o repositório precisa ser **Public**. O código fica visível, mas os dados ficam no Supabase, protegidos por senha e pelas regras de acesso. Repositório **Private** com Pages exige plano pago do GitHub.
2. Na página do repositório: **Add file → Upload files**. Arraste **todo o conteúdo desta pasta** (não a pasta em si) e clique em **Commit changes**.
   - Arquivos que começam com ponto (`.gitignore`, `.nojekyll`) ficam ocultos no Mac: no Finder, aperte **Cmd + Shift + .** para mostrá-los.
3. **Settings → Pages** → *Source*: **Deploy from a branch** → Branch **main**, pasta **/ (root)** → **Save**.
4. Em 1 ou 2 minutos aparece o endereço: `https://SEU-USUARIO.github.io/gestao-de-pessoas/`. Esse é o link que os gerentes vão usar.
5. Depois de preencher o `config.js` (passo 5 abaixo), edite o arquivo direto no GitHub (ícone de lápis) ou envie de novo.

## Preparar o banco de dados (uma única vez)

### 1. Criar o banco de dados no Supabase
1. Crie uma conta em **supabase.com** e clique em **New project**.
   Nome: `gestao-de-pessoas`. Região: **South America (São Paulo)**. Guarde a senha do banco num lugar seguro.
2. Abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
   Deve aparecer "Success. No rows returned".

### 2. Fechar o cadastro público
Em **Authentication → Sign In / Providers → Email**:
- desligue **Allow new users to sign up** (ninguém cria conta sozinho; só o RH, pelo portal);
- deixe o provedor **Email** ligado;
- em **Authentication → Policies** (ou "Password"), defina **senha mínima de 8 caracteres**.

### 3. Publicar a função de usuários
1. Abra **Edge Functions → Deploy a new function → Via Editor**.
2. Nome da função: `usuarios` (exatamente assim).
3. Apague o exemplo, cole todo o conteúdo de `supabase/functions/usuarios/index.ts` e clique em **Deploy**.
4. Mantenha **Verify JWT** ligado.

### 4. Criar o primeiro usuário do RH
1. Em **Authentication → Users → Add user → Create new user**:
   - e-mail: `SEU-LOGIN@usuarios.gestaodepessoas.app` (ex.: `gpe@usuarios.gestaodepessoas.app`)
   - senha: a sua senha (mínimo 8 caracteres)
   - marque **Auto Confirm User**
2. No **SQL Editor**, rode (trocando login e nome):
   ```sql
   select public.criar_primeiro_rh('gpe', 'Marcos Vinicius Santos Almeida');
   ```
   O e-mail acima é só técnico: ninguém recebe mensagens nele. No portal você entra apenas com `gpe` e a senha.

### 5. Ligar o site ao banco
Em **Project Settings → API**, copie **Project URL** e **anon public key** para `config.js`:
```js
window.GP_CONFIG = {
  supabaseUrl: "https://xxxxxxxx.supabase.co",
  supabaseAnonKey: "eyJhbGciOi..."
};
```
A chave **anon** é pública por natureza. **Nunca** coloque a chave `service_role` no site.

Para testar no seu computador antes de publicar, dê dois cliques em `index.html`.

## Primeiro uso
1. Entre com o seu usuário do RH. Como o banco está vazio, escolha **Começar com dados de exemplo** (para conhecer) ou **Começar do zero**.
2. Cadastre as lojas em **Lojas** e as pessoas em **Colaboradores** (formulário completo da ficha de registro ou **Importar planilha (CSV ou Excel)** — o botão **Baixar modelo** traz a planilha pronta, com a aba de cargos e lojas aceitos).
3. Em **Usuários e acessos → + Novo usuário**, crie os gerentes, marque as lojas de cada um e envie usuário e senha por um canal seguro.
4. Crie também um **segundo usuário de RH**, para que um possa redefinir a senha do outro.

## Rotina e cuidados
- **Senha esquecida:** o RH redefine em **Usuários e acessos → Editar**. Se todos os usuários de RH esquecerem, entre no Supabase e troque a senha em **Authentication → Users**.
- **Bloquear alguém:** desmarque **Usuário ativo**. O acesso é cortado na hora.
- **Log:** **Usuários e acessos → Log de acesso** mostra logins, saídas, criação de usuários, aprovações e avisos emitidos. Tentativas de senha errada ficam em **Supabase → Authentication → Logs**.
- **Backup:** no plano gratuito o Supabase não guarda cópias diárias. Até migrar para o plano Pro (cópias automáticas), gere uma cópia semanal em **Configurações → Gerar backup** e guarde o arquivo.
- **LGPD:** o banco guarda dados pessoais (CPF, endereço, dados bancários). Mantenha poucas pessoas com perfil de RH, desative usuários de quem sai da empresa e não compartilhe senhas.
- **Tabelas legais:** confira INSS, IRRF e salário mínimo em **Configurações** sempre que mudarem.

## Custos
- Supabase: gratuito até 500 MB de banco e 50 mil usuários ativos/mês; plano Pro a partir de US$ 25/mês (recomendado em produção pelos backups diários).
- GitHub Pages: gratuito (repositório público).
