"""
Traduce lugares (coordenadas o nombres) a regiones del mapa.

- Coordenadas -> región: point-in-polygon contra los GeoJSON completos de data/raw/.
- Nombre -> región: primero contra los nombres de Region; si no aparece, Nominatim.
"""
import json
import math
import time
import unicodedata
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import geopandas as gpd
from django.conf import settings
from shapely.geometry import LineString, Point

from .models import Region

RAW_DIR = Path(settings.BASE_DIR) / 'data' / 'raw'

# Un punto en la costa puede caer apenas en el mar por la resolución de Natural Earth:
# si no cae dentro de ningún polígono, se acepta la región más cercana hasta esta distancia (~11 km).
DISTANCIA_MAXIMA_GRADOS = 0.1

NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
NOMINATIM_CACHE = RAW_DIR / 'nominatim_cache.json'
# Tipos de resultado que se aceptan: "Balcanes" (península) o "Cáucaso" (cordillera) quedan afuera.
NOMINATIM_TIPOS_PAIS = {'country'}
NOMINATIM_TIPOS_PROVINCIA = {'state', 'province', 'county', 'city', 'town', 'village', 'municipality'}
# Si el resultado es mucho más grande que la provincia donde cae su punto (England cae en Leicestershire),
# es algo intermedio entre provincia y país: se asigna al país.
FACTOR_MAS_GRANDE_QUE_PROVINCIA = 5


@dataclass
class Ubicacion:
    codigo: str
    metodo: str     # place | nombre | nominatim


def area_bbox_km2(bbox: list[str]) -> float:
    """Área aproximada del boundingbox de Nominatim: [sur, norte, oeste, este] en grados."""
    sur, norte, oeste, este = map(float, bbox)
    return (norte - sur) * 111 * (este - oeste) * 111 * math.cos(math.radians((norte + sur) / 2))


def normalizar(texto: str) -> str:
    """'Perú ' -> 'peru'. Sin tildes ni mayúsculas, para comparar nombres escritos a mano."""
    sin_tildes = unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode()
    return ' '.join(sin_tildes.lower().split())


class Localizador:
    """Point-in-polygon sobre países, provincias y departamentos. Carga los GeoJSON la primera vez que se usa."""

    def __init__(self):
        self._capas: dict[str, gpd.GeoDataFrame] = {}

    def _capa(self, nombre: str) -> gpd.GeoDataFrame:
        if nombre not in self._capas:
            gdf = gpd.read_file(RAW_DIR / f'{nombre}.geojson', columns=['codigo'])
            gdf.sindex  # construye el índice espacial (R-tree) una sola vez
            self._capas[nombre] = gdf
        return self._capas[nombre]

    def region_en(self, lat: float, lon: float, capa: str = 'provincias') -> str | None:
        gdf = self._capa(capa)
        punto = Point(lon, lat)  # ojo: GeoJSON y shapely usan (lon, lat)
        dentro = gdf.sindex.query(punto, predicate='intersects')
        if len(dentro):
            return gdf['codigo'].iloc[dentro[0]]
        _, cercanos = gdf.sindex.nearest(punto, max_distance=DISTANCIA_MAXIMA_GRADOS)
        return gdf['codigo'].iloc[cercanos[0]] if len(cercanos) else None

    def regiones_que_cruza(self, coordenadas: list[list[float]], capa: str = 'provincias') -> list[str]:
        """Regiones cuyo polígono interseca la línea (el índice espacial descarta primero las lejanas)."""
        gdf = self._capa(capa)
        indices = gdf.sindex.query(LineString(coordenadas), predicate='intersects')
        return list(gdf['codigo'].iloc[sorted(indices)])


