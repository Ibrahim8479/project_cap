# AI Telerehabilitation System

Lower-body rehabilitation monitoring for patients and physiotherapists. The application provides authenticated patient and clinician workspaces, assigned exercise activity, camera-assisted pose tracking, session recording, movement observations, progress summaries, and messaging.

## Current implementation

- Frontend: HTML, CSS, and JavaScript.
- Backend: PHP endpoints with a MySQL database.
- Camera tracking: MediaPipe Pose landmark detection in the browser.
- Session workflow: camera-derived movement measurements and repetition tracking are stored through the PHP session API.
- Exercise recognition: the current inference adapter loads a feed-forward MLP classifier from JSON model/scaler files.
- Movement cues: rule-based landmark observations and the existing PHP feedback endpoint.
- Current configured exercises: squats, lunges, and knee extensions.

The architecture diagram describes an LSTM sequence-analysis pipeline, but the code currently implements a per-frame MLP exercise classifier and does not contain an LSTM. Likewise, sit-to-stand and leg raises are not currently configured as backend exercises. This UI refresh preserves the existing API, database, authentication, and exercise/session workflows rather than presenting those unimplemented pieces as available.

Movement estimates and feedback are for monitoring and discussion with a physiotherapist. They are not a diagnosis and do not replace professional care.

## Project structure

- `*.html` - Patient, physiotherapist, authentication, and landing pages.
- `css/` - Shared and page-specific visual styles.
- `js/` - Authentication, camera session, dashboard, chart, messaging, and clinician behaviors.
- `php/` - Authentication, profile, session, exercise, inference, and clinician APIs.
- `python/` - Current model training and integration tests.
- `schema.sql` - MySQL schema and seeded accounts for the local environment.

## Profile photos

Users can update or remove their profile photo from Settings. The application accepts JPG, PNG, and WebP files up to 5 MB. Photos are stored under `uploads/profile/`, which Apache is configured to deny direct access to; `php/profile_image.php` serves images only to the account owner and, for patient photos, their linked physiotherapist. The PHP account must have write access to `uploads/profile/`.

The `profile_picture` database column is included in `schema.sql` and is added automatically for existing databases when `php/me.php` is requested. Existing accounts without a photo continue to display initials.

## Run locally

1. Install XAMPP or another PHP + MySQL environment.
2. Place the repository in the web server root, for example `C:\xampp\htdocs\project_cap`.
3. Import `schema.sql` into MySQL.
4. Start Apache and MySQL.
5. Open `http://localhost/project_cap/` in a supported browser. Do not open the HTML files using `file://`; the PHP APIs require a web server.
6. Allow camera permission before starting a recorded exercise session.

### Seeded accounts

- Physiotherapist: `clinician@test.local` / `00000000`
- Patient: `patient@test.local` / `11111111`

The patient is linked to the physiotherapist using code `DR-4892`. These credentials are for local development only.

### Background image

To use a background image you choose, place it under `images/` and set `--app-background-image` in `css/main.css`, for example:

```css
--app-background-image: url("../images/your-background.jpg");
```

## Model training and validation

The supplied training script currently trains the MLP classifier using the configured landmark CSV and can generate synthetic rows when that file is absent. Model retraining and fine-tuning on the large external dataset should wait until its format, licensing, labels, and validation criteria have been reviewed. Existing patient session records are not automatically submitted as training samples.

## Checks

- JavaScript lint: `npm run lint`
- PHP syntax: `C:\xampp\php\php.exe -l php\session_api.php` (repeat for the endpoint being changed).
- Model inference integration check: `.venv\Scripts\python.exe python\integration_test.py`
- Optional PHP development server: `php -S localhost:8000 -t .`, then open `http://localhost:8000/`.
