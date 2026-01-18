import logging
import os
import socket
from urllib.parse import urlparse

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DEFAULT_DATABASE_URL = "postgresql+psycopg2://verif:verif@localhost:5432/verifmatos"
SQLITE_FALLBACK_URL = "sqlite:///./verifmatos.db"


def normalize_database_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.hostname != "db":
        return url
    try:
        socket.gethostbyname(parsed.hostname)
    except OSError:
        userinfo = ""
        if parsed.username:
            userinfo = parsed.username
            if parsed.password:
                userinfo += f":{parsed.password}"
            userinfo += "@"
        host = "localhost"
        if parsed.port:
            host = f"{host}:{parsed.port}"
        netloc = f"{userinfo}{host}"
        return parsed._replace(netloc=netloc).geturl()
    port = parsed.port or 5432
    try:
        with socket.create_connection((parsed.hostname, port), timeout=0.5):
            return url
    except OSError:
        userinfo = ""
        if parsed.username:
            userinfo = parsed.username
            if parsed.password:
                userinfo += f":{parsed.password}"
            userinfo += "@"
        host = f"localhost:{port}"
        netloc = f"{userinfo}{host}"
        return parsed._replace(netloc=netloc).geturl()
    return url


DATABASE_URL = normalize_database_url(os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))


def create_db_engine(database_url: str):
    engine = create_engine(database_url, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except OperationalError:
        if database_url.startswith("postgresql"):
            logging.warning(
                "PostgreSQL unavailable at startup; falling back to SQLite."
            )
            return create_engine(
                SQLITE_FALLBACK_URL, connect_args={"check_same_thread": False}
            )
        raise
    return engine


engine = create_db_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    ensure_event_node_columns()


def ensure_event_node_columns() -> None:
    inspector = inspect(engine)
    if "event_nodes" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("event_nodes")}
    missing = []
    if "last_verifier_name" not in columns:
        missing.append(
            ("last_verifier_name", "VARCHAR(80)")
        )
    if not missing:
        return
    with engine.begin() as connection:
        for column_name, column_type in missing:
            logging.warning("Adding missing column %s to event_nodes.", column_name)
            connection.execute(
                text(
                    f"ALTER TABLE event_nodes ADD COLUMN {column_name} {column_type}"
                )
            )
