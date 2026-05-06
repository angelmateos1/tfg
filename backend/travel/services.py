import openai
from django.conf import settings

class AIService:
    @staticmethod
    def generar_ruta_personalizada(ciudad, monumentos_disponibles, preferencias_usuario):
        # Aquí configuramos el "prompt" que es el secreto del éxito del TFG
        prompt = f"""
        Actúa como un guía turístico experto en {ciudad}. 
        Tengo estos monumentos disponibles: {monumentos_disponibles}.
        El usuario prefiere: {preferencias_usuario}.
        Genera un itinerario optimizado por tiempo y cercanía.
        """
        
        # Llamada a la API (Simulada para que veas la estructura)
        # client = openai.OpenAI(api_key="TU_API_KEY")
        # response = client.chat.completions.create(...)
        response = {
            "choices": [
                {
                    "message": {
                        "content": "Itinerario generado: 1. Catedral, 2. Alcázar..."
                    }
                }
            ]
        }
        return response["choices"][0]["message"]["content"]