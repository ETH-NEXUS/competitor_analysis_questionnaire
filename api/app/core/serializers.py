from rest_framework import serializers

from .models import Author, Book


# Fix for spectacular, used in settings.py - leave it here
class SessionLoginTokenSerializer(serializers.Serializer):
    key = serializers.CharField(read_only=True, required=False)


class AccessMessageSerializer(serializers.Serializer):
    message = serializers.CharField()
    user = serializers.CharField(required=False)


class AuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Author
        fields = ("name", "date_of_birth")
        ref_name = 'NEXUSAuthorSerializer'


class BookSerializer(serializers.ModelSerializer):
    author = AuthorSerializer()

    class Meta:
        model = Book
        fields = "__all__"
