"""
Logros: colecciones de objetivos que se cumplen visitando regiones.

Cada objetivo es un conjunto de regiones y se cumple con una visita realizada a cualquiera de ellas
o a algo que esté adentro: Tilcara cumple "Jujuy" y Jujuy cumple "Argentina". Los deseos no cuentan.
Se definen acá, en código; para sumar uno alcanza con agregarlo a LOGROS. Las rutas históricas
(la Campaña Libertadora, el Camino del Inca) son logros también: un objetivo por etapa.
"""
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field

from django.db.models import Q

from .arbol import ArbolRegiones
from .estadisticas import CONTINENTES
from .estados import ids_regiones_visitadas
from .models import Region, RegionEpoca


@dataclass
class Objetivo:
    nombre: str
    regiones: list[str]


def _sin_epocas(entidad: str, anio: int) -> list[str]:
    return []


@dataclass
class Indice:
    """Las regiones de la base, para armar los objetivos sin una consulta por código."""

    nombres: dict[str, str]
    paises_por_continente: dict[str, list[str]]
    hijos: dict[str, list[str]]
    # Provincia -> su país. Un código que no está acá se toma como país.
    padres: dict[str, str] = field(default_factory=dict)
    # Las provincias que pertenecían a una entidad en un año (ver nacion_formable).
    provincias_de_entidad: Callable[[str, int], list[str]] = _sin_epocas


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


def nacion_formable(
    entidades: Iterable[tuple[str, int]] = (),
    incluir: Iterable[str] = (),
    excluir: Iterable[str] = (),
    por_provincia: bool = False,
) -> Objetivos:
    """
    Formar algo histórico, como las naciones formables de Victoria 3: pisar el territorio que tuvo en su máxima
    expansión. Parte de las fronteras de historical-basemaps (`entidades`: nombre tal cual viene en esos datos
    y año del snapshot) y se corrige a mano: `incluir` suma lo que los datos no traen, `excluir` saca el ruido
    de los bordes. En los dos, un código de país vale por todas sus provincias.

    Por defecto, un objetivo por país de hoy, que se cumple pisando una provincia de ese país que fue parte:
    Alemania cuenta para Roma si fuiste a Renania, no a Berlín. Con `por_provincia`, un objetivo por provincia,
    para lo que cabe en pocos países.
    """
    def armar(indice: Indice) -> list[Objetivo]:
        def expandir(codigos: Iterable[str]) -> set[str]:
            """Un país se convierte en sus provincias (o queda él, si no tiene); una provincia queda como está."""
            return {p for c in codigos for p in ([c] if c in indice.padres else indice.hijos.get(c) or [c])}

        provincias = {p for nombre, anio in entidades for p in indice.provincias_de_entidad(nombre, anio)}
        provincias = (provincias | expandir(incluir)) - expandir(excluir)
        provincias = {p for p in provincias if p in indice.nombres}

        if por_provincia:
            objetivos = [Objetivo(_con_pais(indice, p), [p]) for p in provincias]
        else:
            por_pais: dict[str, list[str]] = {}
            for p in provincias:
                por_pais.setdefault(indice.padres.get(p, p), []).append(p)
            objetivos = [Objetivo(indice.nombres.get(pais, pais), sorted(ps)) for pais, ps in por_pais.items()]
        return sorted(objetivos, key=lambda o: o.nombre)
    return armar


def _con_pais(indice: Indice, provincia: str) -> str:
    """'Nínive (Irak)': entre países se repiten nombres de provincia."""
    pais = indice.padres.get(provincia)
    nombre = indice.nombres[provincia]
    return f'{nombre} ({indice.nombres[pais]})' if pais in indice.nombres else nombre


# Una provincia cuenta para una entidad si la cubría al menos en esta proporción, o si se asignó por centroide.
# Saca las astillas de los bordes, donde las fronteras de historical-basemaps no coinciden con las de hoy.
SUPERFICIE_MINIMA = 50


