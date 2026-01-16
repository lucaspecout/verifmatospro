from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
import secrets
from typing import Any

from fastapi import (
    Depends,
    FastAPI,
    Form,
    HTTPException,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import AuthError, create_access_token, hash_password, verify_password
from app.db import SessionLocal, init_db
from app.models import Event, EventNode, MaterialTemplate, User

app = FastAPI()

app.mount("/static", StaticFiles(directory="app/static"), name="static")

templates = Jinja2Templates(directory="app/templates")

ROLE_ADMIN = "admin"
ROLE_CHIEF = "chief"
ROLE_STOCK = "stock"


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code == 401 and "text/html" in request.headers.get("accept", ""):
        return RedirectResponse("/login", status_code=303)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


class ConnectionManager:
    def __init__(self) -> None:
        self.active: dict[int, list[WebSocket]] = defaultdict(list)

    async def connect(self, event_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active[event_id].append(websocket)

    def disconnect(self, event_id: int, websocket: WebSocket) -> None:
        if websocket in self.active.get(event_id, []):
            self.active[event_id].remove(websocket)

    async def broadcast(self, event_id: int, payload: dict[str, Any]) -> None:
        for connection in list(self.active.get(event_id, [])):
            await connection.send_json(payload)


manager = ConnectionManager()


@app.on_event("startup")
def startup() -> None:
    init_db()
    db = SessionLocal()
    try:
        admin = db.scalar(select(User).where(User.username == "admin"))
        if not admin:
            admin_user = User(
                username="admin",
                password_hash=hash_password("admin"),
                role=ROLE_ADMIN,
                must_change_password=True,
            )
            db.add(admin_user)
            db.commit()
    finally:
        db.close()


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    try:
        data = create_token_data(token)
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    user = db.scalar(select(User).where(User.username == data["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur inconnu")
    return user


def create_token_data(token: str) -> dict[str, Any]:
    from app.auth import get_token_data

    return get_token_data(token)


def require_roles(*roles: str):
    def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Accès refusé")
        return user

    return _checker


@app.get("/", response_class=HTMLResponse)
def home(request: Request, user: User = Depends(get_current_user)):
    if user.must_change_password:
        return RedirectResponse("/password", status_code=303)
    return templates.TemplateResponse(
        "home.html", {"request": request, "user": user}
    )


@app.get("/login", response_class=HTMLResponse)
def login_form(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.post("/login")
def login(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.username == username))
    if not user or not verify_password(password, user.password_hash):
        return templates.TemplateResponse(
            "login.html",
            {"request": request, "error": "Identifiants invalides"},
            status_code=401,
        )
    token = create_access_token(user.username, user.role)
    response = RedirectResponse("/", status_code=303)
    response.set_cookie("access_token", token, httponly=True)
    return response


@app.get("/logout")
def logout():
    response = RedirectResponse("/login", status_code=303)
    response.delete_cookie("access_token")
    return response


@app.get("/password", response_class=HTMLResponse)
def password_form(request: Request, user: User = Depends(get_current_user)):
    return templates.TemplateResponse(
        "password.html", {"request": request, "user": user}
    )


@app.post("/password")
def change_password(
    request: Request,
    new_password: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    db.add(user)
    db.commit()
    return templates.TemplateResponse(
        "password.html",
        {"request": request, "user": user, "success": True},
    )


@app.get("/users", response_class=HTMLResponse)
def users_list(request: Request, user: User = Depends(require_roles(ROLE_ADMIN))):
    db = SessionLocal()
    users = db.scalars(select(User)).all()
    db.close()
    return templates.TemplateResponse(
        "users.html", {"request": request, "user": user, "users": users}
    )


@app.post("/users")
def users_create(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    role: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN)),
):
    existing = db.scalar(select(User).where(User.username == username))
    if existing:
        return templates.TemplateResponse(
            "users.html",
            {
                "request": request,
                "user": user,
                "error": "Utilisateur déjà existant",
                "users": db.scalars(select(User)).all(),
            },
            status_code=400,
        )
    new_user = User(
        username=username,
        password_hash=hash_password(password),
        role=role,
        must_change_password=True,
    )
    db.add(new_user)
    db.commit()
    return RedirectResponse("/users", status_code=303)


@app.get("/materials", response_class=HTMLResponse)
def materials_list(
    request: Request,
    user: User = Depends(require_roles(ROLE_ADMIN)),
    db: Session = Depends(get_db),
):
    materials = db.scalars(select(MaterialTemplate)).all()
    tree = build_tree(materials)
    return templates.TemplateResponse(
        "materials.html",
        {"request": request, "user": user, "tree": tree, "materials": materials},
    )


@app.post("/materials")
def materials_create(
    request: Request,
    name: str = Form(...),
    node_type: str = Form(...),
    expected_qty: int | None = Form(None),
    parent_id: int | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN)),
):
    material = MaterialTemplate(
        name=name,
        node_type=node_type,
        expected_qty=expected_qty if node_type == "item" else None,
        parent_id=parent_id or None,
    )
    db.add(material)
    db.commit()
    return RedirectResponse("/materials", status_code=303)


@app.get("/events", response_class=HTMLResponse)
def events_list(
    request: Request,
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_CHIEF)),
    db: Session = Depends(get_db),
):
    events = db.scalars(select(Event)).all()
    return templates.TemplateResponse(
        "events.html", {"request": request, "user": user, "events": events}
    )


