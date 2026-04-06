# Recomendações de Realocação de Itens - Layout e UX

Este documento detalha as mudanças específicas de posicionamento e organização de elementos em cada tela para melhorar usabilidade, layout e funcionalidade.

---

## 📱 1. PublicStatusPage (Tela do Cidadão)

### Layout Atual
```
[Barra Institucional]
[Cabeçalho]
[Card: Acesso]
[Card: Aviso]
[Card: Primeiro Acesso]
[Card: Lista de Solicitações]
[Card: Detalhes da Solicitação]
[Card: Confirmação]
[Card: Atualização]
[Card: Resumo da Viagem]
[Card: Situação]
[Card: Mensagem da Equipe]
[Card: Orientações]
[Card: Mensagens Enviadas]
[Card: Enviar Mensagem]
[Card: Acompanhamento/Histórico]
[Card: Contato]
[Card: Privacidade]
```

### Layout Recomendado
```
[Barra Institucional - Sticky]
[Cabeçalho]

=== SEM LOGIN ===
[Card Principal: Login + Aviso Importante]

=== COM LOGIN ===
[Resumo Executivo - Cards de Métricas]
  [Status] [Protocolo] [Data] [Ações Rápidas]

[Card Principal: Lista de Solicitações - Accordion]
  ▼ Solicitação #1234 - Agendada
    [Detalhes em grid 2 colunas]
    [Botões de Ação: Confirmar, Mensagem, Mapa]
  ▶ Solicitação #1235 - Em Análise
  ▶ Solicitação #1236 - Concluída

[Card: Enviar Mensagem - Collapsible]
  [Formulário simplificado]

[Card: Histórico - Collapsible]
  [Timeline vertical]

[Card: Contato e Privacidade - 2 colunas]
```

### Mudanças Específicas
1. **Mover** "Aviso importante" para dentro do card de login
2. **Consolidar** todos os cards de detalhes em um card accordion
3. **Agrupar** mensagens e histórico em cards colapsáveis
4. **Mover** botões de ação para dentro do accordion
5. **Juntar** contato e privacidade em um card de 2 colunas

---

## 📊 2. DashboardPage (Operador)

### Layout Atual
```
[Sidebar]
[Topbar]
[Métricas - 4 cards]
[Card Único: Filtros + Lista]
  [Filtros - 7 campos visíveis]
  [Lista de solicitações]
```

### Layout Recomendado
```
[Sidebar]
[Topbar]
[Métricas - 4 cards]

[Card: Filtros Principais]
  [Busca + Status + Período Rápido]
  [Botão: Filtros Avançados ▼]

[AdvancedFilters - Collapsible]
  [Data específica]
  [Período inicial/final]
  [Destino]
  [Botão: Limpar]

[Card: Lista de Solicitações]
  [Lista com paginação]
  [Pagination component no final]
```

### Mudanças Específicas
1. **Separar** filtros principais dos avançados
2. **Mover** data específica, período e destino para AdvancedFilters
3. **Adicionar** paginação na lista (10 itens por página)
4. **Consolidar** botão "Limpar filtros" no AdvancedFilters

---

## 📝 3. RegisterRequestPage (Cadastro)

### Layout Atual
```
[Sidebar]
[Topbar]
[Formulário Único - 25+ campos]
  [Seção: Paciente]
  [Seção: Acesso]
  [Seção: Acompanhante]
  [Seção: Destino]
  [Seção: Observações]
[Resumo Lateral]
```

### Layout Recomendado
```
[Sidebar]
[Topbar]

=== ETAPA 1: PACIENTE ===
[Progress Indicator: ●○○○○]
[Card: Dados do Paciente]
  [Nome, CPF, CNS, Telefone, Endereço]
  [Botão: Buscar CPF]
[Botões: Próximo]

=== ETAPA 2: ACOMPANHANTE ===
[Progress Indicator: ●●○○○]
[Card: Dados do Acompanhante]
  [Checkbox: "Mesmo endereço"]
  [Campos condicionais]
[Botões: Voltar | Próximo]

=== ETAPA 3: DESTINO ===
[Progress Indicator: ●●●○○]
[Card: Dados da Viagem]
  [Destino, Unidade, Especialidade]
  [Data, Horário]
[Botões: Voltar | Próximo]

=== ETAPA 4: ACESSO ===
[Progress Indicator: ●●●●○]
[Card: Dados de Acesso]
  [CPF de acesso, Responsável]
[Botões: Voltar | Próximo]

=== ETAPA 5: REVISÃO ===
[Progress Indicator: ●●●●●]
[Card: Resumo Completo]
[Card: Observações]
[Botões: Voltar | Salvar]
```

