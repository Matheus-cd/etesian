# Etesian - Plano de Evolução da Plataforma

## Estado Atual

### Implementado
- **Autenticação**: Login, MFA (TOTP), refresh tokens
- **Gestão de Usuários**: CRUD completo (admin only)
- **Técnicas MITRE ATT&CK**: Import STIX, CRUD, filtros por tática
- **Exercícios**: Criação, início, conclusão, reabertura, membros
- **Execuções**: Registro de execuções pelo Red Team com evidências
- **Detecções**: Registro de detecções (Tool + SIEM) pelo Blue Team com evidências
- **Void de Detecções**: Invalidação de detecções com justificativa
- **Métricas Base**: Entidade `ExerciseMetrics` com contadores e tempos médios
- **Dashboard Funcional**: Métricas reais do exercício (taxa de detecção, tempo médio, etc.)
- **Sistema de Relatórios**: Página de relatório com resumo executivo e métricas
- **Cobertura por Tática**: Painel visual de cobertura por tática MITRE ATT&CK
- **Gráficos de Detecção**: Donut chart com distribuição de status de detecção
- **Tabela de Técnicas**: Detalhamento de técnicas com status, tempos e evidências
- **DateTimePicker Aprimorado**: Permite entrada manual de data/hora (digitando) além dos seletores visuais
- **Busca de Técnicas Inteligente**: Filtro otimizado para MITRE IDs (T1566 retorna apenas técnicas com esse ID)
- **Serviço Unificado de Estatísticas de Detecção**: Backend centralizado para cálculos consistentes entre relatórios e página de detalhes do exercício
- **API de Estatísticas de Detecção**: Endpoint dedicado `GET /exercises/{id}/detection-stats` para consumo frontend
- **Métricas de Resposta Separadas por Tipo**: MTTD, mais rápida e mais lenta separados para Tool e SIEM
- **Distribuição de Tempo de Resposta**: Histograma separado para Tool e SIEM com faixas (< 1min, 1-5min, 5-15min, > 15min)
- **Contadores de Não Detectados**: Indicadores visuais de técnicas não detectadas por Tool e SIEM
- **Colunas de Tempo Separadas**: Tempo de resposta Tool e SIEM em colunas separadas na tabela de técnicas
- **Agenda/Calendário de Cenários**: Visualização de calendário com drag & drop para agendamento de técnicas

### Pendente
- Cadastro de requisitos por exercício com vínculo a cenários e painel de alertas
- Timeline de execução e detecção no relatório do exercício
- Visualização em grafos com Neo4j (cenários, detecções, TTPs MITRE)
- Exportação de relatórios (PDF/HTML)
- Comparação histórica entre exercícios
- Heatmap MITRE ATT&CK Matrix
- Classificação de severidade por técnica

---

## Avaliação da Plataforma vs Padrões de Mercado

### Análise Comparativa com Ferramentas de Referência
Comparação com plataformas estabelecidas: **Vectr**, **PlexTrac**, **AttackIQ**, **Atomic Red Team**.

### ✅ O Que a Plataforma Faz Bem

| Métrica/Funcionalidade | Status | Descrição |
|------------------------|--------|-----------|
| **Cobertura de Detecção** | ✅ Implementado | Rastreia Tool vs SIEM separadamente, essencial para Purple Team |
| **Tempo de Detecção (TTD)** | ✅ Implementado | Calcula tempo entre execução e detecção para ambas as fontes |
| **MTTD Separado Tool/SIEM** | ✅ Implementado | Métricas de tempo médio de detecção separadas por tipo |
| **Detecção Mais Rápida/Lenta** | ✅ Implementado | Fastest/Slowest detection separados para Tool e SIEM |
| **Distribuição de Tempo de Resposta** | ✅ Implementado | Histograma de tempos por faixa (< 1min, 1-5min, etc.) para Tool e SIEM |
| **Gap Tool→SIEM** | ✅ Implementado | Métrica crítica para avaliar propagação de alertas |
| **Mapeamento MITRE ATT&CK** | ✅ Implementado | Import STIX, filtro por tática, alinhado com padrão da indústria |
| **Trilha de Evidências** | ✅ Implementado | Upload de screenshots/arquivos com captions, auditabilidade |
| **Mecanismo de Contestação (Void)** | ✅ Implementado | Red Team pode invalidar detecções com justificativa |
| **Não Aplicável (N/A)** | ✅ Implementado | Permite marcar detecções como N/A com justificativa para Tool e SIEM |
| **Gestão de Membros** | ✅ Implementado | Papéis Red/Blue/Lead/Viewer por exercício |
| **Status de Técnicas** | ✅ Implementado | Workflow completo: pending → in_progress → paused → completed |
| **Estatísticas Unificadas** | ✅ Implementado | Serviço centralizado garante consistência entre relatórios e dashboard |

### ⚠️ O Que Está Faltando (Comparado aos Padrões de Mercado)

