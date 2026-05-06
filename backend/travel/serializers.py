from rest_framework import serializers
from .models import Monument, Travel

class MonumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Monument
        fields = '__all__'

class TravelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Travel
        fields = '__all__'


class MapDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = Travel
        fields = ['destination', 'country_code', 'latitude', 'longitude', 'is_validated']

class TravelCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Travel
        fields = ['destination', 'country_code', 'latitude', 'longitude', 'start_date', 'end_date']