### Mudanças Específicas
1. **Dividir** formulário em 5 etapas
2. **Adicionar** indicador de progresso no topo
3. **Mover** resumo lateral para etapa final de revisão
4. **Agrupar** campos relacionados por etapa
5. **Adicionar** botões de navegação entre etapas

---

## 🔍 4. RequestDetailsPage (Detalhe)

### Layout Atual
```
[Sidebar]
[Topbar]
[Grid 2 colunas]
  [Coluna Esq: Dados + Comprovante]
  [Coluna Dir: Status + Agenda + Mensagens + Histórico]
```

### Layout Recomendado
```
[Sidebar]
[Topbar]

[Resumo Executivo - Cards horizontais]
  [Protocolo] [Status] [Paciente] [Motorista]

[Tabs de Navegação]
  [Dados] [Histórico] [Mensagens] [Ações]

=== TAB DADOS ===
[Card: Informações Principais - Grid]
[Card: Comprovante - Imprimível]

=== TAB HISTÓRICO ===
[Card: Timeline de Status]
[Card: Logs de Atividade]

=== TAB MENSAGENS ===
[Card: Mensagens da Equipe]
[Card: Mensagens do Paciente]
[Card: Nova Mensagem - Modal]

=== TAB AÇÕES ===
[Card: Atualizar Status - Modal]
[Card: Reagendar - Modal]
[Card: Visibilidade Telefone - Toggle]
```

### Mudanças Específicas
1. **Mover** formulários de ação para modals
2. **Organizar** conteúdo em tabs
3. **Criar** resumo executivo no topo
4. **Separar** histórico e mensagens em tabs distintas

---

## 🗂️ 5. ManagerPage (Gerência)

### Layout Atual
```
[Sidebar]
[Topbar]
[Métricas]
[Card: Filtros]
[Card: Lista + Distribuição]
  [Lista esquerda]
  [Formulário direita]
```

### Layout Recomendado
```
[Sidebar]
[Topbar]
[Métricas]

[Card: Filtros Principais]
  [Busca + Status]
  [Botão: Filtros Avançados ▼]

[AdvancedFilters]
  [Datas, Destino, Motorista]

[Grid 2 colunas]
  [Coluna Esq: Lista com Pagination]
    [Solicitações paginadas]
  [Coluna Dir: Card Fixo de Distribuição]
    [Selecionar solicitação]
    [Formulário simplificado]
    [Botão: Atribuir]
```

### Mudanças Específicas
1. **Adicionar** paginação na lista (15 itens)
2. **Mover** filtros secundários para AdvancedFilters
3. **Fixar** card de distribuição na direita (sticky)
4. **Simplificar** formulário de distribuição

---

## 🚗 6. DriversPage (Equipe e Veículos)

### Layout Atual
```
[Sidebar]
[Topbar]
[Métricas]
[Card: Visão Geral]
[Grid: Formulários Veículo/Motorista]
[Grid: Formulário Operador]
[Grid: Listas Veículos/Motoristas]
[Grid: Listas Operadores/Pacientes]
```

### Layout Recomendado
```
[Sidebar]
[Topbar]
[Métricas]

[Tabs]
  [Visão Geral] [Motoristas] [Veículos] [Operadores] [Pacientes]

=== TAB VISÃO GERAL ===
[Card: Viagens por Motorista - Selector + Lista]

=== TAB MOTORISTAS ===
[Grid 2 colunas]
  [Coluna Esq: Formulário Cadastro]
  [Coluna Dir: Lista com Pagination]

=== TAB VEÍCULOS ===
[Grid 2 colunas]
  [Coluna Esq: Formulário Cadastro]
  [Coluna Dir: Lista com Pagination]

=== TAB OPERADORES ===
[Grid 2 colunas]
  [Coluna Esq: Formulário Cadastro]
  [Coluna Dir: Lista com Pagination]

=== TAB PACIENTES ===
[Card: Lista com Pagination + Export CSV]
```