| Métrica/Funcionalidade | Prioridade | Descrição |
|------------------------|------------|-----------|
| **Visibilidade por Tática** | ✅ Implementado | Painel de cobertura por tática na página de relatório |
| **Cadastro de Requisitos de Exercício** | 🔴 Alta | Requisitos a nível de exercício, vinculados a cenários; Blue Team marca como cumprido; painel de alertas por proximidade de execução |
| **Classificação de Severidade** | 🔴 Alta | Priorizar técnicas por impacto (Critical, High, Medium, Low) |
| **Timeline de Execução e Detecção** | 🟡 Média | Linha do tempo visual de execuções e detecções no relatório, com janelas de exposição |
| **Visualização em Grafos (Neo4j)** | 🟡 Média | Grafo interativo de cenários, detecções e TTPs MITRE, inspirado no Microsoft Defender for Endpoint |
| **MTTD vs MTTR** | 🟡 Média | Separar "tempo para detectar" de "tempo para responder/remediar" |
| **Comparação Histórica** | 🟡 Média | Tendências entre exercícios (evolução ao longo do tempo) |
| **Heatmap de Cobertura** | 🟡 Média | Visualização matriz ATT&CK com status de detecção |
| **Integração SIEM/EDR** | 🟢 Baixa | Correlação automática de alertas com execuções |
| **Benchmark de Indústria** | 🟢 Baixa | Comparar métricas com médias do setor |
| **Relatórios Executivos** | 🟡 Média | Página de relatório implementada, falta exportação PDF/HTML |
| **Score de Maturidade** | 🟡 Média | Pontuação geral baseada em cobertura e tempo de resposta |

### 📊 Métricas Padrão da Indústria

| Métrica | Status | Fórmula |
|---------|--------|---------|
| **Detection Coverage Rate** | ✅ Implementado | (Técnicas Detectadas / Técnicas Executadas) × 100 |
| **Mean Time to Detect (MTTD)** | ✅ Implementado | Média(detection_time - execution_time) - separado Tool/SIEM |
| **Fastest/Slowest Detection** | ✅ Implementado | Min/Max tempo de detecção - separado Tool/SIEM |
| **Response Time Distribution** | ✅ Implementado | Histograma por faixas de tempo - separado Tool/SIEM |
| **Tactic Coverage** | ✅ Implementado | Percentual de táticas com ≥1 técnica detectada |
| **SIEM Propagation Delay** | ✅ Implementado | Média(siem_detected_at - tool_detected_at) |
| **Detection Accuracy** | 🔲 Pendente | (Detecções Válidas / Total Detecções) × 100 |
| **Alert Fatigue Index** | 🔲 Pendente | Detecções Voided / Total Detecções |

### 🎯 Próximos Passos Prioritários (Baseado na Análise)

| # | Feature | Justificativa | Status |
|---|---------|---------------|--------|
| 1 | Relatórios por Tática | Visualizar gaps por fase do ataque | ✅ Implementado |
| 2 | Dashboard com métricas reais | Substituir valores hardcoded | ✅ Implementado |
| 3 | Cadastro de Requisitos de Exercício | Preparar ambiente, alertar Blue Team sobre prazos | 🔲 Pendente |
| 4 | Classificação de Severidade | Priorizar remediação | 🔲 Pendente |
| 5 | Exportação de Relatórios | Entregável para stakeholders | 🔲 Pendente |
| 6 | Comparação entre Exercícios | Demonstrar evolução ao cliente | 🔲 Pendente |
| 7 | Visualização em Grafos (Neo4j) | Correlação visual de cenários, detecções e TTPs MITRE | 🔲 Pendente |
| 8 | Heatmap MITRE ATT&CK | Visualização executiva | 🔲 Pendente |

### 💡 Conclusão da Avaliação

A plataforma **atende aos requisitos fundamentais** de um exercício Purple Team:
- ✅ Separação clara de papéis (Red/Blue)
- ✅ Rastreamento de execuções e detecções
- ✅ Métricas de tempo de resposta (MTTD, fastest, slowest - separados Tool/SIEM)
- ✅ Distribuição de tempo de resposta por faixas (histograma Tool/SIEM)
- ✅ Indicadores de não detectados (Tool e SIEM separados)
- ✅ Auditabilidade com evidências
- ✅ Alinhamento com MITRE ATT&CK
- ✅ Visibilidade agregada por tática
- ✅ Página de relatório com métricas completas
- ✅ Serviço unificado de estatísticas (consistência entre views)

**Gaps restantes** comparados a ferramentas comerciais:
- Falta cadastro de requisitos de exercício com alertas de prazo
- Falta visualização em grafos para correlação visual (referência: Defender for Endpoint)
- Falta exportação de relatórios (PDF/HTML)
- Falta comparação histórica para demonstrar evolução
- Falta heatmap da matriz MITRE ATT&CK

