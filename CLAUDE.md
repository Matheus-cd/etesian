# Etesian — Purple Team Exercise Platform

Plataforma de gerenciamento de exercícios Purple Team. Red Team executa técnicas MITRE ATT&CK, Blue Team registra detecções, Lead coordena o exercício.

## Stack

- **Backend**: Go 1.24 (chi router, sqlx, PostgreSQL, JWT+MFA)
- **Frontend**: React 18 + TypeScript (Vite, TanStack Query, Tailwind CSS, Zustand, i18n)
- **Database**: PostgreSQL 16 com UUIDs

## Estrutura do projeto

```
backend/
  cmd/api/main.go              # Entry point
  internal/
    adapter/http/              # Handlers, middleware, router
    adapter/repository/postgres/ # Implementações sqlx
    domain/entity/             # Modelos de domínio
    domain/repository/         # Interfaces de repositório
    domain/service/            # Lógica de negócio
    infrastructure/            # Config, crypto, database, storage
  migrations/                  # SQL migrations sequenciais (000_, 001_, ...)

frontend/
  src/
    features/{feature}/        # api/, components/, hooks/, store/
    components/ui/             # Componentes reutilizáveis (Button, Modal, etc.)
    i18n/locales/              # en.json e pt-BR.json
    lib/                       # api-client.ts, utils.ts
```

## Comandos essenciais

```bash
# Backend
cd backend && go build ./...           # Build
cd backend && go test ./...            # Testes
cd backend && go run ./cmd/api         # Rodar servidor (porta 8080)

# Frontend
cd frontend && npm install             # Instalar deps
cd frontend && npm run dev             # Dev server (porta 5173)
cd frontend && npm run build           # Build produção
cd frontend && npx tsc --noEmit        # Type check
```

## Variáveis de ambiente (backend)

Configuração em `internal/infrastructure/config/config.go`:
`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE`,
`JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`,
`SERVER_PORT`, `UPLOAD_PATH`, `MAX_FILE_SIZE`

## Roles e permissões

| Role | Backend const | Pode fazer |
|------|--------------|------------|
| Admin | `admin` | Tudo + gestão de usuários |
| Lead | `purple_team_lead` | Coordenar exercícios, criar/editar tudo |
| Red Team | `red_team_operator` | Executar técnicas, registrar execuções |
| Blue Team | `blue_team_analyst` | Registrar detecções, cumprir requisitos |
| Viewer | `viewer` | Somente leitura |

## Regras de desenvolvimento

Veja as regras detalhadas em `.claude/rules/`:
- `software-engineer.md` — Arquitetura e padrões gerais
- `purple-team.md` — Domínio Purple Team e MITRE ATT&CK
- `golang.md` — Convenções Go do projeto
- `react-typescript.md` — Padrões React/TypeScript do projeto
- `postgresql.md` — Database, migrations e queries
- `security.md` — Segurança da aplicação

## i18n

Toda string voltada ao usuário usa i18n. Sempre atualizar **ambos** `en.json` e `pt-BR.json`.
Padrão de chaves: `{feature}.{section}.{key}` (ex: `exercises.status.active`).
