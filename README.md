# Lead Intelligence Platform — Week 1

Hina's Week 1 deliverable: a JavaScript tracking SDK, a test website, a FastAPI receiver compatible with Aysha's `/events` and `/leads` endpoints, and a React dashboard.

```
Test Website → Hina Tracking SDK → POST /events|/leads → FastAPI → SQLite → React dashboard
```

When Aysha's PostgreSQL FastAPI URL is ready, change `HINA_TRACKER_CONFIG.apiUrl` and `VITE_API_URL`. Do not commit production keys.

## Folder structure

```
lead-intelligence-platform/
├── tracker-sdk/
│   ├── src/          tracker.js, visitor.js, session.js, events.js, config.js
│   ├── dist/tracker.js
│   ├── demo/         test website (home, services, contact form)
│   ├── tests/
│   └── README.md
├── frontend/dashboard/
└── backend/          local stand-in for Aysha's API so the week-1 flow can be demoed
```

## Run the full flow

Terminal 1 — API:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Terminal 2 — dashboard:

```bash
cd frontend/dashboard
npm install
npm run dev
```

Terminal 3 — demo website:

```bash
node tracker-sdk/scripts/build.js
python3 -m http.server 5174 --directory tracker-sdk
```

Open:

- Test site: http://localhost:5174/demo/
- Dashboard: http://localhost:5173
- API docs: http://localhost:8000/docs

## Week 1 test plan

1. New visitor opens the demo site → new visitor ID, new session, `page_view`.
2. Same visitor opens Services → same visitor, same session, new `page_view`.
3. Close the tab, return later → same visitor, new session.
4. Click **Request Demo** → `click` event.
5. Submit the contact form → `form_start`, `form_submit`, `POST /leads`, visitor marked as lead in the dashboard.

Backend errors are swallowed by the SDK (console log in debug mode) so the test site still works if the API is down.

## Point at Aysha's backend

SDK (`demo/*.html` or any host page):

```js
window.HINA_TRACKER_CONFIG = { apiUrl: "https://aysha-api.example.com" };
```

Dashboard (`frontend/dashboard/.env`):

```
VITE_API_URL=https://aysha-api.example.com
```

Expected endpoints:

- `POST /events`
- `POST /leads`
- `GET /events`, `GET /stats`, `GET /visitors`, `GET /visitors/{id}` for the dashboard
