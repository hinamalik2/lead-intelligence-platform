# Hina Tracking SDK

JavaScript visitor tracking script for Week 1 of the lead intelligence platform.

## Installation

```html
<script>
  window.HINA_TRACKER_CONFIG = {
    apiUrl: "http://localhost:8000"
  };
</script>
<script src="tracker.js"></script>
```

Or with a data attribute:

```html
<script src="tracker.js" data-api-url="http://localhost:8000" data-site-id="demo-site"></script>
```

The tracker initializes when the page loads. It stores an anonymous visitor ID in `localStorage` and a session ID in `sessionStorage`.

## Configuration

| Key | Default | Purpose |
| --- | --- | --- |
| `apiUrl` | `http://localhost:8000` | Aysha's FastAPI origin. Do not hard-code production. |
| `siteId` | `demo-site` | Optional site identifier |
| `debug` | `false` | Log events in the browser console |
| `sessionTimeoutMs` | `1800000` (30 min) | Idle timeout that starts a new session |

Point `apiUrl` at Aysha's backend when it is available. Until then, use the local API in `/backend`.

## Events

All events POST to `{apiUrl}/events` as JSON.

### `page_view`

Sent on load.

```json
{
  "visitor_id": "visitor_12345",
  "session_id": "session_67890",
  "event_type": "page_view",
  "page_url": "/services",
  "page_title": "AI Services",
  "timestamp": "2026-09-08T10:30:00Z",
  "returning_visitor": false,
  "browser": { "user_agent": "...", "language": "en-US" }
}
```

### `click`

Sent for links, buttons, and `[data-track]` elements. Typed field values are not recorded.

```json
{
  "visitor_id": "visitor_12345",
  "session_id": "session_67890",
  "event_type": "click",
  "element": "Request Demo",
  "page_url": "/services",
  "timestamp": "2026-09-08T10:34:00Z"
}
```

### `scroll`

Sent once per milestone: 25%, 50%, 75%, 100%.

```json
{
  "event_type": "scroll",
  "scroll_percent": 75,
  "page_url": "/services"
}
```

### `form_start`

Sent the first time a visitor focuses a form field.

### `form_submit`

Sent on submit. Passwords and payment fields are ignored.

```json
{
  "event_type": "form_submit",
  "lead": { "name": "John", "email": "john@company.com", "company": "ABC Ltd" }
}
```

The same lead is also sent to `POST /leads` so the visitor stays connected to the lead.

### `page_exit`

Sent on `pagehide` / `beforeunload` with `time_spent` in seconds.

## Visitor vs session

- **Visitor ID** (`visitor_…`) lives in `localStorage` and stays the same when the person returns in that browser.
- **Session ID** (`session_…`) lives in `sessionStorage`. A new session starts after the tab session ends or after 30 minutes idle.

## Privacy

The SDK does not collect passwords, payment details, or extra personal fields. Only business lead form fields (`name`, `email`, `company`) are forwarded.

## Local demo

1. Build: `node tracker-sdk/scripts/build.js`
2. Serve the SDK folder: `python3 -m http.server 5174 --directory tracker-sdk`
3. Open `http://localhost:5174/demo/`
