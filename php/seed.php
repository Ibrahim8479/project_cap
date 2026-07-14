<?php
// php/seed.php — Local-only helper to create test accounts
require_once 'config.php';

// Only allow from localhost for safety
$remote = $_SERVER['REMOTE_ADDR'] ?? 'cli';
if ($remote !== '127.0.0.1' && $remote !== '::1' && PHP_SAPI !== 'cli') {
    http_response_code(403);
    echo "Forbidden\n";
    exit;
}

try {
    $db = getDB();
} catch (Exception $e) {
    echo "DB connection failed: " . $e->getMessage();
    exit;
}

$pairs = [
    // email => [first, last, role, password]
    'patient@test.local'   => ['Test','Patient','patient','11111111'],
    'clinician@test.local' => ['Test','Clinician','clinician','00000000'],
];

foreach ($pairs as $email => $info) {
    [$first, $last, $role, $pwd] = $info;
    // skip if exists
    $stmt = $db->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        echo "$email already exists\n";
        continue;
    }

    $hash = password_hash($pwd, PASSWORD_BCRYPT);
    $clinician_code = ($role === 'clinician') ? 'CLIN-TEST-001' : null;

    $ins = $db->prepare('INSERT INTO users (first_name, last_name, email, password_hash, role, clinician_code) VALUES (?, ?, ?, ?, ?, ?)');
    $ins->execute([$first, $last, $email, $hash, $role, $clinician_code]);
    echo "Created $role: $email (password: $pwd)\n";
}

// If both created, link patient to clinician
$p = $db->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$p->execute(['patient@test.local']); $patient = $p->fetch();
$c = $db->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$c->execute(['clinician@test.local']); $clinician = $c->fetch();
if ($patient && $clinician) {
    $link = $db->prepare('INSERT IGNORE INTO clinician_patients (clinician_id, patient_id) VALUES (?, ?)');
    $link->execute([(int)$clinician['id'], (int)$patient['id']]);
    echo "Linked patient to clinician\n";
}

echo "Done. You can now sign in at /login.html using the seeded accounts.\n";
