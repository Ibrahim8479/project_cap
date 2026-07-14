<?php
// php/me.php — returns current authenticated user and lightweight related data
require_once 'config.php';
header('Content-Type: application/json');
startSecureSession();

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$db = getDB();
$uid = (int)$_SESSION['user_id'];

$body = json_decode(file_get_contents('php://input'), true) ?? [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $first_name = trim($body['first_name'] ?? '');
    $last_name = trim($body['last_name'] ?? '');
    $email = trim($body['email'] ?? '');
    $phone = trim($body['phone'] ?? '');

    // If profile fields are provided, validate and update
    if ($first_name || $last_name || $email) {
        if (!$first_name || !$last_name || !$email) {
            echo json_encode(['error' => 'First name, last name, and email are required.']);
            exit;
        }

        $check = $db->prepare('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1');
        $check->execute([$email, $uid]);
        if ($check->fetch()) {
            echo json_encode(['error' => 'That email address is already registered.']);
            exit;
        }

        $stmt = $db->prepare('UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ? WHERE id = ?');
        $stmt->execute([$first_name, $last_name, $email, $phone, $uid]);
    }

    // Preferences: optionally update preference columns on the users table
    $prefs = $body['prefs'] ?? [];
    $prefReceive = isset($body['receive_reminders']) ? (bool)$body['receive_reminders'] : (isset($prefs['receive_reminders']) ? (bool)$prefs['receive_reminders'] : null);
    $prefRealtime = isset($body['realtime_feedback']) ? (bool)$body['realtime_feedback'] : (isset($prefs['realtime_feedback']) ? (bool)$prefs['realtime_feedback'] : null);
    $prefDark = isset($body['dark_mode']) ? (bool)$body['dark_mode'] : (isset($prefs['dark_mode']) ? (bool)$prefs['dark_mode'] : null);

    // Ensure columns exist (safe for development). Add columns if missing.
    $cols = $db->query("SHOW COLUMNS FROM users LIKE 'receive_reminders'")->fetch();
    if (!$cols) {
        $db->exec("ALTER TABLE users ADD COLUMN receive_reminders TINYINT(1) DEFAULT 1");
    }
    $cols = $db->query("SHOW COLUMNS FROM users LIKE 'realtime_feedback'")->fetch();
    if (!$cols) {
        $db->exec("ALTER TABLE users ADD COLUMN realtime_feedback TINYINT(1) DEFAULT 1");
    }
    $cols = $db->query("SHOW COLUMNS FROM users LIKE 'dark_mode'")->fetch();
    if (!$cols) {
        $db->exec("ALTER TABLE users ADD COLUMN dark_mode TINYINT(1) DEFAULT 0");
    }

    $updates = [];
    $params = [];
    if ($prefReceive !== null) { $updates[] = 'receive_reminders = ?'; $params[] = $prefReceive ? 1 : 0; }
    if ($prefRealtime !== null) { $updates[] = 'realtime_feedback = ?'; $params[] = $prefRealtime ? 1 : 0; }
    if ($prefDark !== null) { $updates[] = 'dark_mode = ?'; $params[] = $prefDark ? 1 : 0; }
    if (count($updates)) {
        $params[] = $uid;
        $sql = 'UPDATE users SET ' . implode(', ', $updates) . ' WHERE id = ?';
        $db->prepare($sql)->execute($params);
    }
}

$uStmt = $db->prepare('SELECT id, first_name, last_name, email, role, condition_type, clinic_name, phone FROM users WHERE id = ? LIMIT 1');
$uStmt->execute([$uid]);
$user = $uStmt->fetch();

// If preference columns exist, include them
$prefCols = $db->query("SHOW COLUMNS FROM users LIKE 'receive_reminders'")->fetch();
if ($prefCols) {
    $pstmt = $db->prepare('SELECT receive_reminders, realtime_feedback, dark_mode FROM users WHERE id = ? LIMIT 1');
    $pstmt->execute([$uid]);
    $prefs = $pstmt->fetch();
    $user['preferences'] = [
        'receive_reminders' => (bool)($prefs['receive_reminders'] ?? 1),
        'realtime_feedback' => (bool)($prefs['realtime_feedback'] ?? 1),
        'dark_mode' => (bool)($prefs['dark_mode'] ?? 0),
    ];
}

if (!$user) {
    echo json_encode(['error' => 'User not found']);
    exit;
}

$result = ['user' => $user];

if ($user['role'] === 'patient') {
    // linked clinician
    $c = $db->prepare('SELECT clinician_id FROM clinician_patients WHERE patient_id = ? LIMIT 1');
    $c->execute([$uid]);
    $link = $c->fetch();
    $result['clinician_id'] = $link['clinician_id'] ?? null;

    // recent sessions
    $s = $db->prepare('SELECT s.id, e.name AS exercise, s.started_at, s.total_reps, s.avg_quality, s.status FROM sessions s JOIN exercises e ON e.id = s.exercise_id WHERE s.patient_id = ? ORDER BY s.started_at DESC LIMIT 10');
    $s->execute([$uid]);
    $result['sessions'] = $s->fetchAll();

    // progress last 7 days
    $p = $db->prepare('SELECT snap_date, total_reps, avg_quality, sessions_done FROM progress_snapshots WHERE patient_id = ? ORDER BY snap_date DESC LIMIT 7');
    $p->execute([$uid]);
    $result['progress'] = $p->fetchAll();

} else {
    // clinician: count patients and sessions today for assigned patients
    $ct = $db->prepare('SELECT COUNT(*) FROM clinician_patients WHERE clinician_id = ?');
    $ct->execute([$uid]);
    $result['patient_count'] = (int)($ct->fetchColumn() ?? 0);

    $st = $db->prepare('SELECT COUNT(*) FROM sessions s JOIN clinician_patients cp ON cp.patient_id = s.patient_id WHERE cp.clinician_id = ? AND DATE(s.started_at) = CURDATE()');
    $st->execute([$uid]);
    $result['sessions_today'] = (int)$st->fetchColumn();

    // avg adherence across clinician's patients (last 7 days)
    $av = $db->prepare('SELECT AVG(ps.avg_quality) AS a FROM progress_snapshots ps JOIN clinician_patients cp ON cp.patient_id = ps.patient_id WHERE cp.clinician_id = ? AND ps.snap_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)');
    $av->execute([$uid]);
    $result['avg_adherence'] = round((float)($av->fetchColumn() ?? 0));
}

echo json_encode($result);
exit;