**Próxima prioridade**: Implementar exportação de relatórios em PDF para facilitar entrega a stakeholders.

---

## Fase 1: Dashboard Funcional ✅ CONCLUÍDA

### 1.1 Backend - API de Métricas
- [x] Criar endpoint `GET /api/v1/dashboard/stats` com métricas globais do usuário
- [x] Criar endpoint `GET /api/v1/exercises/{id}/metrics` para métricas do exercício
- [x] Implementar cálculo de métricas em tempo real:
  - Exercícios ativos
  - Execuções pendentes de detecção
  - Total detectado vs não detectado
  - Média de tempo de resposta (Tool e SIEM)

### 1.2 Frontend - Dashboard Dinâmico
- [x] Criar hooks para consumir APIs de métricas
- [x] Substituir valores hardcoded por dados reais
- [x] Adicionar loading states e error handling
- [x] Exibir exercícios recentes do usuário

---

## Fase 2: Sistema de Relatórios 🔄 EM PROGRESSO

### 2.1 Backend - API de Relatórios

#### Endpoints
```
GET  /api/v1/exercises/{id}/report          - Dados do relatório ✅
GET  /api/v1/exercises/{id}/detection-stats - Estatísticas de detecção unificadas ✅
GET  /api/v1/exercises/{id}/report/export   - Exportar PDF/HTML 🔲
GET  /api/v1/reports/compare                - Comparar múltiplos exercícios 🔲
```

#### Serviço Unificado de Estatísticas ✅
- [x] `DetectionStatsService` centralizado para cálculos consistentes
- [x] Algoritmo: PRIMEIRA execução, ÚLTIMA detecção por técnica
- [x] Cálculo de tempo de resposta considera flags booleanos (ToolDetected/SIEMDetected)
- [x] Distribuição de tempo por faixas separada para Tool e SIEM
- [x] Contagem de não detectados separada para Tool e SIEM

#### Dados do Relatório
- [x] Informações gerais do exercício (nome, cliente, datas, duração)
- [x] Membros participantes e seus papéis
- [x] Resumo executivo:
  - Total de técnicas testadas
  - Taxa de detecção geral (Tool, SIEM, ambos)
  - Tempo médio de resposta/detecção
  - Gaps identificados
- [x] Detalhamento por técnica:
  - Tática MITRE
  - Status de execução
  - Status de detecção
  - Tempo de resposta (execução → detecção)
  - Evidências (links)
- [x] Análise por Tática:
  - Distribuição de técnicas por tática
  - Taxa de detecção por tática
  - Identificação de táticas com maior gap

### 2.2 Métricas de Tempo de Resposta ✅ CONCLUÍDA

#### Cálculos Principais
```
Tempo de Detecção Tool = tool_detected_at - executed_at (somente se ToolDetected=true)
Tempo de Detecção SIEM = siem_detected_at - executed_at (somente se SIEMDetected=true)
Gap Tool→SIEM = siem_detected_at - tool_detected_at (somente se ambos detectados)
```

#### Agregações Implementadas
- [x] MTTD separado para Tool e SIEM
- [x] Detecção mais rápida (Fastest) separado para Tool e SIEM
- [x] Detecção mais lenta (Slowest) separado para Tool e SIEM
- [x] Distribuição por faixa de tempo (< 1min, 1-5min, 5-15min, > 15min) separado para Tool e SIEM
- [x] Contagem de não detectados separado para Tool e SIEM
- [x] Média por tática (SIEM rate por tática)

#### Agregações Pendentes
- [ ] Média por ferramenta (Tool name, SIEM name)
- [ ] Mediana e percentis (P90, P95)
- [ ] Variação entre exercícios (tendência)

### 2.3 Frontend - Página de Relatórios

#### Visualizações Gráficas
- [x] **Donut Chart**: Distribuição de status de detecção
  - Detectado (Tool)
  - Detectado (SIEM)
  - Detectado (Ambos)
  - Não Detectado
  - N/A

- [x] **Painel de Cobertura por Tática**: Cards por tática MITRE
  - Percentual de detecção por tática
  - Contagem de cenários executados vs total
  - Indicação visual de gaps

- [x] **Painel de Métricas de Resposta**: Layout em duas colunas (Tool verde / SIEM azul)
  - MTTD separado para Tool e SIEM
  - Detecção mais rápida/lenta separada para Tool e SIEM
  - Distribuição de tempo por faixas (< 1min, 1-5min, 5-15min, > 15min)
  - Indicador de não detectados em vermelho

- [x] **Tabela de Técnicas Detalhada**:
  - Colunas separadas para tempo de resposta Tool e SIEM
  - Ícones de status de detecção (Tool e SIEM independentes)
  - Ordenação por índice, MITRE ID, nome, tática, status

- [ ] **Bar Chart Horizontal**: Detecção por Tática MITRE
  - Eixo Y: Táticas
  - Eixo X: Quantidade de técnicas
  - Cores: Detectado vs Não Detectado

