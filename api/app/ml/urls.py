from django.urls import path

from .views import chat_view, models_view

urlpatterns = [
    path("models/", models_view, name="ml-models"),
    path("chat/", chat_view, name="ml-chat"),
]