def provincias_de_entidad(entidad: str, anio: int) -> list[str]:
    return list(
        RegionEpoca.objects
        .filter(entidad__nombre=entidad, anio=anio, region__nivel=Region.Nivel.PROVINCIA)
        .filter(Q(porcentaje_superficie__isnull=True) | Q(porcentaje_superficie__gte=SUPERFICIE_MINIMA))
        .values_list('region__codigo', flat=True)
    )


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
    # Estambul tiene las dos orillas: alcanza con ella. Si no, vale una provincia vecina de cada lado.
    Logro('bosforo', 'Las dos orillas del Bósforo', 'Europa y Asia frente a frente.',
          grupos({'Orilla europea': ['TR-34', 'TR-39', 'TR-59'], 'Orilla asiática': ['TR-34', 'TR-41', 'TR-77']})),
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
    Logro('ruta_de_la_seda', 'La Ruta de la Seda',
          "De Chang'an a Constantinopla por Asia Central, el camino de las caravanas entre China y el Mediterráneo.",
          grupos({
              "Xi'an: la antigua Chang'an": ['CN-SN'],
              'Dunhuang: las grutas de Mogao': ['CN-GS'],
              'Kashgar: el borde del Taklamakán': ['CN-XJ'],
              'Samarcanda': ['UZ-SA'],
              'Bujará': ['UZ-BU'],
              'Merv: el oasis del Karakum': ['TM-M'],
              'Nishapur: el Jorasán': ['IR-30'],
              'Rey: junto a Teherán': ['IRN-3216'],
              'Bagdad: la ciudad redonda': ['IQ-BG'],
              'Alepo: el fin del desierto': ['SY-HL'],
              'Constantinopla: la puerta de Europa': ['TR-34'],
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
    # Naciones formables: cada una en su máxima expansión. Los datos de historical-basemaps tienen años sueltos;
    # lo que no coincide con el año del snapshot se completa a mano (ver nacion_formable).
    Logro('asiria', 'Asiria', 'El Imperio neoasirio hacia el 670 a. C., con Asarhadón: de Egipto a los Zagros.',
          nacion_formable(
              [('Assyria', -700)],
              incluir=['IRQ', 'SYR', 'LBN', 'ISR', 'PSX', 'JOR', 'CYP', 'EGY',
                       # Cilicia y la Alta Mesopotamia.
                       'TR-01', 'TR-33', 'TR-80', 'TR-31', 'TR-27', 'TR-79', 'TR-63', 'TR-02', 'TR-46', 'TR-44',
                       'TR-21', 'TR-47', 'TR-72', 'TR-56', 'TR-73',
                       # Las provincias asirias de los Zagros.
                       'IR-17', 'IR-05'])),
    Logro('babilonia', 'Babilonia', 'El Imperio neobabilónico hacia el 560 a. C., de Nabucodonosor a Nabonido.',
          nacion_formable(
              [('Babylonia', -700)],
              incluir=['IRQ', 'KWT', 'SYR', 'LBN', 'ISR', 'PSX', 'JOR',
                       'IR-10',  # Susa
                       'SA-07', 'SA-03',  # Tayma y los oasis del Hiyaz, con Nabonido
                       'TR-63', 'TR-27', 'TR-79', 'TR-31'])),  # Harrán y el norte de Siria
    # El máximo fue en el 117, con Trajano: los datos del año 100 no tienen la Dacia, Armenia ni Mesopotamia.
    Logro('roma', 'Imperio romano', 'El Imperio en su máxima expansión, con Trajano en el año 117.',
          nacion_formable(
              [('Roman Empire', 100)],
              incluir=['IRQ', 'ARM',
                       'RO-AB', 'RO-HD', 'RO-CJ', 'RO-MS', 'RO-SB', 'RO-SJ', 'RO-CS', 'RO-TM', 'RO-DJ', 'RO-OT',
                       'RO-GJ', 'RO-VL', 'RO-MH'],
              excluir=['CZE'])),
    # El snapshot del 600 es el más cercano a Justiniano; la Italia entera la tuvo antes de los lombardos (568).
    Logro('bizancio', 'Imperio bizantino', 'El Imperio romano de Oriente con Justiniano, hacia el 555.',
          nacion_formable([('Eastern Roman Empire', 600)], incluir=['ITA'])),
    Logro('primer_reich', 'Primer Reich', 'El Sacro Imperio Romano Germánico hacia 1200, con Italia y Borgoña.',
          nacion_formable([('Holy Roman Empire', 1200)], incluir=['CZE'])),
    # El mapa de Wikipedia de 1789. Los datos de 1783 lo traen casi entero; se corrige lo que en 1789 era de otros.
    Logro('habsburgo', 'La Monarquía de los Habsburgo',
          'Las tierras de la casa de Austria en 1789: de los Países Bajos austríacos a Transilvania, '
          'con Bohemia, Hungría, Galitzia y la Lombardía.',
          nacion_formable(
              [('Austrian Empire', 1783), ('Austrian Netherlands', 1783), ('Milano (Austria)', 1783)],
              incluir=['LUX',
                       'RO-BV', 'RO-CV', 'RO-SB', 'RO-HD',  # el sur de Transilvania
                       'RS-07',  # Sirmia, en la Frontera Militar
                       'IT-MN', 'IT-GO',  # Mantua y Gorizia
                       'DE-BW'],  # la Austria Anterior: Brisgovia y Friburgo
              excluir=['LIE',
                       'HR-13', 'HR-15', 'HR-17', 'HR-18',  # Dalmacia e Istria, venecianas
                       'HR-19',  # la República de Ragusa
                       'IT-NO',  # Novara, sarda desde 1738
                       'BE-WLG', 'BE-VLI'])),  # el principado episcopal de Lieja
    # 1650 es el snapshot más cercano a 1683 con más territorio. Podolia es otomana desde 1672.
    Logro('otomano', 'Imperio otomano', 'La Sublime Puerta en su máxima expansión, antes del sitio de Viena (1683).',
          nacion_formable([('Ottoman Empire', 1650)], incluir=['UA-68', 'GR-M'], excluir=['SVN'])),
    Logro('virreinato', 'Virreinato del Río de la Plata',
          'El virreinato de 1776: de Patagonia al Alto Perú, con la Banda Oriental, el Paraguay y Atacama.',
          nacion_formable(incluir=['ARG', 'URY', 'PRY', 'BOL',
                                   'CL-AN',  # el litoral de Charcas
                                   'PE-PUN',  # Puno, del virreinato entre 1776 y 1796
                                   'BR-RS'])),  # las Misiones Orientales
    Logro('austria_hungria', 'Austria-Hungría', 'La monarquía dual de 1867 a 1918, ya con Bosnia.',
          nacion_formable([('Austria Hungary', 1900)],
                          incluir=['BIH', 'PL-MA', 'PL-PK'],  # Bosnia y Galitzia, que los datos dejan cortas
                          excluir=['CHE', 'DEU', 'LIE'])),
    Logro('segundo_reich', 'Segundo Reich', 'El Imperio alemán de 1871 a 1918, sin las colonias.',
          nacion_formable([('German Empire', 1914)],
                          incluir=['FR-57', 'FR-67', 'FR-68',  # Alsacia-Lorena
                                   'LT-KL',  # Memel
                                   'DK-83',  # el Schleswig del norte
                                   'BE-WLG',  # Eupen-Malmedy
                                   'RU-KGD'])),  # Prusia Oriental
    # No hay snapshot de la guerra: se arma a mano con lo anexado u ocupado por Alemania en noviembre de 1942,
    # sin los aliados ni los estados títere (Italia, Hungría, Rumania, Bulgaria, Finlandia, Eslovaquia, Croacia).
    Logro('tercer_reich', 'Tercer Reich',
          'El territorio anexado u ocupado por Alemania en su máxima expansión, en noviembre de 1942.',
          nacion_formable(
              incluir=['DEU', 'AUT', 'CZE', 'POL', 'FRA', 'BEL', 'NLD', 'LUX', 'DNK', 'NOR', 'GGY', 'JEY',
                       'SRB', 'SVN', 'LTU', 'LVA', 'EST', 'BLR', 'UKR',
                       # De Grecia, la zona alemana: Atenas, Salónica, Creta y las islas del Egeo norte.
                       # El resto del continente lo ocupó Italia; Tracia y Macedonia oriental, Bulgaria.
                       'GR-A1', 'GR-B', 'GR-M', 'GR-K',
                       'UA-43', 'UA-40',  # Crimea
                       'RU-KGD', 'RU-PSK', 'RU-NGR', 'RU-LEN', 'RU-TVE', 'RU-SMO', 'RU-KLU', 'RU-BRY', 'RU-ORL',
                       'RU-KRS', 'RU-BEL', 'RU-VOR', 'RU-ROS', 'RU-VGG', 'RU-KL', 'RU-KDA', 'RU-AD', 'RU-STA',
                       'RU-KC', 'RU-KB', 'RU-SE'],
              # Odesa y Chernivtsi eran rumanas; Transcarpatia, húngara. De Francia, la zona de ocupación italiana
              # (de los Alpes a Córcega) y los departamentos de ultramar.
              excluir=['UA-51', 'UA-77', 'UA-21',
                       'FR-06', 'FR-83', 'FR-04', 'FR-05', 'FR-73', 'FR-74', 'FR-2A', 'FR-2B',
                       'FR-GF', 'FR-GP', 'FR-MQ', 'FR-RE', 'FR-YT'])),
]


def calcular_logros(logros: list[Logro] = LOGROS) -> list[dict]:
    arbol = ArbolRegiones()

    paises_por_continente: dict[str, list[str]] = {}
    hijos: dict[str, list[str]] = {}
    padres: dict[str, str] = {}
    for nodo in arbol.nodos.values():
        if nodo.nivel == Region.Nivel.PAIS and nodo.continente:
            paises_por_continente.setdefault(nodo.continente, []).append(nodo.codigo)
        if nodo.padre_id is not None:
            hijos.setdefault(arbol.nodos[nodo.padre_id].codigo, []).append(nodo.codigo)
            if nodo.nivel == Region.Nivel.PROVINCIA:
                padres[nodo.codigo] = arbol.nodos[nodo.padre_id].codigo
    indice = Indice({nodo.codigo: nodo.nombre for nodo in arbol.nodos.values()}, paises_por_continente, hijos,
                    padres, provincias_de_entidad)

    # Cada región visitada y todas las que la contienen.
    alcanzadas = {
        nodo.codigo
        for region_id in ids_regiones_visitadas()
        for nodo in arbol.hacia_arriba(region_id)
    }

    id_por_codigo = {nodo.codigo: nodo.id for nodo in arbol.nodos.values()}

    def contenedoras(codigos: list[str]) -> list[str]:
        """Las regiones que contienen a las del objetivo: el mapa las resalta de lejos, mientras las del objetivo
        todavía no se ven (Alemania con la lente de países, en vez de Renania)."""
        arriba = {nodo.codigo for c in codigos for nodo in arbol.hacia_arriba(id_por_codigo.get(c))}
        return sorted(arriba - set(codigos))

    resultado = []
    for logro in logros:
        objetivos = [
            {'nombre': o.nombre, 'regiones': o.regiones, 'contenedoras': contenedoras(o.regiones),
             'cumplido': any(c in alcanzadas for c in o.regiones)}
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
