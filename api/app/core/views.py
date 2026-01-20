
# Create your views here.

from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.http import require_GET


def health(_request):
    return JsonResponse({"status": "ok"})


@require_GET
def csrf(request):
    token = get_token(request)
    response = JsonResponse({"csrfToken": token})
    response["X-CSRFToken"] = token
    return response
