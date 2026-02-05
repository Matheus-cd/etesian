# Etesian - Log de Modificações

Este documento registra todas as modificações realizadas no projeto Etesian.

---

## Visão Geral do Projeto

**Etesian** é uma plataforma de Purple Team com execução manual para registro de execuções de técnicas MITRE ATT&CK e detecções por Blue Team.

### Stack Tecnológica

| Componente | Tecnologia |
|------------|------------|
| Backend | Go 1.24 com Chi framework |
| Database | PostgreSQL com sqlx |
| Auth | JWT RS256 + MFA (TOTP) |
| Frontend | React 18 + TypeScript + Vite |
| State Management | React Query + Zustand |
| UI | Tailwind CSS + Componentes customizados |
| Arquitetura | Clean Architecture / Hexagonal |

### Estrutura do Projeto

```
Etesian/
├── backend/
│   ├── cmd/api/main.go              # Ponto de entrada
│   ├── internal/
│   │   ├── domain/
│   │   │   ├── entity/              # Entidades de domínio
│   │   │   └── repository/          # Interfaces de repositório
│   │   ├── adapter/
│   │   │   ├── http/
│   │   │   │   ├── handler/         # Handlers HTTP
│   │   │   │   ├── middleware/      # Middlewares (auth, RBAC)
│   │   │   │   └── router.go        # Configuração de rotas
│   │   │   └── repository/postgres/ # Implementações PostgreSQL
│   │   └── infrastructure/
│   │       ├── config/              # Configurações
│   │       ├── database/            # Conexão com banco
│   │       └── crypto/              # JWT Manager
│   ├── migrations/                  # Migrations SQL
│   └── uploads/                     # Evidências (imagens)
│
└── frontend/
    ├── src/
    │   ├── components/ui/           # Componentes reutilizáveis
    │   ├── features/
    │   │   ├── auth/                # Autenticação + MFA
    │   │   ├── exercises/           # Gestão de exercícios
    │   │   ├── techniques/          # Catálogo MITRE
    │   │   ├── users/               # Gestão de usuários
    │   │   └── dashboard/           # Dashboard
    │   ├── lib/                     # Utilitários
    │   └── store/                   # Zustand stores
    └── package.json
```

---

## Histórico de Criação do Projeto

### Fase 1: Foundation (Inicial)

#### 1.1 Estrutura Backend Go

**Arquivos criados:**
- `backend/cmd/api/main.go` - Ponto de entrada da aplicação
- `backend/go.mod` - Módulo Go com dependências

**Entidades de Domínio (`backend/internal/domain/entity/`):**
- `user.go` - Usuário com roles (admin, purple_team_lead, red_team_operator, blue_team_analyst, viewer)
- `exercise.go` - Exercício/cenário de Purple Team
- `exercise_member.go` - Membros designados ao exercício (isolamento)
- `exercise_technique.go` - Técnicas associadas ao exercício com status
- `technique.go` - Técnica MITRE ATT&CK
- `execution.go` - Execução registrada pelo Red Team
- `evidence.go` - Evidência (imagem) anexada
- `detection.go` - Detecção registrada pelo Blue Team
- `detection_void.go` - Anulação de detecção
- `audit_log.go` - Log de auditoria
- `exercise_metrics.go` - Métricas calculadas

**Interfaces de Repositório (`backend/internal/domain/repository/`):**
- `user_repository.go`
- `refresh_token_repository.go`
- `exercise_repository.go`
- `exercise_member_repository.go`
- `exercise_technique_repository.go`
- `technique_repository.go`
- `execution_repository.go`
- `evidence_repository.go`
- `detection_repository.go`
- `detection_void_repository.go`

---

#### 1.2 Migrations de Banco de Dados

**`backend/migrations/000001_initial_schema.up.sql`:**
- Tabela `users` com MFA, bloqueio por tentativas
- Tabela `refresh_tokens` para rotação de tokens
- Tabela `techniques` (catálogo MITRE)
- Tabela `exercises` (cenários)
- Tabela `exercise_members` (isolamento por exercício)
- Tabela `exercise_techniques` (técnicas do exercício)
- Tabela `executions` (registros Red Team)
- Tabela `detections` (registros Blue Team)
- Tabela `detection_voids` (anulações)
- Tabela `evidences` (arquivos anexados)
- Tabela `exercise_metrics` (cache de métricas)
- Tabela `audit_logs` (auditoria imutável)
- Índices para performance

**`backend/migrations/000002_add_evidence_caption.up.sql`:**
- Adicionado campo `caption` na tabela `evidences`

---

#### 1.3 Handlers HTTP (`backend/internal/adapter/http/handler/`)

**`auth_handler.go`:**
- `POST /auth/login` - Login com validação de credenciais
- `POST /auth/refresh` - Refresh token com rotação
- `POST /auth/logout` - Logout e revogação de token
- `GET /auth/me` - Dados do usuário autenticado
- `POST /auth/mfa/setup` - Configuração de MFA (gera QR code)
- `POST /auth/mfa/verify` - Verificação de código TOTP

**`user_handler.go`:**
- `GET /users` - Listar usuários (admin)
- `POST /users` - Criar usuário (admin)
- `GET /users/{id}` - Obter usuário
- `PUT /users/{id}` - Atualizar usuário
- `DELETE /users/{id}` - Deletar usuário
- `POST /users/{id}/reset-mfa` - Resetar MFA

