# ADR 003: Inline CSS Rendering

## Status
**Accepted**

## Context
Gmail has limited CSS support. We needed to decide how to convert rich Google Docs formatting into email-safe HTML:

1. **External stylesheets** - Clean code, but Gmail strips `<style>` tags
2. **CSS classes** - Maintainable, but Gmail strips `class` attributes
3. **Inline styles** - Verbose, but universally supported
4. **Plain text only** - Safe, but loses all formatting

## Decision
We chose **Inline CSS only** - all styles applied directly to HTML elements via `style="..."` attributes.

## Consequences

### Positive
- **Maximum compatibility**: Works in Gmail, Outlook, Apple Mail, mobile clients
- **Pixel-perfect rendering**: Exact control over appearance
- **Preserves Doc formatting**: Colors, fonts, borders all transfer accurately
- **No external dependencies**: No reliance on external CSS files
- **Predictable**: No cascading surprises

### Negative
- **HTML bloat**: Large file sizes (5-10x larger than class-based CSS)
- **Hard to maintain**: Can't change "all headers" in one place
- **Duplication**: Same styles repeated across elements
- **File size limits**: Large emails might hit Gmail size limits
- **Not DRY**: Violates "Don't Repeat Yourself" principle

## Rationale

### The Gmail Constraint
Gmail strips:
- `<style>` tags in `<head>`
- `<style>` tags in `<body>`
- `class` and `id` attributes
- External stylesheets
- Many CSS properties (position, float, etc.)

**Reference**: [Gmail CSS Support Guide](https://developers.google.com/gmail/design/css)

### Why not compromise?
Some clients support classes, but Gmail has 1.5B+ users. If it doesn't work in Gmail, it doesn't work for business communication.

### Engineering Trade-off
We prioritized **user experience** (reliable rendering) over **developer experience** (maintainable CSS).

## Implementation Details

### Style Generation
```javascript
// From Google Doc
const fg = textObj.getForegroundColor(i);
const bg = textObj.getBackgroundColor(i);
const bold = textObj.isBold(i);

// To inline CSS
const style = `color:${fg};background-color:${bg};font-weight:${bold ? 'bold' : 'normal'};`;
```

### Table Rendering
Tables are the most complex - we preserve:
- Column widths (converted to pixels)
- Background colors
- Font properties
- Borders (inline `border:` style)
- Cell alignment

### File Size Management
- **Automatic trimming**: Empty table rows are removed
- **Whitespace collapse**: Multiple spaces compressed
- **Image optimization**: Logos use Base64 (cached)
- **Row limit**: Keep only last 1000 execution logs

## Alternatives Considered

### CSS Inlining Libraries
Tools like `premailer` or `juice` could inline CSS automatically, but:
- Not available in Google Apps Script
- Add external dependencies
- Don't understand Google Docs API

### Plain Text
Considered for ultra-reliable delivery, but:
- Tables become unreadable
- Branding is lost
- Stakeholders expect professional formatting

## Related Decisions
- ADR 001: Google Docs as Template Source (source of rich formatting)
- [SheetTableRenderer](../../src/rendering/SheetTableRenderer.js) - Complex table handling

## References
- [CSS Support in Email Clients](https://www.campaignmonitor.com/css/)
- [Gmail CSS Guide](https://developers.google.com/gmail/design/css)
- [Architecture Overview](../../ARCHITECTURE.md#high-fidelity-table-rendering)

---
*Decided: 2026-02-15*  
*Deciders: Enayatullah (Lead Engineer)*  
*Stakeholders: UI/UX, Email Deliverability*
