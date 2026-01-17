from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
import json
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
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
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
    new_password: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    db.add(user)
    db.commit()
    return RedirectResponse("/", status_code=303)


def render_users_page(
    request: Request,
    user: User,
    db: Session,
    error: str | None = None,
    success: str | None = None,
    status_code: int = 200,
) -> HTMLResponse:
    users = db.scalars(select(User)).all()
    return templates.TemplateResponse(
        "users.html",
        {
            "request": request,
            "user": user,
            "users": users,
            "error": error,
            "success": success,
        },
        status_code=status_code,
    )


@app.get("/users", response_class=HTMLResponse)
def users_list(
    request: Request,
    user: User = Depends(require_roles(ROLE_ADMIN)),
    db: Session = Depends(get_db),
):
    return render_users_page(request, user, db)


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
        return render_users_page(
            request,
            user,
            db,
            error="Utilisateur déjà existant",
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


@app.post("/users/{user_id}/password")
def admin_change_password(
    request: Request,
    user_id: int,
    new_password: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN)),
):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404)
    target.password_hash = hash_password(new_password)
    target.must_change_password = target.id != user.id
    db.add(target)
    db.commit()
    return render_users_page(
        request,
        user,
        db,
        success=f"Mot de passe mis à jour pour {target.username}.",
    )


@app.post("/users/{user_id}/delete")
def admin_delete_user(
    request: Request,
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN)),
):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404)
    if target.id == user.id:
        return render_users_page(
            request,
            user,
            db,
            error="Impossible de supprimer votre propre compte.",
            status_code=400,
        )
    if target.role == ROLE_ADMIN:
        admins = db.scalars(select(User).where(User.role == ROLE_ADMIN)).all()
        if len(admins) <= 1:
            return render_users_page(
                request,
                user,
                db,
                error="Impossible de supprimer le dernier administrateur.",
                status_code=400,
            )
    db.delete(target)
    db.commit()
    return render_users_page(
        request,
        user,
        db,
        success=f"Compte {target.username} supprimé.",
    )


@app.get("/materials", response_class=HTMLResponse)
def materials_list(
    request: Request,
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_CHIEF)),
    db: Session = Depends(get_db),
):
    return render_materials_page(request, user, db)


def render_materials_page(
    request: Request,
    user: User,
    db: Session,
    error: str | None = None,
) -> HTMLResponse:
    materials = db.scalars(select(MaterialTemplate)).all()
    materials_index = {item.id: item.name for item in materials}
    tree = build_tree(materials)
    materials_payload = [
        {
            "id": item.id,
            "name": item.name,
            "node_type": item.node_type,
            "expected_qty": item.expected_qty,
            "parent_id": item.parent_id,
        }
        for item in materials
    ]
    return templates.TemplateResponse(
        "materials.html",
        {
            "request": request,
            "user": user,
            "tree": tree,
            "materials": materials,
            "materials_index": materials_index,
            "materials_payload": materials_payload,
            "error": error,
        },
    )


@app.post("/materials")
def materials_create(
    request: Request,
    name: str = Form(...),
    node_type: str = Form(...),
    expected_qty: int | None = Form(None),
    parent_id: int | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_CHIEF)),
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


@app.post("/materials/wizard")
def materials_wizard_create(
    request: Request,
    wizard_payload: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_CHIEF)),
):
    try:
        payload = json.loads(wizard_payload)
    except json.JSONDecodeError:
        return render_materials_page(
            request,
            user,
            db,
            error="Données du wizard invalides. Merci de réessayer.",
        )

    bag_data = payload.get("root", {}) if isinstance(payload, dict) else {}
    root_id = payload.get("root_id") if isinstance(payload, dict) else None
    if not bag_data and isinstance(payload, dict):
        bag_data = payload.get("bag", {})
    bag_name = (bag_data.get("name") or "").strip()
    children = bag_data.get("children") or []
    root_type = bag_data.get("type") or bag_data.get("node_type") or "container"
    if root_type not in {"container", "item"}:
        root_type = "container"
    if not bag_name:
        return render_materials_page(
            request,
            user,
            db,
            error="Le nom du parent est obligatoire.",
        )
    if root_type == "container" and (not isinstance(children, list) or not children):
        return render_materials_page(
            request,
            user,
            db,
            error="Ajoutez au moins un élément dans le parent.",
        )
    if root_type == "item" and children:
        return render_materials_page(
            request,
            user,
            db,
            error="Un item ne peut pas contenir de sous-éléments.",
        )

    def _safe_int(value: Any) -> int | None:
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    root_qty = _safe_int(bag_data.get("qty")) if root_type == "item" else None

    def _delete_descendants(node_id: int) -> None:
        children_nodes = db.scalars(
            select(MaterialTemplate).where(MaterialTemplate.parent_id == node_id)
        ).all()
        for child in children_nodes:
            _delete_descendants(child.id)
            db.delete(child)

    bag = None
    if root_id:
        bag = db.get(MaterialTemplate, root_id)
        if not bag:
            return render_materials_page(
                request,
                user,
                db,
                error="Le sac à modifier est introuvable.",
            )
        bag.name = bag_name
        bag.node_type = root_type
        bag.expected_qty = root_qty if root_type == "item" else None
        bag.parent_id = None
        _delete_descendants(bag.id)
    else:
        bag = MaterialTemplate(
            name=bag_name,
            node_type=root_type,
            expected_qty=root_qty if root_type == "item" else None,
            parent_id=None,
        )
        db.add(bag)
        db.flush()

    def _create_tree(node_data: Any, parent_id: int) -> None:
        if not isinstance(node_data, dict):
            return
        node_name = (node_data.get("name") or "").strip()
        if not node_name:
            return
        node_type = node_data.get("type") or node_data.get("node_type") or "container"
        if node_type not in {"container", "item"}:
            node_type = "container"
        expected_qty = _safe_int(node_data.get("qty")) if node_type == "item" else None
        node = MaterialTemplate(
            name=node_name,
            node_type=node_type,
            expected_qty=expected_qty if node_type == "item" else None,
            parent_id=parent_id,
        )
        db.add(node)
        db.flush()
        if node_type != "container":
            return
        for child in node_data.get("children") or []:
            _create_tree(child, node.id)

    for child in children:
        _create_tree(child, bag.id)
    db.commit()
    return RedirectResponse("/materials", status_code=303)


