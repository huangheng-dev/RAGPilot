from __future__ import annotations

from collections.abc import Iterable, Mapping

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.identity.access_policy import ROLE_CAPABILITY_GRANTS
from ragpilot_api.infrastructure.database.models import Permission, Role, RolePermission


ROLE_DISPLAY_NAMES = {
    "super_admin": "Super Admin",
    "operator": "Operator",
    "reviewer": "Reviewer",
}

ROLE_DESCRIPTIONS = {
    "super_admin": "Full platform administration role.",
    "operator": "Knowledge operations role for documents, chat, workflows, and agents.",
    "reviewer": "Read-focused governance role with admin console visibility.",
}


class RolePermissionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_role_permission_slugs(self) -> dict[str, set[str]]:
        result = await self.session.execute(
            select(Role.slug, Permission.slug)
            .select_from(RolePermission)
            .join(Role, Role.id == RolePermission.role_id)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(
                Role.deleted_at.is_(None),
                Permission.deleted_at.is_(None),
                RolePermission.is_enabled.is_(True),
            )
            .order_by(Role.slug.asc(), Permission.slug.asc())
        )

        role_permissions: dict[str, set[str]] = {}
        for role_slug, permission_slug in result.all():
            role_permissions.setdefault(role_slug, set()).add(permission_slug)
        return role_permissions

    async def ensure_default_role_policy(
        self,
        role_capability_grants: Mapping[str, Iterable[str]] = ROLE_CAPABILITY_GRANTS,
    ) -> None:
        seed_policy = build_role_policy_seed(role_capability_grants)

        existing_roles = {
            role.slug: role
            for role in await self.session.scalars(select(Role).where(Role.slug.in_(seed_policy.role_slugs)))
        }
        existing_permissions = {
            permission.slug: permission
            for permission in await self.session.scalars(select(Permission).where(Permission.slug.in_(seed_policy.permission_slugs)))
        }

        for role_row in seed_policy.roles:
            if role_row["slug"] not in existing_roles:
                role = Role(**role_row)
                self.session.add(role)
                existing_roles[role.slug] = role

        for permission_row in seed_policy.permissions:
            if permission_row["slug"] not in existing_permissions:
                permission = Permission(**permission_row)
                self.session.add(permission)
                existing_permissions[permission.slug] = permission

        await self.session.flush()

        existing_pairs = {
            (role_slug, permission_slug)
            for role_slug, permission_slug in (
                await self.session.execute(
                    select(Role.slug, Permission.slug)
                    .select_from(RolePermission)
                    .join(Role, Role.id == RolePermission.role_id)
                    .join(Permission, Permission.id == RolePermission.permission_id)
                    .where(Role.slug.in_(seed_policy.role_slugs), Permission.slug.in_(seed_policy.permission_slugs))
                )
            ).all()
        }

        for role_slug, permission_slug in seed_policy.role_permissions:
            if (role_slug, permission_slug) in existing_pairs:
                continue
            self.session.add(
                RolePermission(
                    role_id=existing_roles[role_slug].id,
                    permission_id=existing_permissions[permission_slug].id,
                    is_enabled=True,
                )
            )

        await self.session.commit()


class RolePolicySeed:
    def __init__(
        self,
        *,
        roles: list[dict[str, object]],
        permissions: list[dict[str, object]],
        role_permissions: list[tuple[str, str]],
    ) -> None:
        self.roles = roles
        self.permissions = permissions
        self.role_permissions = role_permissions
        self.role_slugs = [str(role["slug"]) for role in roles]
        self.permission_slugs = [str(permission["slug"]) for permission in permissions]


def build_role_policy_seed(role_capability_grants: Mapping[str, Iterable[str]] = ROLE_CAPABILITY_GRANTS) -> RolePolicySeed:
    role_slugs = sorted(role_capability_grants)
    permission_slugs = sorted({permission_slug for grants in role_capability_grants.values() for permission_slug in grants})

    roles = [
        {
            "slug": role_slug,
            "name": ROLE_DISPLAY_NAMES.get(role_slug, role_slug.replace("_", " ").title()),
            "description": ROLE_DESCRIPTIONS.get(role_slug),
            "is_system": True,
        }
        for role_slug in role_slugs
    ]
    permissions = [
        {
            "slug": permission_slug,
            "name": permission_slug.replace("_", " ").title(),
            "category": permission_slug.split("_", 1)[0],
            "description": f"Allows {permission_slug.replace('_', ' ')}.",
            "is_system": True,
        }
        for permission_slug in permission_slugs
    ]
    role_permissions = [
        (role_slug, permission_slug)
        for role_slug in role_slugs
        for permission_slug in sorted(role_capability_grants[role_slug])
    ]

    return RolePolicySeed(roles=roles, permissions=permissions, role_permissions=role_permissions)
