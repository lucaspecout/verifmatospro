import json
import os
import unittest
from datetime import datetime
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite://"

from sqlalchemy import create_engine, event as sqlalchemy_event, select, text
from sqlalchemy.orm import Session
from starlette.requests import Request

from app import db as database, main
from app.bag_groups import inventory, set_group_members
from app.models import Base, BagGroup, Event, EventNode, Lot, MaterialTemplate, TemplateReservation, User


class BagGroupTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        @sqlalchemy_event.listens_for(self.engine, "connect")
        def enable_foreign_keys(connection, record):
            connection.execute("PRAGMA foreign_keys=ON")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, autoflush=False)
        self.user = User(role="admin", username="test")
        self.request = Request({"type": "http", "method": "GET", "path": "/materials", "headers": []})
        self.a = self.bag("Sac A")
        self.b = self.bag("Sac B")
        self.c = self.bag("Sac C")
        self.child(self.a, "Poche", "container")
        self.child(self.b, "Ancien contenu", "item", 99)
        self.child(self.c, "Indépendant", "item", 7)
        pocket = self.db.scalar(select(MaterialTemplate).where(MaterialTemplate.parent_id == self.a.id))
        nested = self.child(pocket, "Trousse", "container")
        self.child(nested, "Compresses", "item", 12)
        self.child(self.a, "Gants", "item", 4)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def bag(self, name):
        bag = MaterialTemplate(name=name, node_type="container")
        self.db.add(bag)
        self.db.flush()
        return bag

    def child(self, parent, name, kind, qty=None):
        child = MaterialTemplate(name=name, node_type=kind, expected_qty=qty, parent_id=parent.id)
        self.db.add(child)
        self.db.flush()
        return child

    def group(self):
        group = set_group_members(self.db, "Secours", [self.a.id, self.b.id], self.a.id)
        self.db.commit()
        return group

    def edit(self, bag, children, name=None):
        payload = {"root_id": bag.id, "root": {"name": name or bag.name, "type": "container", "children": children}}
        return main.materials_wizard_create(self.request, json.dumps(payload), self.db, self.user)

    def test_reference_inventory_replaces_entire_tree(self):
        expected = inventory(self.db, self.a.id)
        other = inventory(self.db, self.c.id)
        self.group()
        self.assertEqual(inventory(self.db, self.b.id), expected)
        self.assertEqual(inventory(self.db, self.c.id), other)
        self.assertEqual((self.a.name, self.b.name), ("Sac A", "Sac B"))
        self.assertEqual(len(inventory(self.db, self.b.id)[0]["children"][0]["children"]), 1)

    def test_reference_is_selection_not_lowest_id(self):
        expected = inventory(self.db, self.b.id)
        set_group_members(self.db, "Référence B", [self.b.id, self.a.id], self.b.id)
        self.db.commit()
        self.assertEqual(inventory(self.db, self.a.id), expected)

    def test_edit_any_member_propagates_names_quantities_and_reparenting(self):
        self.group()
        for bag in (self.b, self.a):
            response = self.edit(bag, [{"name": "Nouvelle poche", "type": "container", "children": [
                {"name": "Pansements", "type": "item", "qty": 23, "children": []}
            ]}], name=bag.name + " renommé")
            self.assertEqual(response.status_code, 303)
            self.assertEqual(inventory(self.db, self.a.id), inventory(self.db, self.b.id))
        self.assertEqual(self.a.name, "Sac A renommé")
        self.assertEqual(self.b.name, "Sac B renommé")

    def test_clear_inventory_and_direct_add_delete_propagate(self):
        self.group()
        self.edit(self.a, [])
        self.assertEqual(inventory(self.db, self.b.id), [])
        main.materials_create(self.request, "Gants", "item", 8, self.b.id, self.db, self.user)
        self.assertEqual(inventory(self.db, self.a.id), inventory(self.db, self.b.id))
        child = self.db.scalar(select(MaterialTemplate).where(MaterialTemplate.parent_id == self.b.id))
        main.materials_delete(child.id, self.db, self.user)
        self.assertEqual(inventory(self.db, self.a.id), [])

    def test_add_remove_and_dissolve_keep_individual_inventories(self):
        group = self.group()
        expected = inventory(self.db, self.a.id)
        set_group_members(self.db, "Nouveau nom", [self.a.id, self.c.id], self.a.id, group)
        self.db.commit()
        self.assertIsNone(self.b.group_id)
        self.assertEqual(inventory(self.db, self.c.id), expected)
        self.edit(self.a, [])
        self.assertEqual(inventory(self.db, self.b.id), expected)
        self.assertEqual(inventory(self.db, self.c.id), [])
        main.bag_group_delete(group.id, self.db, self.user)
        self.assertIsNone(self.a.group_id)
        self.assertIsNone(self.c.group_id)
        self.assertEqual(inventory(self.db, self.b.id), expected)

    def test_status_lots_reservations_and_existing_events_are_preserved(self):
        self.b.out_of_service = True
        self.b.service_note = "Fermeture cassée"
        lot = Lot(name="Lot B", materials=[self.b])
        event = Event(name="Poste", public_token="token")
        self.db.add_all([lot, event])
        self.db.flush()
        node = EventNode(event_id=event.id, name="Ancienne checklist", node_type="item", expected_qty=99)
        booking = TemplateReservation(template_id=self.b.id, event_id=event.id, quantity=1,
                                      starts_at=datetime(2026, 10, 1), ends_at=datetime(2026, 10, 2))
        self.db.add_all([node, booking])
        self.db.commit()
        self.group()
        self.edit(self.a, [])
        self.assertTrue(self.b.out_of_service)
        self.assertFalse(self.a.out_of_service)
        self.assertEqual(self.b.service_note, "Fermeture cassée")
        self.assertEqual(lot.materials[0].id, self.b.id)
        self.assertEqual(booking.template_id, self.b.id)
        self.assertEqual(node.expected_qty, 99)

    def test_invalid_selection_changes_nothing(self):
        group = self.group()
        expected = inventory(self.db, self.c.id)
        for ids in ([self.c.id], [self.c.id, self.a.id], [self.c.id, 99999]):
            with self.assertRaises(ValueError):
                set_group_members(self.db, "Invalide", ids, self.c.id)
            self.db.rollback()
            self.assertEqual(inventory(self.db, self.c.id), expected)
            self.assertIsNone(self.c.group_id)
            self.assertEqual(self.a.group_id, group.id)

    def test_delete_member_does_not_delete_other_bags(self):
        self.group()
        expected = inventory(self.db, self.b.id)
        main.materials_delete(self.a.id, self.db, self.user)
        self.assertEqual(inventory(self.db, self.b.id), expected)
        self.assertEqual(self.b.name, "Sac B")

    def test_materials_page_displays_group_and_reference_controls(self):
        self.group()
        response = main.render_materials_page(self.request, self.user, self.db)
        html = response.body.decode()
        self.assertIn("Groupe : Secours", html)
        self.assertIn('id="bag-group-reference"', html)
        self.assertIn('id="builder-group-notice"', html)

    def test_migration_keeps_legacy_inventory(self):
        legacy = create_engine("sqlite://")
        with legacy.begin() as connection:
            connection.execute(text("CREATE TABLE material_templates (id INTEGER PRIMARY KEY, name TEXT)"))
            connection.execute(text("INSERT INTO material_templates VALUES (1, 'Existant')"))
        with patch.object(database, "engine", legacy):
            database.init_db()
            database.init_db()
        with legacy.connect() as connection:
            row = connection.execute(text("SELECT name, group_id FROM material_templates")).one()
            self.assertEqual(tuple(row), ("Existant", None))
        legacy.dispose()


if __name__ == "__main__":
    unittest.main()
