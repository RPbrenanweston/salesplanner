# PRD: CodeSignal Agent Integration with Sourcing Mission Control

## Introduction

Integrate the CodeSignal talent sourcing agent with the sourcing-mission-control React frontend to create an end-to-end hiring signal platform. Users configure sourcing parameters in the ConfigurationView, trigger CodeSignal processing in the ExecutionView, and view scored candidates in the IntelligenceView. This MVP focuses on synchronous request/response flow with confidence scoring and signal classification.

## Goals

- Connect React frontend (ExecutionView) to Python CodeSignal backend via `/api/v1/process` endpoint
- Return scored candidates (0-100 confidence) with signal classifications (HIRING/COMPANY/INDIVIDUAL)
- Display results in IntelligenceView as a sortable, filterable table
- Deploy full stack to Railway (React frontend + FastAPI backend + Postgres) as production-ready MVP
- Complete in single autonomous coding session (8-16 iterations)

## User Stories

### US-001: Create FastAPI backend scaffold
**Description:** As a developer, I need a FastAPI backend service that the React frontend can call.

**Acceptance Criteria:**
- [ ] FastAPI app created at `backend/main.py`
- [ ] Health check endpoint: `GET /api/v1/health` returns `{"status": "ok"}`
- [ ] Pydantic models defined for request/response validation
- [ ] `python -m uvicorn backend.main:app --reload` runs locally without errors
- [ ] Typecheck passes (Python type hints on all functions)

### US-002: Implement /api/v1/process endpoint
**Description:** As the ExecutionView component, I want to POST sourcing configuration to the backend and receive scored candidates in response.

**Acceptance Criteria:**
- [ ] Endpoint accepts POST with: keywords (list), rssFeedUrls (list), filters (dict with minimumConfidence, signalTypes)
- [ ] Endpoint triggers CodeSignal agent (synchronous) to score candidates
- [ ] Returns JSON: `{ "status": "completed", "results": { "candidates": [...], "metadata": {...} } }`
- [ ] Candidate schema: `{ id, name, source, confidenceScore (0-100), signals (list), rawData }`
- [ ] Signal schema: `{ type (HIRING/COMPANY/INDIVIDUAL), text, confidence, patterns, keywords }`
- [ ] Error responses: 400 for invalid input, 500 for processing errors
- [ ] Response time < 30 seconds for typical sourcing (100-500 items processed)
- [ ] Typecheck passes

### US-003: Create React hooks for backend integration
**Description:** As the ExecutionView, I want a clean React Query hook to call the backend and track execution state.

**Acceptance Criteria:**
- [ ] Hook: `useProcessSourcing()` created at `src/api/sourcing.ts`
- [ ] Hook uses React Query `useMutation` to POST to `/api/v1/process`
- [ ] Hook returns: `{ mutate, isPending, isSuccess, data, error }`
- [ ] VITE_API_URL configured via `.env.production` and `.env.development`
- [ ] Handles CORS errors gracefully with user-friendly error message
- [ ] Typecheck passes
- [ ] Unit test exists: `src/api/__tests__/sourcing.test.ts`

### US-004: Integrate hook into ExecutionView
**Description:** As a user, I want to click "Execute" in ExecutionView to trigger candidate sourcing.

**Acceptance Criteria:**
- [ ] ExecutionView calls `useProcessSourcing()` hook
- [ ] "Execute Search" button triggers mutation with config from props
- [ ] Shows loading spinner while `isPending` is true
- [ ] On success: navigates to IntelligenceView with results (via React Router state)
- [ ] On error: displays error toast with details
- [ ] Button disabled while processing
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill (loading state, success navigation, error handling)

### US-005: Update IntelligenceView to display results
**Description:** As a user, I want to see scored candidates in a table sorted by confidence.

**Acceptance Criteria:**
- [ ] IntelligenceView receives results from React Router location state
- [ ] Table columns: Name | Confidence (%) | Signal Type | Source | Actions
- [ ] Table sorted by confidence descending by default (highest scores first)
- [ ] Confidence displayed as number + bar chart (0-100 scale)
- [ ] Signal type color-coded: HIRING=green, COMPANY=blue, INDIVIDUAL=purple
- [ ] Click row to show raw signal details in a modal (optional for MVP)
- [ ] Empty state message if no results
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill (table layout, sorting, colors, empty state)

### US-006: Configure CORS and environment variables
**Description:** As DevOps, I need the backend and frontend to communicate securely.

**Acceptance Criteria:**
- [ ] CORS configured in FastAPI for `http://localhost:3000` (dev) and Railway production domain
- [ ] Backend reads `DATABASE_URL` from env (Postgres connection string)
- [ ] Frontend reads `VITE_API_URL` from `.env` files
- [ ] `.env.example` files created (no secrets committed)
- [ ] Railway environment variables documented in `DEPLOY.md`
- [ ] Health check verifies Postgres connectivity

### US-007: Deploy to Railway
**Description:** As an operator, I need the full stack running on Railway.

