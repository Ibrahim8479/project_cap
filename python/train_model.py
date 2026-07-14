import json
import random
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import classification_report, accuracy_score

DATA_DIR = Path(__file__).resolve().parent
MODEL_DIR = DATA_DIR / 'model'
MODEL_DIR.mkdir(parents=True, exist_ok=True)

FEATURE_FILE = DATA_DIR / 'exercise_landmarks.csv'
MODEL_FILE = MODEL_DIR / 'pose_classifier.json'
SCALER_FILE = MODEL_DIR / 'pose_scaler.json'

LABEL_MAP = {
    'squat': 0,
    'lunge': 1,
    'knee-ext': 2
}

FEATURE_NAMES = [
    'left_knee', 'right_knee',
    'left_hip', 'right_hip',
    'torso_lean', 'stance_width'
]


def generate_synthetic_row(label):
    if label == 'squat':
        left_knee = random.uniform(100, 155)
        right_knee = random.uniform(100, 155)
        left_hip = random.uniform(60, 95)
        right_hip = random.uniform(60, 95)
        torso_lean = random.uniform(0.02, 0.14)
        stance_width = random.uniform(0.14, 0.24)
    elif label == 'lunge':
        left_knee = random.uniform(110, 160)
        right_knee = random.uniform(110, 160)
        left_hip = random.uniform(65, 100)
        right_hip = random.uniform(70, 105)
        torso_lean = random.uniform(0.02, 0.18)
        stance_width = random.uniform(0.12, 0.28)
    else:
        left_knee = random.uniform(100, 165)
        right_knee = random.uniform(100, 165)
        left_hip = random.uniform(70, 110)
        right_hip = random.uniform(70, 110)
        torso_lean = random.uniform(0.02, 0.12)
        stance_width = random.uniform(0.08, 0.16)

    return {
        'label': label,
        'left_knee': round(left_knee, 1),
        'right_knee': round(right_knee, 1),
        'left_hip': round(left_hip, 1),
        'right_hip': round(right_hip, 1),
        'torso_lean': round(torso_lean, 3),
        'stance_width': round(stance_width, 3)
    }


def generate_synthetic_dataset(csv_path, samples_per_label=300):
    rows = []
    for label in LABEL_MAP.keys():
        for _ in range(samples_per_label):
            rows.append(generate_synthetic_row(label))
    random.shuffle(rows)
    pd.DataFrame(rows).to_csv(csv_path, index=False)
    print(f'Generated synthetic dataset at {csv_path}')


def load_data(csv_path):
    if not csv_path.exists():
        generate_synthetic_dataset(csv_path)
    df = pd.read_csv(csv_path)
    if 'label' not in df.columns:
        raise ValueError('Dataset file must contain a label column')
    return df


def preprocess_features(df):
    label = df['label'].map(LABEL_MAP).astype(int)
    features = df[FEATURE_NAMES]
    return features, label


def build_model(X_train, y_train):
    model = MLPClassifier(
        hidden_layer_sizes=(128, 64),
        activation='relu',
        solver='adam',
        max_iter=300,
        random_state=42,
        early_stopping=True,
        n_iter_no_change=15
    )
    model.fit(X_train, y_train)
    return model


def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f)


def train():
    print('Loading dataset...')
    df = load_data(FEATURE_FILE)
    X, y = preprocess_features(df)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    print('Training classifier...')
    model = build_model(X_train_scaled, y_train)
    y_pred = model.predict(X_test_scaled)

    print('Accuracy:', accuracy_score(y_test, y_pred))
    print(classification_report(y_test, y_pred, target_names=LABEL_MAP.keys()))

    print('Saving scaler and model metadata...')
    save_json(SCALER_FILE, {
        'mean': scaler.mean_.tolist(),
        'scale': scaler.scale_.tolist(),
        'feature_names': FEATURE_NAMES
    })

    save_json(MODEL_FILE, {
        'coefs': [coef.tolist() for coef in model.coefs_],
        'intercepts': [intercept.tolist() for intercept in model.intercepts_],
        'classes': model.classes_.tolist(),
        'class_names': list(LABEL_MAP.keys()),
        'hidden_layer_sizes': model.hidden_layer_sizes,
        'activation': model.activation,
        'solver': model.solver,
        'n_layers': model.n_layers_,
        'n_outputs': model.n_outputs_,
        'out_activation_': model.out_activation_
    })
    print('Model training complete.')


if __name__ == '__main__':
    train()
