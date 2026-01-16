from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from .models import Author, Book
from .serializers import AuthorSerializer, BookSerializer


class AuthorViewSet(viewsets.ModelViewSet):
    """ViewSet for Author model."""

    queryset = Author.objects.all()
    serializer_class = AuthorSerializer
    permission_classes = [AllowAny]


class BookViewSet(viewsets.ModelViewSet):
    """ViewSet for Book model."""

    queryset = Book.objects.all()
    serializer_class = BookSerializer
    permission_classes = [AllowAny]