@app.get("/events/new", response_class=HTMLResponse)
def event_new_form(
    request: Request,
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_CHIEF)),
    db: Session = Depends(get_db),
):
    templates_list = db.scalars(
        select(MaterialTemplate).where(MaterialTemplate.parent_id.is_(None))
    ).all()
    return templates.TemplateResponse(
        "event_new.html",
        {"request": request, "user": user, "templates": templates_list},
    )


@app.post("/events")
def event_create(
    request: Request,
    name: str = Form(...),
    date_value: str = Form(""),
    info: str = Form(""),
    template_ids: list[int] = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_CHIEF)),
):
    parsed_date = date.fromisoformat(date_value) if date_value else None
    event = Event(
        name=name,
        date=parsed_date,
        info=info or None,
        public_token=secrets.token_urlsafe(24),
    )
    db.add(event)
    db.flush()
    for template_id in template_ids:
        root_template = db.get(MaterialTemplate, template_id)
        if root_template:
            copy_template_to_event(db, event.id, root_template, None)
    db.commit()
    return RedirectResponse("/events", status_code=303)


@app.get("/events/{event_id}", response_class=HTMLResponse)
def event_detail(
    request: Request,
    event_id: int,
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_CHIEF)),
    db: Session = Depends(get_db),
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404)
    nodes = db.scalars(select(EventNode).where(EventNode.event_id == event_id)).all()
    tree = build_tree(nodes)
    progress = compute_progress(nodes)
    return templates.TemplateResponse(
        "event_detail.html",
        {
            "request": request,
            "user": user,
            "event": event,
            "tree": tree,
            "progress": progress,
        },
    )


@app.get("/events/{event_id}/monitor", response_class=HTMLResponse)
def event_monitor(
    request: Request,
    event_id: int,
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_CHIEF)),
    db: Session = Depends(get_db),
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404)
    nodes = db.scalars(select(EventNode).where(EventNode.event_id == event_id)).all()
    tree = build_tree(nodes)
    progress = compute_progress(nodes)
    return templates.TemplateResponse(
        "event_monitor.html",
        {
            "request": request,
            "user": user,
            "event": event,
            "tree": tree,
            "progress": progress,
        },
    )


@app.post("/events/{event_id}/close")
def event_close(
    event_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_CHIEF)),
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404)
    event.status = "closed"
    db.add(event)
    db.commit()
    return RedirectResponse(f"/events/{event_id}", status_code=303)


@app.get("/public/{event_id}/{token}", response_class=HTMLResponse)
def public_entry(request: Request, event_id: int, token: str):
    db = SessionLocal()
    event = db.get(Event, event_id)
    if not event or event.public_token != token:
        db.close()
        raise HTTPException(status_code=404)
    db.close()
    return templates.TemplateResponse(
        "public_entry.html", {"request": request, "event": event}
    )


@app.post("/public/{event_id}/{token}")
def public_start(
    request: Request,
    event_id: int,
    token: str,
    name: str = Form(...),
    db: Session = Depends(get_db),
):
    event = db.get(Event, event_id)
    if not event or event.public_token != token:
        raise HTTPException(status_code=404)
    event.verifier_name = name
    event.verification_started_at = datetime.utcnow()
    db.add(event)
    db.commit()
    return RedirectResponse(f"/public/{event_id}/{token}/check", status_code=303)