- [ ] **Line Chart**: Tempo de Resposta por Técnica
  - Eixo X: Técnicas (em ordem de execução)
  - Eixo Y: Tempo em segundos/minutos
  - Linhas: Tool vs SIEM

- [ ] **Box Plot**: Distribuição de Tempos de Resposta
  - Comparar Tool vs SIEM
  - Mostrar outliers

- [ ] **Heatmap**: Cobertura MITRE ATT&CK Matrix
  - Células por técnica
  - Cores por status de detecção

- [ ] **Timeline de Execução e Detecção**: Linha do tempo visual do exercício
  - Eixo X: Tempo (cronológico, do início ao fim do exercício)
  - Marcadores de execução (Red Team) com ícone/cor distinto
  - Marcadores de detecção Tool e SIEM (Blue Team) vinculados à execução correspondente
  - Linhas conectando execução → detecção Tool → detecção SIEM para visualizar o tempo de resposta
  - Código de cores por status: detectado (verde), bloqueado (azul), parcial (amarelo), não detectado (vermelho)
  - Tooltip ao passar o mouse: nome da técnica, MITRE ID, tempos, status
  - Zoom e scroll horizontal para exercícios longos
  - Filtros por tática, status de detecção e tipo (Tool/SIEM)
  - Visão clara de janelas de exposição (tempo entre execução e detecção)

### 2.4 Exportação 🔲 PENDENTE

- [ ] Exportar relatório em PDF
  - Layout profissional
  - Gráficos renderizados
  - Logo do cliente (opcional)

- [ ] Exportar em HTML
  - Standalone (sem dependências externas)
  - Pode ser enviado por email

- [ ] Exportar dados brutos em CSV/JSON
  - Para análise externa
  - Integração com outras ferramentas

---

## Fase 3: Comparação Histórica

### 3.1 Backend
- [ ] Endpoint para comparar N exercícios
- [ ] Calcular evolução de métricas entre exercícios
- [ ] Identificar tendências (melhorias/regressões)

### 3.2 Frontend
- [ ] Seletor de exercícios para comparação
- [ ] Gráficos comparativos:
  - Taxa de detecção ao longo do tempo
  - Tempo médio de resposta entre exercícios
  - Evolução por tática

---

## Fase 4: Melhorias de UX 🔄 EM PROGRESSO

### 4.1 Componentes de Formulário
- [x] DateTimePicker com entrada manual (digitar data/hora além dos seletores visuais)
- [x] Busca de técnicas inteligente (filtro otimizado para MITRE IDs)

### 4.2 Notificações
- [ ] Sistema de notificações in-app
- [ ] Notificar Blue Team quando Red Team executar técnica
- [ ] Notificar sobre exercícios próximos de conclusão

### 4.3 Timeline de Atividades
- [ ] Histórico de ações no exercício
- [ ] Timeline visual de execuções e detecções
- [ ] Filtros por tipo de ação/usuário

### 4.4 Templates de Exercícios
- [ ] Criar exercícios baseados em templates
- [ ] Templates por tipo de teste (ransomware, lateral movement, etc)
- [ ] Compartilhar templates entre usuários

### 4.5 Cadastro de Requisitos de Exercício 🔲 PENDENTE

Sistema de pré-requisitos a nível de exercício. O Red Team, Purple Lead ou Admin cadastra os requisitos necessários no exercício (ex: "Desabilitar tamper protection no endpoint X", "Liberar porta 4444 no firewall"). Ao adicionar cenários, seleciona quais requisitos se aplicam. O Blue Team visualiza e marca como cumpridos. Um painel de alertas mostra cenários com requisitos pendentes próximos da execução.

#### Modelo de Dados

```
exercise_requirements (requisitos pertencem ao exercício)
├── id UUID PK
├── exercise_id UUID FK → exercises
├── title VARCHAR(200) NOT NULL
├── description TEXT
├── category ENUM (acesso, credencial, configuração, software, rede, outro)
├── fulfilled BOOLEAN DEFAULT FALSE
├── fulfilled_by UUID FK → users (quem marcou como cumprido)
├── fulfilled_at TIMESTAMP
├── created_by UUID FK → users
├── created_at TIMESTAMP
└── updated_at TIMESTAMP

scenario_requirement_links (many-to-many: cenários ↔ requisitos)
├── id UUID PK
├── exercise_technique_id UUID FK → exercise_techniques
├── requirement_id UUID FK → exercise_requirements
└── created_at TIMESTAMP
```

**Fluxo:**
1. Red/Lead/Admin cria requisitos no exercício (nível do exercício, reutilizáveis)
2. Red/Lead/Admin ao adicionar/editar cenário seleciona quais requisitos se aplicam (dropdown multi-select dos requisitos do exercício; pode deixar vazio)
3. Blue Team vê quais requisitos cada cenário precisa e marca cada um como "Cumprido"
4. Painel de alertas mostra cenários com requisitos não cumpridos próximos da data de execução

