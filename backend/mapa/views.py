import json
from pathlib import Path

from rest_framework.decorators import api_view
from rest_framework.response import Response

VISITAS_MVP = Path(__file__).resolve().parent / 'data' / 'visitas_mvp.json'


@api_view(['GET'])
def visitas(request):
    """Regiones visitadas. En el MVP salen de un JSON hardcodeado; después, del modelo Visita."""
    with VISITAS_MVP.open(encoding='utf-8') as f:
        return Response(json.load(f))
