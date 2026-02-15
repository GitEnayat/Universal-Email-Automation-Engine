# ADR 002: Draft Recycling Strategy (Idempotency)

## Status
**Accepted**

## Context
When automation runs repeatedly (scheduled triggers, manual re-runs), we need to decide how to handle existing Gmail drafts:

1. **Always create new drafts** - Simple, but creates clutter
2. **Update existing drafts** - Keeps inbox clean, maintains thread context
3. **Delete old + create new** - Clean slate each time
4. **Skip if exists** - Do nothing if draft already present

## Decision
We chose **Update existing drafts** (with fallback to create new).

The strategy:
1. Search existing drafts for matching subject
2. If found → `draft.update()` with new content
3. If not found → Search Gmail threads
4. If thread found → `createDraftReplyAll()` on existing thread
5. If no thread → `createDraft()` as new draft

## Consequences

### Positive
- **Idempotency**: Running the script N times produces the same outcome (1 draft)
- **Thread continuity**: Maintains conversation context in Gmail
- **No inbox spam**: Users don't get overwhelmed with duplicate drafts
- **Safe re-runs**: If automation fails mid-way, re-running won't create chaos
- **Draft feedback loop**: Users can update the draft manually before sending

### Negative
- **Subject collision**: Different templates with same subject will overwrite each other
- **Stale drafts**: Old drafts might contain outdated information temporarily
- **Thread hijacking**: Reply-all on wrong thread could notify wrong people
- **Complexity**: More code paths to test and maintain

## Rationale

### Why not "Always Create New"?
In high-frequency automation (hourly reports), this would overwhelm the drafts folder. After one week: 168 drafts for a single report.

### Why not "Delete + Create"?
Loses the "draft as review checkpoint" benefit. Users might be editing a draft when it's deleted.

### Why not "Skip if Exists"?
Prevents updates to stale data. A "Yesterday's Metrics" report would never update if the draft from yesterday still exists.

### Why "Update"?
- Treats the draft as a **living document** that reflects current data
- Users expect the latest report when they open their drafts
- Aligns with Gmail UX (drafts auto-save updates)

## Mitigations

1. **Subject collision**: Documented in UI warnings. Users should use unique subjects with dates: `"Report - {{DATE:Today}}"`
2. **Thread safety**: Out-of-office and auto-reply threads are filtered out
3. **Clear logging**: Every update is logged with "♻️ Found existing draft" message

## Related Decisions
- ADR 001: Google Docs as Template Source (content generation)
- Safety Modes: `dryRun` and `testMode` allow safe testing

## References
- [Core Orchestrator Logic](../../src/core/MailOrchestrator.js)
- [User Documentation](../../README.md#safe-draft-recycling)

---
*Decided: 2026-02-15*  
*Deciders: Enayatullah (Lead Engineer)*  
*Stakeholders: End Users, SRE Team*
