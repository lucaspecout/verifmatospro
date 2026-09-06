"""Synchronize catalogue inventories while retaining each physical bag's identity."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BagGroup, MaterialTemplate


def root_bag(db: Session, material: MaterialTemplate) -> MaterialTemplate:
    while material.parent_id is not None:
        material = db.get(MaterialTemplate, material.parent_id)
    return material


def lock_bag_group(db: Session, bag: MaterialTemplate) -> None:
    if bag.group_id is not None:
        db.scalar(select(BagGroup).where(BagGroup.id == bag.group_id).with_for_update())


def inventory(db: Session, parent_id: int) -> list[dict]:
    children = db.scalars(select(MaterialTemplate).where(
        MaterialTemplate.parent_id == parent_id
    ).order_by(MaterialTemplate.id)).all()
    return [
        {"name": child.name, "node_type": child.node_type,
         "expected_qty": child.expected_qty, "children": inventory(db, child.id)}
        for child in children
    ]


def delete_inventory(db: Session, parent_id: int) -> None:
    children = db.scalars(select(MaterialTemplate).where(MaterialTemplate.parent_id == parent_id)).all()
    for child in children:
        delete_inventory(db, child.id)
        db.delete(child)
    db.flush()


def copy_inventory(db: Session, parent_id: int, contents: list[dict]) -> None:
    for item in contents:
        child = MaterialTemplate(name=item["name"], node_type=item["node_type"],
                                 expected_qty=item["expected_qty"], parent_id=parent_id)
        db.add(child)
        db.flush()
        copy_inventory(db, child.id, item["children"])


def synchronize_group(db: Session, source: MaterialTemplate) -> None:
    if source.group_id is None:
        return
    db.flush()
    contents = inventory(db, source.id)
    peers = db.scalars(select(MaterialTemplate).where(
        MaterialTemplate.group_id == source.group_id,
        MaterialTemplate.id != source.id,
        MaterialTemplate.parent_id.is_(None),
    )).all()
    for peer in peers:
        delete_inventory(db, peer.id)
        copy_inventory(db, peer.id, contents)


def set_group_members(db: Session, name: str, member_ids: list[int], reference_id: int,
                      group: BagGroup | None = None) -> BagGroup:
    """Validate the complete selection before replacing any inventory."""
    name = name.strip()
    if not name or len(name) > 120:
        raise ValueError("Le nom du groupe doit contenir entre 1 et 120 caractères.")
    member_ids = list(dict.fromkeys(member_ids))
    if len(member_ids) < (1 if group else 2):
        raise ValueError("Sélectionnez au moins deux sacs pour créer un groupe, ou un sac pour conserver un groupe existant.")
    if reference_id not in member_ids:
        raise ValueError("Le sac de référence doit faire partie du groupe.")
    if group:
        db.scalar(select(BagGroup).where(BagGroup.id == group.id).with_for_update())
    bags = db.scalars(select(MaterialTemplate).where(MaterialTemplate.id.in_(member_ids))
                      .order_by(MaterialTemplate.id).with_for_update()).all()
    if len(bags) != len(member_ids) or any(b.parent_id is not None or b.node_type != "container" for b in bags):
        raise ValueError("Sélectionnez uniquement des sacs racine existants.")
    if any(b.group_id is not None and (group is None or b.group_id != group.id) for b in bags):
        raise ValueError("Un sac sélectionné appartient déjà à un autre groupe. Retirez-le de ce groupe avant de l’ajouter ici.")
    source = next(b for b in bags if b.id == reference_id)
    if group and source.group_id != group.id:
        raise ValueError("Pour ajouter des sacs, conservez un sac du groupe comme référence.")
    if group is None:
        group = BagGroup(name=name)
        db.add(group)
        db.flush()
    else:
        group.name = name
        for bag in db.scalars(select(MaterialTemplate).where(MaterialTemplate.group_id == group.id)).all():
            if bag.id not in member_ids:
                bag.group_id = None
    for bag in bags:
        bag.group_id = group.id
    synchronize_group(db, source)
    return group
