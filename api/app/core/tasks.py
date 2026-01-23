from celery import shared_task


@shared_task
def example_task(message: str) -> str:
    """Example task that returns the message."""
    return f"Processed: {message}"
