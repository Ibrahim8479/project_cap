<?php
// Small CLI test to verify the JSON model files and inference math
$cwd = __DIR__ . '/../python/model';
$modelPath = $cwd . '/pose_classifier.json';
$scalerPath = $cwd . '/pose_scaler.json';
if (!file_exists($modelPath) || !file_exists($scalerPath)) {
    echo "Model files not found in $cwd\n";
    exit(1);
}
$model = json_decode(file_get_contents($modelPath), true);
$scaler = json_decode(file_get_contents($scalerPath), true);
$featureNames = $scaler['feature_names'] ?? [];

// Example sample feature vector (approx squat-like)
$sample = [
    'left_knee' => 130.0,
    'right_knee' => 128.0,
    'left_hip' => 72.0,
    'right_hip' => 74.0,
    'torso_lean' => 0.06,
    'stance_width' => 0.18
];

$input = [];
foreach ($featureNames as $f) {
    $input[] = isset($sample[$f]) ? floatval($sample[$f]) : 0.0;
}

// standardize
$mean = $scaler['mean'];
$scale = $scaler['scale'];
$std = [];
for ($i = 0; $i < count($input); $i++) {
    $s = (isset($scale[$i]) && $scale[$i] != 0) ? ($input[$i] - $mean[$i]) / $scale[$i] : 0.0;
    $std[] = $s;
}

function relu(array $x): array { return array_map(fn($v)=> max(0.0, $v), $x); }
function softmax(array $x): array { $m = max($x); $e = array_map(fn($v)=> exp($v-$m), $x); $s = array_sum($e); return array_map(fn($v)=> $v/($s?:1.0), $e); }

$activations = $std;
foreach ($model['coefs'] as $li => $coefMatrix) {
    $next = [];
    $intercepts = $model['intercepts'][$li];
    foreach ($intercepts as $j => $bias) {
        $sum = $bias;
        foreach ($activations as $i => $val) {
            $sum += $val * ($coefMatrix[$i][$j] ?? 0.0);
        }
        $next[] = $sum;
    }
    $activations = ($li < count($model['coefs']) - 1) ? relu($next) : $next;
}
$probs = softmax($activations);
$idx = array_keys($probs, max($probs))[0];
$classNames = $model['class_names'] ?? $model['classes'] ?? [];
$pred = $classNames[$idx] ?? null;
$out = [ 'exercise' => $pred, 'confidence' => round($probs[$idx]*100,1), 'probabilities' => $probs ];
echo json_encode($out, JSON_PRETTY_PRINT) . "\n";
