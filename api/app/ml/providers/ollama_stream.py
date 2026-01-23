from __future__ import annotations

from enum import Enum


class _StreamState(Enum):
    CONTENT = "content"
    THINKING = "thinking"


class StreamParser:
    """Parses streaming LLM output and separates thinking from content.

    Emits dict events shaped like: {"type": "...", "delta": "..."}.
    """

    THINK_OPEN = "<think>"
    THINK_CLOSE = "</think>"
    THINKING_MARKER = "thinking..."
    DONE_MARKER = "done thinking"

    def __init__(self):
        self._state = _StreamState.CONTENT
        self._buffer = ""
        self._strip_next_content = False

    def _get_safe_keep_length(self) -> int:
        if self._state == _StreamState.CONTENT:
            return max(len(self.THINK_OPEN), len(self.THINKING_MARKER))
        return max(len(self.THINK_CLOSE), len(self.DONE_MARKER))

    def _find_transition_index(self) -> tuple[int, str] | None:
        lower = self._buffer.lower()

        if self._state == _StreamState.CONTENT:
            markers = [
                (lower.find(self.THINK_OPEN), self.THINK_OPEN),
                (lower.find(self.THINKING_MARKER), self.THINKING_MARKER),
            ]
        else:
            markers = [
                (lower.find(self.THINK_CLOSE), self.THINK_CLOSE),
                (lower.find(self.DONE_MARKER), self.DONE_MARKER),
            ]

        found = [(idx, marker) for idx, marker in markers if idx != -1]
        if not found:
            return None
        return min(found, key=lambda x: x[0])

    def _strip_prefix_if_needed(self, text: str) -> str:
        if self._strip_next_content:
            self._strip_next_content = False
            return text.lstrip(" \n\t.:")
        return text

    def _emit_event(self, delta: str) -> dict | None:
        if not delta:
            return None
        if self._state == _StreamState.CONTENT:
            return {
                "type": "content_delta",
                "delta": self._strip_prefix_if_needed(delta),
            }
        return {"type": "thinking_delta", "delta": delta}

    def _flush_safe(self) -> dict | None:
        keep = self._get_safe_keep_length()
        if len(self._buffer) <= keep:
            return None
        emit = self._buffer[:-keep]
        self._buffer = self._buffer[-keep:]
        return self._emit_event(emit)

    def _process_transition(self, transition_idx: int, marker: str) -> dict | None:
        event = None
        if transition_idx > 0:
            event = self._emit_event(self._buffer[:transition_idx])

        self._buffer = self._buffer[transition_idx + len(marker) :]

        if self._state == _StreamState.CONTENT:
            self._state = _StreamState.THINKING
        else:
            self._state = _StreamState.CONTENT
            self._strip_next_content = True

        return event

    def feed(self, text: str):
        if not text:
            return

        self._buffer += text

        for _ in range(100):
            transition = self._find_transition_index()

            if transition is None:
                event = self._flush_safe()
                if event:
                    yield event
                break

            idx, marker = transition
            event = self._process_transition(idx, marker)
            if event:
                yield event

    def flush(self) -> dict | None:
        if not self._buffer:
            return None
        event = self._emit_event(self._buffer)
        self._buffer = ""
        return event
