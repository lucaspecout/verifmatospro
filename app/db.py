import os
import socket
from urllib.parse import urlparse

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DEFAULT_DATABASE_URL = "postgresql+psycopg2://verif:verif@localhost:5432/verifmatos"


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

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
