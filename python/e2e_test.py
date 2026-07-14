"""
End-to-end HTTP test for the local PHP server.
Usage:
  - Start PHP built-in server from repo root: `php -S localhost:8000 -t .`
  - Run this script inside the project venv:
      .venv\Scripts\python.exe python\e2e_test.py --base http://localhost:8000

The script will:
  1) POST to /php/login.php with seeded patient credentials
  2) Start a session via /php/session_api.php?action=start
  3) Save a few frames to /php/session_api.php?action=save_frame
  4) Call /php/infer_model.php with a sample feature vector
  5) End the session via /php/session_api.php?action=end

Note: Requires PHP server running and the DB imported (schema.sql) with seeded users.
"""

import requests
import argparse
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://localhost:8000', help='Base URL where the app is served')
args = parser.parse_args()

base = args.base.rstrip('/')
login_url = base + '/php/login.php'
start_url = base + '/php/session_api.php?action=start'
save_url = base + '/php/session_api.php?action=save_frame'
end_url = base + '/php/session_api.php?action=end'
infer_url = base + '/php/infer_model.php'
ai_api = base + '/php/ai_api.php?action=feedback'

s = requests.Session()

print('Attempting login as seeded patient...')
login_data = {'email': 'patient@test.local', 'password': 'password123', 'role': 'patient'}
resp = s.post(login_url, data=login_data, allow_redirects=False)
if resp.status_code not in (302, 303, 200):
    print('Login may have failed (no redirect). Status:', resp.status_code)
    print('Check that PHP server is running and DB has seeded users.')
    sys.exit(2)
print('Login response:', resp.status_code)

# Start session
print('Starting session...')
resp = s.post(start_url, json={'exercise': 'squat'})
print('start:', resp.status_code, resp.text)
if resp.status_code != 200:
    print('Failed to start session. Ensure server+DB are configured.')
    sys.exit(2)
data = resp.json()
session_id = data.get('session_id')
print('session_id=', session_id)

# Save a few frames
print('Saving frames...')
for i in range(3):
    frame = {
        'session_id': session_id,
        'frame_time': i * 0.5,
        'knee_angle': 120 + i,
        'hip_angle': 70 + i,
        'quality_score': 80 - i,
        'form_score': 85 - i,
        'feedback': 'auto'
    }
    r = s.post(save_url, json=frame)
    print('save_frame', i, r.status_code, r.text)

# Call inference endpoint
print('Calling inference endpoint...')
feature_vector = {
    'left_knee': 130.0,
    'right_knee': 128.0,
    'left_hip': 72.0,
    'right_hip': 74.0,
    'torso_lean': 0.06,
    'stance_width': 0.18
}
r = s.post(infer_url, json={'feature_vector': feature_vector})
print('infer status', r.status_code, r.text)

# End session
print('Ending session...')
end_payload = {'session_id': session_id, 'total_reps': 10, 'sets_done': 1, 'status': 'completed'}
r = s.post(end_url, json=end_payload)
print('end status', r.status_code, r.text)

print('E2E test completed.')
