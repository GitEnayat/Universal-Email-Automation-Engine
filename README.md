# 📧 Universal Email Automation Engine

[![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-Compatible-green)](https://developers.google.com/apps-script)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status: Production](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)](https://github.com/anomalyco/opencode)
[![Code Style: JSDoc](https://img.shields.io/badge/Code%20Style-JSDoc-blue)](https://jsdoc.app/)

> **A robust Google Apps Script tool that bridges the gap between raw data and professional communication.**

### ⚡ Quick Start: The "TL;DR"

- **What:** A library that turns Google Doc tabs into high-fidelity Gmail drafts.
    
- **Who:** Built for **Operations, WFM, Analytics, HR, Finance, and Logistics teams**—or any organization managing high-volume, data-driven reporting across various industries.
    
- **Value:** Zero-code template management. Updates to Sheets or Docs propagate to emails instantly.
    
- **Impact:** Reduces manual report creation time by ~90% and eliminates copy-paste errors.
    

## 📖 What is this?

The **Universal Email Automation Engine** helps you send complex, data-heavy emails without writing a new script for every report.

It separates the **content** from the **code**. This means your team can update email templates in Google Docs and manage recipient lists in Google Sheets, while this engine handles the messy work of HTML formatting, token replacement, and secure delivery behind the scenes.

## 💡 The Problem This Solves (The "Why")

In high-volume environments like **Workforce Management (WFM)** or Operations, the journey from data to delivery is broken:

- **The Daily Grind:** Every morning, you open 10 spreadsheets, copy ranges, paste them into Gmail, fix broken borders, and pray the numbers are right.
    
- **The "Oops" Moments:** Sending an old report to a new manager or forgetting to change "Good Morning" to "Good Evening."
    
- **Maintenance Debt:** Hardcoding email addresses inside scripts is a nightmare—every staff change requires a developer to edit code.
    

**This engine transforms that workflow:**

1. **Sheet-to-HTML & Doc-to-HTML:** It generates tables that look exactly like your spreadsheet (colors, borders, and all) while simultaneously converting Google Doc structures (headings, lists, bolding) into professional HTML email bodies.
    
2. **Dynamic Roles:** You can connect this to your internal headcount or user file. The engine dynamically adds all recipients as long as they carry the correct tags or roles (e.g., Managers, Team Leaders, Analysts), removing manual maintenance.
    
3. **Modular Library:** One central "Engine" powers dozens of different "Client" report scripts. It is incredibly easy to scale and add new reports without writing new logic. Once installed, it is simple to maintain; a single update to the library propagates to all your reports instantly.
    

## 🏗️ System Architecture & Engineering

I designed this as a scalable system, not just a quick-fix script.

### 1. Smart Drafts (Idempotency)

Automation can be scary if it runs twice. This engine features **"Safe Draft Recycling."** Before creating a new email, it checks your Drafts folder. If a draft with the same subject exists, it _updates_ it instead of creating a duplicate.

### 2. Built for Non-Coders (The Dynamic Dictionary)

Stakeholders can "program" their own emails directly in a Google Doc using a **Domain-Specific Language (DSL)**. To use these, simply type the tag exactly as shown (including curly braces) anywhere in your document body or subject line.

#### **A. Time & Greeting Tags**

- `{{GREETING}}`: Smart logic that checks the current hour to say "Good Morning", "Good Afternoon", or "Good Evening".
    
- `{{TIME:BKK}}`: Inserts the current time for a specific region (e.g., Bangkok).
    
- `{{TIME:MYT}}`: Inserts current time in Malaysia Time.
    

#### **B. Advanced Date Math**

The engine supports dynamic date calculations so you never have to manually type a date again.

|Input Syntax|Example Result (If Today is 19-Jan)|
|---|---|
|`{{DATE:Today}}`|**19-Jan-2026**|
|`{{DATE:Today-1}}`|**18-Jan-2026** (Yesterday)|
|`{{DATE:Today+7}}`|**26-Jan-2026** (Next week)|
|`{{DATE:MonthStart}}`|**01-Jan-2026**|
|`{{RANGE:MonthStart:Today}}`|**01-Jan-2026 – 19-Jan-2026**|
|`{{MONTH}}`|**January**|

#### **C. Data Injection**

- `[Table] Sheet: <ID>, range: 'Tab'!A1:D10`: Injects a live data range from any Google Sheet you have access to.
    

## 🖼️ Visual Example: From Doc to Inbox

### 1. The Template (Google Doc Tab)

    [TO] Mangers , Leaders 
    [CC] TeamA
    
    [SUBJECT]  Ops Update - {{DATE:Today}}
    [BODY]
    Hi Team, {{GREETING}} 
    Here is the performance for the previous shift:
    
    [Table] Sheet: URL..., range: 'Daily_Stats'!A1:E10
    
    Regards,
     {{SIGNATURE}}

     
### 2. The Result (Gmail Draft)


    to: manger1@company.com , leader1@company.com, leader2@company.com 
    cc: TeamA@company.com
    
    Subject:Ops Update - 01-01-2026

    Hi Team, Good Morning, 
    
    Here is the performance for the previous shift:
    
    |... ( A table Styled with borders and colors from Sheets)
      
      Regards,
      
    Professional User Signature$$


## ✨ Core Components & Setup

### 👥 Dynamic Distribution Lists (The Address Book)

Instead of managing static lists for every report, create a centralized tab in your Sheet. The engine parses this structure to find recipients based on their **Functional Roles** (e.g., Manager, Team Leader, Analyst) or **Specific Teams** (e.g., Team A, Team B).

|Name|Email|Role Key 1|Role Key 2|
|---|---|---|---|
|John Doe|`john@company.com`|`Manager`|`Team_A_Leads`|
|Jane Smith|`jane@company.com`|`Team_B_Analysts`|`WFM_Updates`|

- **Role-Based Parsing:** You can call a "Role Key" in your script, and the engine will automatically find everyone tagged with that role. For example, calling `Team_A_Leads` collects all Managers and Leads associated with that specific group.
    
- **Scalability:** If you link this to an internal headcount file, the email recipients update automatically whenever someone is promoted or moves teams—no code edits required.
    

### ✍️ Professional Signatures

The engine fetches your professional signature from a centralized `User_Profiles` sheet. This ensures that even if a bot creates the draft, it looks like it came directly from you, complete with branding and contact links.

### 🎨 High-Fidelity Table Rendering

Gmail's CSS support is limited. My `TableRenderer` converts modern Google Sheet formatting into **inline CSS styles** and handles **merged cells** (rowspan/colspan), ensuring your data looks professional on Outlook, Gmail Mobile, and Desktop.

## 🚀 Usage Guide

### Phase 1: Deployment

1. Open the project code and click **Deploy** > **New Deployment** > **Library**.
    
2. Copy the **Script ID**.
    

### Phase 3: Implementation

In your client script, add the Library and use the following code:

```
// Basic usage: One-time install, use forever
function runMorningReport() {
  // Finds everyone tagged with "Morning_Status" role
  EmailEngine.createReportDraft("Morning_Status");
}

// Advanced: Use a specific template doc for a one-off project
function runOneOffReport() {
  EmailEngine.createReportDraft("Project_Alpha", {
    docId: "INSERT_GOOGLE_DOC_ID_HERE"
  });
}
```

## 🛡️ Security & Reliability

- **Data Privacy:** All processing happens within your Google Workspace tenant. No data ever leaves your organization's ecosystem.
    
- **Service Limits:** Optimized to handle complex templates within Google Apps Script's 6-minute execution window.
    
- **Platform Awareness:** Engineered specifically to bypass Gmail's legacy CSS constraints by using inline style injection.
    

## 👤 Author & Engineering Philosophy

Built by **Enayatullh**

This project reflects a commitment to **Systems Thinking**. Instead of solving one problem for one person, I built a modular framework that solves a category of problems for an entire organization.

- **Engineering Impact:** Automated 15+ daily operational reports, saving an estimated 10+ hours of manual toil per week.
    
- **Core Skills:** JavaScript (ES6+), Google Workspace APIs, Regex Parsing, HTML/CSS Optimization.
    
- **Contact:**
    
    

_© 2026 Universal Email Automation Engine. Released under MIT License._