**Acceptance Criteria:**
- [ ] Railway project created with two services: backend (container) + frontend (static)
- [ ] Railway Postgres provisioned and linked to backend service
- [ ] Backend Dockerfile created with Python 3.11 + uvicorn
- [ ] Frontend builds with `bun run build` and deploys as static
- [ ] Both services accessible via Railway domains
- [ ] Health check: `GET /api/v1/health` returns ok on live deployment
- [ ] End-to-end test: execute sourcing flow in production, verify results display
- [ ] `DEPLOY.md` documents: setup steps, environment variables, debugging
- [ ] Typecheck passes (Dockerfile is valid, configs correct)

### US-008: Document deployment and API
**Description:** As a developer, I need clear documentation to operate and extend the system.

**Acceptance Criteria:**
- [ ] `README.md` updated with: project overview, tech stack, quick start (local dev)
- [ ] `DEPLOY.md` created with: Railway setup, environment variables, troubleshooting
- [ ] `API.md` created with: endpoint specs, request/response schemas, error codes
- [ ] OpenAPI docs auto-generated at `/docs` (FastAPI built-in)
- [ ] All docs in Markdown, no broken links

## Functional Requirements

- **FR-1:** Backend must expose `POST /api/v1/process` accepting sourcing configuration
- **FR-2:** Backend must trigger CodeSignal agent synchronously and return scored candidates (0-100)
- **FR-3:** Backend must classify signals by type (HIRING, COMPANY, INDIVIDUAL)
- **FR-4:** Frontend ExecutionView must call backend via `useProcessSourcing()` hook
- **FR-5:** Frontend must navigate to IntelligenceView on success with results in URL state
- **FR-6:** IntelligenceView must display candidates in a table sorted by confidence (descending)
- **FR-7:** CORS must be configured to allow frontend → backend requests
- **FR-8:** Both frontend and backend must be deployable to Railway
- **FR-9:** Health check endpoint (`GET /api/v1/health`) must verify system is running
- **FR-10:** All TypeScript must typecheck without errors

## Non-Goals (Out of Scope)

- **No async job queuing** — MVP is synchronous. Async jobs added in future sprint.
- **No persistent job history** — Results only live in component state during session
- **No authentication/authorization** — Single-user MVP. Auth added later.
- **No advanced filtering UI** — Simple table only. Filters configured in ConfigurationView.
- **No confidence threshold learning loop** — Static scoring formula. ML improvements next phase.
- **No CSV upload support** — MVP only processes RSS feeds. CSV support added next.
- **No email notifications** — No integrations beyond RSS → scoring → display.

## Design Considerations

### Frontend Integration Points
- **ConfigurationView** → passes sourcing params to ExecutionView
- **ExecutionView** → calls `useProcessSourcing()`, shows loading, navigates on success
- **IntelligenceView** → receives results via React Router state, displays table
- **Reuse existing components:** Use shadcn/ui Button, Table, Toast for consistency

### Backend Integration Points
- **CodeSignal agent** → imported and called synchronously during request handling
- **No database writes yet** — MVP doesn't persist results. Just return in response.
- **Postgres** — provisioned but not used in MVP (prepared for future phases)

## Technical Considerations

### Backend Stack
- **Framework:** FastAPI (async-ready, Pydantic validation, built-in OpenAPI docs)
- **Runtime:** Python 3.11, uvicorn ASGI server
- **Dependencies:** fastapi, uvicorn, pydantic, python-multipart, python-dotenv
- **Import CodeSignal agent** from existing backend (confidence_scorer.py, signal_classifier.py)

### Frontend Stack
- **HTTP Client:** Fetch API (already built into browsers)
- **State Management:** React Query (`useMutation`) for server state
- **Navigation:** React Router v6 (`useNavigate`, `useLocation`)
- **UI Components:** shadcn/ui Button, Table, Toast (already installed)

### Deployment
- **Container:** Docker (Python backend)
- **Static hosting:** Railway supports static frontend (Nixpacks auto-detect)
- **Database:** Railway Postgres (provisioned, used in Phase 2)
- **Environment:** Development (localhost:3000 ↔ localhost:8000), Production (Railway domains)

## Success Metrics

- All 8 user stories pass acceptance criteria
- Full stack deploys to Railway and is publicly accessible
- End-to-end: Config → Execute → Results displays in < 10 seconds (typical case)
- Confidence scoring accuracy matches CodeSignal agent output
- Zero TypeScript errors
- No CORS errors in browser console
- Documentation is clear enough for a junior developer to extend

## Open Questions

- Should we display raw HTML snippets of signals in the table, or just text summaries?
- Do we need to persist results to Postgres in MVP, or is in-memory state sufficient?
- Should ExecutionView show a progress bar, or just a spinner?
- Any specific styling preferences for the results table (compact vs spacious)?

---

## Implementation Priority

**Tier 1 (Days 1-2, 4 stories):** US-001, US-002, US-003, US-006
- Result: Backend API working, can call from curl/Postman

**Tier 2 (Day 2-3, 3 stories):** US-004, US-005, US-008
- Result: Full frontend-to-backend flow working locally, documented

**Tier 3 (Day 3, 1 story):** US-007
- Result: Deployed to Railway, production-ready

**Estimated timeline:** 8-16 Ralph iterations (~4-8 hours autonomous coding)