#### Backend

**Migration**
- [ ] Criar tabela `exercise_requirements` (id, exercise_id, title, description, category, fulfilled, fulfilled_by, fulfilled_at, created_by, created_at, updated_at)
- [ ] Criar tabela `scenario_requirement_links` (id, exercise_technique_id, requirement_id, created_at)
- [ ] Índices: exercise_id em requirements, exercise_technique_id + requirement_id (unique) em links

**Entidades**
- [ ] Criar entidade `ExerciseRequirement` no domínio
- [ ] Criar entidade `ScenarioRequirementLink` no domínio

**Repositório**
- [ ] CRUD de `exercise_requirements` vinculado ao exercício
- [ ] CRUD de `scenario_requirement_links` vinculado ao ExerciseTechnique
- [ ] Query: listar requisitos de um exercício com contagem de cenários vinculados
- [ ] Query: listar requisitos de um cenário específico com status de cumprimento
- [ ] Query: cenários com requisitos não cumpridos + data agendada (para painel de alertas)

**Endpoints - Requisitos do Exercício**
- [ ] `POST /exercises/{id}/requirements` - Criar requisito (Red/Lead/Admin)
- [ ] `GET /exercises/{id}/requirements` - Listar requisitos do exercício (todos os membros)
- [ ] `PUT /exercises/{id}/requirements/{requirementId}` - Editar requisito (Red/Lead/Admin)
- [ ] `DELETE /exercises/{id}/requirements/{requirementId}` - Remover requisito (Red/Lead/Admin)
- [ ] `PATCH /exercises/{id}/requirements/{requirementId}/fulfill` - Marcar como cumprido/não cumprido (Blue/Lead)
- [ ] `GET /exercises/{id}/requirements/export` - Exportar em CSV/JSON (todos os membros)

**Endpoints - Vínculo Cenário ↔ Requisitos**
- [ ] `PUT /exercises/{id}/techniques/{techniqueId}/requirements` - Definir requisitos do cenário (body: array de requirement_ids; Red/Lead/Admin)
- [ ] `GET /exercises/{id}/techniques/{techniqueId}/requirements` - Listar requisitos do cenário

**Endpoint - Painel de Alertas**
- [ ] `GET /exercises/{id}/requirements/alerts` - Retorna cenários com requisitos não cumpridos agrupados por urgência:
  - `critical`: execução no dia (0 dias)
  - `high`: execução em 1 dia
  - `warning`: execução em 2 dias
  - `upcoming`: execução em 3 dias
  - Cada item: cenário (nome, MITRE ID, data agendada), lista de requisitos pendentes
  - Base de cálculo: `scheduled_start_time` do ExerciseTechnique vs data atual

**Permissões**
- [ ] Criar/editar/remover requisitos: Red Team, Lead, Admin
- [ ] Vincular requisitos a cenários: Red Team, Lead, Admin
- [ ] Marcar como cumprido: Blue Team, Lead
- [ ] Visualizar: todos os membros do exercício

#### Frontend - Gestão de Requisitos (Red/Lead/Admin)

**Seção de Requisitos na Página do Exercício**
- [ ] Nova aba ou seção colapsável "Requisitos" na página de detalhes do exercício
- [ ] Tabela de requisitos do exercício com colunas: Título, Categoria, Status (cumprido/pendente), Cenários vinculados, Criado por
- [ ] Botão "Adicionar Requisito" abre formulário inline ou modal:
  - Título (obrigatório)
  - Descrição (opcional, textarea)
  - Categoria (dropdown: acesso, credencial, configuração, software, rede, outro)
- [ ] Ações por requisito: editar, remover (com confirmação se vinculado a cenários)
- [ ] Indicador visual: badge de quantidade de cenários que usam cada requisito

**Vínculo no Formulário de Cenário**
- [ ] Ao adicionar ou editar cenário (ExerciseTechnique), exibir campo multi-select "Requisitos"
- [ ] Dropdown listando os requisitos cadastrados no exercício (título + categoria como tag)
- [ ] Permite selecionar múltiplos ou nenhum (cenários sem pré-requisitos)
- [ ] Chips/tags dos requisitos selecionados com opção de remover individualmente

#### Frontend - Visualização Blue Team

**Requisitos por Cenário**
- [ ] No card do cenário, badge indicando quantidade de requisitos (ex: "3 requisitos, 1 pendente")
- [ ] Cor do badge: verde (todos cumpridos), amarelo (parcial), vermelho (nenhum cumprido), cinza (sem requisitos)
- [ ] Ao expandir/clicar no cenário, seção mostrando lista de requisitos com checkbox para marcar como "Cumprido"
- [ ] Ao marcar como cumprido, registra `fulfilled_by` e `fulfilled_at` automaticamente

