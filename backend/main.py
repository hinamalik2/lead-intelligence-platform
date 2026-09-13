from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
import json

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import JSON, DateTime, Integer, String, create_engine, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DATABASE_URL = f"sqlite:///{DATA_DIR / 'tracker.db'}"

engine = create_engine(DATABASE_URL, future=True)


class Base(DeclarativeBase):
    pass


class EventRow(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    visitor_id: Mapped[str] = mapped_column(String, index=True)
    session_id: Mapped[str] = mapped_column(String, index=True)
    event_type: Mapped[str] = mapped_column(String, index=True)
    page_url: Mapped[str] = mapped_column(String, default="")
    page_title: Mapped[str] = mapped_column(String, default="")
    timestamp: Mapped[datetime] = mapped_column(DateTime, index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class LeadRow(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    visitor_id: Mapped[str] = mapped_column(String, index=True)
    session_id: Mapped[str] = mapped_column(String, default="")
    name: Mapped[str] = mapped_column(String, default="")
    email: Mapped[str] = mapped_column(String, default="")
    company: Mapped[str] = mapped_column(String, default="")
    timestamp: Mapped[datetime] = mapped_column(DateTime)


class EventIn(BaseModel):
    visitor_id: str
    session_id: str
    event_type: str
    page_url: str = ""
    page_title: str = ""
    timestamp: Optional[datetime] = None
    site_id: Optional[str] = None
    element: Optional[str] = None
    scroll_percent: Optional[int] = None
    time_spent: Optional[int] = None
    returning_visitor: Optional[bool] = None
    browser: Optional[dict[str, Any]] = None
    lead: Optional[dict[str, Any]] = None

    model_config = {"extra": "allow"}


class LeadIn(BaseModel):
    visitor_id: str
    session_id: str = ""
    name: str = ""
    email: str = ""
    company: str = ""
    page_url: str = ""
    timestamp: Optional[datetime] = None
    source_form: str = ""
    site_id: Optional[str] = None


app = FastAPI(title="Hina / Aysha compatible tracking API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    Base.metadata.create_all(engine)


def parse_time(value: Optional[datetime]) -> datetime:
    if value is None:
        return datetime.now(timezone.utc).replace(tzinfo=None)
    if value.tzinfo:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/events")
async def create_event(request: Request) -> dict[str, Any]:
    body = EventIn.model_validate(json.loads(await request.body() or b"{}"))
    stamp = parse_time(body.timestamp)
    with Session(engine) as db:
        row = EventRow(
            visitor_id=body.visitor_id,
            session_id=body.session_id,
            event_type=body.event_type,
            page_url=body.page_url,
            page_title=body.page_title,
            timestamp=stamp,
            payload=body.model_dump(mode="json"),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return {"id": row.id, "ok": True}


@app.post("/leads")
def create_lead(body: LeadIn) -> dict[str, Any]:
    stamp = parse_time(body.timestamp)
    with Session(engine) as db:
        row = LeadRow(
            visitor_id=body.visitor_id,
            session_id=body.session_id,
            name=body.name,
            email=body.email,
            company=body.company,
            timestamp=stamp,
        )
        db.add(row)
        db.add(
            EventRow(
                visitor_id=body.visitor_id,
                session_id=body.session_id,
                event_type="lead_created",
                page_url=body.page_url,
                page_title="",
                timestamp=stamp,
                payload=body.model_dump(mode="json"),
            )
        )
        db.commit()
        db.refresh(row)
        return {"id": row.id, "ok": True, "visitor_id": row.visitor_id}


@app.get("/stats")
def stats() -> dict[str, int]:
    cutoff = datetime.utcnow() - timedelta(minutes=15)
    with Session(engine) as db:
        total_visitors = db.scalar(select(func.count(func.distinct(EventRow.visitor_id)))) or 0
        active_sessions = (
            db.scalar(
                select(func.count(func.distinct(EventRow.session_id))).where(EventRow.timestamp >= cutoff)
            )
            or 0
        )
        session_counts = db.execute(
            select(EventRow.visitor_id, func.count(func.distinct(EventRow.session_id))).group_by(
                EventRow.visitor_id
            )
        ).all()
        returning = sum(1 for _, count in session_counts if count and count > 1)
        return {
            "total_visitors": total_visitors,
            "active_sessions": active_sessions,
            "returning_visitors": returning,
        }


@app.get("/events")
def list_events(limit: int = Query(100, le=500), visitor_id: Optional[str] = None) -> list[dict[str, Any]]:
    with Session(engine) as db:
        stmt = select(EventRow).order_by(EventRow.timestamp.desc()).limit(limit)
        if visitor_id:
            stmt = stmt.where(EventRow.visitor_id == visitor_id)
        rows = db.scalars(stmt).all()
        return [
            {
                "id": row.id,
                "visitor_id": row.visitor_id,
                "session_id": row.session_id,
                "event_type": row.event_type,
                "page_url": row.page_url,
                "page_title": row.page_title,
                "timestamp": row.timestamp.isoformat() + "Z",
                "payload": row.payload,
            }
            for row in rows
        ]


@app.get("/visitors")
def list_visitors() -> list[dict[str, Any]]:
    with Session(engine) as db:
        visitors = db.execute(
            select(
                EventRow.visitor_id,
                func.count(EventRow.id),
                func.max(EventRow.timestamp),
                func.count(func.distinct(EventRow.session_id)),
            ).group_by(EventRow.visitor_id)
        ).all()
        leads = {
            row.visitor_id: row
            for row in db.scalars(select(LeadRow)).all()
        }
        results = []
        for visitor_id, event_count, last_seen, session_count in visitors:
            lead = leads.get(visitor_id)
            results.append(
                {
                    "visitor_id": visitor_id,
                    "event_count": event_count,
                    "session_count": session_count,
                    "last_seen": last_seen.isoformat() + "Z" if last_seen else None,
                    "lead_status": "lead" if lead else "anonymous",
                    "lead": None
                    if not lead
                    else {
                        "name": lead.name,
                        "email": lead.email,
                        "company": lead.company,
                    },
                }
            )
        results.sort(key=lambda item: item["last_seen"] or "", reverse=True)
        return results


@app.get("/visitors/{visitor_id}")
def visitor_detail(visitor_id: str) -> dict[str, Any]:
    with Session(engine) as db:
        events = db.scalars(
            select(EventRow).where(EventRow.visitor_id == visitor_id).order_by(EventRow.timestamp.asc())
        ).all()
        if not events:
            raise HTTPException(status_code=404, detail="Visitor not found")
        lead = db.scalar(select(LeadRow).where(LeadRow.visitor_id == visitor_id))
        sessions = sorted({row.session_id for row in events})
        pages = [row.page_url for row in events if row.event_type == "page_view"]
        clicks = [row.payload.get("element") for row in events if row.event_type == "click"]
        scrolls = [
            row.payload.get("scroll_percent")
            for row in events
            if row.event_type == "scroll"
        ]
        time_spent = [
            row.payload.get("time_spent")
            for row in events
            if row.event_type == "page_exit" and row.payload.get("time_spent") is not None
        ]
        return {
            "visitor_id": visitor_id,
            "session_ids": sessions,
            "pages_viewed": pages,
            "clicks": [item for item in clicks if item],
            "scroll_depth": max([item or 0 for item in scrolls] + [0]),
            "time_spent": sum(int(item or 0) for item in time_spent),
            "lead_status": "lead" if lead else "anonymous",
            "lead": None
            if not lead
            else {"name": lead.name, "email": lead.email, "company": lead.company},
            "events": [
                {
                    "event_type": row.event_type,
                    "page_url": row.page_url,
                    "timestamp": row.timestamp.isoformat() + "Z",
                    "payload": row.payload,
                }
                for row in events
            ],
        }
