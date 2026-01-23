import json
import re
import time
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from langchain_core.messages import (  # type: ignore
    AIMessage,
    HumanMessage,
    SystemMessage,
)
from langchain_ollama import ChatOllama  # type: ignore

from .ollama_stream import StreamParser
from .prompts import THINKING_PROMPT_JSON, THINKING_PROMPT_TAGS


class ProviderError(RuntimeError):
    pass


@dataclass(frozen=True)
class ChatMessage:
    role: str
    content: str


def _ensure_http_url(value):
    value = (value or "").strip().rstrip("/")
    if value and "://" not in value:
        return f"http://{value}"
    return value


class OllamaProvider:
    name = "ollama"

    def __init__(self, base_url=None, timeout_s=None):
        self.base_url = _ensure_http_url(base_url or settings.OLLAMA_BASE_URL)
        self.timeout_s = float(timeout_s or settings.OLLAMA_TIMEOUT_S)

    def _build_lc_messages(self, system_prompt, messages):
        lc_messages = [SystemMessage(content=system_prompt)]
        for m in messages:
            if m.role == "system":
                lc_messages.append(SystemMessage(content=m.content))
            elif m.role == "assistant":
                lc_messages.append(AIMessage(content=m.content))
            else:
                lc_messages.append(HumanMessage(content=m.content))
        return lc_messages

    def _parse_json_response(self, content):
        trimmed = content.strip()
        if not (trimmed.startswith("{") and trimmed.endswith("}")):
            return content, None
        try:
            parsed = json.loads(trimmed)
        except json.JSONDecodeError:
            return content, None
        if not isinstance(parsed, dict):
            return content, None
        parsed_content = parsed.get("content")
        parsed_thinking = parsed.get("thinking")
        if isinstance(parsed_content, str):
            content = parsed_content
        thinking = (
            parsed_thinking
            if isinstance(parsed_thinking, str) and parsed_thinking
            else None
        )
        return content, thinking

    def _extract_thinking_from_extra(self, extra):
        if not isinstance(extra, dict):
            return None
        for key in ("thinking", "reasoning", "thoughts"):
            value = extra.get(key)
            if isinstance(value, str) and value:
                return value
        return None

    def _extract_thinking_from_content(self, content):
        think_match = re.search(r"<think>(.*?)</think>", content, flags=re.DOTALL)
        if think_match:
            thinking = think_match.group(1).strip() or None
            content = (
                content[: think_match.start()] + content[think_match.end() :]
            ).strip()
            return content, thinking

        marker_match = re.search(
            r"Thinking\.\.\.(.*?)Done thinking\.?",
            content,
            flags=re.DOTALL | re.IGNORECASE,
        )
        if marker_match:
            thinking = marker_match.group(1).strip() or None
            content = (
                content[: marker_match.start()] + content[marker_match.end() :]
            ).lstrip(" \n\t.:")
            return content, thinking

        return content, None

    def list_models(self):
        url = f"{self.base_url}/api/tags"
        try:
            resp = urlopen(Request(url, method="GET"), timeout=self.timeout_s)
            raw = resp.read().decode("utf-8")
        except HTTPError as e:
            raise ProviderError(
                f"Ollama HTTP error: {getattr(e, 'code', 'unknown')}"
            ) from e
        except TimeoutError as e:
            raise ProviderError(
                f"Ollama timed out after {self.timeout_s}s at {url}"
            ) from e
        except URLError as e:
            raise ProviderError(
                f"Ollama unreachable at {self.base_url} ({getattr(e, 'reason', e)})"
            ) from e

        try:
            parsed = json.loads(raw)
            models = parsed.get("models") or []
            names = [m.get("name") or m.get("model") for m in models]
            return sorted({n for n in names if n})
        except Exception as e:
            raise ProviderError("Invalid Ollama response") from e

    def chat(self, *, model, messages):
        started = time.monotonic()

        lc_messages = self._build_lc_messages(THINKING_PROMPT_JSON, messages)
        llm = ChatOllama(
            model=model, base_url=self.base_url, request_timeout=self.timeout_s
        )
        try:
            result = llm.invoke(lc_messages)
        except Exception as e:
            raise ProviderError(f"Ollama chat failed ({type(e).__name__})") from e

        content = getattr(result, "content", "") or ""
        content, thinking = self._parse_json_response(content)
        if not thinking:
            thinking = self._extract_thinking_from_extra(
                getattr(result, "additional_kwargs", None)
            )
        if not thinking:
            content, thinking = self._extract_thinking_from_content(content)
        duration_ms = int((time.monotonic() - started) * 1000)
        return content, duration_ms, thinking

    def chat_stream(self, *, model, messages):
        lc_messages = self._build_lc_messages(THINKING_PROMPT_TAGS, messages)
        llm = ChatOllama(
            model=model, base_url=self.base_url, request_timeout=self.timeout_s
        )
        parser = StreamParser()

        try:
            for chunk in llm.stream(lc_messages):
                text = self._extract_chunk_text(chunk)
                if not text:
                    continue
                yield from parser.feed(text)
        except Exception as e:
            raise ProviderError(f"Ollama chat failed ({type(e).__name__})") from e

        final_event = parser.flush()
        if final_event:
            yield final_event

    def _extract_chunk_text(self, chunk):
        text = getattr(chunk, "content", "") or ""
        if not text and getattr(chunk, "message", None) is not None:
            text = getattr(chunk.message, "content", "") or ""
        return text
