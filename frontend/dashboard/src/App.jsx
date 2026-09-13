import { useEffect, useMemo, useState } from "react";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function App() {
  const [stats, setStats] = useState({ total_visitors: 0, active_sessions: 0, returning_visitors: 0 });
  const [events, setEvents] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  async function refresh() {
    try {
      const [statsRes, eventsRes, visitorsRes] = await Promise.all([
        fetch(`${API_URL}/stats`),
        fetch(`${API_URL}/events?limit=50`),
        fetch(`${API_URL}/visitors`),
      ]);
      if (!statsRes.ok) throw new Error("stats failed");
      setStats(await statsRes.json());
      setEvents(await eventsRes.json());
      setVisitors(await visitorsRes.json());
      setError("");
    } catch (err) {
      setError("Cannot reach the tracking API. Start the FastAPI backend on port 8000.");
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    fetch(`${API_URL}/visitors/${encodeURIComponent(selectedId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [selectedId, events.length]);

  const filteredVisitors = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visitors;
    return visitors.filter((row) => row.visitor_id.toLowerCase().includes(q));
  }, [visitors, query]);

  return (
    <div className="layout">
      <header>
        <div>
          <h1>Tracking dashboard</h1>
          <p>Week 1 visitor activity from the Hina SDK</p>
        </div>
        <button type="button" onClick={refresh}>
          Refresh
        </button>
      </header>

      {error ? <p className="banner">{error}</p> : null}

      <section className="cards">
        <article>
          <span>Total visitors</span>
          <strong>{stats.total_visitors}</strong>
        </article>
        <article>
          <span>Active sessions</span>
          <strong>{stats.active_sessions}</strong>
        </article>
        <article>
          <span>Returning visitors</span>
          <strong>{stats.returning_visitors}</strong>
        </article>
      </section>

      <section className="grid">
        <div className="panel">
          <h2>Visitors</h2>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter visitor ID"
          />
          <table>
            <thead>
              <tr>
                <th>Visitor</th>
                <th>Sessions</th>
                <th>Lead</th>
              </tr>
            </thead>
            <tbody>
              {filteredVisitors.map((row) => (
                <tr
                  key={row.visitor_id}
                  className={row.visitor_id === selectedId ? "active" : ""}
                  onClick={() => setSelectedId(row.visitor_id)}
                >
                  <td>
                    <button type="button" className="linkish">
                      {row.visitor_id}
                    </button>
                  </td>
                  <td>{row.session_count}</td>
                  <td>{row.lead_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>Recent activity</h2>
          <table>
            <thead>
              <tr>
                <th>Visitor</th>
                <th>Event</th>
                <th>Page</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((row) => (
                <tr key={row.id} onClick={() => setSelectedId(row.visitor_id)}>
                  <td>{row.visitor_id}</td>
                  <td>{row.event_type}</td>
                  <td>{row.page_url || "—"}</td>
                  <td>{formatTime(row.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Visitor detail</h2>
        {!detail ? (
          <p>Select a visitor to see sessions, pages, clicks, scroll, and lead status.</p>
        ) : (
          <div className="detail">
            <p><strong>Visitor ID</strong> {detail.visitor_id}</p>
            <p><strong>Session ID</strong> {detail.session_ids.join(", ")}</p>
            <p><strong>Pages viewed</strong> {detail.pages_viewed.join(", ") || "—"}</p>
            <p><strong>Clicks</strong> {detail.clicks.join(", ") || "—"}</p>
            <p><strong>Scroll depth</strong> {detail.scroll_depth}%</p>
            <p><strong>Time spent</strong> {detail.time_spent} seconds</p>
            <p><strong>Lead status</strong> {detail.lead_status}</p>
            {detail.lead ? (
              <p>
                {detail.lead.name} · {detail.lead.email} · {detail.lead.company}
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
