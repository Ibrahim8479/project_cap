<?php
// php/clinician_api.php
// Endpoints: ?action=patients | patient_detail | assign_patient

require_once 'config.php';
header('Content-Type: application/json');
startSecureSession();

if (empty($_SESSION['user_id']) || $_SESSION['role'] !== 'clinician') {
    jsonResponse(['error' => 'Unauthorized'], 401);
}

$clinician_id = (int)$_SESSION['user_id'];
$action = $_GET['action'] ?? '';
$db     = getDB();
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($action) {

    case 'patients':
    case 'list_patients':
        $stmt = $db->prepare('
            SELECT u.id, u.first_name, u.last_name, u.condition_type, u.created_at,
                   COALESCE(ps.avg_quality, 0) AS avg_quality,
                   COALESCE(ps.sessions_done, 0) AS sessions_done,
                   (SELECT COUNT(*) FROM sessions s WHERE s.patient_id = u.id) AS total_sessions,
                   (SELECT MAX(started_at) FROM sessions s WHERE s.patient_id = u.id) AS last_session
            FROM clinician_patients cp
            JOIN users u ON u.id = cp.patient_id
            LEFT JOIN (
                SELECT patient_id, AVG(avg_quality) AS avg_quality, SUM(sessions_done) AS sessions_done
                FROM progress_snapshots
                WHERE snap_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                GROUP BY patient_id
            ) ps ON ps.patient_id = u.id
            WHERE cp.clinician_id = ?
            ORDER BY u.first_name
        ');
        $stmt->execute([$clinician_id]);
        jsonResponse(['patients' => $stmt->fetchAll()]);

    case 'patient_detail':
        $patient_id = (int)($_GET['patient_id'] ?? 0);
        if (!$patient_id) jsonResponse(['error' => 'Missing patient_id'], 400);

        // Verify relationship
        $check = $db->prepare('SELECT 1 FROM clinician_patients WHERE clinician_id = ? AND patient_id = ?');
        $check->execute([$clinician_id, $patient_id]);
        if (!$check->fetch()) jsonResponse(['error' => 'Patient not found'], 404);

        // Patient info
        $pStmt = $db->prepare('SELECT id, first_name, last_name, condition_type, created_at FROM users WHERE id = ?');
        $pStmt->execute([$patient_id]);
        $patient = $pStmt->fetch();

        // Recent sessions
        $sStmt = $db->prepare('
            SELECT s.id, e.name AS exercise, s.started_at, s.total_reps, s.sets_done, s.avg_quality, s.status
            FROM sessions s
            JOIN exercises e ON e.id = s.exercise_id
            WHERE s.patient_id = ?
            ORDER BY s.started_at DESC
            LIMIT 10
        ');
        $sStmt->execute([$patient_id]);

        // Progress last 14 days
        $prStmt = $db->prepare('
            SELECT snap_date, avg_quality, total_reps, sessions_done
            FROM progress_snapshots
            WHERE patient_id = ?
            ORDER BY snap_date ASC
            LIMIT 14
        ');
        $prStmt->execute([$patient_id]);

        jsonResponse([
            'patient'  => $patient,
            'sessions' => $sStmt->fetchAll(),
            'progress' => $prStmt->fetchAll(),
        ]);

    case 'assign_patient':
        $code = trim($body['clinician_code'] ?? '');
        if (!$code) jsonResponse(['error' => 'Missing code'], 400);
        $stmt = $db->prepare('SELECT id FROM users WHERE role = "clinician" AND clinician_code = ? LIMIT 1');
        $stmt->execute([$code]);
        if (!$stmt->fetch()) jsonResponse(['error' => 'Invalid code'], 404);

        $patient_id = (int)($body['patient_id'] ?? 0);
        $link = $db->prepare('INSERT IGNORE INTO clinician_patients (clinician_id, patient_id) VALUES (?, ?)');
        $link->execute([$clinician_id, $patient_id]);
        jsonResponse(['ok' => true]);

    default:
        jsonResponse(['error' => 'Unknown action'], 400);
}