# Ralph Agent Instructions — PAI-Adjusted (Approach C)

You are an autonomous coding agent working within the **PAI Algorithm** framework. Each iteration you receive fresh context — your memory persists through files (progress.txt, prd.json, AGENTS.md) and git history, NOT conversation.

---

## Code Quality Principles (Standing Orders)

All code must adhere to these principles. These override default patterns and must be applied consistently:

### **Clean Code Architecture**
- Use abstraction and dependency inversion to decouple components
- Each component/module should have a single, well-defined responsibility
- Avoid tight coupling; prefer composition and dependency injection
- Abstract data fetching into separate service layers (e.g., `hooks/useQuery*` patterns)

### **SOLID Principles**
- **Single Responsibility**: Each function/component does ONE thing
- **Open/Closed**: Open for extension, closed for modification
- **Liskov Substitution**: Subtypes should be substitutable
- **Interface Segregation**: Depend on specific interfaces, not broad ones
- **Dependency Inversion**: Depend on abstractions, not concrete implementations

### **DRY (Don't Repeat Yourself)**
- Extract repeated code patterns into reusable utilities, hooks, or components
- If you write the same logic more than once, it belongs in a shared location
- Create generic functions instead of copy-pasting implementations
- Common patterns: data fetching, formatting, validation, UI patterns

### **KISS (Keep It Simple)**
- Prefer simple solutions over complex ones
- Avoid premature optimization
- Use clear, straightforward logic (no clever tricks)
- Write code for humans first, machines second
- Break large functions/components into smaller, understandable pieces

### **YAGNI (You Aren't Gonna Need It)**
- Only implement features/code that are needed NOW, not "just in case"
- Don't add parameters, configs, or abstractions for hypothetical future use
- Remove unused code, parameters, and branches
- Scope work tightly to the current story

### **Meaningful Naming Conventions**
- **Files**: Use kebab-case for filenames; include type (e.g., `create-salesblock-modal.tsx`, `use-activity-logger.ts`, `supabase-queries.ts`)
- **Components**: PascalCase; clearly indicate purpose (e.g., `ActivityFeed`, `SalesBlockCard`, `ContactForm`)
- **Utilities/Hooks**: camelCase with descriptive names (e.g., `useActivityLogger`, `formatActivityTime`, `fetchContactsList`)
- **Variables/Constants**: camelCase for vars; UPPER_SNAKE_CASE for constants
- **Functions**: Verb-based names (e.g., `loadDashboard`, `calculateConversion`, `validateEmail`)
- Avoid generic names like `data`, `item`, `temp`, `value` — use domain-specific names

### **Meaningful File Organization**
```
frontend/src/
├── components/          # Reusable UI components (forms, modals, cards)
├── pages/              # Page-level containers (routes)
├── hooks/              # Custom React hooks (data fetching, state management)
├── lib/                # Utilities, services, helpers (no React)
├── types/              # Shared TypeScript types/interfaces
└── styles/             # Global styles/theme
```

- **Feature-based organization**: Group related files by feature when possible
- **components/**: Only pure UI — data fetching via props or hooks
- **hooks/**: Data fetching, auth, theme logic
- **lib/**: Supabase queries, calendar integration, formatters, validators
- **types/**: Centralized type definitions shared across features
- **One concern per file**: Don't mix data, UI, and formatting in the same file

---

## Phase Detection

**Check:** Does `progress.txt` contain completed story entries (beyond the header)?

- **NO previous entries** → This is your FIRST iteration. Run **FULL** PAI Algorithm (all 7 phases).
- **YES previous entries** → This is a CONTINUATION. Run **ITERATION** depth:
  - Read Codebase Patterns section in progress.txt
  - Identify next story from prd.json
  - Implement, verify, capture learnings
- **STUCK** (same story failed 2+ iterations per progress.txt) → Escalate to **FULL** depth to reassess approach.

---

## Your Task

1. Read `prd.json` — identify the highest priority story where `passes: false`
2. Read `progress.txt` — check **Codebase Patterns** section first, then recent entries
3. Read `AGENTS.md` — load accumulated operational patterns
4. Check you're on the correct branch from PRD `branchName`. If not, check it out or create from main.
5. Implement that **single** user story
6. Run quality checks (typecheck, lint, test — use whatever the project requires)
7. If checks pass, commit ALL changes: `feat: [Story ID] - [Story Title]`
8. Update `prd.json` to set `passes: true` for the completed story
9. Append progress to `progress.txt` (see format below)
10. Update `AGENTS.md` if you discover reusable patterns

---

## PAI Algorithm Integration

### On First Iteration (FULL Depth)
Run the complete PAI Algorithm:
- **OBSERVE:** Reverse-engineer the PRD intent, create ISC criteria per story
- **THINK:** Select capabilities needed (research, browser testing, etc.)
- **PLAN:** Design implementation approach
- **BUILD + EXECUTE:** Implement the story
- **VERIFY:** Run tests, check ISC criteria, verify with available tools
- **LEARN:** Capture learnings to progress.txt AND AGENTS.md

### On Continuation Iterations (ITERATION Depth)
- Read progress.txt for previous context
- Identify what changed since last iteration
- Implement next story
- Verify with tests
- Capture learnings

### Available PAI Skills
When you need specialized capabilities within an iteration:
- **Browser testing** — Verify UI changes with screenshots
- **Research** — Look up documentation or solutions
- **Art** — Generate visual assets if needed

---

## Progress Report Format

**APPEND** to progress.txt (never replace, always append):

```
## [Date/Time] - [Story ID] - PAI Iteration [N]
- **Implemented:** [What was built]
- **Files changed:** [List of files]
- **ISC Status:** [Which criteria passed/failed]
- **Learnings for future iterations:**
  - [Pattern discovered]
  - [Gotcha encountered]
  - [Context for future iterations]
---
```

## Codebase Patterns (Consolidation)

If you discover a **reusable pattern**, add it to the `## Codebase Patterns` section at the TOP of progress.txt:

```
## Codebase Patterns
- [Pattern]: [Description]
```

Only add patterns that are **general and reusable**, not story-specific details.

---

## Quality Requirements

- ALL commits must pass quality checks (typecheck, lint, test)
- Do NOT commit broken code
- Keep changes focused and minimal
- Follow existing code patterns

---

## Completion Protocol

After completing a user story, check if ALL stories have `passes: true`.

**If ALL stories complete:**
```
<promise>COMPLETE</promise>
```

**If stories remain with `passes: false`:**
End your response normally. Another iteration will pick up the next story.

**If blocked for 2+ iterations on the same story:**
Document blockers and attempted approaches in progress.txt, then:
```
<promise>BLOCKED</promise>
```

---

## Important Rules

- Work on **ONE** story per iteration
- Commit frequently
- Keep CI green
- Read Codebase Patterns BEFORE starting work
- Write learnings AFTER completing work
- NEVER delete progress.txt — only append
