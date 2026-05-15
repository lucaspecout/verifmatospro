from __future__ import annotations

from dataclasses import dataclass
import os
import socket
from typing import Any
from urllib.parse import urlparse


@dataclass
class LdapConfig:
    enabled: bool
    url: str
    bind_dn: str
    bind_password: str
    user_base_dn: str
    user_filter: str
    group_base_dn: str
    group_filter: str
    group_name_attr: str
    required_group: str
    group_role_map: dict[str, str]


@dataclass
class LdapUser:
    username: str
    dn: str
    email: str | None
    display_name: str | None
    role: str
    groups: list[str]


class LdapAuthError(Exception):
    pass


class LdapUnavailableError(LdapAuthError):
    pass


def normalize_role(value: str) -> str:
    cleaned = value.strip().lower().replace(" ", "").replace("_", "")
    aliases = {
        "chefdeposte": "chief",
        "chief": "chief",
        "admin": "admin",
        "stock": "stock",
        "ope": "stock",
        "operateur": "stock",
        "opérateur": "stock",
    }
    return aliases.get(cleaned, value.strip())


def parse_group_role_map(value: str) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for raw_part in value.split(","):
        part = raw_part.strip()
        if not part or ":" not in part:
            continue
        group, role = part.split(":", 1)
        group = group.strip()
        role = normalize_role(role)
        if group and role:
            mapping[group] = role
    return mapping


def ldap_config() -> LdapConfig:
    required_group = os.getenv("LDAP_GROUP_REQUIRED", "verifmatos").strip()
    role_map = parse_group_role_map(
        os.getenv("LDAP_GROUP_ROLE_MAP", f"{required_group}:chief")
    )
    if required_group and required_group not in role_map:
        role_map[required_group] = "chief"
    return LdapConfig(
        enabled=os.getenv("LDAP_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"},
        url=os.getenv("LDAP_URL", "ldap://lldap:3890"),
        bind_dn=os.getenv("LDAP_BIND_DN", ""),
        bind_password=os.getenv("LDAP_BIND_PASSWORD", ""),
        user_base_dn=os.getenv("LDAP_USER_BASE_DN", "ou=people,dc=apc38,dc=local"),
        user_filter=os.getenv("LDAP_USER_FILTER", "(|(uid={username})(mail={username}))"),
        group_base_dn=os.getenv("LDAP_GROUP_BASE_DN", "ou=groups,dc=apc38,dc=local"),
        group_filter=os.getenv("LDAP_GROUP_FILTER", "(member={user_dn})"),
        group_name_attr=os.getenv("LDAP_GROUP_NAME_ATTR", "cn"),
        required_group=required_group,
        group_role_map=role_map,
    )


def _ldap_imports() -> tuple[Any, Any, Any, Any, Any]:
    try:
        from ldap3 import ALL, Connection, Server, SUBTREE
        from ldap3.utils.conv import escape_filter_chars
    except ImportError as exc:
        raise LdapUnavailableError("La dépendance ldap3 n'est pas installée.") from exc
    return ALL, Connection, Server, SUBTREE, escape_filter_chars


def test_tcp_endpoint(config: LdapConfig) -> tuple[bool, str]:
    parsed = urlparse(config.url)
    host = parsed.hostname
    port = parsed.port or (636 if parsed.scheme == "ldaps" else 389)
    if not host:
        return False, "URL LDAP invalide"
    try:
        with socket.create_connection((host, port), timeout=3):
            return True, f"Connexion TCP OK vers {host}:{port}"
    except OSError as exc:
        return False, f"Connexion TCP impossible vers {host}:{port}: {exc}"


def _server(config: LdapConfig) -> Any:
    ALL, _Connection, Server, _SUBTREE, _escape = _ldap_imports()
    return Server(config.url, get_info=ALL, connect_timeout=5)


def admin_connection(config: LdapConfig) -> Any:
    _ALL, Connection, _Server, _SUBTREE, _escape = _ldap_imports()
    if not config.bind_dn or not config.bind_password:
        raise LdapUnavailableError("Bind DN ou mot de passe LDAP admin manquant.")
    connection = Connection(
        _server(config),
        user=config.bind_dn,
        password=config.bind_password,
        auto_bind=True,
        receive_timeout=8,
    )
    return connection


def _format_filter(template: str, **values: str) -> str:
    _ALL, _Connection, _Server, _SUBTREE, escape_filter_chars = _ldap_imports()
    escaped = {key: escape_filter_chars(value) for key, value in values.items()}
    return template.format(**escaped)


def find_user(connection: Any, config: LdapConfig, username: str) -> Any | None:
    _ALL, _Connection, _Server, SUBTREE, _escape = _ldap_imports()
    search_filter = _format_filter(config.user_filter, username=username)
    ok = connection.search(
        config.user_base_dn,
        search_filter,
        search_scope=SUBTREE,
        attributes=["uid", "mail", "cn", "display_name"],
        size_limit=2,
    )
    if not ok or not connection.entries:
        return None
    if len(connection.entries) > 1:
        raise LdapAuthError("Plusieurs utilisateurs LDAP correspondent à cet identifiant.")
    return connection.entries[0]


