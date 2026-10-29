<?php
require_once 'config.php';
startSecureSession();

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    exit;
}

$viewerId = (int)$_SESSION['user_id'];
$viewerRole = $_SESSION['role'] ?? '';
$requestedId = filter_input(INPUT_GET, 'user_id', FILTER_VALIDATE_INT);
$userId = $requestedId ?: $viewerId;
$db = getDB();

if ($userId !== $viewerId) {
    if ($viewerRole !== 'clinician') {
        http_response_code(403);
        exit;
    }
    $relationship = $db->prepare('SELECT 1 FROM clinician_patients WHERE clinician_id = ? AND patient_id = ? LIMIT 1');
    $relationship->execute([$viewerId, $userId]);
    if (!$relationship->fetch()) {
        http_response_code(403);
        exit;
    }
}

$stmt = $db->prepare('SELECT profile_picture FROM users WHERE id = ? LIMIT 1');
$stmt->execute([$userId]);
$filename = $stmt->fetchColumn();
$allowedTypes = [
    'jpg' => 'image/jpeg',
    'png' => 'image/png',
    'webp' => 'image/webp',
];
$extension = strtolower(pathinfo((string)$filename, PATHINFO_EXTENSION));
if (!$filename || !isset($allowedTypes[$extension])) {
    http_response_code(404);
    exit;
}

$path = __DIR__ . '/../uploads/profile/' . basename($filename);
if (!is_file($path) || !is_readable($path)) {
    http_response_code(404);
    exit;
}

header('Content-Type: ' . $allowedTypes[$extension]);
header('Content-Length: ' . filesize($path));
header('Cache-Control: private, max-age=300');
header('X-Content-Type-Options: nosniff');
readfile($path);
