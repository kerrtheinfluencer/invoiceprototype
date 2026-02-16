#!/usr/bin/env python3
"""Simple signup backend for Seller Tracker.

- POST /api/signup {"email":"..."}
- GET /admin/signups (HTTP Basic Auth)
  username: kxrr1
  password: Iamsuperman2021
"""

from __future__ import annotations

import base64
import json
import sqlite3
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "0.0.0.0"
PORT = 5050
DB_PATH = Path(__file__).with_name("signups.db")
ADMIN_USERNAME = "kxrr1"
ADMIN_PASSWORD = "Iamsuperman2021"


def init_db() -> None:
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS email_signups (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


class Handler(BaseHTTPRequestHandler):
    def _set_headers(self, status: int = 200, content_type: str = "application/json") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def _json(self, status: int, payload: dict) -> None:
        self._set_headers(status, "application/json")
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def _is_authorized(self) -> bool:
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Basic "):
            return False

        try:
            decoded = base64.b64decode(auth.split(" ", 1)[1]).decode("utf-8")
            username, password = decoded.split(":", 1)
        except Exception:
            return False

        return username == ADMIN_USERNAME and password == ADMIN_PASSWORD

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_POST(self):
        if self.path != "/api/signup":
            self._json(404, {"error": "Not found"})
            return

        try:
            data = self._read_json()
            email = str(data.get("email", "")).strip().lower()
            if not email or "@" not in email:
                self._json(400, {"error": "Valid email is required"})
                return

            created_at = datetime.now(timezone.utc).isoformat()
            conn = sqlite3.connect(DB_PATH)
            try:
                conn.execute(
                    "INSERT OR IGNORE INTO email_signups (email, created_at) VALUES (?, ?)",
                    (email, created_at),
                )
                conn.commit()
                cur = conn.execute("SELECT id FROM email_signups WHERE email = ?", (email,))
                row = cur.fetchone()
                signup_id = row[0] if row else None
            finally:
                conn.close()

            self._json(201, {"ok": True, "email": email, "id": signup_id})
        except json.JSONDecodeError:
            self._json(400, {"error": "Invalid JSON"})
        except Exception as exc:
            self._json(500, {"error": "Server error", "detail": str(exc)})

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"ok": True})
            return

        if self.path != "/admin/signups":
            self._json(404, {"error": "Not found"})
            return

        if not self._is_authorized():
            self.send_response(401)
            self.send_header("WWW-Authenticate", 'Basic realm="SellerTracker Admin"')
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            return

        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        try:
            rows = conn.execute(
                "SELECT id, email, created_at FROM email_signups ORDER BY id DESC"
            ).fetchall()
            payload = [{"id": r["id"], "email": r["email"], "created_at": r["created_at"]} for r in rows]
        finally:
            conn.close()

        self._json(200, {"count": len(payload), "signups": payload})


def run() -> None:
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Seller Tracker backend running on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    run()
