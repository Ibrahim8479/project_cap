# Python AI Training / Inference Helpers

This folder contains the Python tools for training and using a pose classifier based on landmark features.

## Overview

- `train_model.py` trains a simple MLP classifier using a CSV feature dataset.
- `infer_model.py` loads the trained model weights and runs inference in pure Python.

## How to use

1. Place your dataset file at `python/exercise_landmarks.csv`.
2. The CSV must include a `label` column with values `squat`, `lunge`, or `knee-ext`.
3. Run training:

```bash
C:/Users/ibmah/AppData/Local/Programs/Python/Python314/python.exe python/train_model.py
```

4. Use `python/infer_model.py` to verify model loading.

## Notes

- This training pipeline uses scikit-learn and NumPy only.
- The saved model is exported as JSON for simple PHP integration.
