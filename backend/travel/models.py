from django.db import models
from user.models import User

class Travel(models.Model):
    destination = models.CharField(max_length=255)
    country_code = models.CharField(max_length=3, null=True, blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    start_date = models.DateField()
    end_date = models.DateField()
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    is_validated = models.BooleanField(default=False)

    def __str__(self):
        return self.destination

class Monument(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField()
    travel = models.ForeignKey(Travel, on_delete=models.CASCADE)
    ratio_validation = models.FloatField(default=50.0)
    points = models.IntegerField(default=10)

    def __str__(self):
        return self.name

class Visit(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    monument = models.ForeignKey(Monument, on_delete=models.CASCADE)
    date = models.DateField()
    rating = models.IntegerField()
    validation = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.monument.name} - {self.date}"
    
class Route(models.Model):
    travel = models.ForeignKey(Travel, on_delete=models.CASCADE, related_name='routes')
    name = models.CharField(max_length=255)
    itinerary = models.TextField()

    def __str__(self):
        return self.name