# Contributing

Hi there! 👋 Thanks for checking out the Google Workspace Email Orchestrator.

This project is a lightweight, internal tool designed to make life easier for Operations and HR teams. It's not a massive enterprise framework, just a practical set of scripts to automate a common problem.

If you have ideas to make it better, I'd love to see them.

## 🛠️ Local Development (clasp)

We use `clasp` to develop locally and push to Google Apps Script.

### Prerequisites
- Node.js installed
- Google Clasp installed: `npm install -g @google/clasp`

### Setup
1.  **Login**: `clasp login`
2.  **Clone**: `clasp clone <script-id>` (if you have the ID)
3.  **Push**: `clasp push` to sync your local changes to the Apps Script project.

**Note on Folder Structure**:
Locally, we use folders like `src/core` and `src/recipients` to keep things organized. When pushed to Apps Script, these flatten into filenames like `core_MailOrchestrator.gs`. This is normal behavior for Apps Script!

## 🧪 Testing

This engine interacts with real Gmail and Drive files, so safety is key.

**Always tests your changes:**
1.  **Dry Run**: Run `generateEmailDraft("TemplateName", { dryRun: true })`. Check the logs to see what *would* have happened.
2.  **Test Mode**: Run with `testMode: true` to force emails to go only to you, ignoring the real distribution list.

## 📝 Coding Style

-   **Keep it Simple**: We prioritize readability over clever one-liners.
-   **No 3rd Party Deps**: We avoid external libraries to keep the project portable and dependency-free.
-   **JSDoc**: Please add basic JSDoc comments to functions so we know what they do.

## 📦 Submitting a PR

1.  Fork the repo.
2.  Create your feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes.
4.  Open a Pull Request.

Thanks for helping make this tool better! 🚀
