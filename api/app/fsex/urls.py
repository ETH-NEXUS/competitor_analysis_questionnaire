"""
URL configuration for app project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from rest_framework import permissions
from rest_framework.routers import DefaultRouter

from core import views
from core.viewsets import (
    AuthorViewSet,
    BookViewSet,
    AccessAdminViewSet,
    AccessAuthenticatedViewSet,
    AccessEditorBooksViewSet,
    AccessEditorViewSet,
    AccessPublicViewSet,
)

router = DefaultRouter()
router.register("authors", AuthorViewSet, basename="author")
router.register("books", BookViewSet, basename="book")
router.register("access/public", AccessPublicViewSet, basename="access-public")
router.register("access/authenticated", AccessAuthenticatedViewSet, basename="access-authenticated")
router.register("access/admin", AccessAdminViewSet, basename="access-admin")
router.register("access/editor", AccessEditorViewSet, basename="access-editor")
router.register("access/editor-books", AccessEditorBooksViewSet, basename="access-editor-books")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/", views.health, name="health"),
    path("api/v1/auth/csrf/", views.csrf, name="csrf"),
    path("api/v1/auth/", include("dj_rest_auth.urls")),
    path("api/v1/", include(router.urls)),
    path("api/v1/ml/", include("ml.urls")),
]

if settings.DEBUG:
    from drf_spectacular.views import (
        SpectacularAPIView,
        SpectacularRedocView,
        SpectacularSwaggerView,
    )

    urlpatterns += [
        # OpenAPI 3 schema
        path(
            "api/v1/schema/",
            SpectacularAPIView.as_view(
                permission_classes=[permissions.AllowAny],
                authentication_classes=[],
            ),
            name="schema",
        ),
        # Swagger UI
        path(
            "api/v1/schema/swagger-ui/",
            SpectacularSwaggerView.as_view(url_name="schema"),
            name="schema-swagger-ui",
        ),
        # ReDoc UI (optional)
        path(
            "api/v1/schema/redoc/",
            SpectacularRedocView.as_view(url_name="schema"),
            name="schema-redoc",
        ),
    ]