**`technique_handler.go`:**
- `GET /techniques` - Listar técnicas com paginação/filtros
- `GET /techniques/tactics` - Listar táticas únicas
- `GET /techniques/{id}` - Obter técnica
- `POST /techniques` - Criar técnica (lead/admin)
- `POST /techniques/import-stix` - Importar STIX JSON
- `PUT /techniques/{id}` - Atualizar técnica
- `DELETE /techniques/{id}` - Deletar técnica

**`exercise_handler.go`:**
- `GET /exercises` - Listar exercícios (filtrado por acesso)
- `POST /exercises` - Criar exercício
- `GET /exercises/{id}` - Obter exercício
- `PUT /exercises/{id}` - Atualizar exercício
- `DELETE /exercises/{id}` - Deletar exercício
- `POST /exercises/{id}/start` - Iniciar exercício
- `POST /exercises/{id}/complete` - Completar exercício
- `POST /exercises/{id}/reopen` - Reabrir exercício
- `GET /exercises/{id}/members` - Listar membros
- `POST /exercises/{id}/members` - Adicionar membro
- `DELETE /exercises/{id}/members/{userId}` - Remover membro
- `GET /exercises/{id}/techniques` - Listar técnicas do exercício
- `POST /exercises/{id}/techniques` - Adicionar técnica
- `PUT /exercises/{id}/techniques/{techId}` - Atualizar técnica
- `DELETE /exercises/{id}/techniques/{techId}` - Remover técnica
- `POST /exercises/{id}/techniques/reorder` - Reordenar técnicas
- `GET /exercises/{id}/techniques/{techId}` - Obter técnica específica
- `POST /exercises/{id}/techniques/{techId}/start` - Iniciar técnica
- `POST /exercises/{id}/techniques/{techId}/pause` - Pausar técnica
- `POST /exercises/{id}/techniques/{techId}/resume` - Retomar técnica
- `POST /exercises/{id}/techniques/{techId}/complete` - Completar técnica

**`execution_handler.go`:**
- `POST /exercises/{id}/executions` - Criar execução
- `GET /exercises/{id}/executions` - Listar execuções do exercício
- `GET /exercises/{id}/techniques/{techId}/executions` - Listar execuções da técnica
- `GET /executions/{id}` - Obter execução
- `PUT /executions/{id}` - Atualizar execução
- `DELETE /executions/{id}` - Deletar execução
- `POST /executions/{id}/evidences` - Upload de evidência
- `DELETE /executions/{id}/evidences/{evId}` - Deletar evidência
- `GET /evidences/{id}/file` - Servir arquivo de evidência

**`detection_handler.go`:**
- `POST /exercises/{id}/detections` - Criar detecção
- `GET /exercises/{id}/detections` - Listar detecções
- `GET /detections/{id}` - Obter detecção
- `PUT /detections/{id}` - Atualizar detecção
- `POST /detections/{id}/void` - Anular detecção

---

#### 1.4 Middlewares (`backend/internal/adapter/http/middleware/`)

**`auth_middleware.go`:**
- Validação de JWT RS256
- Extração de claims para contexto
- Rejeição de tokens expirados

**`rbac_middleware.go`:**
- `RequireAdmin` - Somente administradores
- `RequireLeadOrAdmin` - Leads e administradores
- `RequireExerciseRole(roles...)` - Roles específicas no exercício

**`exercise_access_middleware.go`:**
- Verifica se usuário tem acesso ao exercício
- Admins e leads têm acesso total
- Outros usuários só acessam se forem membros

---

#### 1.5 Repositórios PostgreSQL (`backend/internal/adapter/repository/postgres/`)

- `user_repo.go` - CRUD de usuários
- `refresh_token_repo.go` - Gestão de refresh tokens
- `technique_repo.go` - CRUD de técnicas
- `exercise_repo.go` - CRUD de exercícios
- `exercise_member_repo.go` - Gestão de membros
- `exercise_technique_repo.go` - Técnicas do exercício
- `execution_repo.go` - CRUD de execuções
- `evidence_repo.go` - CRUD de evidências
- `detection_repo.go` - CRUD de detecções
- `detection_void_repo.go` - Anulações

---

#### 1.6 Infraestrutura (`backend/internal/infrastructure/`)

**`config/config.go`:**
- Carregamento de variáveis de ambiente
- Configurações de JWT, banco, servidor

**`database/postgres.go`:**
- Conexão com PostgreSQL via sqlx
- Pool de conexões configurável

**`crypto/jwt_manager.go`:**
- Geração de tokens JWT RS256
- Validação e parsing de tokens
- Suporte a chaves RSA

---

### Fase 2: Frontend React

#### 2.1 Estrutura Base

**Arquivos de configuração:**
- `frontend/package.json` - Dependências npm
- `frontend/vite.config.ts` - Configuração Vite
- `frontend/tailwind.config.js` - Configuração Tailwind
- `frontend/tsconfig.json` - Configuração TypeScript

**`frontend/src/main.tsx`:**
- Ponto de entrada React
- Providers (QueryClient, Router)

**`frontend/src/App.tsx`:**
- Configuração de rotas
- Layout principal

---

#### 2.2 Componentes UI (`frontend/src/components/ui/`)

- `Button.tsx` - Botão com variantes (primary, secondary, danger, ghost)
- `Input.tsx` - Input com label e erro
- `Card.tsx` - Container com sombra
- `Modal.tsx` - Modal com overlay
- `Badge.tsx` - Badge para status
- `Spinner.tsx` - Loading spinner
- `Table.tsx` - Tabela responsiva
- `Dropdown.tsx` - Menu dropdown
- `Tabs.tsx` - Navegação por abas
- `Toast.tsx` - Notificações toast

