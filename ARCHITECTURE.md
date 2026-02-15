# Universal Email Automation Engine - Architecture

## System Overview

The Universal Email Automation Engine is a Google Apps Script-based framework that converts Google Doc templates into professional Gmail drafts, with support for dynamic data injection, recipient management, and HTML formatting.

## Module Structure

```
src/
├── config/
│   └── AppConfig.js              # Configuration management
├── core/
│   └── MailOrchestrator.js       # Main orchestration logic
├── integrations/
│   └── LinkRepository.js         # CMS link management
├── recipients/
│   └── RecipientService.js       # Distribution lists & signatures
├── rendering/
│   └── SheetTableRenderer.js     # Table HTML generation
├── template-engine/
│   └── TemplateService.js        # Template parsing & dictionary
└── utils/
    └── LoggerUtil.js             # Structured logging utility
```

## Module Dependencies

```
MailOrchestrator
├── AppConfig (configuration)
├── TemplateService
│   ├── Dictionary Engine (applyDictionary_)
│   ├── HTML Converter (convertElementToHtml_)
│   └── Table Renderer (processTables)
├── LinkRepository
├── RecipientService
└── GmailApp (external)
```

## Data Flow

1. **Initialization**: `MailOrchestrator` creates `AppConfig` with optional overrides
2. **Template Fetch**: `TemplateService.fetchTemplate()` parses Google Doc tabs
3. **Dictionary Processing**: `applyDictionary_()` replaces `{{TAGS}}` with dynamic values
4. **Link Injection**: `LinkRepository.injectManagedLinks()` processes `$LINK...$` tags
5. **Recipient Resolution**: `RecipientService.resolveRecipients()` maps tags to emails
6. **Signature Generation**: `RecipientService.generateUserSignature()` adds user signature
7. **Draft Creation**: `GmailApp.createDraft()` or `draft.update()` creates/updates draft

## Key Components

### 1. AppConfig (src/config/AppConfig.js)
**Purpose**: Centralized configuration with environment overrides

**Key Features**:
- Default values for all required settings
- Constructor accepts override object
- Backward compatibility aliases (Lib_Config)
- Validation helper (`validateConfig()`)

**Configuration Categories**:
- Template source (Google Doc ID)
- Distribution lists (Sheet ID, tabs, columns)
- Link repository (CMS Sheet ID, columns)
- Assets (Logo file ID, signature tab)

### 2. MailOrchestrator (src/core/MailOrchestrator.js)
**Purpose**: Main entry point and workflow coordination

**Key Functions**:
- `generateEmailDraft()`: Primary function for single template
- `generateBatchDrafts()`: Batch processing multiple templates
- `createReportDraft()`: Backward compatibility alias
- `onOpen()`: Sheets UI menu registration

**Workflow**:
1. Validate config
2. Fetch and parse template
3. Process dictionary tags
4. Inject managed links
5. Resolve recipients
6. Generate signature
7. Check for existing drafts (recycling)
8. Create or update Gmail draft

**Error Handling**:
- Try/catch around Gmail API calls
- Null-safety checks (e.g., `draftSubject && draftSubject.indexOf()`)
- Graceful degradation (returns empty arrays/objects on failure)

### 3. TemplateService (src/template-engine/TemplateService.js)
**Purpose**: Google Doc parsing and template processing

**Key Functions**:
- `fetchTemplate()`: Extracts content from Doc tabs
- `applyDictionary_()`: Processes `{{TAGS}}` with dynamic values
- `convertElementToHtml_()`: Converts Doc elements to HTML
- `parseDateToken_()`: NLP date parsing ("next monday", "monthstart", etc.)

**Supported Dictionary Tags**:
- `{{DATE:Today-1}}` - Date arithmetic
- `{{RANGE:MonthStart:Today}}` - Date ranges
- `{{TIME:BKK}}` - Time with timezone
- `{{MONTHNAME:-1}}` - Month names
- `{{RAMCO}}` - RAMCO billing cycles
- `{{GREETING}}` - Time-based greeting
- `{{ACTIVE_SPREADSHEET_LINK}}` - Dynamic URLs

**HTML Conversion**:
- Paragraphs → `<p>`
- List items → `<li>` (wrapped in `<ul>` or `<ol>`)
- Tables → `<table>` with inline styles
- Horizontal rules → `<hr>`
- Preserves formatting (bold, links, colors)

### 4. LinkRepository (src/integrations/LinkRepository.js)
**Purpose**: Centralized link management via Google Sheet

**Key Functions**:
- `loadLinkRepository()`: Fetches links from CMS sheet
- `injectManagedLinks()`: Replaces `$LINK:Key, TEXT:Label$` with `<a>` tags

**Link Tag Format**:
```
$LINK:Report_URL, TEXT:Click Here$
```

**Features**:
- HTML healing (strips formatting from within tags)
- Direct URL fallback (if key is already a URL)
- Error highlighting for missing keys

