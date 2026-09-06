import os
import unittest

os.environ["DATABASE_URL"] = "sqlite://"

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from starlette.requests import Request

from app import main
from app.models import Base, Event, EventNode, User


class ItemActionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.user = User(username="test", role="admin")
        self.event = Event(name="Poste", public_token="test-item-actions")
        self.db.add(self.event)
        self.db.flush()
        self.item = EventNode(event_id=self.event.id, name="Radio", node_type="item", status="ok")
        self.other = EventNode(event_id=self.event.id, name="Gants", node_type="item", status="ok")
        self.db.add_all([self.item, self.other])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_item_destination_is_saved_without_marking_loaded(self):
        response = main.event_node_load(self.event.id, self.item.id, " VPSP 1 ", self.user, self.db)
        self.assertEqual(response.status_code, 200)
        self.db.refresh(self.item)
        self.assertEqual(self.item.load_vehicle, "VPSP 1")
        self.assertIsNone(self.item.loaded_at)
        self.assertIsNone(self.other.load_vehicle)

    def test_reset_item_does_not_reset_other_items(self):
        request = Request({"type": "http", "headers": [(b"accept", b"application/json")]})
        response = main.event_node_reset(request, self.event.id, self.item.id, self.user, self.db)
        self.assertEqual(response.status_code, 200)
        self.db.refresh(self.item)
        self.assertIsNone(self.item.status)
        self.assertEqual(self.other.status, "ok")


if __name__ == "__main__":
    unittest.main()
