import json

from rest_framework.renderers import BaseRenderer


class ServerSentEventsRenderer(BaseRenderer):
    media_type = "text/event-stream"
    format = "sse"
    charset = "utf-8"

    def render(self, data):
        if data is None:
            return b""
        if isinstance(data, (bytes, bytearray)):
            return bytes(data)
        if isinstance(data, str):
            return data.encode(self.charset)
        try:
            return json.dumps(data).encode(self.charset)
        except TypeError:
            return str(data).encode(self.charset)
