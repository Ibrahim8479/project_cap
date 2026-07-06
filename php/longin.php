<?php
// php/login.php

require_once 'config.php';
startSecureSession();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../login.html');
    exit;
}

$email    = trim($_POST['email']    ?? '');
$password = trim($_POST['password'] ?? '');
$role     = in_array($_POST['role'] ?? '', ['patient','clinician']) ? $_POST['role'] : 'patient';
$remember = isset($_POST['remember']);

// Basic validation
if (!$email || !$password) {
    header('Location: ../login.html?error=missing_fields');
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    header('Location: ../login.html?error=invalid_email');
    exit;
}

$db   = getDB();
$stmt = $db->prepare('SELECT id, first_name, last_name, password_hash, role FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    header('Location: ../login.html?error=invalid_credentials');
    exit;
}

// Optionally check role matches
if ($user['role'] !== $role) {
    header('Location: ../login.html?error=wrong_role');
    exit;
}

// Set session
$_SESSION['user_id']    = $user['id'];
$_SESSION['first_name'] = $user['first_name'];
$_SESSION['last_name']  = $user['last_name'];
$_SESSION['role']       = $user['role'];
session_regenerate_id(true);

// Remember-me cookie (7 days)
if ($remember) {
    $token = bin2hex(random_bytes(32));
    setcookie('remember_token', $token, time() + 7 * 86400, '/', '', true, true);
    // TODO: store token hash in a remember_tokens table
}

// Redirect by role
if ($user['role'] === 'clinician') {
    header('Location: ../clinician.html');
} else {
    header('Location: ../dashboard.html');
}
exit;