---

#### 2.3 Feature: Auth (`frontend/src/features/auth/`)

**Componentes:**
- `LoginPage.tsx` - Página de login
- `MFASetupPage.tsx` - Configuração de MFA com QR code
- `MFAVerifyPage.tsx` - Verificação de código TOTP

**API e Hooks:**
- `api/authApi.ts` - Cliente da API de autenticação
- `hooks/useAuth.ts` - Hook de autenticação
- `store/authStore.ts` - Estado global (Zustand)

---

#### 2.4 Feature: Exercises (`frontend/src/features/exercises/`)

**Componentes:**
- `ExercisesListPage.tsx` - Lista de exercícios com filtros
- `ExerciseDetailPage.tsx` - Detalhes do exercício
- `ExerciseForm.tsx` - Formulário de criação/edição
- `TechniqueSelector.tsx` - Seleção de técnicas MITRE
- `TechniqueExecutionModal.tsx` - Modal de execução de técnica
- `MembersList.tsx` - Lista de membros do exercício

**API e Hooks:**
- `api/exercisesApi.ts` - Cliente da API
- `hooks/useExercises.ts` - Hooks React Query

---

#### 2.5 Feature: Techniques (`frontend/src/features/techniques/`)

**Componentes:**
- `TechniquesListPage.tsx` - Catálogo MITRE
- `TechniqueForm.tsx` - Criação/edição de técnica
- `STIXImportModal.tsx` - Importação de arquivo STIX

**API e Hooks:**
- `api/techniquesApi.ts`
- `hooks/useTechniques.ts`

---

#### 2.6 Feature: Users (`frontend/src/features/users/`)

**Componentes:**
- `UsersListPage.tsx` - Lista de usuários (admin)
- `UserForm.tsx` - Criação/edição de usuário
- `RoleBadge.tsx` - Badge colorido por role

**API e Hooks:**
- `api/usersApi.ts`
- `hooks/useUsers.ts`

---

#### 2.7 Utilitários (`frontend/src/lib/`)

- `api-client.ts` - Axios configurado com interceptors
- `utils.ts` - Funções utilitárias (cn, formatDate, etc.)
- `constants.ts` - Constantes da aplicação

---

## [2026-01-19] - Sessão de Desenvolvimento

### 1. Correção de Tela Branca no Modal de Execução de Técnica

**Problema:** Ao clicar para expandir um cenário, apenas uma tela branca era exibida sem conteúdo.

**Causa:** A API retornava `null` em vez de `[]` para listas vazias de execuções.

**Arquivos modificados:**
- `backend/internal/adapter/http/handler/execution_handler.go`
  - Alterado `var executionResponses []ExecutionResponse` para `executionResponses := make([]ExecutionResponse, 0, len(executions))`
  - Aplicado nas funções `ListByExercise` e `ListByTechnique`

---

### 2. Correção de Atualização em Tempo Real do Status

**Problema:** Ao clicar em "Iniciar Execução", a UI não atualizava imediatamente. O status só aparecia após atualizar a página.

**Causa:** Os hooks de mutação apenas invalidavam as queries, mas não atualizavam o cache diretamente.

**Arquivos modificados:**
- `frontend/src/features/exercises/hooks/useExercises.ts`
  - Modificados hooks `useStartTechnique`, `usePauseTechnique`, `useResumeTechnique`, `useCompleteTechnique`
  - Adicionado `queryClient.setQueryData()` no `onSuccess` para atualização imediata do cache
  - Adicionado hook `useExerciseTechnique` para buscar dados frescos da técnica

- `frontend/src/features/exercises/components/TechniqueExecutionModal.tsx`
  - Passou a usar `useExerciseTechnique` para obter dados atualizados

---

### 3. Campos Dinâmicos no Formulário de Nova Execução

**Funcionalidade:** Permitir que o analista preencha campos pré-definidos ou crie campos personalizados.

**Campos pré-definidos:**
- Origem (IP)
- Hostname
- Usuário
- Alvo
- Data/Hora da Execução
- Referências

**Arquivos modificados:**
- `frontend/src/features/exercises/components/TechniqueExecutionModal.tsx`
  - Adicionado seletor de campos com toggle para habilitar/desabilitar
  - Adicionada funcionalidade de criar campos personalizados
  - Campos são salvos nas notas da execução formatados como "Label: Valor"

---

### 4. Upload de Evidências Durante Criação de Execução

**Funcionalidade:** Permitir adicionar evidências enquanto preenche o formulário de nova execução (antes de salvar).

**Recursos implementados:**
- Drag and drop para upload de arquivos
- Paste da clipboard (Ctrl+V) para colar imagens
- Seleção manual de múltiplos arquivos
- Preview de imagens antes do upload
- Campo de legenda para cada evidência
- Upload automático após salvar a execução

**Arquivos modificados:**
- `frontend/src/features/exercises/components/TechniqueExecutionModal.tsx`
  - Adicionada interface `PendingEvidence` para evidências pendentes
  - Adicionados estados: `pendingEvidences`, `editingCaptionId`, `isDragging`
  - Adicionados handlers: `handleDragOver`, `handleDragLeave`, `handleDrop`, `addPendingEvidence`
  - Adicionado event listener para paste da clipboard
  - Zona de drop com feedback visual
  - Grid de preview das evidências pendentes