### Mudanças Específicas
1. **Separar** em tabs por tipo de cadastro
2. **Adicionar** paginação em todas as listas
3. **Mover** formulários para coluna esquerda em cada tab
4. **Adicionar** botão de exportação CSV na tab Pacientes

---

## 👨‍💼 7. AdminManagersPage (Admin)

### Layout Atual
```
[Sidebar]
[Topbar]
[Card: Tabela Solicitações]
[Grid: Formulários Gerente/Operador]
[Grid: Formulário Motorista]
[Grid: Listas Gerente/Operador]
[Grid: Lista Motorista]
```

### Layout Recomendado
```
[Sidebar]
[Topbar]

[Tabs]
  [Solicitações] [Gerentes] [Operadores] [Motoristas]

=== TAB SOLICITAÇÕES ===
[Card: Filtros + Tabela]
  [AdvancedFilters para filtros secundários]
  [Tabela com colunas essenciais]
  [Pagination]

=== TAB GERENTES ===
[Grid 2 colunas]
  [Formulário Cadastro]
  [Lista com Pagination]

=== TAB OPERADORES ===
[Grid 2 colunas]
  [Formulário Cadastro]
  [Lista com Pagination]

=== TAB MOTORISTAS ===
[Grid 2 colunas]
  [Formulário Cadastro]
  [Lista com Pagination]
```

### Mudanças Específicas
1. **Organizar** em tabs por funcionalidade
2. **Reduzir** colunas da tabela de solicitações
3. **Adicionar** AdvancedFilters para filtros secundários
4. **Adicionar** paginação em todas as listas
5. **Padronizar** layout de formulários (2 colunas)

---

## 🚛 8. DriverPortalPage (Motorista)

### Layout Atual
```
[Sidebar]
[Header]
[Métricas]
[Filtros Rápidos]
[Lista de Viagens]
  [Card expandido com detalhes]
  [Formulário de mensagem inline]
```

### Layout Recomendado
```
[Sidebar]
[Header]
[Métricas]

[Filtros Rápidos - Chips]
[AdvancedFilters - Collapsible]
  [Datas específicas]
  [Períodos]

[Grid 2 colunas]
  [Coluna Esq: Lista com Pagination]
    [Cards compactos de viagens]
  [Coluna Dir: Detalhes + Ações - Sticky]
    [Informações da viagem selecionada]
    [Botões de ação]
    [Formulário de mensagem - Modal]
```

### Mudanças Específicas
1. **Adicionar** paginação na lista (10 itens)
2. **Mover** formulário de mensagem para modal
3. **Fixar** card de detalhes na direita (sticky)
4. **Mover** filtros secundários para AdvancedFilters
5. **Compactar** cards da lista

---

## 📐 Padrões de Layout a Seguir

### Grid System
- **Formulários**: 2 colunas (field + field)
- **Listas**: 1-3 colunas dependendo do conteúdo
- **Cards**: Máximo 2 colunas em telas grandes

### Spacing
- **Entre cards**: 18px gap
- **Entre campos**: 14px gap
- **Padding interno**: 20px

### Hierarquia Visual
- **Títulos de seção**: 1.2rem, bold
- **Títulos de card**: 1.1rem, bold
- **Labels**: 0.9rem, semibold
- **Texto**: 0.97rem, regular

### Responsividade
- **Mobile**: 1 coluna
- **Tablet**: 2 colunas
- **Desktop**: 2-3 colunas

---

## ✅ Checklist de Implementação

- [ ] Implementar paginação em todas as listas longas
- [ ] Adicionar AdvancedFilters nas telas com muitos filtros
- [ ] Criar formulário em etapas (wizard) no cadastro
- [ ] Organizar conteúdo em tabs onde aplicável
- [ ] Mover formulários de ação para modals
- [ ] Fixar elementos importantes (sticky)
- [ ] Consolidar cards relacionados
- [ ] Padronizar espaçamentos
- [ ] Testar responsividade
- [ ] Validar acessibilidade

---

**Nota**: Estas recomendações visam melhorar significativamente a usabilidade e organização visual do sistema. A implementação deve ser feita gradualmente, testando cada mudança com usuários reais.