# PhysioTrack - PhysioTracklitation Web App (Capstone)

This project is a static frontend prototype for a lower-body telerehabilitation application. It includes pages for patients and clinicians, simulated live sessions, messaging, and progress tracking.

## Project structure

- `*.html` - Application pages (landing, auth, dashboard, session, clinician views).
- `css/` - Stylesheets for layout and components.
- `js/` - All JavaScript files. (No inline scripts - moved into `js/`.)
- `php/` - Server endpoints used in demos (authentication, session APIs).
- `schema.sql` - Example DB schema (local demo name `rehabiai_db`).

## What I changed

- Extracted inline JS from `forgot.html` into `js/forgot.js` and linked it.
- Replaced AI-marketing text with realistic rehabilitation wording across the UI.
- Adjusted brand name in UI assets to `PhysioTrack` (database name kept for schema compatibility).

## How to run locally

1. Open `index.html` in your browser (double-click or use a local static server).
2. Pages are static; PHP endpoints require a PHP server and a configured database.

Quick local static server (Python 3):
```bash
cd "c:/Users/ibmah/OneDrive/Desktop/Project_capson"
python -m http.server 8000
# then visit http://localhost:8000 in your browser
```

To enable PHP endpoints, run a local PHP server and ensure the database `rehabiai_db` exists per `schema.sql`.

## File references

- Main scripts: `js/main.js`, `js/auth.js`, `js/dashboard.js`, `js/session.js`, `js/clinician.js`, `js/messages.js`, `js/forgot.js`
- If you prefer different script organization, tell me and I’ll refactor.

## Script mapping (what each file does)

- `js/main.js`: site-wide UI helpers (nav, sidebar, smooth scroll, section highlight).
- `js/auth.js`: login/register form behaviors, role toggle, client-side validation.
- `js/dashboard.js`: patient dashboard helpers, charts, demo message send used on dashboard pages.
- `js/session.js`: live session UI (camera placeholder, pose overlay, simulated form score).
- `js/clinician.js`: clinician views (charts, patient filtering).
- `js/messages.js`: conversation UI and send-message behavior used on full Messages page.
- `js/forgot.js`: extracted forgot-password form handler (was inline in `forgot.html`).

## Quick verification steps I ran

1. Scanned all HTML files for inline `<script>` blocks - none remain.
2. Confirmed every page references external JS in `js/` (script tags at end of `body`).
3. Confirmed `js/` contains the extracted `forgot.js` and the existing scripts.

## Next recommended steps

- (Optional) Run a JS linter (ESLint) across `js/` to catch style/safety issues.
- (Optional) Wire PHP endpoints and import `schema.sql` to test auth and session APIs.
- I can also add automated smoke tests (Node + JSDOM) to exercise critical UI flows.

## Next steps I can do for you

- Extract any remaining inline JS (none found).
- Wire the PHP endpoints to a local SQLite/demo DB for a full end-to-end demo.
- Improve copy or populate pages with more realistic sample data.

If you want I can run a quick browser console lint pass (basic) or add a simple test harness for the JS functions.
