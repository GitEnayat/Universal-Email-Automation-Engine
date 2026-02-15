# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-15
### Added
-   **Library Support**: Documented how to use the engine as a library in other projects.
-   **Send Mode**: Added `emailAction: "SEND"` configuration to optionally send emails immediately instead of just drafting.
-   **Template Guide**: Added a clear "Authoring Guide" for end-users in README.
-   **Limits Documentation**: Added explicit "Limitations & Quotas" section to manage expectations.

### Changed
-   **Documentation Refresh**: Rewrote README and ARCHITECTURE docs to fully align with the tool's "Internal Automation" positioning. Removed marketing buzzwords in favor of grounded engineering terms.
-   **Naming Standardization**: Unified project naming to "Google Workspace Email Orchestrator".
-   **Scheduler API**: Corrected documentation for `Scheduler.scheduleReport`.

## [1.0.0] - 2026-01-20
### Initial Release
-   **Core Engine**: Logic for parsing Google Docs and merging with Sheet data.
-   **Draft Management**: Intelligent check for existing drafts to support "update" vs "create".
-   **Recipient Logic**: Resolution of email addresses from a central Directory sheet.
-   **HTML Rendering**: Custom renderer to convert Sheet ranges into HTML tables.
-   **Scheduling**: wrapper for Apps Script triggers.
