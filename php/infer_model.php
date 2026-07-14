<?php
// php/infer_model.php — clearer inference adapter for the trained pose classifier
require_once 'config.php';
header('Content-Type: application/json');
startSecureSession();

function json_error(string $msg, int $code = 400) {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

if (empty($_SESSION['user_id'])) {
    json_error('Unauthorized', 401);
}

$payload = json_decode(file_get_contents('php://input'), true) ?? [];
$featureVector = $payload['feature_vector'] ?? null;
if ($featureVector === null || !is_array($featureVector)) {
    json_error('Missing or invalid "feature_vector" payload');
}

$modelPath = __DIR__ . '/../python/model/pose_classifier.json';
$scalerPath = __DIR__ . '/../python/model/pose_scaler.json';
if (!file_exists($modelPath) || !file_exists($scalerPath)) {
    json_error('Model files not found. Run python/train_model.py first.', 500);
}

$model = json_decode(file_get_contents($modelPath), true);
$scaler = json_decode(file_get_contents($scalerPath), true);
if (!is_array($model) || !is_array($scaler)) {
    json_error('Failed to load model files', 500);
}

$featureNames = $scaler['feature_names'] ?? [];
if (!is_array($featureNames) || count($featureNames) === 0) {
    json_error('Scaler missing feature names', 500);
}

// Build ordered input vector. Accept either a name=>value map or a numeric array
$inputVector = [];
foreach ($featureNames as $feature) {
    if (array_key_exists($feature, $featureVector)) {
        $inputVector[] = floatval($featureVector[$feature]);
    } else {
        // fallback: if payload sent numeric array in same order
        $inputVector[] = isset($featureVector[count($inputVector)]) ? floatval($featureVector[count($inputVector)]) : 0.0;
    }
}

// Standardize
$mean = $scaler['mean'] ?? [];
$scale = $scaler['scale'] ?? [];
if (!is_array($mean) || !is_array($scale)) json_error('Invalid scaler metadata', 500);
$standardized = [];
for ($i = 0; $i < count($inputVector); $i++) {
    $m = $mean[$i] ?? 0.0;
    $s = $scale[$i] ?? 1.0;
    $standardized[] = ($s != 0.0) ? (($inputVector[$i] - $m) / $s) : 0.0;
}

// Helpers
function relu(array $x): array { return array_map(fn($v) => max(0.0, $v), $x); }
function softmax(array $x): array { $mx = max($x); $ex = array_map(fn($v) => exp($v - $mx), $x); $sum = array_sum($ex); return array_map(fn($v) => $v / ($sum ?: 1.0), $ex); }

// Run through the MLP model weights saved by train_model.py
$activations = $standardized;
foreach ($model['coefs'] as $layerIndex => $coefMatrix) {
    $next = [];
    $intercepts = $model['intercepts'][$layerIndex];
    foreach ($intercepts as $j => $bias) {
        $sum = $bias;
        foreach ($activations as $i => $val) {
            $w = $coefMatrix[$i][$j] ?? 0.0;
            $sum += $val * $w;
        }
        $next[] = $sum;
    }
    $activations = ($layerIndex < count($model['coefs']) - 1) ? relu($next) : $next;
}

$probs = softmax($activations);
$bestIdx = array_search(max($probs), $probs, true);
$classNames = $model['class_names'] ?? $model['classes'] ?? [];
$prediction = $classNames[$bestIdx] ?? null;

echo json_encode([
    'exercise' => $prediction,
    'confidence' => round(($probs[$bestIdx] ?? 0.0) * 100, 1),
    'probabilities' => $probs
]);
exit;
