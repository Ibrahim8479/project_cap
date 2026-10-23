<?php
// php/register.php

require_once 'config.php';
startSecureSession();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../register.html');
    exit;
}

// Collect + sanitize
$first_name = trim($_POST['first_name'] ?? '');
$last_name  = trim($_POST['last_name']  ?? '');
$email      = trim($_POST['email']    ?? '');
$password   = trim($_POST['password'] ?? '');
$pwd_confirm= trim($_POST['password_confirm'] ?? '');
$role       = in_array($_POST['role'] ?? '', ['patient','clinician']) ? $_POST['role'] : 'patient';

// Patient-specific
$condition       = trim($_POST['condition']      ?? '');
$clinician_code  = trim($_POST['clinician_code'] ?? '');

// Clinician-specific
$clinic          = trim($_POST['clinic']          ?? '');
$specialization  = trim($_POST['specialization']  ?? '');

// Validation
$errors = [];

if (!$first_name || !$last_name) $errors[] = 'Name is required.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Invalid email address.';
if (strlen($password) < 8)  $errors[] = 'Password must be at least 8 characters.';
if ($password !== $pwd_confirm) $errors[] = 'Passwords do not match.';

if ($errors) {
    $q = urlencode(implode(' | ', $errors));
    header("Location: ../register.html?error=$q");
    exit;
}

$db = getDB();

// Check duplicate email
$stmt = $db->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    header('Location: ../register.html?error=email_taken');
    exit;
}

$linkedClinician = null;
if ($role === 'patient' && $clinician_code) {
    $cStmt = $db->prepare('SELECT id FROM users WHERE clinician_code = ? AND role = "clinician" LIMIT 1');
    $cStmt->execute([$clinician_code]);
    $linkedClinician = $cStmt->fetch();
    if (!$linkedClinician) {
        header('Location: ../register.html?error=invalid_clinician_code');
        exit;
    }
}

if ($role === 'clinician') {
    $codeStmt = $db->prepare('SELECT id FROM users WHERE clinician_code = ? LIMIT 1');
    do {
        $clinician_code = 'DR-' . strtoupper(bin2hex(random_bytes(3)));
        $codeStmt->execute([$clinician_code]);
    } while ($codeStmt->fetch());
}

// Hash password
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

// Insert user
$stmt = $db->prepare('
    INSERT INTO users (first_name, last_name, email, password_hash, role, condition_type, clinic_name, specialization, clinician_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
');
$stmt->execute([
    $first_name, $last_name, $email, $hash, $role,
    $condition, $clinic, $specialization, $clinician_code
]);
$user_id = (int)$db->lastInsertId();

// If patient gave a clinician code, link them
if ($linkedClinician) {
    $link = $db->prepare('INSERT IGNORE INTO clinician_patients (clinician_id, patient_id) VALUES (?, ?)');
    $link->execute([$linkedClinician['id'], $user_id]);
}

// Start session
$_SESSION['user_id']    = $user_id;
$_SESSION['first_name'] = $first_name;
$_SESSION['last_name']  = $last_name;
$_SESSION['role']       = $role;
session_regenerate_id(true);

header($role === 'clinician' ? 'Location: ../clinician.html' : 'Location: ../dashboard.html');
exit;