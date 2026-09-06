import os
import unittest

os.environ["DATABASE_URL"] = "sqlite://"

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from starlette.requests import Request
from fastapi import HTTPException

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

    def test_extra_buttons_only_appear_for_root_items(self):
        template = main.templates.env.get_template("partials/node.html")
        for parent_id in (None, self.other.id):
            with self.subTest(parent_id=parent_id):
                self.item.parent_id = parent_id
                html = template.render(
                    branch={"node": self.item, "status": "ok", "children": []},
                    event=self.event, show_parent_actions=True,
                )
                self.assertIn('data-action="bulk-ok"', html)
                for action in ("open-load-modal", "reset-item"):
                    self.assertEqual(f'data-action="{action}"' in html, parent_id is None)

    def test_nested_item_cannot_set_destination(self):
        self.item.parent_id = self.other.id
        self.db.commit()
        with self.assertRaises(HTTPException) as error:
            main.event_node_load(self.event.id, self.item.id, "VPSP 1", self.user, self.db)
        self.assertEqual(error.exception.status_code, 400)
        self.assertIsNone(self.item.load_vehicle)


if __name__ == "__main__":
    unittest.main()