def user_groups(connection: Any, config: LdapConfig, user_dn: str) -> list[str]:
    _ALL, _Connection, _Server, SUBTREE, _escape = _ldap_imports()
    search_filter = _format_filter(config.group_filter, user_dn=user_dn)
    connection.search(
        config.group_base_dn,
        search_filter,
        search_scope=SUBTREE,
        attributes=[config.group_name_attr],
    )
    groups: list[str] = []
    for entry in connection.entries:
        attr = getattr(entry, config.group_name_attr, None)
        value = attr.value if attr is not None else None
        if value:
            groups.append(str(value))
    return groups


def _entry_value(entry: Any, attr_name: str) -> str | None:
    attr = getattr(entry, attr_name, None)
    value = attr.value if attr is not None else None
    return str(value) if value else None


def authenticate_ldap(username: str, password: str) -> LdapUser:
    config = ldap_config()
    if not config.enabled:
        raise LdapUnavailableError("LDAP désactivé.")
    if not password:
        raise LdapAuthError("Mot de passe LDAP manquant.")

    try:
        admin = admin_connection(config)
    except LdapAuthError:
        raise
    except Exception as exc:
        raise LdapUnavailableError(f"Bind admin LDAP impossible: {exc}") from exc
    try:
        entry = find_user(admin, config, username)
        if entry is None:
            raise LdapAuthError("Utilisateur LDAP introuvable.")
        user_dn = str(entry.entry_dn)
        user_username = _entry_value(entry, "uid") or username
        email = _entry_value(entry, "mail")
        display_name = _entry_value(entry, "cn") or _entry_value(entry, "display_name")

        _ALL, Connection, _Server, _SUBTREE, _escape = _ldap_imports()
        try:
            user_connection = Connection(
                _server(config),
                user=user_dn,
                password=password,
                auto_bind=True,
                receive_timeout=8,
            )
        except Exception as exc:
            raise LdapAuthError("Identifiants LDAP invalides.") from exc
        user_connection.unbind()

        groups = user_groups(admin, config, user_dn)
        if config.required_group not in groups:
            raise LdapAuthError("Utilisateur LDAP non membre du groupe requis.")
        role = config.group_role_map.get(config.required_group, "chief")
        return LdapUser(
            username=user_username,
            dn=user_dn,
            email=email,
            display_name=display_name,
            role=role,
            groups=groups,
        )
    except LdapAuthError:
        raise
    except Exception as exc:
        raise LdapUnavailableError(f"Erreur LDAP: {exc}") from exc
    finally:
        admin.unbind()


def run_ldap_diagnostic(test_username: str | None = None, test_password: str | None = None) -> list[dict[str, Any]]:
    config = ldap_config()
    results: list[dict[str, Any]] = []

    def add(name: str, ok: bool, detail: str) -> None:
        results.append({"name": name, "ok": ok, "detail": detail})

    add("LDAP activé", config.enabled, "LDAP_ENABLED=true" if config.enabled else "LDAP_ENABLED=false")
    tcp_ok, tcp_detail = test_tcp_endpoint(config)
    add(f"URL/port TCP {config.url}", tcp_ok, tcp_detail)
    if not config.enabled:
        return results

    try:
        connection = admin_connection(config)
        add("Bind admin", True, "Bind admin réussi")
    except Exception as exc:
        add("Bind admin", False, str(exc))
        return results

    try:
        _ALL, _Connection, _Server, SUBTREE, _escape = _ldap_imports()
        users_ok = connection.search(config.user_base_dn, "(objectClass=*)", search_scope=SUBTREE, size_limit=1)
        add("Users base DN", bool(users_ok), config.user_base_dn)
        groups_ok = connection.search(config.group_base_dn, "(objectClass=*)", search_scope=SUBTREE, size_limit=1)
        add("Groups base DN", bool(groups_ok), config.group_base_dn)
        group_filter = _format_filter(
            f"({config.group_name_attr}={{group}})",
            group=config.required_group,
        )
        group_ok = connection.search(
            config.group_base_dn,
            group_filter,
            search_scope=SUBTREE,
            attributes=[config.group_name_attr],
            size_limit=1,
        )
        add(
            f"Présence du groupe requis {config.required_group}",
            bool(group_ok and connection.entries),
            group_filter,
        )
    finally:
        connection.unbind()

    if test_username or test_password:
        if not test_username or not test_password:
            add("Test utilisateur LDAP", False, "Identifiant et mot de passe requis.")
        else:
            try:
                ldap_user = authenticate_ldap(test_username, test_password)
                add(
                    "Test utilisateur LDAP",
                    True,
                    f"{ldap_user.username} authentifié, rôle {ldap_user.role}",
                )
            except Exception as exc:
                add("Test utilisateur LDAP", False, str(exc))
    else:
        add("Test utilisateur LDAP", False, "Aucun identifiant/mot de passe fourni.")
    return results
