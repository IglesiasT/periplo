"""
Logros: colecciones de objetivos que se cumplen visitando regiones.

Cada objetivo es un conjunto de regiones y se cumple con una visita realizada a cualquiera de ellas
o a algo que esté adentro: Tilcara cumple "Jujuy" y Jujuy cumple "Argentina". Los deseos no cuentan.
Se definen acá, en código; para sumar uno alcanza con agregarlo a LOGROS. Las rutas históricas
(la Campaña Libertadora, el Camino del Inca) son logros también: un objetivo por etapa.
"""
from collections.abc import Callable
from dataclasses import dataclass

from .arbol import ArbolRegiones
from .estadisticas import CONTINENTES
from .models import Region, Visita


@dataclass
class Objetivo:
    nombre: str
    regiones: list[str]


@dataclass
class Indice:
    """Las regiones de la base, para armar los objetivos sin una consulta por código."""

    nombres: dict[str, str]
    paises_por_continente: dict[str, list[str]]
    hijos: dict[str, list[str]]


# Arma los objetivos de un logro. Los códigos que no están en la base se ignoran.
Objetivos = Callable[[Indice], list[Objetivo]]


def regiones(*codigos: str) -> Objetivos:
    """Un objetivo por región."""
    return lambda indice: [Objetivo(indice.nombres[c], [c]) for c in codigos if c in indice.nombres]


def provincias_de(pais: str) -> Objetivos:
    return lambda indice: [Objetivo(indice.nombres[c], [c]) for c in indice.hijos.get(pais, [])]


def grupos(por_nombre: dict[str, list[str]]) -> Objetivos:
    """Objetivos con nombre propio que se cumplen con cualquiera de sus regiones."""
    def armar(indice: Indice) -> list[Objetivo]:
        objetivos = [
            Objetivo(nombre, [c for c in codigos if c in indice.nombres]) for nombre, codigos in por_nombre.items()
        ]
        return [o for o in objetivos if o.regiones]
    return armar


def continentes(*nombres: str) -> Objetivos:
    """Un objetivo por continente (nombres de Natural Earth), cumplido con cualquiera de sus países."""
    return lambda indice: [
        Objetivo(CONTINENTES.get(n, n), indice.paises_por_continente[n])
        for n in nombres if indice.paises_por_continente.get(n)
    ]


@dataclass
class Logro:
    id: str
    nombre: str
    descripcion: str
    objetivos: Objetivos


LOGROS = [
    Logro('jurisdicciones', 'Las 24 jurisdicciones', 'Todas las provincias argentinas y la Ciudad de Buenos Aires.',
          provincias_de('ARG')),
    Logro('noa', 'Noroeste', 'Las seis provincias del NOA.',
          regiones('AR-Y', 'AR-A', 'AR-T', 'AR-K', 'AR-F', 'AR-G')),
    Logro('litoral', 'Litoral', 'Las provincias de los grandes ríos.',
          regiones('AR-S', 'AR-E', 'AR-W', 'AR-N')),
    Logro('cuyo', 'Cuyo', 'Mendoza, San Juan y San Luis.',
          regiones('AR-M', 'AR-J', 'AR-D')),
    Logro('patagonia', 'Patagonia', 'De Neuquén al fin del mundo.',
          regiones('AR-Q', 'AR-R', 'AR-U', 'AR-Z', 'AR-V')),
    Logro('plata', 'Las dos orillas del Plata', 'Pisar las dos costas del Río de la Plata.',
          grupos({'Orilla argentina': ['AR-C', 'AR-B'], 'Orilla uruguaya': ['URY']})),
    Logro('estrecho', 'Las columnas de Hércules', 'Las dos orillas del Estrecho de Gibraltar.',
          regiones('ESP', 'MAR')),
    Logro('mercosur', 'Mercosur fundador', 'Los cuatro países que firmaron el Tratado de Asunción en 1991.',
          regiones('ARG', 'BRA', 'PRY', 'URY')),
    # Rutas históricas: cada objetivo es una etapa del recorrido, en el orden en que se hizo.
    Logro('campania_libertadora', 'La Campaña Libertadora',
          'Los pasos de San Martín de Mendoza a Guayaquil: el cruce de los Andes y la expedición al Perú (1817–1822).',
          grupos({
              'Mendoza: el Ejército de los Andes': ['AR-M'],
              'San Juan: el paso de Los Patos': ['AR-J'],
              'Santiago: Chacabuco y Maipú': ['CL-RM'],
              'Maule: Cancha Rayada': ['CL-ML'],
              'Valparaíso: zarpa la expedición': ['CL-VS'],
              'Ica: el desembarco en Paracas': ['PE-ICA'],
              'Lima: Huaura y la independencia': ['PER-591', 'PER-587', 'PE-CAL'],
              'Guayaquil: la entrevista con Bolívar': ['EC-G'],
          })),
    Logro('qhapaq_nan', 'Qhapaq Ñan', 'Los seis países que atraviesa el Camino del Inca.',
          regiones('COL', 'ECU', 'PER', 'BOL', 'CHL', 'ARG')),
    Logro('sudamerica', 'Sudamérica', 'Los doce países independientes del continente.',
          regiones('ARG', 'BOL', 'BRA', 'CHL', 'COL', 'ECU', 'GUY', 'PRY', 'PER', 'SUR', 'URY', 'VEN')),
    Logro('urss', 'Los sucesores de la URSS', 'Las quince repúblicas que salieron de la Unión Soviética.',
          regiones('RUS', 'UKR', 'BLR', 'MDA', 'EST', 'LVA', 'LTU', 'GEO', 'ARM', 'AZE',
                   'KAZ', 'UZB', 'TKM', 'KGZ', 'TJK')),
    Logro('continentes', 'Los seis continentes', 'Al menos un país en cada continente habitado.',
          continentes('South America', 'North America', 'Europe', 'Africa', 'Asia', 'Oceania')),
]


def calcular_logros(logros: list[Logro] = LOGROS) -> list[dict]:
    arbol = ArbolRegiones()

    paises_por_continente: dict[str, list[str]] = {}
    hijos: dict[str, list[str]] = {}
    for nodo in arbol.nodos.values():
        if nodo.nivel == Region.Nivel.PAIS and nodo.continente:
            paises_por_continente.setdefault(nodo.continente, []).append(nodo.codigo)
        if nodo.padre_id is not None:
            hijos.setdefault(arbol.nodos[nodo.padre_id].codigo, []).append(nodo.codigo)
    indice = Indice({nodo.codigo: nodo.nombre for nodo in arbol.nodos.values()}, paises_por_continente, hijos)

    # Cada región visitada y todas las que la contienen.
    alcanzadas = {
        nodo.codigo
        for region_id in Visita.objects.filter(realizada=True).values_list('region_id', flat=True)
        for nodo in arbol.hacia_arriba(region_id)
    }

    resultado = []
    for logro in logros:
        objetivos = [
            {'nombre': o.nombre, 'regiones': o.regiones, 'cumplido': any(c in alcanzadas for c in o.regiones)}
            for o in logro.objetivos(indice)
        ]
        cumplidos = sum(o['cumplido'] for o in objetivos)
        resultado.append({
            'id': logro.id,
            'nombre': logro.nombre,
            'descripcion': logro.descripcion,
            'cumplidos': cumplidos,
            'total': len(objetivos),
            'completo': bool(objetivos) and cumplidos == len(objetivos),
            'objetivos': objetivos,
        })
    return resultado
