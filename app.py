"""
app.py — unified entrypoint for Render
Serves:
  • /api/*        → Flask REST API (from d3.py)
  • /*            → Built React frontend (UI1/dist/)

Render build command:
  cd UI1 && npm install --include=dev && npm run build && cd .. && pip install -r requirements.txt

Render start command:
  gunicorn app:app --workers 1 --threads 4 --timeout 120
"""

import os
from flask import send_from_directory, send_file
from d3 import app  # imports the Flask app and all /api/* routes

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
DIST_DIR  = os.path.join(BASE_DIR, "UI1", "dist")

# ── Serve React static assets (JS, CSS, images) ──────────────────────────────
@app.route("/assets/<path:filename>")
def assets(filename):
    return send_from_directory(os.path.join(DIST_DIR, "assets"), filename)

# ── Catch-all: serve index.html for React Router paths ───────────────────────
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    # Don't intercept /api/* — Flask already handles those
    if path.startswith("api/"):
        from flask import abort
        abort(404)
    index = os.path.join(DIST_DIR, "index.html")
    if os.path.exists(index):
        return send_file(index)
    return "Frontend not built. Run: cd UI1 && npm run build", 404


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
