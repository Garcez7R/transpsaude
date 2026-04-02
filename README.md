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

O projeto foi idealizado e desenvolvido integralmente por **Rafael Garcez**, responsável pela concepção funcional, arquitetura técnica, modelagem de dados, implementação do frontend, backend, integrações e governança operacional do sistema.

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

- acesso à consulta pública do agendamento;
- autenticação por identificador pessoal e PIN de acesso;
- primeiro acesso com troca obrigatória de PIN;
- visualização de status, data, horário e local de embarque;
- leitura de mensagens e orientações liberadas pela equipe interna;
- envio de mensagens para a equipe responsável;
- confirmação opcional do recebimento da agenda;
- acompanhamento do histórico da solicitação.

**Particularidades do perfil**

- não acessa áreas internas do sistema;
- visualiza apenas informações vinculadas ao seu acesso;
- utiliza o sistema como canal de consulta e acompanhamento.

### Operador

- atendimento presencial e abertura da solicitação;
- registro de paciente, responsável e acompanhante;
- definição do acesso do cidadão para consulta posterior;
- visualização do painel operacional;
- atualização de status da solicitação;
- registro de mensagens e avisos vinculados ao agendamento;
- leitura destacada de mensagens novas enviadas pelo paciente;
- redefinição do acesso do paciente, quando necessário.

**Particularidades do perfil**

- atua no ponto inicial do fluxo;
- não realiza governança de usuários internos;
- não administra motoristas, veículos ou gerentes.

### Gerente

- análise e organização da fila de solicitações;
- atribuição de motorista por viagem;
- atribuição de veículo por viagem;
- definição de horário de saída;
- definição de horário da consulta;
- definição de local oficial de embarque;
- visualização operacional por data e por período;
- gestão de motoristas, operadores, pacientes e veículos;
- acompanhamento e leitura de relatórios operacionais.

**Particularidades do perfil**

- concentra a gestão operacional do transporte;
- pode reorganizar viagens e distribuir a agenda dos motoristas;
- pode atuar sobre a base operacional, sem substituir a governança administrativa plena.

### Motorista

- acesso próprio ao portal funcional do motorista;
- visualização das viagens atribuídas ao seu nome;
- consulta de paciente, acompanhante e destino;
- consulta de local de embarque e horário de saída;
- abertura rápida do embarque em mapa externo e ligação direta para paciente ou acompanhante, quando houver telefone disponível;
- envio de mensagens vinculadas à viagem;
- leitura das observações e orientações aplicáveis à viagem;
- separação visual entre mensagens da equipe e mensagens enviadas pelo paciente.

**Particularidades do perfil**

- não acessa painéis de gestão interna;
- consulta apenas a própria agenda operacional;
- atua na etapa final de execução da viagem.

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
- busca prévia por CPF para reaproveitar cadastros existentes e reduzir redigitação;
- base de pacientes com pesquisa refinada por nome, CPF, telefone, endereço, CPF de acesso e responsável;
- controle de acesso do cidadão para consulta pública;
- protocolo de solicitação;
- detalhe completo da solicitação;
- histórico de movimentações;
- reagendamento com registro histórico;
- mensagens internas e mensagens visíveis ao paciente.
- registro de confirmação da agenda pelo paciente;
- registro de visualização da agenda e leitura de mensagens.
- sinalização visual de mensagem nova do paciente até leitura pela equipe.

### Gestão operacional

- atribuição de motorista por solicitação;
- atribuição de veículo por solicitação;
- vínculo preferencial de veículo no cadastro do motorista;
- portal do motorista com leitura rápida da viagem, ações móveis e mensagens separadas por origem;
- leitura rápida das viagens por motorista na área de equipe;
- formulário do operador reorganizado por etapas de atendimento, acesso, acompanhante e destino;
- definição de horário de saída;
- definição de horário da consulta;
- definição de local oficial de embarque;
- visualização por status, data e período;
- filtros por destino, motorista, paciente e protocolo;
- badges padronizadas para confirmação, leitura e mensagens novas;
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
- visualização de múltiplas solicitações vinculadas ao mesmo acesso, com separação por protocolo, data e destino;
- visualização de data, horário e embarque;
- abertura de local de embarque em mapa externo;
- atalhos diretos no resumo da viagem para abrir mensagens da equipe ou falar com a equipe;
- mensagens e orientações liberadas para consulta pública;
- confirmação da agenda;
- envio de mensagens para a equipe;
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