---

### 5. Restrição de Upload Apenas para Imagens (OWASP)

**Funcionalidade:** Restringir upload apenas para imagens seguindo as diretrizes de segurança OWASP.

**Validações implementadas (Backend):**
1. Verificação de tamanho máximo (10MB)
2. Validação de extensão (.jpg, .jpeg, .png, .gif, .webp)
3. Verificação de magic bytes para detectar tipo real do arquivo
4. Validação de correspondência entre extensão e conteúdo
5. Sanitização do nome do arquivo
6. Proteção contra path traversal

**Arquivos modificados:**
- `backend/internal/adapter/http/handler/execution_handler.go`
  - Adicionada variável `allowedImageTypes` com magic bytes para cada tipo
  - Adicionada constante `maxImageSize` (10MB)
  - Adicionada função `validateImageFile()` com validação completa
  - Adicionada função `sanitizeFilename()` para limpar nomes de arquivo
  - Atualizada função `saveEvidenceFile()` para usar extensão baseada no MIME detectado
  - Atualizada função `UploadEvidence()` para usar validação OWASP

- `frontend/src/features/exercises/components/TechniqueExecutionModal.tsx`
  - Adicionadas constantes `ALLOWED_IMAGE_TYPES` e `MAX_IMAGE_SIZE`
  - Adicionadas funções `isAllowedImageType()` e `isFileSizeValid()`
  - Validação no drag and drop com mensagens de erro em português
  - Validação na seleção de arquivos
  - Atributo `accept` nos inputs de arquivo restrito a imagens
  - Texto informativo atualizado para indicar apenas imagens

---

### 6. Correção da Exibição de Miniaturas das Evidências

**Problema:** Imagens não apareciam em miniatura após registrar a execução, apenas um placeholder de imagem não encontrada.

**Causa:** As imagens precisam ser carregadas via API com token de autenticação.

**Arquivos modificados:**
- `backend/internal/adapter/http/handler/execution_handler.go`
  - Adicionada função `GetEvidenceFile()` para servir arquivos de imagem
  - Validação de path traversal antes de servir arquivo
  - Headers de Content-Type e Cache-Control configurados

- `backend/internal/adapter/http/router.go`
  - Adicionada rota `GET /evidences/{evidenceID}/file`

- `frontend/src/features/exercises/api/exercisesApi.ts`
  - Adicionada função `fetchEvidenceBlob()` que faz requisição autenticada e retorna blob URL

- `frontend/src/features/exercises/components/TechniqueExecutionModal.tsx`
  - Reescrito componente `EvidenceCard` para carregar imagens via API
  - Adicionados estados: `imageUrl`, `isLoading`, `hasError`
  - Adicionada ref `blobUrlRef` para limpeza de memory leaks
  - Loading spinner enquanto carrega
  - Clique na imagem abre em nova aba

---

### 7. Exclusão de Registros de Execução

**Funcionalidade:** Permitir exclusão de execuções com confirmação do usuário.

**Arquivos modificados:**
- `backend/internal/adapter/http/handler/execution_handler.go`
  - Adicionada função `Delete()` que:
    - Verifica se a execução existe
    - Remove todas as evidências associadas (arquivos do disco + registros do banco)
    - Deleta o registro de execução

- `backend/internal/adapter/http/router.go`
  - Adicionada rota `DELETE /executions/{executionID}`

- `frontend/src/features/exercises/api/exercisesApi.ts`
  - Adicionada função `deleteExecution()`

- `frontend/src/features/exercises/hooks/useExercises.ts`
  - Adicionado hook `useDeleteExecution()` com invalidação de cache

- `frontend/src/features/exercises/components/TechniqueExecutionModal.tsx`
  - Adicionado estado `executionToDelete` para controle de confirmação
  - Adicionada função `handleConfirmDeleteExecution()`
  - Adicionado modal de confirmação com aviso sobre consequências
  - Adicionado botão "Excluir" (variante danger) no `ExecutionCard`
  - Atualizada prop `onDeleteExecution` no componente

---

## Arquivos Principais do Projeto

### Backend
| Arquivo | Descrição |
|---------|-----------|
| `cmd/api/main.go` | Ponto de entrada da aplicação |
| `internal/domain/entity/*.go` | Entidades de domínio |
| `internal/domain/repository/*.go` | Interfaces de repositório |
| `internal/adapter/http/handler/*.go` | Handlers HTTP |
| `internal/adapter/http/middleware/*.go` | Middlewares |
| `internal/adapter/http/router.go` | Configuração de rotas |
| `internal/adapter/repository/postgres/*.go` | Implementações PostgreSQL |
| `internal/infrastructure/config/config.go` | Configurações |
| `internal/infrastructure/database/postgres.go` | Conexão com banco |
| `internal/infrastructure/crypto/jwt_manager.go` | Gestão de JWT |
| `migrations/*.sql` | Migrations do banco |

### Frontend
| Arquivo | Descrição |
|---------|-----------|
| `src/main.tsx` | Ponto de entrada React |
| `src/App.tsx` | Configuração de rotas |
| `src/components/ui/*.tsx` | Componentes reutilizáveis |
| `src/features/auth/*` | Feature de autenticação |
| `src/features/exercises/*` | Feature de exercícios |
| `src/features/techniques/*` | Feature de técnicas |
| `src/features/users/*` | Feature de usuários |
| `src/lib/api-client.ts` | Cliente Axios |
| `src/store/*.ts` | Stores Zustand |

