<?php
// php/healthz.php - lightweight health check for server and database
require_once 'config.php';

header('Content-Type: application/json');

$out = ['ok' => true, 'php_version' => phpversion()];

// Check database connection quickly
try {
    $db = getDB();
    $stmt = $db->query('SELECT 1');
    $stmt->execute();
    $out['db'] = 'connected';
} catch (Exception $e) {
    $out['db'] = 'error';
    $out['db_error'] = $e->getMessage();
    $out['ok'] = false;
}

echo json_encode($out);
exit;
