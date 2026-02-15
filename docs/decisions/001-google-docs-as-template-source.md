# ADR 001: Google Docs as Template Source

## Status
**Accepted**

## Context
We needed to determine how users would create and manage email templates for the automation engine. The options considered were:

1. **HTML files in the repository** - Traditional approach for web apps
2. **Google Docs** - Native to the Google Workspace ecosystem
3. **Google Sheets** - Data-oriented approach
4. **Plain text in Script Properties** - Quick but inflexible

## Decision
We chose **Google Docs** as the primary template source.

## Consequences

### Positive
- **Accessibility for non-developers**: Operations teams, managers, and analysts can edit templates without touching code
- **Rich formatting**: Native support for bold, colors, tables, and styling
- **Version history**: Google Docs automatically tracks changes
- **Collaboration**: Multiple users can edit simultaneously with comments
- **Familiar interface**: No training required for Google Workspace users
- **Template inheritance**: Tab-based organization allows template variations

### Negative
- **No local development**: Templates can't be version-controlled in git
- **External dependency**: Relies on Google Docs availability
- **Parsing complexity**: Must convert Doc structure to HTML
- **No IDE support**: No syntax highlighting for template tags

## Rationale

The primary goal of this project is to enable **Operations teams** (WFM, Analytics, HR) to self-serve their reporting needs without Engineering support. 

By using Google Docs:
- Template changes require zero deployment
- Domain experts own their content
- Stakeholders can review templates visually
- The barrier to entry is essentially zero

This aligns with the principle of **"Config over Code"** for operational tools.

## Related Decisions
- ADR 003: Inline CSS Rendering (related to Doc → HTML conversion)
- ADR 002: Draft Recycling Strategy (idempotency for safe re-runs)

## References
- [Template Format Documentation](../template-format.md)
- [Architecture Overview](../../ARCHITECTURE.md)

---
*Decided: 2026-02-15*  
*Deciders: Enayatullah (Lead Engineer)*  
*Stakeholders: WFM Operations, Analytics Teams*