---

## [2026-01-19] - Sessão de Desenvolvimento - Interface Blue Team

### 8. Interface de Detecção para Blue Team

**Funcionalidade:** Criar interface dedicada para o Blue Team registrar detecções de ferramentas de segurança e SIEM.

#### 8.1 Controle de Permissões por Role

**Implementação:**
- Blue Team (`blue_team_analyst`) **não pode** controlar status de técnicas (iniciar, pausar, completar)
- Apenas `admin`, `purple_team_lead` e `red_team_operator` podem controlar status
- Blue Team **pode** registrar detecções com evidências obrigatórias

**Arquivos modificados:**
- `frontend/src/features/exercises/components/TechniqueExecutionModal.tsx`
  - Adicionada importação do `useAuthStore`
  - Adicionadas constantes `STATUS_CONTROL_ROLES` e `DETECTION_ROLES`
  - Adicionada verificação `canControlStatus` e `canRegisterDetection`
  - Botões de status (iniciar/pausar/completar) condicionados a `canControlStatus`
  - Mensagem informativa para Blue Team quando não pode controlar status

---

#### 8.2 Formulário de Registro de Detecção

**Funcionalidade:** Modal completo para Blue Team registrar detecções.

**Campos implementados:**

**Detecção por Ferramenta (EDR/AV):**
- Checkbox "Detectado por Ferramenta"
- Nome da ferramenta (CrowdStrike, Defender, etc.)
- Horário da detecção
- ID do alerta
- Notas
- **Evidência obrigatória** (screenshot do alerta)

**Detecção por SIEM:**
- Checkbox "Detectado por SIEM"
- Nome do SIEM (Splunk, Elastic, etc.)
- Horário da detecção
- ID do alerta
- Notas
- **Evidência obrigatória** (screenshot do dashboard)

**Notas do Analista:**
- Campo de texto livre para observações gerais

**Arquivos modificados:**
- `frontend/src/features/exercises/components/TechniqueExecutionModal.tsx`
  - Adicionados estados para formulário de detecção
  - Adicionado modal de detecção com seções Tool e SIEM
  - Drag and drop e seleção de arquivos para evidências
  - Validação: evidência obrigatória para cada tipo de detecção selecionado
  - Cálculo automático do `detection_status` (detected/partial/not_detected)

---

#### 8.3 API e Hooks para Detecções

**Backend - Novas rotas:**
- `GET /executions/{executionID}/detections` - Listar detecções de uma execução
- `POST /detections/{detectionID}/evidences` - Upload de evidência de detecção

**Arquivos modificados:**
- `backend/internal/adapter/http/router.go`
  - Adicionada rota GET para listar detecções por execução
  - Adicionada rota POST para upload de evidência de detecção

- `backend/internal/adapter/http/handler/detection_handler.go`
  - Adicionadas funções auxiliares `createDirIfNotExists`, `createFile`, `copyFile`
  - Adicionada função `ListByExecution()` para listar detecções de uma execução
  - Adicionada função `UploadEvidence()` para upload de evidência de detecção
  - Corrigido `ListByExercise` para usar `make()` em vez de `nil`

- `backend/internal/domain/repository/execution_repository.go`
  - Adicionado método `ListByExecution` na interface `DetectionRepository`

- `backend/internal/adapter/repository/postgres/execution_repo.go`
  - Implementado método `ListByExecution()` no repositório

**Frontend - API:**
- `frontend/src/features/exercises/api/exercisesApi.ts`
  - Adicionados tipos: `DetectionStatus`, `Detection`, `CreateDetectionRequest`
  - Adicionada interface `Detection` com campos de tool, siem, status e evidências
  - Adicionadas funções:
    - `getDetectionsByExecution()` - Listar detecções
    - `createDetection()` - Criar detecção
    - `updateDetection()` - Atualizar detecção
    - `uploadDetectionEvidence()` - Upload de evidência (tool ou siem)

**Frontend - Hooks:**
- `frontend/src/features/exercises/hooks/useExercises.ts`
  - Adicionado import de `CreateDetectionRequest`
  - Adicionado hook `useCreateDetection()`
  - Adicionado hook `useUpdateDetection()`
  - Adicionado hook `useUploadDetectionEvidence()`

---

#### 8.4 Exibição de Status de Detecção

**Funcionalidade:** Mostrar status de detecção em múltiplos lugares da interface.

**No card de execução (TechniqueExecutionModal):**
- Badge com status de detecção (Detectado, Parcial, Não Detectado, Aguardando)
- Seção expandida mostrando detalhes:
  - Status de detecção por ferramenta com tempo de resposta
  - Status de detecção por SIEM com tempo de resposta
  - Notas do analista
  - Evidências de detecção (separadas por tipo)

**Na listagem de técnicas (ExerciseDetailPage):**
- Badge de status de detecção ao lado do status da técnica
- Indicadores: Ferramenta | SIEM quando detectado em ambos
- Loading spinner enquanto carrega status

**Arquivos modificados:**
- `frontend/src/features/exercises/components/TechniqueExecutionModal.tsx`
  - Modificado `ExecutionCard` para exibir detecções
  - Adicionados estados `detections`, `loadingDetections`
  - Seção de "Detecção - Blue Team" com cards de Tool e SIEM
  - Exibição de tempo de resposta calculado
  - Grid de evidências de detecção
  - Modificado `EvidenceCard` para aceitar `onDelete` opcional e `label`