@app.get("/public/{event_id}/{token}/check", response_class=HTMLResponse)
def public_check(
    request: Request,
    event_id: int,
    token: str,
    db: Session = Depends(get_db),
):
    event = db.get(Event, event_id)
    if not event or event.public_token != token:
        raise HTTPException(status_code=404)
    nodes = db.scalars(select(EventNode).where(EventNode.event_id == event_id)).all()
    tree = build_tree(nodes)
    progress = compute_progress(nodes)
    return templates.TemplateResponse(
        "public_check.html",
        {
            "request": request,
            "event": event,
            "tree": tree,
            "progress": progress,
            "token": token,
        },
    )


@app.post("/public/{event_id}/{token}/item/{node_id}")
def update_item(
    event_id: int,
    token: str,
    node_id: int,
    status: str = Form(...),
    comment: str = Form(""),
    db: Session = Depends(get_db),
):
    event = db.get(Event, event_id)
    if not event or event.public_token != token:
        raise HTTPException(status_code=404)
    node = db.get(EventNode, node_id)
    if not node or node.event_id != event_id or node.node_type != "item":
        raise HTTPException(status_code=404)
    node.status = status
    node.comment = comment or None
    node.updated_at = datetime.utcnow()
    db.add(node)
    db.commit()
    nodes = db.scalars(select(EventNode).where(EventNode.event_id == event_id)).all()
    progress = compute_progress(nodes)
    manager_payload = {
        "type": "progress",
        "progress": progress,
        "node_id": node.id,
        "status": node.status,
        "comment": node.comment or "",
    }
    try:
        import anyio

        anyio.from_thread.run(manager.broadcast, event_id, manager_payload)
    except RuntimeError:
        pass
    return RedirectResponse(f"/public/{event_id}/{token}/check", status_code=303)


@app.get("/stock/issues", response_class=HTMLResponse)
def stock_issues(
    request: Request,
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_STOCK)),
    db: Session = Depends(get_db),
):
    issues = db.scalars(select(EventNode).where(EventNode.status == "problem")).all()
    return templates.TemplateResponse(
        "stock_issues.html",
        {"request": request, "user": user, "issues": issues},
    )


@app.websocket("/ws/events/{event_id}")
async def websocket_event(websocket: WebSocket, event_id: int):
    await manager.connect(event_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(event_id, websocket)


def copy_template_to_event(
    db: Session, event_id: int, template: MaterialTemplate, parent_id: int | None
) -> None:
    node = EventNode(
        event_id=event_id,
        name=template.name,
        node_type=template.node_type,
        expected_qty=template.expected_qty,
        parent_id=parent_id,
    )
    db.add(node)
    db.flush()
    for child in template.children:
        copy_template_to_event(db, event_id, child, node.id)


def build_tree(nodes: list[Any]) -> list[dict[str, Any]]:
    nodes_by_parent: dict[int | None, list[Any]] = defaultdict(list)
    for node in nodes:
        nodes_by_parent[node.parent_id].append(node)

    def _build(parent_id: int | None) -> list[dict[str, Any]]:
        items = []
        for node in nodes_by_parent.get(parent_id, []):
            children = _build(node.id)
            status = compute_node_status(node, children)
            items.append(
                {
                    "node": node,
                    "children": children,
                    "status": status,
                }
            )
        return items

    return _build(None)


def compute_node_status(node: EventNode, children: list[dict[str, Any]]) -> str:
    if node.node_type == "item":
        node_status = getattr(node, "status", None)
        if node_status == "problem":
            return "problem"
        if node_status == "ok":
            return "ok"
        return "pending"
    if not children:
        return "pending"
    child_statuses = [child["status"] for child in children]
    if all(status == "ok" for status in child_statuses):
        return "ok"
    if any(status == "problem" for status in child_statuses):
        return "problem"
    return "pending"


def compute_progress(nodes: list[EventNode]) -> dict[str, Any]:
    items = [node for node in nodes if node.node_type == "item"]
    total = len(items)
    ok_count = len([node for node in items if node.status == "ok"])
    problem_count = len([node for node in items if node.status == "problem"])
    pending = total - ok_count - problem_count
    return {
        "total": total,
        "ok": ok_count,
        "problem": problem_count,
        "pending": pending,
        "percent": int((ok_count / total) * 100) if total else 0,
    }
