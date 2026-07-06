-- rehabiai_schema.sql
-- Run this once to set up the database

CREATE DATABASE IF NOT EXISTS rehabiai_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rehabiai_db;

-- Users (patients + clinicians)
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('patient','clinician') NOT NULL DEFAULT 'patient',
    condition_type VARCHAR(100),
    clinic_name   VARCHAR(200),
    specialization VARCHAR(100),
    clinician_code VARCHAR(20),
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Clinician–patient relationships
CREATE TABLE IF NOT EXISTS clinician_patients (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    clinician_id  INT NOT NULL,
    patient_id    INT NOT NULL,
    assigned_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinician_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id)   REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_pair (clinician_id, patient_id)
);

-- Exercise definitions
CREATE TABLE IF NOT EXISTS exercises (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(50)  NOT NULL UNIQUE,
    description TEXT,
    target_reps INT DEFAULT 15,
    target_sets INT DEFAULT 3
);

INSERT IGNORE INTO exercises (name, slug, description, target_reps, target_sets) VALUES
  ('Squats',          'squat',    'Basic lower-body squat for knee/hip rehab', 15, 3),
  ('Lunges',          'lunge',    'Alternating lunges for balance and strength', 12, 3),
  ('Knee Extensions', 'knee-ext', 'Seated knee extension for quadriceps', 20, 2);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    patient_id    INT NOT NULL,
    exercise_id   INT NOT NULL,
    started_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at      DATETIME,
    total_reps    INT DEFAULT 0,
    sets_done     INT DEFAULT 0,
    avg_quality   FLOAT DEFAULT 0,
    avg_form_score FLOAT DEFAULT 0,
    status        ENUM('in_progress','completed','partial') DEFAULT 'in_progress',
    FOREIGN KEY (patient_id)  REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

-- Frame-level quality data (sampled, not every frame)
CREATE TABLE IF NOT EXISTS session_frames (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    session_id    INT NOT NULL,
    frame_time    FLOAT NOT NULL,          -- seconds from session start
    knee_angle    FLOAT,
    hip_angle     FLOAT,
    quality_score FLOAT,
    form_score    FLOAT,
    feedback_msg  VARCHAR(255),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Messages between patients and clinicians
CREATE TABLE IF NOT EXISTS messages (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    sender_id     INT NOT NULL,
    receiver_id   INT NOT NULL,
    body          TEXT NOT NULL,
    is_read       TINYINT(1) DEFAULT 0,
    sent_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Progress snapshots (daily summary per patient)
CREATE TABLE IF NOT EXISTS progress_snapshots (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    patient_id    INT NOT NULL,
    snap_date     DATE NOT NULL,
    total_reps    INT DEFAULT 0,
    avg_quality   FLOAT DEFAULT 0,
    sessions_done INT DEFAULT 0,
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_patient_date (patient_id, snap_date)
);