# Roadmap

This project is stable and operational. Future development focuses on reliability, ease of use for template authors, and internal maintainability.

## 📍 Near Term
-   **Validation Improvements**: Better error messages when a template tag is misspelled or missing.
-   **Performance**: Optimize table rendering for very large datasets (currently optimized for <100 rows).
-   **Enhanced Logging**: Add more granular status codes to the System Log for better debugging.

## 🔭 Long Term
-   **Sidebar UI**: A simple Google Doc sidebar to validate the template without running a full script test.
-   **Simplified Renderer**: An option for "Simple HTML" tables that works better on mobile devices (less strict formatting preservation).
-   **Portability**: Investigation into porting the logic to Node.js / Microsoft Graph for non-Google environments.

## ❌ Not Planned
-   **Marketing Features**: Unsubscribe links, bounce tracking, or analytics pixels. This is an internal tool.
-   **SaaS-ification**: Multi-tenant database support. The tool is designed to run in *your* tenant.