class Nominatim:
    """Geocodificador de OpenStreetMap. Política de uso: máximo 1 pedido por segundo y User-Agent propio."""

    def __init__(self):
        self.cache = json.loads(NOMINATIM_CACHE.read_text(encoding='utf-8')) if NOMINATIM_CACHE.exists() else {}
        self._ultimo_pedido = 0.0

    def buscar(self, nombre: str) -> dict | None:
        if nombre not in self.cache:
            time.sleep(max(0.0, 1.1 - (time.monotonic() - self._ultimo_pedido)))
            parametros = urllib.parse.urlencode({'q': nombre, 'format': 'jsonv2', 'limit': 1})
            req = urllib.request.Request(f'{NOMINATIM_URL}?{parametros}',
                                         headers={'User-Agent': 'periplo/0.1 (mapa de viajes personal)'})
            with urllib.request.urlopen(req) as resp:
                resultados = json.load(resp)
            self._ultimo_pedido = time.monotonic()
            self.cache[nombre] = resultados[0] if resultados else None
            NOMINATIM_CACHE.write_text(json.dumps(self.cache, ensure_ascii=False, indent=1), encoding='utf-8')
        return self.cache[nombre]


class Ubicador:
    def __init__(self, usar_nominatim: bool = True):
        self.localizador = Localizador()
        self.nominatim = Nominatim() if usar_nominatim else None
        # Provincias que tienen departamentos cargados (por ahora, las argentinas del IGN).
        self.provincias_con_departamentos = set(
            Region.objects.filter(nivel=Region.Nivel.DEPARTAMENTO).values_list('padre__codigo', flat=True)
        )
        self.indice_nombres: dict[str, list[tuple[str, str]]] = {}
        self.areas: dict[str, float] = {}
        for nivel, codigo, nombre, area in Region.objects.values_list('nivel', 'codigo', 'nombre', 'area_km2'):
            self.indice_nombres.setdefault(normalizar(nombre), []).append((nivel, codigo))
            self.areas[codigo] = area or 0

    def regiones_atravesadas(self, coordenadas: list[list[float]]) -> list[str]:
        """Provincias que cruza una ruta; en las que tienen departamentos, los departamentos."""
        provincias = self.localizador.regiones_que_cruza(coordenadas)
        resultado = [c for c in provincias if c not in self.provincias_con_departamentos]
        if len(resultado) < len(provincias):
            resultado += self.localizador.regiones_que_cruza(coordenadas, capa='departamentos')
        return resultado

    def por_coordenadas(self, lat: float, lon: float, detallar: bool = False) -> Ubicacion | None:
        """Provincia donde cae el punto. Con `detallar`, baja a departamento si esa provincia los tiene."""
        codigo = self.localizador.region_en(lat, lon)
        if detallar and codigo in self.provincias_con_departamentos:
            codigo = self.localizador.region_en(lat, lon, capa='departamentos') or codigo
        return Ubicacion(codigo, 'place') if codigo else None

    def por_nombre(self, nombre: str) -> Ubicacion | None:
        return self._por_nombre_local(nombre) or self._por_nominatim(nombre)

    def _por_nombre_local(self, nombre: str) -> Ubicacion | None:
        candidatos = self.indice_nombres.get(normalizar(nombre), [])
        # Primero países; si no, provincias. Solo si el nombre es inequívoco.
        for nivel in (Region.Nivel.PAIS, Region.Nivel.PROVINCIA):
            codigos = [c for n, c in candidatos if n == nivel]
            if len(codigos) == 1:
                return Ubicacion(codigos[0], 'nombre')
        return None

    def _por_nominatim(self, nombre: str) -> Ubicacion | None:
        if self.nominatim is None:
            return None
        resultado = self.nominatim.buscar(nombre)
        if not resultado:
            return None
        lat, lon, tipo = float(resultado['lat']), float(resultado['lon']), resultado.get('addresstype')
        if tipo in NOMINATIM_TIPOS_PAIS:
            codigo = self.localizador.region_en(lat, lon, capa='paises')
        elif tipo in NOMINATIM_TIPOS_PROVINCIA:
            codigo = self.localizador.region_en(lat, lon)
            if codigo and area_bbox_km2(resultado['boundingbox']) > FACTOR_MAS_GRANDE_QUE_PROVINCIA * self.areas[codigo]:
                codigo = self.localizador.region_en(lat, lon, capa='paises')
        else:
            return None
        return Ubicacion(codigo, 'nominatim') if codigo else None
