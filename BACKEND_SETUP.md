# Seller Tracker Backend

This project now includes a lightweight signup backend in `backend_server.py`.

## Run backend

```bash
python3 backend_server.py
```

It starts on `http://127.0.0.1:5050`.

## API

- `POST /api/signup`
  - JSON body: `{ "email": "user@example.com" }`
  - Stores unique email signups in `signups.db`.

- `GET /admin/signups` (Basic Auth required)
  - Username: `kxrr1`
  - Password: `Iamsuperman2021`

- `GET /health`
  - Returns `{ "ok": true }`.

## Notes

- Frontend access modal prompts first-time users for email.
- Access state is stored in browser localStorage key: `sellerTrackerAccessEmail`.
