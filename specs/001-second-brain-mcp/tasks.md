# Tasks: Second Brain MCP Server

**Input**: Design documents from `specs/001-second-brain-mcp/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/mcp.md

---

## Phase 1: Project Setup

**Purpose**: Create the project skeleton for the `secondbrain-mcp` worker.

- [x] T001 Create the root project directory `secondbrain-mcp/`
- [x] T002 [P] Create the `secondbrain-mcp/src/` directory and its subdirectories: `mcp`, `handlers`, `db`, `utils`
- [x] T003 [P] Create an initial `secondbrain-mcp/package.json` file
- [x] T004 [P] Create a `secondbrain-mcp/tsconfig.json` file configured for Cloudflare Workers
- [x] T005 [P] Create the `secondbrain-mcp/wrangler.toml` file with content from `instruction.md`, using placeholder IDs
- [x] T006 [P] Add the database schema to `secondbrain-mcp/src/db/schema.sql`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the core server logic, routing, and utilities that all tools will depend on.

- [x] T007 Initialize `npm` dependencies by running `npm install` in `secondbrain-mcp/`
- [x] T008 [P] Implement the embedding generation wrapper in `secondbrain-mcp/src/handlers/embeddings.ts`
- [x] T009 [P] Implement the Vectorize helper functions in `secondbrain-mcp/src/utils/vectorize.ts`
- [x] T010 [P] Implement Zod schemas and validation helpers in `secondbrain-mcp/src/utils/validation.ts`
- [x] T011 [P] Define all necessary TypeScript interfaces in `secondbrain-mcp/src/mcp/types.ts`
- [x] T012 Implement the main Hono application setup in `secondbrain-mcp/src/index.ts`, including CORS and a basic `/mcp` route
- [ ] T013 Define the four MCP tools in `secondbrain-mcp/src/mcp/tools.ts`
- [ ] T014 Implement the core MCP `tools/list` and `tools/call` logic in `secondbrain-mcp/src/mcp/server.ts`, dispatching calls to placeholder handler functions

### Tests for Foundational Code
- [ ] T015 [P] Write a unit test for the embedding handler in `secondbrain-mcp/src/handlers/embeddings.test.ts`
- [ ] T016 [P] Write unit tests for the Zod validation schemas in `secondbrain-mcp/src/utils/validation.test.ts`

---

## Phase 3: User Story 1 - Store and Embed a Memory (Priority: P1) 🎯 MVP

**Goal**: Implement the `store_memory` tool to allow users to add new memories.
**Independent Test**: Call the `/mcp` endpoint to use the `store_memory` tool and verify a new memory is created.

### Tests for User Story 1
- [ ] T017 [US1] Write unit test for the `store_memory` handler in `secondbrain-mcp/src/handlers/memory.test.ts`, mocking D1, Vectorize, and AI bindings.

### Implementation for User Story 1
- [ ] T018 [US1] Implement the `store_memory` handler logic in `secondbrain-mcp/src/handlers/memory.ts`
- [ ] T019 [US1] Connect the `store_memory` tool in `secondbrain-mcp/src/mcp/server.ts` to the real handler implementation

---

## Phase 4: User Story 2 - Search for Memories (Priority: P2)

**Goal**: Implement the `search_memory` tool for semantic search.
**Independent Test**: Call the `/mcp` endpoint to use the `search_memory` tool and retrieve the memory created in the previous phase.

### Tests for User Story 2
- [ ] T020 [US2] Write unit test for the `search_memory` handler in `secondbrain-mcp/src/handlers/search.test.ts`, mocking D1, Vectorize, and AI bindings.

### Implementation for User Story 2
- [ ] T021 [US2] Implement the `search_memory` handler logic in `secondbrain-mcp/src/handlers/search.ts`
- [ ] T022 [US2] Connect the `search_memory` tool in `secondbrain-mcp/src/mcp/server.ts` to the real handler implementation

---

## Phase 5: User Story 3 - Manage and List Memories (Priority: P3)

**Goal**: Implement the `list_memories` and `delete_memory` tools.
**Independent Test**: Use the `list_memories` tool to see recent items. Use the `delete_memory` tool to remove an item and verify it is gone.

### Tests for User Story 3
- [ ] T023 [P] [US3] Write unit test for the `list_memories` handler in `secondbrain-mcp/src/handlers/search.test.ts`
- [ ] T024 [P] [US3] Write unit test for the `delete_memory` handler in `secondbrain-mcp/src/handlers/memory.test.ts`

### Implementation for User Story 3
- [ ] T025 [P] [US3] Implement the `list_memories` handler logic in `secondbrain-mcp/src/handlers/search.ts`
- [ ] T026 [P] [US3] Implement the `delete_memory` handler logic in `secondbrain-mcp/src/handlers/memory.ts`
- [ ] T027 [US3] Connect the `list_memories` and `delete_memory` tools in `secondbrain-mcp/src/mcp/server.ts` to their handlers

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize documentation, scripts, and error handling.

- [ ] T028 [P] Implement robust error handling and logging across all handlers
- [ ] T029 [P] Create the `setup.sh` script for Cloudflare resource creation in the `secondbrain-mcp/` directory
- [ ] T030 [P] Create a comprehensive `README.md` for the `secondbrain-mcp/` project, including setup and deployment instructions
- [ ] T031 [P] Create the `DEPLOY.md` checklist in the `secondbrain-mcp/` directory
- [ ] T032 [P] Implement basic rate limiting using Workers KV

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** must be completed first.
- **Phase 2 (Foundational)** depends on Phase 1. It blocks all User Story phases.
- **Phase 3, 4, and 5 (User Stories)** can be worked on sequentially or in parallel after Phase 2 is complete.
- **Phase 6 (Polish)** can be done after all user stories are implemented.
