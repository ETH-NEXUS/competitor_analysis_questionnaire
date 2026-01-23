import json
import time

from django.http import JsonResponse, StreamingHttpResponse
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    renderer_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.renderers import JSONRenderer

from ml.providers.ollama import ChatMessage, OllamaProvider, ProviderError

from .renderers import ServerSentEventsRenderer
from .serializers import ChatRequestSerializer, ModelsResponseSerializer

try:
    from drf_spectacular.utils import OpenApiResponse, extend_schema
except ImportError:

    def extend_schema(*args, **kwargs):
        def decorator(fn):
            return fn

        return decorator

    def OpenApiResponse(*args, **kwargs):
        return None


@extend_schema(
    summary="List available models",
    responses={200: ModelsResponseSerializer},
)
@api_view(["GET"])
@permission_classes([AllowAny])
@authentication_classes([])
def models_view(request):
    provider = OllamaProvider()
    try:
        models = provider.list_models()
    except ProviderError as e:
        out = ModelsResponseSerializer({"models": [], "error": str(e)})
        return JsonResponse(out.data, status=status.HTTP_502_BAD_GATEWAY)

    return JsonResponse(ModelsResponseSerializer({"models": models}).data)


def _event_stream(*, model: str, messages: list):
    started = time.monotonic()
    provider = OllamaProvider()
    try:
        for event in provider.chat_stream(
            model=model,
            messages=[ChatMessage(**m) for m in messages],
        ):
            yield f"data: {json.dumps(event)}\n\n"
    except ProviderError as e:
        yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
        return
    duration_ms = int((time.monotonic() - started) * 1000)
    yield f"data: {json.dumps({'type': 'done', 'duration_ms': duration_ms})}\n\n"


@extend_schema(
    summary="Chat with the LLM",
    description="Send a chat message and receive a streaming response via Server-Sent Events (Content-Type: text/event-stream).",
    request=ChatRequestSerializer,
    responses={
        200: OpenApiResponse(
            description="Server-Sent Events stream",
        ),
    },
)
@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])
@renderer_classes([ServerSentEventsRenderer, JSONRenderer])
def chat_view(request):
    serializer = ChatRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return JsonResponse(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    response = StreamingHttpResponse(
        _event_stream(
            model=serializer.validated_data["model"],
            messages=serializer.validated_data["messages"],
        ),
        content_type="text/event-stream; charset=utf-8",
    )
    response["Cache-Control"] = "no-cache, no-transform"
    response["X-Accel-Buffering"] = "no"
    return response
