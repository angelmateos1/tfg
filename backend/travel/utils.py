import math

def calcular_distancia(lat1, lon1, lat2, lon2):
    """
    Calcula la distancia en metros entre dos coordenadas GPS.
    """
    R = 6371000  # Radio de la Tierra en metros

    # Convertir a radianes
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    # Fórmula Haversine
    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    distancia = R * c
    return distancia # Devuelve los metros