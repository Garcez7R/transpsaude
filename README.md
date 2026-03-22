# TranspSaude

<p align="center">
  <img src="./cp.jpeg" alt="Prefeitura Municipal de Capão do Leão" width="140" />
</p>

<p align="center">
  <strong>Plataforma institucional para gestão do transporte em saúde</strong><br />
  Prefeitura Municipal de Capão do Leão
</p>

## Apresentação

O **TranspSaude** é uma aplicação web com suporte a **PWA** desenvolvida para apoiar a operação do transporte em saúde da **Prefeitura Municipal de Capão do Leão**.

O sistema organiza o fluxo de atendimento desde o cadastro presencial da solicitação até o acompanhamento do cidadão, passando pela análise da gerência, distribuição para motoristas, registro de orientações e controle operacional da agenda.

O projeto foi estruturado para operar com uma arquitetura simples, econômica e compatível com o ecossistema **Cloudflare Pages + Functions + D1**, com foco em:

- rastreabilidade do processo;
- clareza operacional;
- acesso móvel pelo cidadão;
- governança de perfis internos;
- implantação enxuta no plano free da Cloudflare.

## Objetivo institucional

O sistema foi concebido para atender às necessidades conjuntas da:

- **Secretaria Municipal de Saúde**, no controle das solicitações de transporte para tratamento;
- **Secretaria Municipal de Transportes**, na organização de rotas, distribuição de motoristas, veículos e horários;
- **equipe administrativa**, na governança de acessos, cadastros, histórico e acompanhamento das demandas.

## Perfis de acesso

### Cidadão

- consulta pública com `CPF + PIN`;
- primeiro acesso com senha temporária `0000`;
- troca obrigatória para PIN numérico de 4 dígitos;
- visualização do status da solicitação;
- data, horário e local de embarque;
- mensagens e orientações liberadas pela equipe interna;
- histórico da solicitação.

### Operador

- cadastro presencial da solicitação;
- registro de paciente, responsável e acompanhante;
- definição do CPF de acesso do cidadão;
- visualização do painel operacional;
- atualização de status;
- registro de mensagens e avisos na solicitação;
- reset de acesso do paciente quando necessário.

### Gerente

- análise das solicitações;
- atribuição de motorista;
- definição de horário de saída;
- definição de local oficial de embarque;
- visualização operacional por período;
- gestão de motoristas, operadores, pacientes e veículos;
- relatórios operacionais.

### Administrador

- acesso completo ao ambiente interno;
- criação e gestão de gerentes;
- governança de acessos internos;
- visão administrativa dos agendamentos;
- apoio à operação e à gestão da base cadastral.

### Motorista

- acesso próprio com `CPF + PIN`;
- visualização das viagens atribuídas;
- dados do paciente;
- local de embarque;
- horário de saída;
- destino, observações e orientações aplicáveis.

## Fluxo operacional

1. O cidadão é atendido presencialmente pela equipe da prefeitura.
2. O operador registra a solicitação de transporte no sistema.
3. O sistema gera o protocolo e libera o acesso inicial do cidadão.
4. A gerência analisa a fila de solicitações.
5. A gerência define motorista, horário e, quando necessário, ponto oficial de embarque.
6. O motorista acessa sua agenda e consulta as viagens atribuídas.
7. O cidadão acompanha a solicitação pelo celular ou navegador.
8. A equipe interna registra status, mensagens e histórico operacional.

## Recursos já implementados

### Gestão de solicitações

- cadastro completo de solicitações de transporte em saúde;
- identificação de paciente, responsável e acompanhante;
- controle de CPF de acesso para consulta pública;
- protocolo de solicitação;
- detalhe completo da solicitação;
- histórico de movimentações;
- reagendamento com registro histórico;
- mensagens internas e mensagens visíveis ao paciente.

### Gestão operacional

- atribuição de motorista por solicitação;
- vínculo de veículo ao motorista;
- definição de horário de saída;
- definição de local oficial de embarque;
- visualização por status, data e período;
- filtros por destino, motorista, paciente e protocolo;
- relatórios de apoio à gerência.

### Governança de acessos

- perfis separados para operador, gerente, administrador e motorista;
- sessões internas com token em banco;
- primeiro acesso obrigatório com troca de PIN;
- redefinição de acesso controlada por perfil;
- trilha de auditoria para eventos internos relevantes.

### Consulta pública

- área institucional do cidadão;
- acompanhamento do agendamento;
- visualização de data, horário e embarque;
- mensagens e orientações liberadas para consulta pública;
- PWA instalável em dispositivos compatíveis.

