from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from guardian.shortcuts import assign_perm, get_objects_for_user
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Author, Book
from .permissions import IsEditor, Perms
from .serializers import AccessMessageSerializer, AuthorSerializer, BookSerializer


class AuthorViewSet(viewsets.ModelViewSet):
    queryset = Author.objects.all()
    serializer_class = AuthorSerializer


class BookViewSet(viewsets.ModelViewSet):
    queryset = Book.objects.all()
    serializer_class = BookSerializer


class AccessPublicViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]
    serializer_class = AccessMessageSerializer

    def list(self, _request):
        return Response({"message": "public"})


class AccessAuthenticatedViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AccessMessageSerializer

    def list(self, request):
        return Response({"message": "authenticated", "user": request.user.username})


class AccessAdminViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AccessMessageSerializer

    def list(self, request):
        return Response({"message": "admin", "user": request.user.username})


class AccessEditorViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated, IsEditor]
    serializer_class = AccessMessageSerializer

    def list(self, request):
        return Response({"message": "editor", "user": request.user.username})


class AccessEditorBooksViewSet(viewsets.GenericViewSet):
    """Books that the editor has object-level 'view_book' permission for."""

    permission_classes = [permissions.IsAuthenticated, IsEditor]
    queryset = Book.objects.all()
    serializer_class = BookSerializer

    def list(self, request):
        books = get_objects_for_user(request.user, Perms.VIEW_BOOK, klass=Book)
        return Response([{"id": b.id, "title": b.title} for b in books])

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAdminUser])
    def grant(self, request):
        """
        Grant view_book permission on this book.
        Body: {"user": "alice"} or {"group": "editor"}
        """
        book = self.get_object()
        username = request.data.get("user")
        groupname = request.data.get("group")

        if not username and not groupname:
            return Response(
                {"detail": "user or group required"}, status=status.HTTP_400_BAD_REQUEST
            )

        if username:
            user_model = get_user_model()
            try:
                target = user_model.objects.get(username=username)
            except user_model.DoesNotExist:
                return Response({"detail": "user not found"}, status=status.HTTP_404_NOT_FOUND)
            assign_perm(Perms.VIEW_BOOK, target, book)
            return Response({"granted": Perms.VIEW_BOOK, "user": username, "book": book.id})

        group, _created = Group.objects.get_or_create(name=groupname)
        assign_perm(Perms.VIEW_BOOK, group, book)
        return Response({"granted": Perms.VIEW_BOOK, "group": groupname, "book": book.id})
