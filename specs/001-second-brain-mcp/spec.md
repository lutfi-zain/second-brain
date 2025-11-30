# Feature Specification: Second Brain MCP Server

**Feature Branch**: `001-second-brain-mcp`
**Created**: 2025-11-30
**Status**: Draft
**Input**: User description: "we're building multiagent mcp for second brain and thinking in maftia.tech. baca @instruction.md"

## User Scenarios & Testing *(mandatory)*

This feature enables a personal "Second Brain" accessible via the Model Context Protocol (MCP). It allows users and AI agents to store, search, and manage textual "memories" through a standardized set of tools.

### User Story 1 - Store and Embed a Memory (Priority: P1)

As a user or agent, I want to submit a piece of information (a "memory") so that it is permanently stored and made available for future semantic searches.

**Why this priority**: This is the core ingestion functionality. Without the ability to store memories, no other function has value.

**Independent Test**: This can be tested by calling the `store_memory` tool with a new piece of text. A successful response (containing a new memory ID) indicates the memory was stored. A subsequent search for that memory (in US2) will fully validate it.

**Acceptance Scenarios**:
1.  **Given** a user provides a piece of text and a valid type (e.g., 'note').
    **When** they call the `store_memory` tool.
    **Then** the system successfully stores the text, generates an embedding, and returns a unique `memory_id` and `vector_id`.
2.  **Given** a user provides text but an invalid `type`.
    **When** they call the `store_memory` tool.
    **Then** the system returns an error indicating the input is invalid.

---

### User Story 2 - Search for Memories (Priority: P2)

As a user or agent, I want to perform a semantic search using a natural language query so that I can find the most relevant memories I have previously stored.

**Why this priority**: Search is the primary way users will retrieve value from their stored memories.

**Independent Test**: This can be tested by calling the `search_memory` tool with a query string. A successful response will contain a list of previously stored memories that are semantically related to the query, each with a relevance score.

**Acceptance Scenarios**:
1.  **Given** a user has already stored several memories.
    **When** they call the `search_memory` tool with a query that is semantically similar to one of the memories.
    **Then** the system returns a list of results containing that memory, ranked by a relevance score.
2.  **Given** a user provides a search query and specific filters (e.g., type = 'decision').
    **When** they call the `search_memory` tool.
    **Then** the system returns only memories that match the filters and are relevant to the query.

---

### User Story 3 - Manage and List Memories (Priority: P3)

As a user or agent, I want to be able to list my recent memories and delete specific ones I no longer need.

**Why this priority**: Provides essential data management and housekeeping capabilities for the user.

**Independent Test**: The `list_memories` tool can be called to verify it returns a list of recently stored items. The `delete_memory` tool can be tested by providing a valid `memory_id`; a subsequent search for that memory should yield no results.

**Acceptance Scenarios**:
1.  **Given** a user has stored multiple memories.
    **When** they call the `list_memories` tool.
    **Then** the system returns a paginated list of their memories.
2.  **Given** a user has a `memory_id` for an existing memory.
    **When** they call the `delete_memory` tool with that ID.
    **Then** the memory is permanently removed from the system and is no longer discoverable via search or list.

### Edge Cases
- **`store_memory`**: What happens if the text to be stored is extremely long or empty? The system should return a validation error.
- **`search_memory`**: How does the system handle a search query that has no semantic match to any stored memories? It should return an empty list of results.
- **`delete_memory`**: What happens when a user tries to delete a `memory_id` that does not exist? The system should return a non-breaking error (e.g., success: false, message: "not found").
- **Rate Limiting**: What happens when a user sends too many requests in a short period? The system should return a "429 Too Many Requests" error.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: The system MUST provide a Model Context Protocol (MCP) endpoint accessible via Server-Sent Events (SSE).
- **FR-002**: The system MUST expose a tool named `store_memory` that accepts text, type, and optional metadata.
- **FR-003**: The system MUST expose a tool named `search_memory` that accepts a query string and optional filters.
- **FR-004**: The system MUST expose a tool named `list_memories` that accepts optional filters and pagination controls.
- **FR-005**: The system MUST expose a tool named `delete_memory` that accepts a `memory_id`.
- **FR-006**: When `store_memory` is called, the system MUST generate a vector embedding for the provided text.
- **FR-007**: The system MUST persist memories and their metadata in a relational database according to the specified schema.
- **FR-008**: The system MUST store the generated embeddings in a vector index for efficient semantic search.
- **FR-009**: The `search_memory` tool MUST convert the inbound query to an embedding and use it to find similar vectors in the index.
- **FR-010**: All tool inputs MUST be validated for correct data types and required fields.
- **FR-011**: Search results MUST be filterable by `type`, `source`, and `tags`.

### Key Entities
- **Memory**: Represents a single piece of information stored by the user.
  - **Attributes**:
    - `id`: A unique numerical identifier.
    - `text`: The content of the memory.
    - `type`: A category for the memory (e.g., 'note', 'idea', 'decision').
    - `source`: The origin of the memory (e.g., 'gemini', 'manual').
    - `tags`: A list of keywords for categorization.
    - `metadata`: A flexible object for storing additional context.
    - `created_at`: Timestamp of when the memory was created.
- **Memory Vector**: Represents the link between a memory and its vector embedding.
  - **Attributes**:
    - `memory_id`: The ID of the memory it belongs to.
    - `vector_id`: The unique string identifier in the vector index.
    - `embedding_model`: The name of the model used to generate the embedding.

## Assumptions
- This specification is for the "Second Brain MCP" only. The "Sequential Thinking MCP" will be treated as a separate feature.
- The entire infrastructure will be built on and deployed to the Cloudflare ecosystem (Workers, D1, Vectorize, KV) as detailed in `instruction.md`.
- User authentication and authorization are out of scope for this initial version. The endpoint is assumed to be protected by other means or is publicly accessible to authorized clients.

## Success Criteria *(mandatory)*

### Measurable Outcomes
- **SC-001**: A user can successfully store and then retrieve a memory via semantic search with an end-to-end latency of less than 3 seconds.
- **SC-002**: The system will maintain a 99.9% success rate for all valid `store_memory` and `search_memory` tool calls under normal load.
- **SC-003**: The system must be able to handle at least 50 concurrent search requests without significant performance degradation (>5s response time).
- **SC-004**: A developer can successfully set up, deploy the service, and perform a successful end-to-end test in under 15 minutes using the provided `setup.sh` script and `DEPLOY.md` checklist.