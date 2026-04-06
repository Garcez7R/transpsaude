# TranspSaude

<p align="center">
  <strong>Plataforma para gestão de transporte em saúde</strong><br />
  Simulação de sistema para logística de pacientes
</p>

## Apresentação

O **TranspSaude** é uma aplicação web com suporte a **PWA (Progressive Web App)** desenvolvida para gerenciar e otimizar a operação de transporte de pacientes em contextos de saúde pública ou privada.

O sistema organiza o fluxo completo de atendimento: desde o cadastro da solicitação e análise da gerência até a distribuição para motoristas, registro de orientações e controle operacional da agenda em tempo real.

Este projeto foi idealizado e desenvolvido integralmente por **Rafael Garcez**, abrangendo a concepção funcional, arquitetura técnica, modelagem de dados e implementação de frontend, backend e governança operacional.

A arquitetura foi estruturada para ser simples, econômica e de alta performance, utilizando o ecossistema **Cloudflare Pages + Functions + D1**, com foco em:

- Rastreabilidade total do processo;
- Clareza operacional para equipes internas;
- Acesso móvel facilitado para o paciente;
- Governança rigorosa de perfis de acesso;
- Implantação enxuta e escalável.

## Objetivo do Sistema

O sistema foi concebido para centralizar e resolver gargalos logísticos entre:

- **Setor de Agendamento:** Controle centralizado de solicitações de transporte para tratamentos e exames;
- **Setor de Transportes:** Organização inteligente de rotas, veículos, motoristas e horários;
- **Equipe Administrativa:** Governança de acessos, auditoria de dados e acompanhamento de métricas.

## Perfis de Acesso

### Paciente / Cidadão
- Consulta pública do status do agendamento via PIN de acesso;
- Visualização de data, horário e local de embarque com integração a mapas;
- Canal de comunicação direta com a equipe responsável;
- Confirmação de recebimento da agenda e histórico de solicitações.

### Operador
- Triagem inicial e abertura de solicitações;
- Registro de pacientes, responsáveis e acompanhantes;
- Gerenciamento do painel operacional básico e atualização de status.

### Gerente
- Análise da fila de espera e organização da logística de viagens;
- Atribuição de motoristas e veículos por demanda;
- Definição de horários de saída, consulta e locais de embarque;
- Gestão de cadastros base e emissão de relatórios operacionais.

### Motorista
- Portal funcional exclusivo com visualização de agenda personalizada;
- Consulta de destinos, acompanhantes e contatos de emergência;
- Acesso rápido a mapas externos para navegação e registro de ocorrências da viagem.

## Fluxo Operacional Simulado

1. O paciente solicita o transporte através do setor de atendimento.
2. O operador registra a demanda e gera um protocolo com acesso para consulta.
3. A gerência analisa a viabilidade e atribui os recursos (motorista/veículo).
4. O motorista recebe a rota em seu dispositivo móvel.
5. O paciente acompanha a evolução do agendamento em tempo real pelo PWA.

## Arquitetura Técnica

- **Frontend:** React + TypeScript + Vite
- **Roteamento:** React Router
- **UI:** CSS customizado + Lucide React (Icons)
- **Backend:** Cloudflare Pages Functions (Serverless)
- **Banco de Dados:** Cloudflare D1 (SQL)
- **Segurança:** Autenticação baseada em tokens e sessões em banco
- **PWA:** Manifesto e Service Worker para funcionamento offline e instalação no mobile

## Estrutura do Projeto

- `src/` - Aplicação React e componentes de interface.
- `functions/api/` - Endpoints da API (Serverless).
- `db/` - Schemas SQL e migrações do banco de dados.
- `public/` - Ativos estáticos e configuração PWA.

## Segurança e Governança

O sistema contempla:
- Separação estrita de privilégios por perfil (RBAC);
- Trilhas de auditoria para eventos críticos;
- Reset de credenciais controlado;
- Design System consistente para redução de erros operacionais.

## Titularidade e Licença

Este é um projeto com **código proprietário**. 

O uso do código-fonte, modelagem e estrutura operacional é restrito ao titular. Para fins de estudo, consulte o arquivo [LICENSE](./LICENSE) anexo ao repositório.

---
*Projeto desenvolvido como parte do portfólio técnico de infraestrutura e desenvolvimento de Rafael Garcez.*