**Painel de Alertas de Requisitos Pendentes**
- [ ] Painel fixo ou destaque no topo da página do exercício (visível para todos, especialmente Blue Team)
- [ ] Agrupa cenários por nível de urgência baseado na `scheduled_start_time`:
  - 🔴 **Hoje** (0 dias): "Cenário X executa HOJE e tem N requisitos pendentes"
  - 🟠 **Amanhã** (1 dia): "Cenário Y executa amanhã e tem N requisitos pendentes"
  - 🟡 **Em 2 dias**: "Cenário Z executa em 2 dias e tem N requisitos pendentes"
  - 🔵 **Em 3 dias**: "Cenário W executa em 3 dias e tem N requisitos pendentes"
- [ ] Cada item do alerta mostra: nome do cenário, MITRE ID, data/hora agendada, lista dos requisitos pendentes
- [ ] Botão rápido "Marcar como Cumprido" direto no alerta (sem precisar navegar ao cenário)
- [ ] Painel some automaticamente quando não há alertas pendentes
- [ ] Polling ou refresh a cada N segundos para atualizar em tempo real
- [ ] Contagem total de alertas como badge no título da seção

#### Frontend - Exportação em Tabela
- [ ] Botão de exportação na seção de requisitos do exercício
- [ ] Exportar em CSV com colunas: Requisito, Categoria, Status, Cumprido por, Data de Cumprimento, Cenários Vinculados (MITRE IDs), Datas Agendadas
- [ ] Opção de filtrar antes de exportar (por categoria, status, cenário)



Permite que analistas de Red Team ou Purple Team visualizem e organizem cenários em um calendário, facilitando o planejamento e execução do exercício.

#### Backend
- [x] Adicionar campos `scheduled_start` e `scheduled_end` ao Exercise (período do exercício)
- [x] Adicionar campo `scheduled_date` ao ExerciseTechnique (data agendada para execução)
- [x] Endpoint para atualizar data agendada de um cenário: `PATCH /exercises/{id}/techniques/{techniqueId}/schedule`
- [x] Endpoint para obter cenários agrupados por data: `GET /exercises/{id}/techniques/calendar`
- [x] Validar que `scheduled_date` está dentro do período do exercício

#### Frontend - Formulário de Exercício
- [x] Adicionar campos de data início/fim do exercício no formulário de criação
- [x] Adicionar campos de data início/fim no formulário de edição
- [x] Validação: data fim deve ser maior que data início

#### Frontend - Visualização de Cenários
- [x] Botão de toggle para alternar entre visualização Lista e Calendário
- [x] **Visualização Lista**: Manter comportamento atual (cards em lista)
- [x] **Visualização Calendário**:
  - Grade mensal/semanal com dias do período do exercício
  - Cards de cenários posicionados nos dias agendados
  - Cenários não agendados em área lateral "Não Agendados"
  - Drag & drop para mover cenários entre dias
  - Indicadores visuais de status (pending, in_progress, completed)
  - Cores por tática MITRE para fácil identificação

#### UX/Funcionalidades
- [x] Arrastar cenário da lista "Não Agendados" para um dia específico
- [x] Arrastar cenário entre dias para reagendar
- [x] Clicar no cenário para ver detalhes/registrar execução
- [x] Visualização de carga por dia (quantos cenários por dia)
- [x] Destacar dia atual
- [x] Navegação entre semanas/meses

---

## Fase 5: Integrações

### 5.1 SIEM Integration
- [ ] Webhook para receber alertas automaticamente
- [ ] Correlacionar alertas com execuções
- [ ] Suporte inicial: Splunk, Elastic SIEM

### 5.2 Ticketing Integration
- [ ] Criar tickets automaticamente para gaps
- [ ] Integração com Jira/ServiceNow
- [ ] Tracking de remediação

### 5.3 API Pública
- [ ] Documentação OpenAPI/Swagger
- [ ] API keys para acesso programático
- [ ] Rate limiting

---

## Fase 6: Visualização em Grafos com Neo4j 🔲 PENDENTE

Visualização interativa inspirada no **Microsoft Defender for Endpoint** (Investigation Graph), permitindo explorar os cenários executados, suas detecções e as TTPs do MITRE ATT&CK correlacionadas em formato de grafo. Layout em três painéis: timeline vertical à esquerda, grafo central, e painel de detalhes à direita.

### 6.1 Infraestrutura - Neo4j

#### Setup
- [ ] Adicionar Neo4j ao `docker-compose.yml` (Neo4j Community Edition)
- [ ] Criar módulo de conexão Go para Neo4j (`neo4j-go-driver`)
- [ ] Configurar variáveis de ambiente (NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)

