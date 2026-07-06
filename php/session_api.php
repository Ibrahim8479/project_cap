<?php
// php/session_api.php – REST-like API for session data
// Endpoints: POST /session_api.php?action=start|save_frame|end|get_progress

require_once 'config.php';

header('Content-Type: application/json');

startSecureSession();

if (empty($_SESSION['user_id'])) {
    jsonResponse(['error' => 'Unauthorized'], 401);
}

$user_id = (int)$_SESSION['user_id'];
$action  = $_GET['action'] ?? '';
$db      = getDB();
$body    = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($action) {

    // ── Start session ──────────────────────────────────────────
    case 'start':
        $exercise_slug = $body['exercise'] ?? 'squat';
        $ex = $db->prepare('SELECT id FROM exercises WHERE slug = ? LIMIT 1');
        $ex->execute([$exercise_slug]);
        $exercise = $ex->fetch();
        if (!$exercise) jsonResponse(['error' => 'Unknown exercise'], 400);

        $stmt = $db->prepare('
            INSERT INTO sessions (patient_id, exercise_id, status)
            VALUES (?, ?, "in_progress")
        ');
        $stmt->execute([$user_id, $exercise['id']]);
        jsonResponse(['session_id' => (int)$db->lastInsertId()]);

    // ── Save frame ─────────────────────────────────────────────
    case 'save_frame':
        $session_id   = (int)($body['session_id']   ?? 0);
        $frame_time   = (float)($body['frame_time']  ?? 0);
        $knee_angle   = $body['knee_angle']   ?? null;
        $hip_angle    = $body['hip_angle']    ?? null;
        $quality      = $body['quality_score'] ?? null;
        $form         = $body['form_score']    ?? null;
        $feedback     = substr($body['feedback'] ?? '', 0, 255);

        if (!$session_id) jsonResponse(['error' => 'Missing session_id'], 400);

        // Verify session belongs to this user
        $check = $db->prepare('SELECT id FROM sessions WHERE id = ? AND patient_id = ? LIMIT 1');
        $check->execute([$session_id, $user_id]);
        if (!$check->fetch()) jsonResponse(['error' => 'Session not found'], 404);

        $stmt = $db->prepare('
            INSERT INTO session_frames (session_id, frame_time, knee_angle, hip_angle, quality_score, form_score, feedback_msg)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([$session_id, $frame_time, $knee_angle, $hip_angle, $quality, $form, $feedback]);
        jsonResponse(['ok' => true]);

    // ── End session ────────────────────────────────────────────
    case 'end':
        $session_id  = (int)($body['session_id']  ?? 0);
        $total_reps  = (int)($body['total_reps']  ?? 0);
        $sets_done   = (int)($body['sets_done']   ?? 0);
        $status      = in_array($body['status'] ?? '', ['completed','partial']) ? $body['status'] : 'completed';

        if (!$session_id) jsonResponse(['error' => 'Missing session_id'], 400);

        // Calculate averages from frames
        $avg = $db->prepare('
            SELECT AVG(quality_score) AS aq, AVG(form_score) AS af
            FROM session_frames WHERE session_id = ?
        ');
        $avg->execute([$session_id]);
        $avgs = $avg->fetch();

        $stmt = $db->prepare('
            UPDATE sessions
            SET ended_at = NOW(), total_reps = ?, sets_done = ?,
                avg_quality = ?, avg_form_score = ?, status = ?
            WHERE id = ? AND patient_id = ?
        ');
        $stmt->execute([
            $total_reps, $sets_done,
            round($avgs['aq'] ?? 0, 1),
            round($avgs['af'] ?? 0, 1),
            $status, $session_id, $user_id
        ]);

        // Upsert daily progress snapshot
        $today = date('Y-m-d');
        $snap = $db->prepare('
            INSERT INTO progress_snapshots (patient_id, snap_date, total_reps, avg_quality, sessions_done)
            VALUES (?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
                total_reps    = total_reps    + VALUES(total_reps),
                avg_quality   = (avg_quality + VALUES(avg_quality)) / 2,
                sessions_done = sessions_done + 1
        ');
        $snap->execute([$user_id, $today, $total_reps, round($avgs['aq'] ?? 0, 1)]);

        jsonResponse(['ok' => true]);

    // ── Get progress (last 7 days) ─────────────────────────────
    case 'get_progress':
        $stmt = $db->prepare('
            SELECT snap_date, total_reps, avg_quality, sessions_done
            FROM progress_snapshots
            WHERE patient_id = ?
            ORDER BY snap_date DESC
            LIMIT 7
        ');
        $stmt->execute([$user_id]);
        jsonResponse(['progress' => $stmt->fetchAll()]);

    // ── Get messages ───────────────────────────────────────────
    case 'get_messages':
        $other_id = (int)($body['with'] ?? 0);
        if (!$other_id) jsonResponse(['error' => 'Missing user id'], 400);
        $stmt = $db->prepare('
            SELECT m.id, m.sender_id, m.body, m.sent_at,
                   u.first_name, u.last_name
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE (m.sender_id = ? AND m.receiver_id = ?)
               OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.sent_at ASC
            LIMIT 50
        ');
        $stmt->execute([$user_id, $other_id, $other_id, $user_id]);
        // Mark as read
        $db->prepare('UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ?')
           ->execute([$user_id, $other_id]);
        jsonResponse(['messages' => $stmt->fetchAll()]);

    // ── Send message ───────────────────────────────────────────
    case 'send_message':
        $to   = (int)($body['to']   ?? 0);
        $msg  = trim($body['body'] ?? '');
        if (!$to || !$msg) jsonResponse(['error' => 'Missing data'], 400);
        $stmt = $db->prepare('INSERT INTO messages (sender_id, receiver_id, body) VALUES (?, ?, ?)');
        $stmt->execute([$user_id, $to, $msg]);
        jsonResponse(['ok' => true, 'message_id' => (int)$db->lastInsertId()]);

    default:
        jsonResponse(['error' => 'Unknown action'], 400);
}