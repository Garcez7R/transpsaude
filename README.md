# TranspSaude

Aplicação web e PWA para apoio ao transporte de pacientes da **Prefeitura de Capão do Leão**, com foco no cadastro interno de solicitações e no acompanhamento público pelo cidadão.

O projeto foi desenhado para funcionar com uma arquitetura simples, enxuta e econômica usando **Cloudflare Pages + Functions + D1**, mantendo o MVP acessível e fácil de operar.

## Visão Geral

O fluxo principal do sistema é:

1. o operador atende o paciente no balcão da prefeitura;
2. cadastra a solicitação de viagem para tratamento;
3. o sistema libera o primeiro acesso do cidadão com **CPF + senha temporária `0000`**;
4. no primeiro acesso, o cidadão cria um **PIN numérico de 4 dígitos**;
5. a equipe interna atualiza o status da solicitação;
6. o cidadão acompanha tudo pelo celular, em formato PWA.

## Módulos Atuais

### Painel Interno

- login administrativo inicial;
- visão geral das solicitações;
- filtros por status;
- base para gestão operacional;
- tela inicial de cadastro de nova solicitação.

### Área do Cidadão

- acesso com CPF;
- senha temporária inicial `0000`;
- troca obrigatória para PIN de 4 dígitos;
- visualização do status da solicitação;
- histórico básico de andamento;
- botão de instalação do app no mobile quando o navegador permitir.

## Status do MVP

Escopo já implementado:

- identidade visual institucional da Prefeitura de Capão do Leão;
- painel administrativo inicial;
- fluxo público de primeiro acesso do cidadão;
- estrutura base da API em Cloudflare Pages Functions;
- estrutura inicial do banco D1;
- PWA com manifesto, service worker e CTA de instalação mobile.

Escopo sugerido para próxima etapa:

- edição de status da solicitação;
- autenticação persistente real no backend;
- cadastro completo com gravação definitiva no D1;
- histórico administrativo;
- trilha de auditoria operacional;
- recuperação de acesso controlada pela prefeitura.

## Stack Técnica

- **Frontend:** React 19 + TypeScript + Vite
- **Roteamento:** React Router
- **Ícones:** Lucide React
- **Backend:** Cloudflare Pages Functions
- **Banco:** Cloudflare D1
- **PWA:** `manifest.webmanifest` + `service worker`

## Estrutura do Projeto

- [src/](/home/rgarcez/Documentos/transp-saude/src) - aplicação React
- [src/pages/](/home/rgarcez/Documentos/transp-saude/src/pages) - telas principais
- [src/components/](/home/rgarcez/Documentos/transp-saude/src/components) - componentes reutilizáveis
- [functions/api/](/home/rgarcez/Documentos/transp-saude/functions/api) - endpoints da API
- [db/schema.sql](/home/rgarcez/Documentos/transp-saude/db/schema.sql) - schema inicial do D1
- [public/manifest.webmanifest](/home/rgarcez/Documentos/transp-saude/public/manifest.webmanifest) - manifesto do PWA
- [public/sw.js](/home/rgarcez/Documentos/transp-saude/public/sw.js) - service worker
- [wrangler.toml](/home/rgarcez/Documentos/transp-saude/wrangler.toml) - configuração do projeto Cloudflare

## Banco de Dados

O schema inicial contempla as seguintes entidades:

- `operators`
- `patients`
- `travel_requests`
- `request_status_history`
- `audit_logs`

Campos já previstos para acesso do cidadão:

- `cpf`
- `cpf_masked`
- `temporary_password`
- `citizen_pin`
- `must_change_pin`
- `access_activated_at`
- `last_login_at`

## Acesso Inicial do MVP

### Admin

Acesso administrativo inicial configurado para validação do MVP:

- **CPF:** `968.203.730-15`
- **Senha:** `1978`

### Cidadão

Fluxo inicial previsto:

- login com CPF cadastrado no atendimento;
- senha temporária padrão: `0000`;
- obrigatoriedade de troca para PIN de 4 dígitos no primeiro acesso.

## Scripts

- `npm run dev` - inicia o ambiente local com Vite
- `npm run build` - gera o build de produção
- `npm run lint` - executa a análise estática do projeto
- `npm run preview` - abre o build localmente para revisão

## Rodando Localmente

1. Instale as dependências:

```bash
npm install
```

2. Suba o ambiente local:

```bash
npm run dev
```

3. Acesse a aplicação no navegador no endereço informado pelo Vite.

## Deploy na Cloudflare

### 1. Criar o banco D1

```bash
npx wrangler d1 create transpsaude-db
```

### 2. Atualizar o `database_id`

Edite [wrangler.toml](/home/rgarcez/Documentos/transp-saude/wrangler.toml) com o ID real do banco.

### 3. Aplicar o schema

```bash
npx wrangler d1 execute transpsaude-db --file=db/schema.sql
```

### 4. Subir o repositório

```bash
git push -u origin main
```

### 5. Criar o projeto no Pages

No Cloudflare Pages, use:

- **Production branch:** `main`
- **Build command:** `npm run build`
- **Build output directory:** `dist`

### 6. Configurar o binding do banco

No projeto Pages:

- tipo: `D1 database`
- nome: `DB`
- valor: `transpsaude-db`

## Observações Operacionais

- enquanto o D1 não estiver configurado, a aplicação usa dados de exemplo para facilitar a validação;
- parte do fluxo atual ainda está em modo MVP e poderá ser endurecida nas próximas etapas;
- para produção real, o ideal é migrar senhas e PINs para armazenamento com hash;
- se o schema do banco mudar depois do primeiro deploy, pode ser necessário aplicar migrações incrementais no D1.

## Qualidade Atual

Validações locais usadas no projeto:

```bash
npm run build
npm run lint
```

## Próximos Passos Recomendados

1. editar status da solicitação pelo painel;
2. gravar novas solicitações diretamente no D1;
3. melhorar o fluxo de autenticação administrativa;
4. registrar histórico operacional completo;
5. preparar relatórios e filtros adicionais;
6. revisar segurança para uso público real.
