# 📧 Universal Email Automation Engine

> **A robust Google Apps Script tool that bridges the gap between raw data and professional communication.**

## 📖 What is this?

The **Universal Email Automation Engine** helps you send complex, data-heavy emails without writing a new script for every report.

It separates the **content** from the **code**. This means your team can update email templates in Google Docs and manage recipient lists in Google Sheets, while this engine handles the messy work of HTML formatting, token replacement, and secure delivery behind the scenes.

**The Goal:** Stop wasting time copy-pasting tables and start sending perfect, consistent reports automatically.

## 💡 Why I Built This

If you've ever worked in **Workforce Management (WFM)** or Operations, you know the struggle:

- **The Daily Grind:** Every morning, you open 10 different spreadsheets, copy ranges, paste them into Gmail, fix the broken borders, update the date, and pray you didn't paste the wrong numbers.
    
- **The "Oops" Moments:** Accidentally leaving an old recipient on the CC line or forgetting to change "Good Morning" to "Good Afternoon."
    
- **The Code Mess:** Hardcoding email addresses like `manager@company.com` inside your scripts, meaning you have to edit code every time someone gets promoted.
    

**This engine solves that by:**

1. **Mimicking Google Sheets:** It generates HTML tables that look exactly like your spreadsheet (colors, borders, and all).
    
2. **Using "Role Keys":** You send to `Morning_Leads`, not specific email addresses. The script looks up who that is in a Google Sheet.
    
3. **One Script to Rule Them All:** A single library powers dozens of different reports.
    

## 🏗️ How it Works (Under the Hood)

I designed this as a scalable system, not just a quick-fix script. Here are the core principles:

### 1. Smart Drafts (No Spam Loops)

Automation can be scary. What if it runs twice? This engine features **"Safe Draft Recycling."** Before creating a new email, it checks your Drafts folder. If a draft with the same subject exists, it _updates_ it instead of creating a duplicate. This keeps your workspace clean and lets you re-run the script safely.

### 2. Built for Non-Coders

Your stakeholders shouldn't need to know JavaScript to change an email template. They can just write in a Google Doc using simple placeholders like:

- `{{DATE:Today}}`
    
- `[Table] Sheet: <ID>...`
    

### 3. Modular Design

The code is split into logical parts. The part that reads the Doc doesn't know about Gmail. The part that draws the table doesn't know about recipients. This makes the system incredibly stable and easy to upgrade.

### 📊 Data Flow

```
graph TD
    A[Google Sheet Data] -->|Fetch Range| B(TableRenderer)
    C[Google Doc Template] -->|Parse Tokens| D(TemplateEngine)
    E[Distribution List] -->|Lookup Emails| F(RecipientResolver)
    B --> G{DraftOrchestrator}
    D --> G
    F --> G
    G -->|Update or Create| H[Gmail Draft]
```

## ✨ Key Features Explained

### 📝 The Doc-to-HTML Engine

Instead of just finding and replacing text, this engine reads the structure of your Google Doc. It preserves your bold text, links, bullet points, and headers, converting them into clean HTML that Gmail understands.

### 🎨 The Table Renderer

Gmail is notoriously bad at displaying tables. This module reads your Google Sheet's raw data—including **merged cells** and **background colors**—and rebuilds them as a bulletproof HTML table. It looks great on desktop and mobile.

### ⏱️ Dynamic "Smart Tags"

The system uses a live dictionary to fill in the blanks at the exact moment the email is generated:

|   |   |
|---|---|
|**Tag**|**What it does**|
|`{{DATE:Today}}`|Inserts today's date (e.g., **19-Jan-2026**).|
|`{{DATE:Today+1}}`|Calculates tomorrow's date automatically.|
|`{{GREETING}}`|Checks the time and inserts "Good Morning" or "Good Afternoon".|
|`{{RAMCO}}`|Calculates complex payroll cycles (e.g., "16th Jan - 15th Feb").|

## 🚀 How to Use It

### Phase 1: Install the Library (One-Time Setup)

1. Open the Google Apps Script project containing this code.
    
2. Click **Deploy** > **New Deployment** > **Library**.
    
3. Copy the **Script ID**.
    

### Phase 2: Create Your Client Script

In any new script where you want to send emails:

1. Click **Libraries +**, paste the ID, and name it `EmailEngine`.
    
2. Set up your configuration and trigger:
    

```
function runMorningReport() {
  // 1. Pick the report you want to generate
  // (This must match the Tab Name in your Google Doc)
  const REPORT_KEY = "Morning_Status";

  // 2. Call the engine
  EmailEngine.createReportDraft(REPORT_KEY);
}
```

### Phase 3: Automate It (Optional)

To make this run automatically every day:

1. Go to the **Triggers** icon (alarm clock) in the left sidebar.
    
2. Click **Add Trigger**.
    
3. Select `runMorningReport`, choose **Time-driven**, and set it to run (e.g., Daily at 8 AM).
    

## 📖 Configuration Guide

### 1. The "Distribution" Sheet

Create a tab in your Google Sheet to act as your address book.

|   |   |   |
|---|---|---|
|**Report_Key**|**TO**|**CC**|
|**Morning_Status**|`boss@company.com`|`team@company.com`|
|**Weekly_Review**|`client@partner.com`|`internal@company.com`|

> **Tip:** You can put multiple emails in one cell separated by semicolons (`;`).

### 2. The Google Doc Template

- **Tab Name:** Rename the specific _tab_ inside your Doc to match the `Report_Key` (e.g., `Morning_Status`).
    
- **Body:** Write your email as usual.
    
- Tables: To insert a table, use this syntax on its own line:
    
    [Table] Sheet: <Spreadsheet_ID>, range: '<SheetName>'!A1:F20
    

## 📂 Project Structure

|   |   |
|---|---|
|**File**|**What it does**|
|**`Config.gs`**|Stores your IDs (Doc ID, Sheet ID) so you only have to change them in one place.|
|**`TemplateEngine.gs`**|The "Reader." It scans your Doc and finds the placeholders.|
|**`TableRenderer.gs`**|The "Artist." It draws the tables based on your Sheet data.|
|**`RecipientResolver.gs`**|The "Postman." It figures out who needs to receive the email.|
|**`DraftOrchestrator.gs`**|The "Manager." It coordinates everything and talks to Gmail.|

## 👤 Author

**Built by [Enayatullah Hassani]**

I built this project to solve a real problem: the disconnect between data and communication. It demonstrates how **Systems Engineering** can turn a fragile, manual process into a robust, automated workflow.

- **Tech Stack:** JavaScript (ES6+), Google Workspace APIs, Regex, HTML/CSS.
    
- **Contact:** [Your Email / LinkedIn]
    

_© 2026 Universal Email Automation Engine. Released under MIT License._
