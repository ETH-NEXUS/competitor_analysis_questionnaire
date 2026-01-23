from rest_framework import permissions


class Groups:
    EDITOR = "editor"


class Perms:
    VIEW_BOOK = "core.view_book"


class IsEditor(permissions.BasePermission):
    def has_permission(self, request, _view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.groups.filter(name=Groups.EDITOR).exists()
        )