- `frontend/src/features/exercises/components/ExerciseDetailPage.tsx`
  - Adicionados imports: `Eye`, `EyeOff`, `AlertTriangle`, `Shield`
  - Adicionado `detectionStatusConfig` com cores e ícones
  - Modificado `SortableTechniqueItem` para carregar e exibir status de detecção
  - Badge de detecção com ícone e cor correspondente ao status
  - Indicadores de "Ferramenta" e "SIEM" quando detectados

---

#### 8.5 Validação de Evidência Obrigatória

**Regra:** Não é possível registrar detecção sem anexar evidência.

**Validações implementadas:**
- Se "Detectado por Ferramenta" está marcado, deve ter pelo menos uma evidência de tipo "tool"
- Se "Detectado por SIEM" está marcado, deve ter pelo menos uma evidência de tipo "siem"
- Mensagens de erro em português informando qual evidência está faltando
- Pelo menos um tipo de detecção deve ser selecionado

**Arquivo modificado:**
- `frontend/src/features/exercises/components/TechniqueExecutionModal.tsx`
  - Validação em `handleSaveDetection()` antes de enviar

---

### Resumo das Modificações

| Componente | Arquivos Modificados |
|------------|---------------------|
| Backend Handler | `detection_handler.go` |
| Backend Repository Interface | `execution_repository.go` |
| Backend Repository Impl | `postgres/execution_repo.go` |
| Backend Router | `router.go` |
| Frontend API | `exercisesApi.ts` |
| Frontend Hooks | `useExercises.ts` |
| Frontend Modal | `TechniqueExecutionModal.tsx` |
| Frontend Page | `ExerciseDetailPage.tsx` |

---

### 8.6 Correção de Bug - Tela Branca ao Expandir Cenário

**Problema:** Ao clicar para expandir um cenário (técnica), a tela ficava branca sem nenhuma informação.

**Causa:** Múltiplos problemas relacionados ao tratamento de respostas da API e tipos TypeScript:

1. **Resposta null da API:** A função `getDetectionsByExecution` poderia retornar `null` em vez de um array vazio, causando erro ao acessar `.length`
2. **Tipos de ícones incompatíveis:** O tipo `typeof Eye` não era compatível com outros ícones como `Clock`, `AlertTriangle`, etc.

**Correções aplicadas:**

**TechniqueExecutionModal.tsx:**
```typescript
// Antes
const data = await exercisesApi.getDetectionsByExecution(execution.id)
setDetections(data)

// Depois
const data = await exercisesApi.getDetectionsByExecution(execution.id)
setDetections(data || [])  // Garantir array mesmo se null

// Adicionado tratamento no catch
} catch (error) {
  console.error('Error fetching detections:', error)
  setDetections([])  // Garantir array em caso de erro
}
```

**ExerciseDetailPage.tsx:**
```typescript
// Antes
if (detections.length > 0) {

// Depois
if (detections && detections.length > 0) {

// Tipo corrigido
const detectionStatusConfig: Record<DetectionStatus, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>  // Era: typeof Eye
}> = { ... }
```

**Arquivos modificados:**
- `frontend/src/features/exercises/components/TechniqueExecutionModal.tsx`
  - Adicionado fallback `|| []` para resposta da API
  - Adicionado `setDetections([])` no bloco catch

- `frontend/src/features/exercises/components/ExerciseDetailPage.tsx`
  - Adicionado import do `React`
  - Corrigido tipo do `detectionStatusConfig` para `React.ComponentType`
  - Adicionada verificação `detections &&` antes de acessar `.length`

---

### 8.7 Correção de Bug - Tela Branca (Continuação)

**Problema:** O bug de tela branca persistiu mesmo após as correções iniciais.

**Investigação adicional:** Possíveis causas de memory leaks e race conditions nos useEffects que fazem chamadas assíncronas.

**Correções adicionais aplicadas:**

**TechniqueExecutionModal.tsx - ExecutionCard:**
```typescript
// Antes
const [loadingDetections, setLoadingDetections] = useState(true)

useEffect(() => {
  const fetchDetections = async () => {
    try {
      const data = await exercisesApi.getDetectionsByExecution(execution.id)
      setDetections(data || [])
    } catch (error) {
      console.error('Error fetching detections:', error)
      setDetections([])
    } finally {
      setLoadingDetections(false)
    }
  }
  fetchDetections()
}, [execution.id])

// Depois
const [loadingDetections, setLoadingDetections] = useState(false)

useEffect(() => {
  if (!execution?.id) return

  let isMounted = true
  setLoadingDetections(true)

  const fetchDetections = async () => {
    try {
      const data = await exercisesApi.getDetectionsByExecution(execution.id)
      if (isMounted) {
        setDetections(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching detections:', error)
      if (isMounted) {
        setDetections([])
      }
    } finally {
      if (isMounted) {
        setLoadingDetections(false)
      }
    }
  }

  fetchDetections()

  return () => {
    isMounted = false
  }
}, [execution?.id])
```

**ExerciseDetailPage.tsx - SortableTechniqueItem:**
```typescript
// Correções aplicadas:
// 1. Verificação antecipada de condições
// 2. Flag isMounted para evitar updates em componentes desmontados
// 3. Validação Array.isArray() para garantir tipo correto
// 4. Cleanup function no useEffect
// 5. Optional chaining para acessar execution ID
```

