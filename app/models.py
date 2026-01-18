from datetime import datetime
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


lot_materials = Table(
    "lot_materials",
    Base.metadata,
    Column("lot_id", ForeignKey("lots.id"), primary_key=True),
    Column("material_template_id", ForeignKey("material_templates.id"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    must_change_password: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MaterialTemplate(Base):
    __tablename__ = "material_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    node_type: Mapped[str] = mapped_column(String(20), nullable=False)
    expected_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("material_templates.id"), nullable=True
    )

    parent = relationship("MaterialTemplate", remote_side=[id], backref="children")
    lots = relationship(
        "Lot", secondary=lot_materials, back_populates="materials", lazy="selectin"
    )


class Lot(Base):
    __tablename__ = "lots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)

    materials = relationship(
        "MaterialTemplate",
        secondary=lot_materials,
        back_populates="lots",
        lazy="selectin",
    )


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    info: Mapped[str | None] = mapped_column(Text, nullable=True)
    public_token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="open")
    verifier_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    verification_started_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    verification_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class EventNode(Base):
    __tablename__ = "event_nodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    node_type: Mapped[str] = mapped_column(String(20), nullable=False)
    expected_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("event_nodes.id"))
    status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_verifier_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    event = relationship("Event", backref="nodes")
    parent = relationship("EventNode", remote_side=[id], backref="children")
