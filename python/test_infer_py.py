from infer_model import PoseClassifier
import numpy as np

clf = PoseClassifier()
# Sample vector matching FEATURE_NAMES: left_knee,right_knee,left_hip,right_hip,torso_lean,stance_width
sample = np.array([[130.0, 128.0, 72.0, 74.0, 0.06, 0.18]], dtype=np.float32)
label_index, probs = clf.predict(sample)
print('label_index:', label_index)
print('probs:', probs)