- [src/](./src) - aplicação React
- [src/pages/](./src/pages) - telas principais
- [functions/api/](./functions/api) - API da aplicação
- [db/schema.sql](./db/schema.sql) - schema consolidado do banco
- [db/migrations/](./db/migrations) - migrações incrementais
- [public/manifest.webmanifest](./public/manifest.webmanifest) - manifesto PWA
- [public/sw.js](./public/sw.js) - service worker
- [wrangler.toml](./wrangler.toml) - configuração Cloudflare

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

## Titularidade e uso do código

Este projeto possui **código proprietário**.

O uso do código-fonte, da modelagem funcional, da identidade visual e da estrutura operacional fica restrito ao titular do projeto e ao uso institucional autorizado.

Sem autorização expressa e por escrito do titular, é vedado:

- reutilizar o código em ambiente institucional ou comercial;
- redistribuir o projeto total ou parcialmente;
- publicar cópias, versões derivadas ou adaptações para terceiros;
- utilizar a solução como base de produto, serviço ou implantação em outros entes públicos ou privados.

É admitido apenas o uso **pessoal** e **para estudos**, sem finalidade comercial, institucional, operacional ou de redistribuição.

As condições formais constam em [LICENSE](./LICENSE).

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

Editar [wrangler.toml](./wrangler.toml) com o identificador real do banco.

### 6. Aplicar schema e migrações

```bash
npx wrangler d1 execute transpsaude-db --file=db/schema.sql
```

Quando necessário, aplicar também as migrações incrementais em [db/migrations/](./db/migrations).

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

O sistema foi estruturado com fluxo de primeiro acesso controlado, exigindo atualização de credencial no uso inicial, conforme a política operacional definida pela administração municipal.

## Qualidade e validação

Validações locais utilizadas no projeto:

```bash
npm run lint
npm run build
```

## Checkpoint atual

Estado atual do produto neste repositório:

- fluxo principal já funcional entre cidadão, operador, gerente, motorista e administração;
- consulta pública com múltiplas agendas, mensagens, confirmação, mapa e leitura mais acessível;
- operador com painel mais enxuto, cadastro reorganizado por etapas e reaproveitamento de paciente por CPF;
- gerência com distribuição de viagens mais direta, foco em motorista, consulta, saída e embarque;
- base refinada de pacientes para busca, auditoria e conferência por dados críticos;
- badges, flags e métricas mais compactas e consistentes entre as telas internas;
- **paginação implementada** para listas longas (10 itens por página);
- **confirmação de exclusão** com modal para ações destrutivas;
- **exportação CSV** de dados de pacientes;
- **atalhos de teclado** globais para produtividade;
- **validação de formulários** com verificação de datas, horários, CPF e telefone;
- **layout padronizado** em todas as páginas com design system consistente;
- compatibilidade operacional mantida com Cloudflare Pages + Functions + D1.

### Componentes reutilizáveis implementados

- **Pagination** - Paginação para listas longas com navegação por página
- **ConfirmDialog** - Modal de confirmação para ações destrutivas
- **AdvancedFilters** - Filtros avançados colapsáveis
- **validation.ts** - Biblioteca de validação de formulários
- **csv-export.ts** - Exportação de dados em formato CSV
- **keyboard-shortcuts.ts** - Gerenciador de atalhos de teclado

Pontos já maduros:

- consulta pública do cidadão;
- cadastro inicial da solicitação;
- painel operacional do operador;
- distribuição da gerência;
- base de pacientes;
- paginação e filtros;
- exportação de dados;
- atalhos de teclado.

Próximos passos mais naturais:

- QA ponta a ponta por perfil em ambiente real;
- revisão final do portal do motorista;
- preenchimento dos contatos institucionais definitivos;
- estabilização operacional para uso contínuo e coleta de feedback da prefeitura.

## Evolução recomendada

Próximas frentes possíveis de evolução:

- exportação e impressão de relatórios operacionais;
- painéis executivos por período;
- indicadores de demanda por destino e por motorista;
- contatos institucionais da secretaria e canais auxiliares de atendimento;
- notificações adicionais no app;
- rotinas formais de observabilidade e suporte institucional.

## Licença e uso institucional

Este repositório foi estruturado para uso institucional no contexto do transporte em saúde da **Prefeitura Municipal de Capão do Leão**, podendo ser evoluído conforme as necessidades administrativas e operacionais do município.
