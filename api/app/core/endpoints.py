from drf_auto_endpoint import endpoints
from .models import Book, Author
from .serializers import BookSerializer
from drf_auto_endpoint.router import register


class DefaultEndpoint(endpoints.Endpoint):
    """The default Endpoint"""

    include_str = False

    def get_url(self):
        """The core endpoint defaults to not include the application name in the apis url."""
        if hasattr(self, "url") and self.url is not None:
            return self.url

        return "{}".format(self.model_name.replace("_", "-"))


@register
class BookEndpoint(DefaultEndpoint):
    model = Book
    base_serializer = BookSerializer


@register
class AuthorEndpoint(DefaultEndpoint):
    model = Author
