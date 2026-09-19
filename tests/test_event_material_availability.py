import os
import unittest
from datetime import datetime

os.environ["DATABASE_URL"] = "sqlite://"

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from starlette.requests import Request
from app import main
from app.models import Base, Event, EventNode, MaterialTemplate, TemplateReservation, Lot, LotReservation, User


class EventMaterialAvailabilityTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.event = Event(name="Poste", public_token="one", starts_at=datetime(2026, 10, 1, 8), ends_at=datetime(2026, 10, 1, 18))
        self.item = MaterialTemplate(name="Radios", node_type="item", expected_qty=10)
        self.db.add_all([self.event, self.item])
        self.db.commit()
        self.user = User(role="admin")
        self.request = Request({"type": "http"})

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add(self, quantity):
        return main.event_materials_add_from_template(self.request, self.event.id, str(self.item.id), self.user, self.db, quantity)

    def test_partial_and_repeated_additions_reserve_only_requested_quantity(self):
        self.assertEqual(self.add("3").status_code, 303)
        self.assertEqual(self.add("2").status_code, 303)
        self.assertEqual(self.db.scalar(select(TemplateReservation)).quantity, 5)
        self.assertEqual([node.expected_qty for node in self.db.scalars(select(EventNode).order_by(EventNode.id))], [3, 2])
        self.assertEqual(self.item.expected_qty, 10)
        self.assertEqual(main.event_material_remaining(self.db, self.event, self.item), 5)
        self.assertEqual(self.add("6").status_code, 200)
        self.assertEqual(self.db.scalar(select(TemplateReservation)).quantity, 5)

    def test_invalid_quantities_do_not_create_material(self):
        for quantity in ("0", "-1", "1.5", "abc", "", "11"):
            self.assertEqual(self.add(quantity).status_code, 200)
            self.assertIsNone(self.db.scalar(select(EventNode)))
            self.assertIsNone(self.db.scalar(select(TemplateReservation)))

    def test_unavailable_material_is_absent_from_choices(self):
        self.item.out_of_service = True
        self.db.commit()
        response = main.event_materials(self.request, self.event.id, self.user, self.db)
        self.assertNotIn(f'data-remaining="10"', response.body.decode())
        self.assertEqual(self.add("1").status_code, 200)
        self.assertIsNone(self.db.scalar(select(EventNode)))

    def test_whole_lot_booking_blocks_direct_addition(self):
        lot = Lot(name="Lot", materials=[self.item])
        self.db.add(lot)
        self.db.flush()
        self.db.add(LotReservation(lot_id=lot.id, title="Reservation", starts_at=self.event.starts_at, ends_at=self.event.ends_at))
        self.db.commit()
        self.assertEqual(main.event_material_remaining(self.db, self.event, self.item), 0)
        self.assertEqual(self.add("1").status_code, 200)
        self.assertIsNone(self.db.scalar(select(EventNode)))

    def test_non_overlapping_bookings_use_peak_quantity(self):
        for start, end in ((8, 12), (12, 18)):
            self.db.add(TemplateReservation(template_id=self.item.id, event_id=self.event.id, quantity=6, starts_at=self.event.starts_at.replace(hour=start), ends_at=self.event.ends_at.replace(hour=end)))
        self.db.commit()
        self.assertEqual(main.event_material_remaining(self.db, self.event, self.item), 4)
        self.assertEqual(self.add("4").status_code, 303)


if __name__ == "__main__":
    unittest.main()