#### Modelo de Grafo
- [ ] Nós (Nodes):
  - `(:Exercise {id, name, status, client})` - Exercício
  - `(:Technique {id, mitre_id, name, description})` - Técnica MITRE ATT&CK
  - `(:Tactic {id, name})` - Tática MITRE ATT&CK
  - `(:Scenario {id, exercise_technique_id, status, scheduled_date})` - Cenário (instância da técnica no exercício)
  - `(:Execution {id, executed_at, executed_by, notes})` - Execução pelo Red Team
  - `(:Detection {id, status, tool_detected, tool_blocked, siem_detected})` - Detecção pelo Blue Team
  - `(:Member {id, user_id, username, role})` - Membro do exercício
- [ ] Relacionamentos (Edges):
  - `(:Exercise)-[:HAS_SCENARIO]->(:Scenario)`
  - `(:Scenario)-[:USES_TECHNIQUE]->(:Technique)`
  - `(:Technique)-[:BELONGS_TO_TACTIC]->(:Tactic)`
  - `(:Scenario)-[:EXECUTED_AS]->(:Execution)`
  - `(:Execution)-[:DETECTED_BY]->(:Detection)`
  - `(:Execution)-[:PERFORMED_BY]->(:Member)`
  - `(:Detection)-[:REGISTERED_BY]->(:Member)`
  - `(:Tactic)-[:NEXT_PHASE]->(:Tactic)` - Ordem da kill chain

#### Sincronização de Dados
- [ ] Sync service: PostgreSQL → Neo4j (event-driven ou batch)
- [ ] Sincronizar ao criar/atualizar exercícios, execuções e detecções
- [ ] Endpoint para forçar re-sync completo de um exercício: `POST /exercises/{id}/graph/sync`

### 6.2 Backend - API de Grafos

#### Endpoints
```
GET  /api/v1/exercises/{id}/graph                   - Grafo completo do exercício
GET  /api/v1/exercises/{id}/graph/scenario/{scenarioId} - Subgrafo de um cenário específico
GET  /api/v1/exercises/{id}/graph/tactic/{tacticId}     - Subgrafo por tática
GET  /api/v1/exercises/{id}/graph/timeline              - Dados para timeline vertical
```

#### Queries Cypher
- [ ] Grafo completo: todos os nós e relacionamentos do exercício
- [ ] Subgrafo por cenário: cenário → execuções → detecções → técnica → tática
- [ ] Subgrafo por tática: tática → técnicas → cenários → execuções → detecções
- [ ] Kill chain path: caminho entre táticas na ordem de ataque
- [ ] Cenários não detectados: filtrar nós sem detecção ou com status not_detected

### 6.3 Frontend - Visualização em Grafos

#### Layout de Três Painéis (inspirado no Defender for Endpoint)

**Painel Esquerdo - Timeline Vertical do Cenário**
- [ ] Timeline vertical cronológica das ações do cenário selecionado
- [ ] Marcadores de execução (Red Team) com timestamp e executor
- [ ] Marcadores de detecção (Blue Team) com timestamp, tipo (Tool/SIEM), e status
- [ ] Indicador visual de tempo entre execução e detecção (janela de exposição)
- [ ] Ícones distintos: espada (execução), escudo (detecção Tool), radar (detecção SIEM)
- [ ] Código de cores: vermelho (execução), verde (detectado), azul (bloqueado), amarelo (parcial)
- [ ] Scroll vertical para cenários com muitas ações
- [ ] Collapsar/expandir detalhes de cada evento

**Painel Central - Grafo Interativo**
- [ ] Renderização com biblioteca de grafos (react-force-graph, vis-network ou cytoscape.js)
- [ ] Nós com ícones e cores por tipo:
  - Exercício: ícone central, cor roxa
  - Tática: hexágono, cor por fase da kill chain
  - Técnica: losango, cor conforme MITRE
  - Cenário: círculo, cor por status (verde=detectado, vermelho=não detectado, azul=bloqueado)
  - Execução: triângulo vermelho (Red Team)
  - Detecção: escudo verde/azul (Blue Team)
- [ ] Arestas com label do relacionamento e direção animada
- [ ] Zoom, pan e drag dos nós
- [ ] Agrupamento automático por tática (cluster layout)
- [ ] Highlight do caminho ao selecionar um nó (nós conectados destacados, demais esmaecidos)
- [ ] Filtros no topo: por tática, status de detecção, período, membro
- [ ] Legenda interativa para toggle de tipos de nó
- [ ] Layout force-directed com opção de layout hierárquico (kill chain da esquerda para direita)

**Painel Direito - Detalhes do Elemento Selecionado**
- [ ] Ao clicar em um nó do grafo, exibir detalhes contextuais:
  - **Cenário**: técnica MITRE, tática, status, datas, requisitos
  - **Execução**: timestamp, executor, notas, evidências (com preview)
  - **Detecção**: status Tool/SIEM, bloqueado, tempos de resposta, evidências
  - **Técnica**: ID MITRE, nome, descrição, tática, subtécnicas
  - **Tática**: nome, quantidade de cenários, taxa de detecção
