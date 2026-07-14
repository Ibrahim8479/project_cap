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

1. Install XAMPP or another local PHP+MySQL environment.
2. Place this repository in your web server root, e.g. `C:\xampp\htdocs\project_cap`.
3. Import `schema.sql` into MySQL to create the `rehabiai_db` database and tables.
4. Start Apache and MySQL.
5. Open the app in your browser at `http://localhost/project_cap/`.

### Using the PHP backend

- `login.html` submits to `php/login.php`
- `register.html` submits to `php/register.php`
- `php/me.php` provides the authenticated user and dashboard data
- `php/exercises_api.php` loads exercises
- `php/session_api.php` stores session frames and messages
- `php/clinician_api.php` provides clinician patient data
- `php/ai_api.php` provides AI feedback and stores training samples from completed sessions
- `php/infer_model.php` performs model-based exercise classification from landmark features
- `js/session.js` now uses MediaPipe Pose for live landmark detection, rep counting, form scoring, and exercise classification when camera access is enabled

### Example local PHP server command

If you prefer the built-in PHP server instead of XAMPP, run from the repo root:

```bash
cd c:/xampp/htdocs/project_cap
php -S localhost:8000
```

Then visit `http://localhost:8000`.

### Test user logins

The schema includes seeded test accounts if you import `schema.sql`:

- Clinician: `clinician@test.local` / `password123`
- Patient: `patient@test.local` / `password123`

The seeded patient is already linked to the clinician via clinician code `DR-4892`.

If you add a new patient, the app will persist the user and assign them to a clinician if you provide a valid `clinician_code`.

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

## AI model & testing

The project includes a small ML training pipeline and test helpers.

- To (re)train the synthetic model and produce JSON artifacts:

```bash
cd c:/xampp/htdocs/project_cap
.venv\Scripts\python.exe python\train_model.py
```

- To run the in-repo integration tests (uses the trained model):

```bash
.venv\Scripts\python.exe python\integration_test.py
```

- To run a full HTTP end-to-end test against a running PHP server:

1. Start the PHP built-in server from the repo root (or use XAMPP/Apache):

```powershell
php -S localhost:8000 -t .
```

2. In the project venv run the e2e script which logs in as the seeded patient and exercises the API:

```bash
.venv\Scripts\python.exe python\e2e_test.py --base http://localhost:8000
```

If PHP is not on your PATH, use XAMPP's Apache to serve the repo root instead and open `http://localhost/project_cap/` in the browser.
