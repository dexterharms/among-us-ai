# Work on Double Agent

Execute one complete implementation cycle for the Double Agent project, from task selection through PR creation.

## Context

| Resource | Path |
|----------|------|
| Codebase | `~/.dexter/projects/double-agent/` |
| Documentation | `~/.dexter/projects/double-agent/docs/` |
| Master Plan | `~/.dexter/projects/double-agent/docs/plans/double-agent.plan.md` |
| Linear Project | `double-agent` |

## Execution

### 1. Task Selection

Query Linear for issues in the `double-agent` project. Select the highest-priority task that is:
- Not already assigned or in progress
- Within current sprint scope (if applicable)

### 2. Implementation Verification

Before writing any code, compare current codebase state against the Master Plan specification for the selected task:
- If already correctly implemented → mark Linear issue "Done", return to step 1
- If partially implemented but broken → proceed with fix
- If not implemented → proceed with fresh implementation

### 3. Development Cycle

Execute the `dev-cycle` skill with these project-specific bindings:

```
Branch: double-agent/<issue-id>-<short-description>
Base: main
Test strategy: Use `coding-agents` skill for TDD workflow
Validation: Run Diffray locally before PR
```

**Required checkpoints:**
- [ ] Switched to main, pulled latest
- [ ] Created feature branch from main
- [ ] Tests written (via coding-agents skill)
- [ ] Implementation written
- [ ] Diffray validation passed locally
- [ ] Committed with descriptive message
- [ ] Pushed to origin
- [ ] PR created with summary linking to Linear issue

### 4. Cycle Validation

Verify every checkpoint in step 3 was completed. If any checkpoint failed:
- Fix the issue before proceeding
- Do not mark task complete until all checkpoints pass

### 5. Report

Output a concise summary:
- Linear issue ID and title
- Branch name
- PR URL (if created)
- Status: COMPLETE / BLOCKED / FAILED
- If blocked or failed: specific blocker and recommended next action
