import os
import unittest
from datetime import datetime
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite://"

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from starlette.requests import Request

from app import main
from app.models import Base, Event, EventNode, Lot, LotReservation, MaterialTemplate, TemplateReservation, User


class EventScheduleTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.start = datetime(2026, 10, 1, 8)
        self.end = datetime(2026, 10, 1, 18)
        self.bag = MaterialTemplate(name="Sac", node_type="container")
        self.lot = Lot(name="Lot", materials=[self.bag])
        self.event = Event(name="Poste", public_token="one", starts_at=self.start, ends_at=self.end, date=self.start.date())
        self.other = Event(name="Autre poste", public_token="two")
        self.db.add_all([self.lot, self.event, self.other])
        self.db.flush()
        self.booking = TemplateReservation(template_id=self.bag.id, event_id=self.event.id, quantity=1, starts_at=self.start, ends_at=self.end)
        self.lot_booking = LotReservation(lot_id=self.lot.id, event_id=self.event.id, title="Poste", reserved_items="Sac", starts_at=self.start, ends_at=self.end)
        self.node = EventNode(event_id=self.event.id, name="Sac", node_type="container", status="ok", comment="Vérifié")
        self.db.add_all([self.booking, self.lot_booking, self.node])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def check(self, start="2026-10-01T08:00", end="2026-10-01T18:00"):
        return main.check_event_schedule(self.db, self.event, start, end)

    def test_own_reservations_are_excluded(self):
        self.assertTrue(self.check()["available"])

    def test_other_reservations_block_but_adjacent_dates_do_not(self):
        self.db.add(TemplateReservation(template_id=self.bag.id, event_id=self.other.id, quantity=1, starts_at=self.start, ends_at=self.end))
        self.db.commit()
        self.assertFalse(self.check()["available"])
        self.assertTrue(self.check("2026-10-01T18:00", "2026-10-01T20:00")["available"])

    def test_manual_whole_lot_blocks(self):
        self.db.add(LotReservation(lot_id=self.lot.id, title="Manuel", starts_at=self.start, ends_at=self.end))
        self.db.commit()
        self.assertFalse(self.check()["available"])

    def test_out_of_service_and_invalid_dates_block(self):
        self.bag.out_of_service = True
        self.db.commit()
        self.assertFalse(self.check()["available"])
        self.assertFalse(self.check("invalid")["available"])
        self.assertFalse(self.check("2026-10-01T18:00")["available"])

    def test_successive_quantity_bookings_use_peak_usage(self):
        self.bag.node_type = "item"
        self.bag.expected_qty = 2
        for start, end in [(8, 12), (12, 18)]:
            self.db.add(TemplateReservation(template_id=self.bag.id, event_id=self.other.id, quantity=1, starts_at=self.start.replace(hour=start), ends_at=self.end.replace(hour=end)))
        self.db.commit()
        self.assertTrue(self.check()["available"])

    def test_update_moves_all_reservations_and_preserves_checklist(self):
        result = main.event_update_schedule(Request({"type": "http"}), self.event.id, "2026-10-03T09:00", "2026-10-04T19:00", User(role="admin"), self.db)
        self.assertEqual(result.status_code, 303)
        self.assertEqual(self.event.date, datetime(2026, 10, 3).date())
        for booking in (self.booking, self.lot_booking):
            self.assertEqual(booking.starts_at, self.event.starts_at)
            self.assertEqual(booking.ends_at, self.event.ends_at)
        self.assertEqual(self.node.status, "ok")
        self.assertEqual(self.node.comment, "Vérifié")

    def test_failed_update_keeps_original_reservations(self):
        self.bag.out_of_service = True
        self.db.commit()
        with patch.object(main, "render_event_edit_page", return_value="blocked"):
            result = main.event_update_schedule(Request({"type": "http"}), self.event.id, "2026-10-03T09:00", "2026-10-03T19:00", User(role="admin"), self.db)
        self.assertEqual(result, "blocked")
        for item in (self.event, self.booking, self.lot_booking):
            self.assertEqual(item.starts_at, self.start)
            self.assertEqual(item.ends_at, self.end)


if __name__ == "__main__":
    unittest.main()
