# Google Workspace Email Orchestrator

[![Google Apps Script](https://img.shields.io/badge/Platform-Google%20Apps%20Script-blue)](https://developers.google.com/apps-script)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status: Operational](https://img.shields.io/badge/Status-Operational-green)](https://github.com/anomalyco/opencode)

> **An internal automation tool designed to eliminate manual reporting toil in Google Workspace environments.**

This project is a configuration-driven engine that merges **Google Doc templates** with **Google Sheet data** to generate formatted Gmail drafts. It is intended for Operations, HR, and Finance teams who regularly send recurring, data-driven emails using Docs, Sheets, and Gmail.

---

## 🎯 Scope & Positioning

### What this is
-   **An Internal Workflow Tool**: Designed for teams already using Google Workspace.
-   **A "Glue" Layer**: Connects Docs (content), Sheets (data/config), and Gmail (delivery).
-   **Operational Automation**: Intended for daily reports, shift updates, and team notifications.

### What this is NOT
-   **Not a Marketing Platform**: This is not a replacement for Mailchimp or SendGrid. It is not designed for mass external mailing lists.
-   **Not a SaaS Product**: It allows internal teams to maintain and adjust their own workflows without needing frequent developer involvement.
-   **Constrained by Quotas**: It respects Google Apps Script execution limits (6 min/run) and email quotas.

---

## 📦 Using as a Library

This engine is designed to be installed as a **Library** in your Google Apps Script projects. This allows multiple scripts (e.g., one for HR, one for Ops) to share the same core logic.

### Installation
1.  Open your Google Apps Script project.
2.  Click **Libraries +**.
3.  Enter the Script ID of this engine.
4.  Select the latest version and save.

### Example Runner
Once installed, you can call the engine from your own scripts:

```javascript
/**
 * @OnlyCurrentDoc
 */
function sendWeeklyReport() {
  // 1. Define your config overrides
  const config = {
    templateDocumentId: "1234567890abcdef...",
    directorySheetId: "9876543210zyxwv...",
    emailAction: "DRAFT" // or "SEND"
  };

  // 2. Call the Engine
  // 'EmailEngine' is the identifier you gave the library
  EmailEngine.generateEmailDraft("Weekly_Status", config);
}
```

---

## 💻 Developer Workflow (clasp)

We use `clasp` (Command Line Apps Script Projects) to manage this code locally.

### Setup
```bash
npm install -g @google/clasp
clasp login
```

### Folder Structure
The repository is structured for local development but flattens upon deployment to Apps Script.

```
/src
  /config       -> Config management
  /core         -> Main orchestration logic
  /recipients   -> Directory & signature handling
  /rendering    -> HTML table generation
  /template-engine -> Doc parsing & token replacement
```

### Pushing Code
```bash
clasp push
```
*Note: This will upload the `src/` folder to the bound Apps Script project.*

---

## 📝 Template Authoring Guide

Templates are created in **Google Docs**. The engine parses them and replaces special tags with data.

### 1. Basic Replacement
Use `{{KEY}}` tags to inject text.
-   **Template**: `Hello {{FirstName}},`
-   **Result**: `Hello Alice,`

### 2. Date Logic
The engine understands natural language date tokens.
-   `{{DATE:Today}}` → `15-Feb-2026`
-   `{{DATE:Next Monday}}` → `16-Feb-2026`
-   `{{GREETING}}` → `Good Morning` (based on time of day)

### 3. Injecting Data Tables
To embed a live range from a Google Sheet, use the `[Table]` tag:
```
[Table] Sheet: <Spreadsheet_ID>, range: 'Q1_Results'!A1:E10
```
-   **Formatting**: The engine preserves your Sheet's background colors, borders, and font styles.

### 4. Managed Links
Use `$LINK:Key, TEXT:Label$` to inject URLs managed in your central configuration sheet.
-   **Template**: `Please update the $LINK:Tracker_Sheet, TEXT:Project Tracker$`
-   **Result**: `Please update the <a href="...">Project Tracker</a>`

---

## ⚡ Core Problem Solved

In many organizations, analysts and operations staff often spend hours manually copying data from spreadsheets into emails, formatting tables, and checking distribution lists. This "copy-paste" tax slows down operations and introduces errors.

This engine solves that by:
1.  **Centralizing Content**: Templates live in Google Docs (easy for non-technical users to edit).
2.  **Centralizing Logic**: Distribution lists and settings live in Google Sheets.
3.  **Automating Assembly**: The script handles the merge, formatting, and draft creation.

---

## 🛠️ Design Principles

### 1. Safety & Idempotency
Because this tool is meant to run frequently, safety and repeatability were key priorities.
-   **Draft Recycling**: The engine checks for existing drafts before creating new ones. If a draft exists, it updates the content instead of creating a duplicate.
-   **Dry Run Mode**: `generateEmailDraft("Report", { dryRun: true })` logs actions without touching Gmail.
-   **Test Mode**: `userOverrides: { testMode: true }` forces all emails to go to the developer, ignoring real recipients.

### 2. "Fail Fast" Architecture
To prevent partial failures (e.g., sending half a batch):
-   **Pre-flight Validation**: Templates and configuration are validated for missing tags or invalid IDs before any data processing begins.
-   **Atomic Recipient Checks**: Execution halts immediately if no valid recipients are resolved.

### 3. Observability
-   **Structured Logging**: Every execution is logged to a `System_Logs` sheet with timestamp, duration, status (CREATED/UPDATED/ERROR), and mode (PROD/TEST/DRY_RUN).
-   **Audit Trail**: This allows non-technical administrators to see who ran a report and when.

---

## 🚀 Usage

### 1. Simple Execution
```javascript
function runMorningReport() {
  // Generates draft based on "Morning_Status" tab in the Template Doc
  EmailEngine.generateEmailDraft("Morning_Status");
}
```

### 2. Developer Options
```javascript
function debugReport() {
  EmailEngine.generateEmailDraft("Morning_Status", {
    dryRun: true,      // Log output only
    testMode: true,    // Send to current user only
    templateDocumentId: "..." // Override source doc for testing
  });
}
```

### 3. Scheduling
Wraps the Apps Script implementation of time-based triggers:
```javascript
function setupTriggers() {
  // Schedule report for 8:00 AM daily
  Scheduler.scheduleReport("Morning_Status", {
    frequency: "daily",
    hour: 8
  });
}
```

### 4. Auto-Send Configuration
By default, the engine only creates **Drafts** for safety. To send emails immediately:
```javascript
function runAndSend() {
  EmailEngine.generateEmailDraft("Morning_Status", {
    emailAction: "SEND" // Options: "DRAFT" (default) or "SEND"
  });
}
```
*Note: In `SEND` mode, the script still updates an existing draft if one exists, then sends it. This prevents duplicate threads.*

---

## 🏃 Running in Apps Script (Manual Setup)

You don't need clasp or Node.js to use this. Here's how to deploy manually:

1. Open Google Sheets or go to [script.google.com](https://script.google.com) and create a standalone project
2. Go to **Extensions → Apps Script**
3. Copy the contents of each `.gs` file from this repo into the script editor (create new files as needed)
4. Update the IDs in `Config.gs` with your actual Google Doc and Sheet IDs
5. Run the `generateEmailDraft()` function manually from the editor, or set up a trigger

That's it. No build steps, no dependencies.

---

## 🔐 Permissions & OAuth Scopes

When you first run this script, Google will ask for permission to access:

- **Gmail** - Create and manage drafts
- **Google Docs** - Read your template documents
- **Google Sheets** - Read data tables and configuration
- **Google Drive** - Access logo and signature files

Everything runs inside your own Google Workspace. No data leaves Google's servers, and no external APIs are called. The script only accesses documents you explicitly configure.

---

## 📁 Example Client Project Structure

Here's how a client project using this library might look:

```
MyDailyReports/
├─ Code.gs          # Main runner functions
└─ Triggers.gs      # Time-based trigger setup
```

**Code.gs:**
```javascript
function sendMorningShiftReport() {
  // Call the library with your template
  EmailEngine.generateEmailDraft("Morning_Shift", {
    testMode: false,
    dryRun: false
  });
}

function testBeforeDeploy() {
  // Safety check before going live
  EmailEngine.generateEmailDraft("Morning_Shift", {
    testMode: true,
    dryRun: true
  });
}
```

---

## ⚠️ Limitations & Quotas

This is a practical tool with real constraints:

- **6-minute execution limit** - Apps Script will timeout. For large batches, use `generateBatchDrafts()` which has built-in time checks
- **Gmail daily quotas** - Google Workspace: 1,500 emails/day. Consumer accounts: 100/day. This creates drafts, not sends, so limits are generous
- **Cache size** - 100KB limit for logo caching. Large logos skip cache gracefully
- **Internal use only** - Built for operational emails within your organization. Not designed for bulk marketing campaigns

These limits are sufficient for daily operational reports but keep them in mind when designing your workflow.

---

## 🌍 Where this fits

This project is intentionally built for the Google Workspace ecosystem, where Docs, Sheets, and Gmail are already part of daily operations.

The goal is not to compete with enterprise automation platforms, but to solve a common team-level problem: removing manual reporting work using the tools analysts already use.

The underlying pattern — combining templates, structured data, and automated delivery — exists in every workplace. In other environments, similar workflows might be implemented using tools like Microsoft Graph, Power Automate, or serverless functions.

This repository demonstrates the approach in a Google Workspace context.

---

## 👤 Author context

**Enayatullh**
*Operations Engineer*

I built this tool to solve a recurring friction point I observed in WFM (Workforce Management) teams: analysts spending time on manual email formatting. This project represents my approach to **Systems Thinking**—building reusable tooling to solve categories of problems.

---
_License: MIT_
