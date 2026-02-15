# Contributing to Universal Email Automation Engine

Thank you for your interest in contributing! This project follows standard open-source practices for Google Apps Script development.

## Getting Started

### Prerequisites
- Google Workspace account with access to Apps Script
- Access to Google Docs, Sheets, and Gmail
- Basic knowledge of JavaScript (ES6+)

### Development Setup
1. **Copy the Library**: Make a copy of the script in your Google Apps Script environment
2. **Create Test Documents**: Set up test Google Docs, Sheets, and drafts
3. **Enable Services**: Ensure Gmail, Drive, Sheets, and Docs APIs are enabled

## How to Contribute

### Reporting Bugs
When reporting bugs, please include:
- **Error message** (copy from Apps Script logs)
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Template content** (sanitized version)
- **Browser and OS** (if UI-related)

Use the bug report template:
```
**Bug**: Brief description
**Location**: File/Function name
**Error**: Full error message
**Reproduce**: 
1. Step 1
2. Step 2
```

### Suggesting Enhancements
Enhancement suggestions should include:
- **Use case**: Why is this needed?
- **Proposed solution**: How would it work?
- **Alternatives**: Other approaches considered
- **Impact**: Who benefits?

### Pull Request Process

1. **Fork and Branch**
   - Create a feature branch: `feature/your-feature-name`
   - For bugs: `fix/bug-description`

2. **Code Style Guide**
   - Use 2-space indentation
   - Follow JSDoc commenting for all functions
   - Use meaningful variable names
   - Add comments for complex logic
   - Use `Log.info()`/`Log.error()` instead of `Logger.log()` in new code

3. **Testing**
   - Run the test suite: `testRunner()`
   - Add tests for new pure functions in `tests/TestRunner.js`
   - Test in dry-run mode first: `generateEmailDraft("Template", { dryRun: true })`
   - Test in test mode: `generateEmailDraft("Template", { testMode: true })`

4. **Documentation**
   - Update relevant `.md` files
   - Add JSDoc comments to new functions
   - Update ARCHITECTURE.md if architecture changes

5. **Submit PR**
   - Clear description of changes
   - Reference any related issues
   - Screenshots/GIFs for UI changes
   - Test results summary

## Code Standards

### Function Naming
- Public functions: `camelCase` (e.g., `generateEmailDraft`)
- Private helpers: `camelCase_` with trailing underscore (e.g., `parseDateToken_`)
- Test functions: `testFunctionName` (e.g., `testParseDateToken`)

### Error Handling
```javascript
try {
  // Risky operation
} catch (e) {
  Log.error("ModuleName", `Operation failed: ${e.message}`);
  // Graceful fallback or re-throw
}
```

### Mode Flags
Always support these safety modes:
- `dryRun`: Log actions without side effects
- `testMode`: Override recipients to current user

### Configuration
- Use `AppConfig` class for all settings
- Add validation in `validateConfig()` for new required fields
- Support backward compatibility via aliases

## Project Structure

```
src/
├── config/          # Configuration management
├── core/            # Main orchestration
├── integrations/    # External service integrations
├── recipients/      # Distribution lists & signatures
├── rendering/       # HTML generation
├── template-engine/ # Template parsing
├── utils/           # Helper utilities
tests/               # Unit tests
```

## Testing Guidelines

### Pure Functions (High Priority for Tests)
- `parseDateToken_()`
- `applyDictionary_()`
- `parseRecipientKeys()`
- `fixMissingQuotes_()`
- `htmlToPlainText_()`

### Integration Testing
- End-to-end with `dryRun: true`
- Test mode with `testMode: true`
- UI functions in container-bound context

### Test Data
Use consistent test data:
- Template names: `"Test_Template"`
- Sheet ranges: `"'Test'!A1:D10"`
- Emails: `"test@example.com"`

## Commit Messages

Use conventional commits:
```
feat: Add new dictionary command
fix: Handle null subject in drafts
docs: Update ARCHITECTURE.md
refactor: Simplify recipient resolution
test: Add tests for date parsing
```

## Code Review Checklist

Before submitting PR:
- [ ] Code follows style guide
- [ ] Tests pass (`testRunner()`)
- [ ] Dry-run works without errors
- [ ] Documentation updated
- [ ] Backward compatibility maintained
- [ ] No hardcoded IDs or secrets
- [ ] Error handling in place

## Questions?

- **Architecture**: See [ARCHITECTURE.md](ARCHITECTURE.md)
- **Usage**: See [README.md](README.md)
- **Issues**: Create an issue with the question label

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Maintainers**: Enayatullah
**Project Status**: Production Ready
**Last Updated**: 2026-02-15