## Arquitetura técnica

- **Frontend:** React + TypeScript + Vite
- **Roteamento:** React Router
- **UI:** CSS próprio + Lucide React
- **Backend:** Cloudflare Pages Functions
- **Banco de dados:** Cloudflare D1
- **Sessões:** tabela `auth_sessions` no D1
- **PWA:** manifesto + service worker

## Compatibilidade com Cloudflare Free

O projeto foi mantido dentro de um conjunto de serviços compatíveis com o plano free da Cloudflare:

- Cloudflare Pages
- Cloudflare Pages Functions
- Cloudflare D1

Não há dependência operacional de:

- R2
- Durable Objects
- Queues
- KV
- Hyperdrive
- AI
- Browser Rendering

Também foi ajustado o mecanismo de hash de credenciais para um formato mais leve e compatível com as restrições práticas do runtime do plano free.

## Estrutura do projeto

- [src/](/home/rgarcez/Documentos/transp-saude/src) - aplicação React
- [src/pages/](/home/rgarcez/Documentos/transp-saude/src/pages) - telas principais
- [functions/api/](/home/rgarcez/Documentos/transp-saude/functions/api) - API da aplicação
- [db/schema.sql](/home/rgarcez/Documentos/transp-saude/db/schema.sql) - schema consolidado do banco
- [db/migrations/](/home/rgarcez/Documentos/transp-saude/db/migrations) - migrações incrementais
- [public/manifest.webmanifest](/home/rgarcez/Documentos/transp-saude/public/manifest.webmanifest) - manifesto PWA
- [public/sw.js](/home/rgarcez/Documentos/transp-saude/public/sw.js) - service worker
- [wrangler.toml](/home/rgarcez/Documentos/transp-saude/wrangler.toml) - configuração Cloudflare

## Estrutura de dados principal

Entidades centrais já previstas no banco:

- `operators`
- `patients`
- `travel_requests`
- `drivers`
- `vehicles`
- `request_status_history`
- `request_messages`
- `audit_logs`
- `auth_sessions`

## Segurança e controle

O sistema já contempla:

- separação de perfis internos;
- sessões em banco;
- controle de acesso por função;
- reset controlado de credenciais;
- primeiro acesso obrigatório;
- histórico e auditoria de operações internas;
- compatibilidade progressiva com credenciais legadas.

Para ambiente público definitivo, seguem como boas práticas permanentes:

- revisão periódica das permissões por perfil;
- revisão de políticas de backup e retenção;
- monitoramento dos logs do Cloudflare;
- revisão contínua de LGPD, segurança e governança.

## Implantação

### 1. Instalar dependências

```bash
npm install
```

### 2. Executar localmente

```bash
npm run dev
```

### 3. Validar build e lint

```bash
npm run lint
npm run build
```

### 4. Criar o banco D1

```bash
npx wrangler d1 create transpsaude-db
```

### 5. Atualizar o `database_id`

Editar [wrangler.toml](/home/rgarcez/Documentos/transp-saude/wrangler.toml) com o identificador real do banco.

### 6. Aplicar schema e migrações

```bash
npx wrangler d1 execute transpsaude-db --file=db/schema.sql
```

Quando necessário, aplicar também as migrações incrementais em [db/migrations/](/home/rgarcez/Documentos/transp-saude/db/migrations).

### 7. Publicar no Cloudflare Pages

Configuração recomendada:

- **Branch de produção:** `main`
- **Build command:** `npm run build`
- **Output directory:** `dist`

### 8. Configurar binding do banco

No projeto Pages:

- **Type:** `D1 database`
- **Name:** `DB`
- **Value:** `transpsaude-db`

## Operação inicial

O sistema trabalha com credencial temporária padrão `0000` para primeiro acesso, seguida de troca obrigatória para PIN numérico de 4 dígitos.

Esse padrão se aplica a:

- administrador;
- gerente;
- operador;
- motorista;
- cidadão.

## Qualidade e validação

Validações locais utilizadas no projeto:

```bash
npm run lint
npm run build
```

## Evolução recomendada

Próximas frentes possíveis de evolução:

- exportação e impressão de relatórios operacionais;
- painéis executivos por período;
- indicadores de demanda por destino e por motorista;
- notificações adicionais no app;
- rotinas formais de observabilidade e suporte institucional.

## Licença e uso institucional

Este repositório foi estruturado para uso institucional no contexto do transporte em saúde da **Prefeitura Municipal de Capão do Leão**, podendo ser evoluído conforme as necessidades administrativas e operacionais do município.
