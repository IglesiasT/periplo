"""
Cliente mínimo de la API de Notion y parseo de las bases Destinations y Lugares.

La API se llama desde el backend porque no admite CORS y el token no puede llegar al navegador.
"""
import json
import urllib.error
import urllib.request
from dataclasses import dataclass, field

API = 'https://api.notion.com/v1'
VERSION = '2022-06-28'

# Status de Destinations -> Viaje.Estado
ESTADOS_DESTINO = {
    'Not started': 'deseo',
    'Investigando': 'investigando',
    'In progress': 'en_curso',
    'Done!': 'hecho',
}


class ErrorNotion(Exception):
    pass


@dataclass
class Place:
    lat: float
    lon: float
    nombre: str


@dataclass
class Destino:
    notion_id: str
    nombre: str
    estado: str                     # valor de Viaje.Estado
    place: Place | None
    lugares_ids: list[str] = field(default_factory=list)


@dataclass
class Lugar:
    notion_id: str
    nombre: str
    visitado: bool | None           # None si el Estado está vacío
    place: Place | None
    viajes_ids: list[str] = field(default_factory=list)


class ClienteNotion:
    def __init__(self, token: str):
        if not token:
            raise ErrorNotion('Falta NOTION_TOKEN en backend/.env.')
        self.token = token

    def _llamar(self, metodo: str, ruta: str, cuerpo: dict | None = None) -> dict:
        req = urllib.request.Request(
            f'{API}{ruta}',
            method=metodo,
            data=json.dumps(cuerpo).encode() if cuerpo is not None else None,
            headers={
                'Authorization': f'Bearer {self.token}',
                'Notion-Version': VERSION,
                'Content-Type': 'application/json',
            },
        )
        try:
            with urllib.request.urlopen(req) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            detalle = json.load(e)
            raise ErrorNotion(f'{metodo} {ruta}: {e.code} {detalle.get("code")} - {detalle.get("message")}') from e

    def base(self, database_id: str) -> dict:
        return self._llamar('GET', f'/databases/{database_id}')

    def filas(self, database_id: str) -> list[dict]:
        """Todas las páginas de una base. La API devuelve de a 100: hay que paginar con start_cursor."""
        filas, cursor = [], None
        while True:
            cuerpo = {'page_size': 100} | ({'start_cursor': cursor} if cursor else {})
            respuesta = self._llamar('POST', f'/databases/{database_id}/query', cuerpo)
            filas += respuesta['results']
            if not respuesta['has_more']:
                return filas
            cursor = respuesta['next_cursor']


# --- Parseo de propiedades -------------------------------------------------------------------

def texto_titulo(prop: dict) -> str:
    return ''.join(t['plain_text'] for t in prop['title']).strip()


def nombre_opcion(prop: dict) -> str | None:
    """Valor de una propiedad select o status."""
    return (prop[prop['type']] or {}).get('name')


def place(prop: dict | None) -> Place | None:
    valor = (prop or {}).get('place')
    if not valor or valor.get('lat') is None:
        return None
    return Place(lat=valor['lat'], lon=valor['lon'], nombre=valor.get('name') or '')


def ids_relacion(prop: dict) -> list[str]:
    return [r['id'] for r in prop['relation']]


def parsear_destino(pagina: dict) -> Destino:
    p = pagina['properties']
    return Destino(
        notion_id=pagina['id'],
        nombre=texto_titulo(p['Name']),
        estado=ESTADOS_DESTINO.get(nombre_opcion(p['Status']), 'deseo'),
        place=place(p.get('Place')),
        lugares_ids=ids_relacion(p['Lugares']),
    )


def parsear_lugar(pagina: dict) -> Lugar:
    p = pagina['properties']
    estado = nombre_opcion(p['Estado'])
    return Lugar(
        notion_id=pagina['id'],
        nombre=texto_titulo(p['Lugar']),
        visitado=None if estado is None else estado == 'Visitado',
        place=place(p.get('Place')),
        viajes_ids=ids_relacion(p['Viaje']),
    )
