<?php
// php/exercises_api.php?action=list
require_once 'config.php';
header('Content-Type: application/json');
startSecureSession();

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$db = getDB();
$action = $_GET['action'] ?? 'list';
switch ($action) {
    case 'list':
        $stmt = $db->prepare('SELECT id, name, slug, description, target_reps, target_sets FROM exercises ORDER BY name');
        $stmt->execute();
        echo json_encode(['exercises' => $stmt->fetchAll()]);
        break;
    default:
        echo json_encode(['error' => 'Unknown action']);
}
exit;