**Mudanças principais:**
1. **Estado inicial `false`:** `loadingDetections` inicia como `false` ao invés de `true`
2. **Guard clause:** Verificação `if (!execution?.id) return` no início
3. **isMounted flag:** Previne updates de estado após unmount do componente
4. **Array.isArray():** Verificação explícita se a resposta é um array
5. **Cleanup function:** Retorna função que seta `isMounted = false`
6. **Optional chaining:** Usa `execution?.id` e `technique.executions?.[0]?.id`

**Arquivos modificados:**
- `frontend/src/features/exercises/components/TechniqueExecutionModal.tsx`
  - Refatorado useEffect do ExecutionCard com cleanup e validações

- `frontend/src/features/exercises/components/ExerciseDetailPage.tsx`
  - Refatorado useEffect do SortableTechniqueItem com cleanup e validações

---

### 8.8 Correção de Erros de Build TypeScript

**Problema:** Build falhou com 8 erros de variáveis declaradas mas não utilizadas (TS6133).

**Erros corrigidos:**

1. **ExerciseDetailPage.tsx:190** - `exerciseId` declarado mas não usado
   - Solução: Renomeado para `_exerciseId` e adicionado `void _exerciseId`

2. **ExercisesPage.tsx:10** - `Users` importado mas não usado
   - Solução: Removido do import

3. **TechniqueExecutionModal.tsx:174** - `updateDetection` declarado mas não usado
   - Solução: Removido import e declaração de `useUpdateDetection`

4. **UsersPage.tsx:2** - `Filter` importado mas não usado
   - Solução: Removido do import

5. **UsersPage.tsx:5** - `Input` importado mas não usado
   - Solução: Removido import

6. **UsersTable.tsx:81** - `buttonRefs` declarado mas não usado
   - Solução: Removido declaração

7. **UsersTable.tsx:97** - `handleClickOutside` e parâmetro `e` declarados mas não usados
   - Solução: Removido parâmetro `e: MouseEvent` da função

**Arquivos modificados:**
- `frontend/src/features/exercises/components/ExerciseDetailPage.tsx`
- `frontend/src/features/exercises/components/ExercisesPage.tsx`
- `frontend/src/features/exercises/components/TechniqueExecutionModal.tsx`
- `frontend/src/features/users/components/UsersPage.tsx`
- `frontend/src/features/users/components/UsersTable.tsx`

---

### 8.9 Correção de Erros de Build TypeScript (Continuação)

**Problema:** Build ainda falhou com 3 erros adicionais.

**Erros corrigidos:**

1. **UsersPage.tsx:158** - `Users` não encontrado (TS2304)
   - Causa: O import de `Users` foi removido erroneamente na correção anterior, mas ainda era usado no componente
   - Solução: Re-adicionado `Users` ao import de lucide-react

2. **UsersTable.tsx:1** - `useRef` importado mas não usado (TS6133)
   - Solução: Removido `useRef` do import

3. **UsersTable.tsx:96** - `handleClickOutside` declarado mas não usado (TS6133)
   - Solução: Removida função `handleClickOutside` não utilizada do useEffect

**Arquivos modificados:**
- `frontend/src/features/users/components/UsersPage.tsx`
- `frontend/src/features/users/components/UsersTable.tsx`

---

### 8.10 Debug - Tela Branca ao Expandir Cenário

**Objetivo:** Adicionar código de debug para identificar a causa raiz do problema de tela branca.

**Debug adicionado:**

1. **Error Boundary:** Componente `ModalErrorBoundary` para capturar erros de renderização
   - Mostra mensagem de erro, stack trace e component stack
   - Botão para tentar novamente

2. **Console logs em TechniqueExecutionModal:**
   - Log no início do render com props
   - Log após fetch de técnica com resultado
   - Log após fetch de execuções com resultado e erros
   - Log antes do return se technique é null
   - Log com detalhes da técnica antes de renderizar

3. **Console logs em ExecutionCard:**
   - Log no render com executionId e index
   - Log no início do useEffect
   - Log quando não há execution ID
   - Log antes de fazer fetch
   - Log com resposta do fetch
   - Log quando fetch completa
   - Log antes do return com hasDetection e latestDetection

**Como usar:**
1. Abra o Console do navegador (F12 → Console)
2. Tente expandir o cenário
3. Observe os logs para identificar onde o erro ocorre
4. Se houver erro de renderização, será exibido na tela em vez de tela branca

**Arquivo modificado:**
- `frontend/src/features/exercises/components/TechniqueExecutionModal.tsx`

**NOTA:** Remover todo o código de debug após identificar e corrigir o problema.

---

## [2026-01-21] - Sessão de Desenvolvimento - Melhorias de UI/UX

### 9. Correção de Exibição de Legenda em Evidências de Detecção

**Problema:** A legenda (caption) das evidências de detecção não era exibida na interface.

**Causa:** A função `toDetectionResponse` no backend não incluía o campo `Caption` ao mapear evidências.

**Arquivo modificado:**
- `backend/internal/adapter/http/handler/detection_handler.go`
  - Adicionado campo `Caption` no mapeamento de evidências dentro de `toDetectionResponse`

---

### 10. Atualização Responsiva da Interface após Criação de Detecção

**Problema:** A interface não atualizava automaticamente após criar uma detecção ou adicionar legenda.

**Correções aplicadas:**
- `frontend/src/features/exercises/components/TechniqueExecutionModal.tsx`
  - Adicionado `useQueryClient` para invalidação de cache
  - Mudança de upload sequencial para paralelo com `Promise.all`
  - Adicionado `key` com refreshKey no ExecutionCard para forçar re-renderização
  - Adicionados delays para propagação de dados