### 5. RecipientService (src/recipients/RecipientService.js)
**Purpose**: Distribution list management and signature generation

**Key Functions**:
- `resolveRecipients()`: Maps role tags to email addresses
- `generateUserSignature()`: Creates HTML signature with logo

**Caching**:
- `_DISTRO_CACHE_DATA`: Caches distribution list for single execution
- `CacheService`: Caches Base64 logo (6-hour TTL, 75KB limit)

**Signature Template Variables**:
- `{{Sender_Name}}`
- `{{Sender_Role}}`
- `{{First_Email}}`
- `{{Second_Email}}`
- `{{Signature_Logo}}`

### 6. SheetTableRenderer (src/rendering/SheetTableRenderer.js)
**Purpose**: Converts Google Sheet ranges to HTML tables

**Key Functions**:
- `processTables()`: Scans for `[Table]` tags and replaces with HTML
- `buildHtmlTableFromSheet_()`: Generates styled HTML table

**Table Tag Format**:
```
[Table] Sheet: <URL_OR_ID>, range: 'SheetName'!A1:D10
```

**Features**:
- Preserves formatting (colors, fonts, alignment)
- Handles merged cells (rowspan/colspan)
- Empty row trimming
- Hidden column detection
- Responsive column widths

## Security Considerations

1. **Data Privacy**: All processing within Google Workspace (no external APIs)
2. **Script Authorization**: Requires Gmail, Drive, Sheets, and Docs permissions
3. **No Secrets in Code**: All IDs configurable via AppConfig overrides
4. **Input Validation**: Config validation helper checks required fields

## Performance Optimizations

1. **Caching**:
   - Distribution lists cached per execution
   - Logo Base64 cached in CacheService (6 hours)
   - Link repository loaded once per batch

2. **Batch Processing**:
   - `generateBatchDrafts()` reuses config and link map
   - Reduces redundant API calls

3. **Draft Recycling**:
   - Updates existing drafts instead of creating duplicates
   - Reduces Gmail clutter

## Error Handling Strategy

1. **Graceful Degradation**:
   - Missing templates return null (not crash)
   - Missing links show error span (not crash)
   - Missing recipients return empty array

2. **Logging**:
   - Structured logging with timestamps
   - Module-specific loggers
   - Emoji indicators for quick scanning

3. **User Feedback**:
   - UI alerts for critical errors
   - Inline error messages in HTML (red spans)
   - Detailed logs in Apps Script dashboard

## Extension Points

1. **New Dictionary Commands**:
   Add case to `applyDictionary_()` switch statement

2. **New Template Variables**:
   Add replacement in `generateUserSignature()`

3. **Custom Validators**:
   Extend `validateConfig()` with project-specific checks

4. **Pre/Post Processing**:
   Hook into `generateEmailDraft()` before/after draft creation

## Testing Strategy

Recommended test coverage:

1. **Unit Tests** (Pure Functions):
   - `parseDateToken_()`: Date arithmetic
   - `applyDictionary_()`: Tag replacement
   - `parseRecipientKeys()`: Key parsing
   - `fixMissingQuotes_()`: Range formatting

2. **Integration Tests**:
   - End-to-end draft creation
   - Config validation
   - Batch processing

3. **Manual Testing**:
   - UI menu functions (requires bound script)
   - Gmail rendering across clients
   - Sheet table formatting

## Deployment

1. **Library Deployment**:
   - Deploy as Apps Script Library
   - Share Script ID with users
   - Version control for updates

2. **Client Usage**:
   ```javascript
   function runReport() {
     EmailEngine.generateEmailDraft("MyTemplate");
   }
   ```

3. **Configuration**:
   - Copy AppConfig with project-specific IDs
   - Override via constructor or per-call

## Known Limitations

1. **Execution Time**: 6-minute Apps Script limit
2. **Cache Size**: 100KB limit for CacheService
3. **Gmail Quotas**: Daily sending limits apply
4. **CSS Support**: Limited to inline styles for email compatibility

## Risk Mitigations Implemented

### Batch Processing Rate Limits
- **Mitigation**: 5-minute execution time check with early exit
- **Mitigation**: 500ms delay between iterations to prevent API throttling
- **Result**: Templates skipped gracefully if time limit approached

### UI Context Safety
- **Mitigation**: `isUiContextAvailable_()` helper checks for container-bound context
- **Mitigation**: All UI functions wrapped in try/catch blocks
- **Result**: Graceful failure with helpful error messages in standalone mode

## Future Enhancements

1. **Structured Logging** (6.1): ✅ Implemented
2. **Config Validation** (6.2): ✅ Implemented
3. **Batch Processing** (6.6): ✅ Implemented
4. **UI Menu** (6.8): ✅ Implemented
5. **Unit Tests** (6.5): ✅ Implemented
6. **Documentation**: ✅ ARCHITECTURE.md (this file)

---

*Last Updated: 2026-02-15 17:00*
*Version: 1.0 - All Items Complete*
