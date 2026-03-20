# TranspSaude

Base inicial para um sistema municipal de transporte em saude com:

- painel interno do operador;
- consulta publica por protocolo e PIN;
- PWA para uso no celular;
- API pronta para Cloudflare Pages Functions;
- estrutura inicial para banco `D1`.

## Stack

- React + TypeScript + Vite
- React Router
- Cloudflare Pages Functions
- Cloudflare D1
- PWA manual com `manifest` + `service worker`

## Rodando localmente

1. Instale as dependencias:

```bash
npm install
```

2. Rode o frontend:

```bash
npm run dev
```

3. Para deploy ou dev integrado com Cloudflare, configure o projeto no Pages e crie um banco D1.

## Scripts

- `npm run dev` - servidor Vite local
- `npm run build` - build de producao
- `npm run lint` - lint do projeto

## Estrutura

- `src/` - app React
- `functions/api/` - endpoints da API
- `db/schema.sql` - schema inicial do D1
- `public/manifest.webmanifest` - manifesto do PWA
- `public/sw.js` - service worker

## Modelo inicial de negocio

O MVP foi desenhado para este fluxo:

1. operador atende o paciente no balcao;
2. cadastra a solicitacao de viagem;
3. sistema gera protocolo e PIN;
4. equipe interna atualiza o status;
5. cidadao acompanha pelo PWA.

Status iniciais:

- `recebida`
- `em_analise`
- `aguardando_documentos`
- `aprovada`
- `agendada`
- `cancelada`
- `concluida`

## Banco D1

O arquivo [db/schema.sql](/home/rgarcez/Documentos/transp-saude/db/schema.sql) traz uma primeira modelagem com:

- `operators`
- `patients`
- `travel_requests`
- `request_status_history`
- `audit_logs`

## Cloudflare

Exemplo de configuracao em [wrangler.toml](/home/rgarcez/Documentos/transp-saude/wrangler.toml).

Para ligar o D1 real:

1. crie o banco:

```bash
npx wrangler d1 create transpsaude-db
```

2. atualize `database_id` no `wrangler.toml`;
3. aplique o schema:

```bash
npx wrangler d1 execute transpsaude-db --file=db/schema.sql
```

## Observacao

Enquanto o D1 nao estiver configurado, a API responde com dados de exemplo para facilitar a validacao inicial das telas.