@app.get("/materials/parents/export")
def materials_parents_export(
    ids: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_CHIEF)),
):
    if not ids:
        raise HTTPException(status_code=400, detail="Aucun parent sélectionné")
    selected_ids = []
    for raw_id in ids.split(","):
        raw_id = raw_id.strip()
        if not raw_id:
            continue
        try:
            selected_ids.append(int(raw_id))
        except ValueError:
            continue
    if not selected_ids:
        raise HTTPException(status_code=400, detail="Aucun parent sélectionné")
    parents = db.scalars(
        select(MaterialTemplate).where(
            MaterialTemplate.id.in_(selected_ids),
            MaterialTemplate.parent_id.is_(None),
        )
    ).all()

    def build_tree(node: MaterialTemplate) -> dict[str, Any]:
        return {
            "name": node.name,
            "type": node.node_type,
            "qty": node.expected_qty,
            "children": [build_tree(child) for child in node.children],
        }

    payload = {"parents": [build_tree(parent) for parent in parents]}
    content = json.dumps(payload, ensure_ascii=False, indent=2)
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=parents-export.json"},
    )


@app.post("/materials/parents/import")
def materials_parents_import(
    request: Request,
    items_payload: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_CHIEF)),
):
    try:
        payload = json.loads(items_payload)
    except json.JSONDecodeError:
        return render_materials_page(
            request,
            user,
            db,
            error="Le fichier importé est invalide.",
        )
    raw_parents = payload.get("parents") if isinstance(payload, dict) else None
    if not isinstance(raw_parents, list) or not raw_parents:
        return render_materials_page(
            request,
            user,
            db,
            error="Aucun parent sélectionné pour l'import.",
        )

    def _safe_int(value: Any) -> int | None:
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _create_tree(node_data: Any, parent_id: int | None) -> bool:
        if not isinstance(node_data, dict):
            return False
        name = (node_data.get("name") or "").strip()
        if not name:
            return False
        node_type = node_data.get("type") or node_data.get("node_type") or "container"
        if node_type not in {"container", "item"}:
            node_type = "container"
        qty = _safe_int(node_data.get("qty")) if node_type == "item" else None
        node = MaterialTemplate(
            name=name,
            node_type=node_type,
            expected_qty=qty,
            parent_id=parent_id,
        )
        db.add(node)
        db.flush()
        children = node_data.get("children") if node_type == "container" else []
        if isinstance(children, list):
            for child in children:
                _create_tree(child, node.id)
        return True

    created = 0
    for parent in raw_parents:
        if _create_tree(parent, None):
            created += 1

    if not created:
        return render_materials_page(
            request,
            user,
            db,
            error="Aucun parent valide à importer.",
        )
    db.commit()
    return RedirectResponse("/materials", status_code=303)


@app.post("/materials/{material_id}/delete")
def materials_delete(
    material_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_CHIEF)),
):
    material = db.get(MaterialTemplate, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Item introuvable")

    def delete_descendants(node_id: int) -> None:
        children = db.scalars(
            select(MaterialTemplate).where(MaterialTemplate.parent_id == node_id)
        ).all()
        for child in children:
            delete_descendants(child.id)
            db.delete(child)

    delete_descendants(material.id)
    db.delete(material)
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
    items = [node for node in nodes if node.node_type == "item"]
    return templates.TemplateResponse(
        "event_detail.html",
        {
            "request": request,
            "user": user,
            "event": event,
            "tree": tree,
            "progress": progress,
            "items": items,
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


@app.post("/events/{event_id}/delete")
def event_delete(
    event_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_CHIEF)),
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404)
    nodes = db.scalars(select(EventNode).where(EventNode.event_id == event_id)).all()
    for node in nodes:
        db.delete(node)
    db.delete(event)
    db.commit()
    return RedirectResponse("/events", status_code=303)


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
            counts = compute_node_counts(node, children, status)
            items.append(
                {
                    "node": node,
                    "children": children,
                    "status": status,
                    "counts": counts,
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


def compute_node_counts(
    node: EventNode, children: list[dict[str, Any]], status: str
) -> dict[str, int]:
    if node.node_type == "item":
        return {
            "total": 1,
            "ok": 1 if status == "ok" else 0,
            "problem": 1 if status == "problem" else 0,
            "pending": 1 if status == "pending" else 0,
        }
    if not children:
        return {"total": 0, "ok": 0, "problem": 0, "pending": 0}
    totals = {"total": 0, "ok": 0, "problem": 0, "pending": 0}
    for child in children:
        for key in totals:
            totals[key] += child["counts"][key]
    return totals


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
