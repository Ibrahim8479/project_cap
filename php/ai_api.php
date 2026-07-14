<?php
// php/ai_api.php — lightweight AI feedback and training API
require_once 'config.php';
header('Content-Type: application/json');
startSecureSession();

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$db = getDB();
$action = $_GET['action'] ?? 'feedback';
$body = json_decode(file_get_contents('php://input'), true) ?? [];
$user_id = (int)$_SESSION['user_id'];

switch ($action) {
    case 'feedback':
        $quality = (float)($body['quality'] ?? 0);
        $form = (float)($body['form'] ?? 0);
        $exercise = trim($body['exercise'] ?? '');
        $repCount = (int)($body['reps'] ?? 0);

        if (!$exercise) {
            echo json_encode(['error' => 'Missing exercise']);
            exit;
        }

        $advice = [];
        if ($quality < 70) {
            $advice[] = 'Focus on slow controlled movement and avoid bouncing between reps.';
        } else {
            $advice[] = 'Good control — keep that consistency for the next set.';
        }
        if ($form < 70) {
            $advice[] = 'Try to maintain a neutral spine and align your knees over your toes.';
        }
        if ($repCount > 0 && $repCount < 10) {
            $advice[] = 'Build a strong base with slower repetitions before increasing speed.';
        }

        echo json_encode(['advice' => implode(' ', $advice), 'quality' => $quality, 'form' => $form]);
        exit;

    case 'train':
        $session_id = (int)($body['session_id'] ?? 0);
        $avg_quality = (float)($body['avg_quality'] ?? 0);
        $avg_form = (float)($body['avg_form_score'] ?? 0);
        $total_reps = (int)($body['total_reps'] ?? 0);
        $sets_done = (int)($body['sets_done'] ?? 0);
        $feedback_tag = trim($body['feedback_tag'] ?? 'general');
        $feedback_text = trim($body['feedback_text'] ?? 'No additional feedback.');

        if (!$session_id || !$avg_quality || !$avg_form) {
            echo json_encode(['error' => 'Missing training data']);
            exit;
        }

        $stmt = $db->prepare('SELECT patient_id, exercise_id FROM sessions WHERE id = ? LIMIT 1');
        $stmt->execute([$session_id]);
        $session = $stmt->fetch();
        if (!$session) {
            echo json_encode(['error' => 'Session not found']);
            exit;
        }

        $insert = $db->prepare('INSERT INTO ai_training_samples (session_id, patient_id, exercise_id, avg_quality, avg_form_score, total_reps, sets_done, feedback_tag, feedback_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $insert->execute([
            $session_id,
            $session['patient_id'],
            $session['exercise_id'],
            $avg_quality,
            $avg_form,
            $total_reps,
            $sets_done,
            $feedback_tag,
            $feedback_text
        ]);

        echo json_encode(['ok' => true, 'sample_id' => (int)$db->lastInsertId()]);
        exit;

    default:
        echo json_encode(['error' => 'Unknown action']);
        exit;
}
