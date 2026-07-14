import json
from pathlib import Path

import numpy as np

MODEL_DIR = Path(__file__).resolve().parent / 'model'
MODEL_FILE = MODEL_DIR / 'pose_classifier.json'
SCALER_FILE = MODEL_DIR / 'pose_scaler.json'


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def softmax(x):
    exp = np.exp(x - np.max(x))
    return exp / exp.sum(axis=-1, keepdims=True)


class PoseClassifier:
    def __init__(self):
        self.model = load_json(MODEL_FILE)
        self.scaler = load_json(SCALER_FILE)
        self.feature_names = self.scaler['feature_names']
        self.mean = np.array(self.scaler['mean'], dtype=np.float32)
        self.scale = np.array(self.scaler['scale'], dtype=np.float32)

    def transform(self, X):
        X = np.asarray(X, dtype=np.float32)
        return (X - self.mean) / self.scale

    def predict(self, X):
        X = self.transform(X)
        activations = X
        for i, (coef, intercept) in enumerate(zip(self.model['coefs'], self.model['intercepts'])):
            activations = activations.dot(np.array(coef, dtype=np.float32)) + np.array(intercept, dtype=np.float32)
            if i < len(self.model['coefs']) - 1:
                activations = np.maximum(activations, 0)
        probs = softmax(activations)
        probs = np.array(probs)
        # handle both (n_classes,) and (batch, n_classes) shapes
        if probs.ndim == 2:
            label_index = int(np.argmax(probs, axis=1)[0])
        else:
            label_index = int(np.argmax(probs))
        return label_index, probs.tolist()


if __name__ == '__main__':
    clf = PoseClassifier()
    sample = np.zeros(len(clf.feature_names), dtype=np.float32)
    label, probs = clf.predict(sample.reshape(1, -1))
    print('predicted', label, probs)