---

### 11. Nova Lógica de Classificação de Detecções

**Mudança de conceito:** A detecção pelo SIEM agora é considerada o cenário ideal.

**Nova lógica:**
- SIEM detectou → `detected` (independente de ferramenta)
- Apenas ferramenta detectou → `partial`
- Nenhum detectou → `not_detected`

**Arquivos modificados:**

**Backend:**
- `backend/internal/adapter/http/handler/detection_handler.go`
  - Atualizada lógica em `Create()` e `Update()` para priorizar SIEM
  ```go
  if req.SIEMDetected {
    detection.DetectionStatus = entity.DetectionStatusDetected
  } else if req.ToolDetected {
    detection.DetectionStatus = entity.DetectionStatusPartial
  } else {
    detection.DetectionStatus = entity.DetectionStatusNotDetected
  }
  ```

**Frontend:**
- `frontend/src/features/exercises/components/ExerciseDetailPage.tsx`
  - Adicionada função `calculateDetectionStatus()` para recalcular status localmente

- `frontend/src/features/exercises/components/TechniqueExecutionModal.tsx`
  - Adicionada função `calculateDetectionStatus()` para exibição correta do status

---

### 12. Correção do Dropdown de Seleção de Idioma

**Problema:** O dropdown de seleção de idioma ficava quase fora da tela para baixo.

**Solução:** Implementada lógica para detectar espaço disponível e abrir para cima quando necessário.

**Arquivo modificado:**
- `frontend/src/components/ui/LanguageSelector.tsx`
  - Adicionado estado `openUpward`
  - Adicionado `useEffect` para calcular espaço disponível
  - Classe condicional: `bottom-full mb-2` para abrir para cima, `top-full mt-2` para baixo

```typescript
useEffect(() => {
  if (isOpen && buttonRef.current) {
    const buttonRect = buttonRef.current.getBoundingClientRect()
    const dropdownHeight = 100
    const spaceBelow = window.innerHeight - buttonRect.bottom
    const spaceAbove = buttonRect.top
    setOpenUpward(spaceBelow < dropdownHeight && spaceAbove > spaceBelow)
  }
}, [isOpen])
```

---

### 13. Gráficos Donut para Taxa de Detecção

**Funcionalidade:** Exibir gráficos donut abaixo da descrição do exercício mostrando taxas de detecção.

**Gráficos implementados:**
1. **Taxa de detecção por Ferramenta** (cor laranja `#f59e0b`)
2. **Taxa de detecção pelo SIEM** (cor azul `#3b82f6`)

**Arquivos criados/modificados:**

**Novo componente:**
- `frontend/src/components/ui/DonutChart.tsx`
  - Utiliza `@mui/x-charts/PieChart` para renderização
  - Props: `value`, `size`, `color`, `backgroundColor`, `label`, `sublabel`
  - Configuração de donut com `innerRadius` e `outerRadius`
  - Porcentagem exibida no centro do gráfico

```typescript
import { PieChart } from '@mui/x-charts/PieChart'

export function DonutChart({
  value,
  size = 140,
  color = '#10b981',
  backgroundColor = '#e5e7eb',
  label,
  sublabel,
}: DonutChartProps) {
  const data = [
    { id: 0, value: safeValue, color: color },
    { id: 1, value: remaining, color: backgroundColor },
  ]

  return (
    <PieChart
      series={[{
        data,
        innerRadius: size * 0.32,
        outerRadius: size * 0.45,
        cornerRadius: 4,
        startAngle: -90,
        endAngle: 270,
      }]}
      // ...
    />
  )
}
```

**ExerciseDetailPage.tsx:**
- Adicionado estado `detectionStats` para estatísticas de detecção
- Adicionado `useEffect` para calcular estatísticas baseadas nas execuções
- Seção de gráficos exibida quando exercício não é draft e há execuções

```typescript
const [detectionStats, setDetectionStats] = useState({
  toolDetected: 0,
  siemDetected: 0,
  totalWithExecutions: 0,
})

// Gráficos exibidos quando:
// - exercise.status !== 'draft'
// - detectionStats.totalWithExecutions > 0
```

**Traduções adicionadas:**
- `frontend/src/i18n/locales/pt-BR.json`
  - `detection.detectionRates`: "Taxas de Detecção"
  - `detection.scenariosDetected`: "cenários detectados"

- `frontend/src/i18n/locales/en.json`
  - `detection.detectionRates`: "Detection Rates"
  - `detection.scenariosDetected`: "scenarios detected"

**Dependência adicionada:**
- `@mui/x-charts` - Biblioteca de gráficos MUI X

---

### Resumo das Modificações desta Sessão

| Componente | Arquivos Modificados |
|------------|---------------------|
| Backend Handler | `detection_handler.go` |
| Frontend UI | `DonutChart.tsx` (novo), `LanguageSelector.tsx` |
| Frontend Page | `ExerciseDetailPage.tsx` |
| Frontend Modal | `TechniqueExecutionModal.tsx` |
| Traduções | `pt-BR.json`, `en.json` |

---

## Próximas Tarefas Pendentes

_(Adicionar aqui conforme novas tarefas forem identificadas)_

---

## Convenções

- **Data:** Formato YYYY-MM-DD
- **Seções:** Numeradas sequencialmente por sessão
- **Arquivos:** Caminho relativo a partir da raiz do projeto
- **Problemas:** Descrição do problema, causa e solução