- [ ] Links rápidos: abrir modal de detecção, ir para relatório, ver evidências
- [ ] Mini-resumo de métricas do elemento (MTTD, taxa de detecção se for tática)
- [ ] Navegação entre elementos relacionados (clicar em links para recentrar o grafo)

#### Interações e UX
- [ ] Duplo clique em nó: expandir/colapsar nós filhos
- [ ] Clique simples: selecionar nó, atualizar painéis laterais e timeline
- [ ] Hover: tooltip com resumo rápido
- [ ] Botão "Centralizar" para resetar o zoom e posição
- [ ] Botão "Expandir Tudo" / "Colapsar por Tática"
- [ ] Modo fullscreen para o grafo
- [ ] Exportar imagem do grafo (PNG/SVG)

### 6.4 Stack Técnico

| Componente | Tecnologia | Justificativa |
|---|---|---|
| **Banco de Grafos** | Neo4j Community Edition | Referência para grafos, queries Cypher expressivas |
| **Driver Go** | `neo4j/neo4j-go-driver/v5` | Driver oficial, suporte a transações |
| **Visualização Frontend** | `react-force-graph-2d` ou `cytoscape.js` | Performance com muitos nós, customização avançada |
| **Layout** | Force-directed + hierárquico | Force para exploração, hierárquico para kill chain |
| **Timeline** | Componente custom com Tailwind | Controle total sobre UX da timeline vertical |

---

## Priorização Sugerida

| Fase | Prioridade | Status |
|------|------------|--------|
| 1. Dashboard Funcional | Alta | ✅ Concluída |
| 2. Sistema de Relatórios | Alta | 🔄 Em progresso (falta exportação) |
| 3. Comparação Histórica | Média | 🔲 Pendente |
| 4. Melhorias de UX | Média | 🔄 Em progresso (DateTimePicker + Calendário concluídos) |
| 5. Integrações | Baixa | 🔲 Pendente |
| 6. Visualização em Grafos (Neo4j) | Média | 🔲 Pendente |

---

## Stack Técnico para Novas Features

### Backend
- **Geração de PDF**: `go-wkhtmltopdf` ou `chromedp`
- **Cálculos estatísticos**: Implementar em Go puro
- **Cache de métricas**: Redis (opcional)
- **Banco de grafos**: Neo4j Community Edition + `neo4j/neo4j-go-driver/v5`

### Frontend
- **Gráficos**: `recharts` ou `chart.js` (React wrappers)
- **Exportação**: `react-pdf` para preview, backend para geração final
- **Data tables**: `@tanstack/react-table` para tabelas complexas
- **Calendário**: `react-big-calendar` ou `@fullcalendar/react` para visualização de agenda
- **Drag & Drop**: `@dnd-kit/core` para arrastar cenários entre dias (leve e moderno)
- **Grafos**: `react-force-graph-2d` ou `cytoscape.js` para visualização interativa de grafos

---

## Próximos Passos Imediatos

### Concluídos
1. ~~**Implementar API de métricas do exercício** (`GET /exercises/{id}/metrics`)~~ ✅
2. ~~**Criar página de relatório do exercício** (`/exercises/{id}/report`)~~ ✅
3. ~~**Implementar gráfico donut de detecção** (já existe componente `DonutChart`)~~ ✅
4. ~~**Adicionar painel de cobertura por tática**~~ ✅
5. ~~**Criar serviço unificado de estatísticas de detecção** (`DetectionStatsService`)~~ ✅
6. ~~**Criar endpoint dedicado para estatísticas** (`GET /exercises/{id}/detection-stats`)~~ ✅
7. ~~**Separar métricas de tempo de resposta** (MTTD, fastest, slowest para Tool e SIEM)~~ ✅
8. ~~**Adicionar distribuição de tempo por faixas** (histograma Tool e SIEM separados)~~ ✅
9. ~~**Adicionar indicadores de não detectados** (contagem Tool e SIEM)~~ ✅
10. ~~**Corrigir cálculo de tempo de resposta** (verificar flag booleano além do timestamp)~~ ✅
11. ~~**Separar colunas de tempo de resposta na tabela de técnicas**~~ ✅
12. ~~**Adicionar campos de período (início/fim) ao exercício**~~ ✅
13. ~~**Implementar visualização de calendário com drag & drop para cenários**~~ ✅

### Pendentes
1. **Implementar cadastro de requisitos de exercício** (entidade, API, vínculo a cenários, painel de alertas, exportação)
2. **Implementar timeline de execução e detecção** (linha do tempo visual no relatório)
3. **Implementar exportação de relatório em PDF**
4. **Adicionar gráfico de tempo de resposta por técnica (linha/barra)**
5. **Implementar heatmap da matriz MITRE ATT&CK**
6. **Implementar visualização em grafos com Neo4j** (grafo interativo + timeline + detalhes)
7. **Criar endpoint de comparação histórica entre exercícios**
