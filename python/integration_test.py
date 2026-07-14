from infer_model import PoseClassifier
import numpy as np
import sys

clf = PoseClassifier()
features = clf.feature_names

# Representative samples matching the synthetic ranges used in train_model.py
samples = {
    'squat': [130.0, 128.0, 72.0, 74.0, 0.06, 0.18],
    'lunge': [140.0, 138.0, 80.0, 88.0, 0.10, 0.20],
    'knee-ext': [155.0, 150.0, 90.0, 92.0, 0.04, 0.12]
}

print('Feature names:', features)
errors = 0
for label, vec in samples.items():
    arr = np.array(vec, dtype=np.float32).reshape(1, -1)
    idx, probs = clf.predict(arr)
    # model may use class_names in same order as LABEL_MAP in train_model.py
    pred_name = clf.model.get('class_names', clf.model.get('classes'))[idx]
    conf = probs[0][idx] if isinstance(probs[0], list) else probs[idx]
    print(f"Sample {label}: predicted={pred_name} conf={conf:.3f}")
    if pred_name != label:
        print('  -> MISMATCH')
        errors += 1

if errors:
    print(f"{errors} mismatches")
    sys.exit(2)

print('Integration test passed')
