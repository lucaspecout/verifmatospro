import os
import unittest
from datetime import datetime
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite://"

from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import Session
from starlette.requests import Request

from app import db as database, main
from app.models import Base, Event, Lot, LotReservation, MaterialTemplate, User


class ServiceStatusTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.user = User(username="test", role="admin", password_hash="unused")
        self.bag = MaterialTemplate(name="Sac rouge", node_type="container", out_of_service=True)
        self.lot = Lot(name="Lot rouge", materials=[self.bag])
        self.event = Event(name="Poste", public_token="test", starts_at=datetime(2026, 10, 1, 8), ends_at=datetime(2026, 10, 1, 18))
        self.db.add_all([self.user, self.lot, self.event])
        self.db.commit()
        self.request = Request({"type": "http", "method": "GET", "path": "/", "headers": []})

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_status_can_be_restored_and_note_cleared(self):
        main.material_service_update(self.bag.id, "out_of_service", "Fermeture cassée", self.user, self.db)
        self.assertEqual(self.bag.service_note, "Fermeture cassée")
        main.material_service_update(self.bag.id, "available", "Ancien motif", self.user, self.db)
        self.assertFalse(self.bag.out_of_service)
        self.assertIsNone(self.bag.service_note)
        self.assertIsNone(main.lot_service_error(self.lot))

    def test_manual_lot_reservation_blocked(self):
        result = main.lot_reservation_create(self.request, self.lot.id, "Mission", "2026-10-01T08:00", "2026-10-01T18:00", "", self.user, self.db)
        self.assertIn("error=", result.headers["location"])
        self.assertIsNone(self.db.scalar(select(LotReservation)))

    def test_availability_blocks_bag_and_containing_lot(self):
        result = main.lots_availability("2026-10-01T08:00", "2026-10-01T18:00", self.user, self.db)
        self.assertEqual(result["unavailable_lots"][0]["id"], self.lot.id)
        self.assertEqual(result["template_availability"][0]["remaining"], 0)
        main.material_service_update(self.bag.id, "available", "", self.user, self.db)
        result = main.lots_availability("2026-10-01T08:00", "2026-10-01T18:00", self.user, self.db)
        self.assertEqual(result["unavailable_lots"], [])
        self.assertEqual(result["template_availability"][0]["remaining"], 1)

    def test_new_event_blocks_direct_bag_and_whole_lot(self):
        with patch.object(main, "render_event_new_page", side_effect=lambda *args, **kwargs: kwargs["error"]):
            for bag_ids, lot_ids in [([self.bag.id], []), ([], [self.lot.id])]:
                message = main.event_create(self.request, "Mission", "2026-10-01T08:00", "2026-10-01T18:00", "", bag_ids, "{}", lot_ids, self.db, self.user)
                self.assertIn("hors service", message)
        self.assertEqual(len(self.db.scalars(select(Event)).all()), 1)

    def test_existing_event_cannot_add_bag_or_lot(self):
        with patch.object(main, "render_event_materials_page", side_effect=lambda *args, **kwargs: kwargs["error"]):
            message = main.event_materials_add_from_template(self.request, self.event.id, str(self.bag.id), self.user, self.db)
            self.assertIn("hors service", message)
            message = main.event_materials_add_from_lot(self.request, self.event.id, str(self.lot.id), self.user, self.db)
            self.assertIn("hors service", message)
        self.assertIsNone(self.db.scalar(select(LotReservation)))

    def test_migration_preserves_existing_bags_and_is_repeatable(self):
        legacy = create_engine("sqlite://")
        with legacy.begin() as connection:
            connection.execute(text("CREATE TABLE material_templates (id INTEGER PRIMARY KEY, name TEXT)"))
            connection.execute(text("INSERT INTO material_templates VALUES (1, 'Sac existant')"))
        with patch.object(database, "engine", legacy):
            database.ensure_material_service_columns()
            database.ensure_material_service_columns()
        self.assertIn("service_note", {c["name"] for c in inspect(legacy).get_columns("material_templates")})
        with legacy.connect() as connection:
            self.assertEqual(connection.execute(text("SELECT name, out_of_service FROM material_templates")).one(), ("Sac existant", 0))
        legacy.dispose()


if __name__ == "__main__":
    unittest.main()
