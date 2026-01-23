from django.db import models


class Author(models.Model):
    name = models.CharField(max_length=50)
    date_of_birth = models.DateField()
    date_of_death = models.DateField(null=True, blank=True)

    def __str__(self):
        return self.name


class Book(models.Model):
    title = models.CharField(max_length=100)
    author = models.ForeignKey(Author, on_delete=models.PROTECT, null=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["id"]
