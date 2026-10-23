from django.db import models


class RegionManager(models.Manager):
    def get_by_natural_key(self, codigo):
        return self.get(codigo=codigo)


class Region(models.Model):
    """País, provincia o departamento. La geometría vive en un GeoJSON y se vincula por `codigo`."""

    class Nivel(models.TextChoices):
        PAIS = 'pais', 'País'
        PROVINCIA = 'provincia', 'Provincia'
        DEPARTAMENTO = 'departamento', 'Departamento'

    nivel = models.CharField(max_length=12, choices=Nivel.choices)
    nombre = models.CharField(max_length=200)
    codigo = models.CharField(max_length=20, unique=True, help_text='ADM0_A3, ISO 3166-2 o código GADM.')
    padre = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='hijos')
    area_km2 = models.FloatField(null=True, blank=True, help_text='Calculada en una proyección de áreas iguales.')
    continente = models.CharField(max_length=40, blank=True, help_text='Solo en países (Natural Earth).')

    objects = RegionManager()

    class Meta:
        ordering = ['codigo']
        verbose_name_plural = 'regiones'

    def __str__(self):
        return f'{self.nombre} ({self.codigo})'

    def natural_key(self):
        return (self.codigo,)

    def codigos_hacia_arriba(self) -> list[str]:
        """Su código y los de las regiones que la contienen: ['AR-38094', 'AR-Y', 'ARG']."""
        codigos, region = [], self
        while region is not None:
            codigos.append(region.codigo)
            region = region.padre
        return codigos


class Viaje(models.Model):
    class Estado(models.TextChoices):
        # Mapean el Status de la base Destinations de Notion. Es descriptivo:
        # lo que se pinta en el mapa lo decide Visita.realizada.
        DESEO = 'deseo', 'Deseo'                    # Not started
        INVESTIGANDO = 'investigando', 'Investigando'
        EN_CURSO = 'en_curso', 'En curso'           # In progress (planificando)
        HECHO = 'hecho', 'Hecho'                    # Done!

    nombre = models.CharField(max_length=200)
    estado = models.CharField(max_length=12, choices=Estado.choices, default=Estado.HECHO)
    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_fin = models.DateField(null=True, blank=True)
    notion_id = models.CharField(max_length=36, null=True, blank=True, unique=True)
    notas = models.TextField(blank=True)

    class Meta:
        ordering = ['-fecha_inicio', 'nombre']

    def __str__(self):
        return self.nombre


class Visita(models.Model):
    class TipoPresencia(models.TextChoices):
        # De más a menos intensa en el mapa.
        ESTADIA = 'estadia', 'Estadía'
        PASO = 'paso', 'De paso'
        TRANSITO = 'transito', 'Tránsito'

    # Opcional: un lugar puede estar visitado sin saber en qué viaje.
    viaje = models.ForeignKey(Viaje, null=True, blank=True, on_delete=models.CASCADE, related_name='visitas')
    region = models.ForeignKey(Region, on_delete=models.PROTECT, related_name='visitas')
    tipo_presencia = models.CharField(max_length=10, choices=TipoPresencia.choices, default=TipoPresencia.ESTADIA)
    realizada = models.BooleanField(default=True, help_text='Falso = todavía no fui: se pinta como deseo.')
    desde_notion = models.BooleanField(default=False, editable=False,
                                       help_text='La creó sincronizar_notion, que la regenera en cada corrida.')

    class Meta:
        constraints = [models.UniqueConstraint(fields=['viaje', 'region'], name='visita_unica_por_viaje')]

    def __str__(self):
        estado = self.get_tipo_presencia_display() if self.realizada else 'deseo'
        return f'{self.viaje or "Sin viaje"} → {self.region} ({estado})'


class Ruta(models.Model):
    """Recorrido de un viaje: importado de GPX/KML o dibujado en el mapa."""

    class Origen(models.TextChoices):
        GPX = 'gpx', 'GPX'
        KML = 'kml', 'KML'
        DIBUJADA = 'dibujada', 'Dibujada'

    viaje = models.ForeignKey(Viaje, on_delete=models.CASCADE, related_name='rutas')
    nombre = models.CharField(max_length=200, blank=True)
    # LineString como lista de [lon, lat], el mismo orden que GeoJSON.
    coordenadas = models.JSONField()
    longitud_km = models.FloatField(help_text='Geodésica, sobre el elipsoide WGS84.')
    origen = models.CharField(max_length=10, choices=Origen.choices)

    def __str__(self):
        return f'{self.nombre or "Ruta"} ({self.longitud_km:.0f} km)'


class Foto(models.Model):
    """Foto subida desde la app. Si trae GPS en el EXIF, se ubica sola en el mapa."""

    viaje = models.ForeignKey(Viaje, null=True, blank=True, on_delete=models.CASCADE, related_name='fotos')
    visita = models.ForeignKey(Visita, null=True, blank=True, on_delete=models.SET_NULL, related_name='fotos')
    archivo = models.ImageField(upload_to='fotos/%Y/%m/')
    miniatura = models.ImageField(upload_to='fotos/miniaturas/', blank=True)
    # Del EXIF, si están.
    lat = models.FloatField(null=True, blank=True)
    lon = models.FloatField(null=True, blank=True)
    tomada_en = models.DateTimeField(null=True, blank=True)
    # Región donde cae (lat, lon), calculada al subirla.
    region = models.ForeignKey(Region, null=True, blank=True, on_delete=models.SET_NULL, related_name='fotos')
    descripcion = models.TextField(blank=True)

    class Meta:
        ordering = ['tomada_en', 'id']

    def __str__(self):
        return self.archivo.name


class EntidadPoliticaHistorica(models.Model):
    """Imperio, reino, estado o cultura de los snapshots de historical-basemaps.
    El mismo nombre en distintos años es la misma entidad."""

    nombre = models.CharField(max_length=200, unique=True, help_text='Tal cual viene en historical-basemaps.')
    nombre_es = models.CharField(max_length=200, blank=True,
                                 help_text='Vacío si es igual al original. Sale de data/entidades_es.json.')
    color = models.CharField(max_length=7, blank=True, help_text='Hex (#rrggbb) para pintarla en el mapa.')

    class Meta:
        ordering = ['nombre']
        verbose_name = 'entidad política histórica'
        verbose_name_plural = 'entidades políticas históricas'

    def __str__(self):
        return self.nombre


class RegionEpoca(models.Model):
    """A qué entidad pertenecía una región en un año con snapshot. Una región que cae entre
    varias entidades tiene una fila por cada una, con su porcentaje de superficie."""

    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name='epocas')
    anio = models.IntegerField(help_text='Año del snapshot; los a. C. van en negativo.')
    entidad = models.ForeignKey(EntidadPoliticaHistorica, on_delete=models.CASCADE, related_name='regiones')
    porcentaje_superficie = models.FloatField(null=True, blank=True,
                                              help_text='Vacío si se asignó por centroide.')

    class Meta:
        ordering = ['anio', 'region', '-porcentaje_superficie']
        verbose_name = 'región en una época'
        verbose_name_plural = 'regiones en cada época'
        constraints = [models.UniqueConstraint(fields=['region', 'anio', 'entidad'], name='region_epoca_unica')]
        indexes = [models.Index(fields=['anio', 'entidad'])]

    def __str__(self):
        pct = f' ({self.porcentaje_superficie:.0f}%)' if self.porcentaje_superficie is not None else ''
        return f'{self.region} en {self.anio}: {self.entidad}{pct}'


class RutaHistorica(models.Model):
    """Ruta de la Seda, Camino del Inca, etc. El progreso se calcula contra las Visita."""

    nombre = models.CharField(max_length=200, unique=True)
    descripcion = models.TextField(blank=True)
    regiones = models.ManyToManyField(Region, related_name='rutas_historicas')

    class Meta:
        ordering = ['nombre']
        verbose_name = 'ruta histórica'
        verbose_name_plural = 'rutas históricas'

    def __str__(self):
        return self.nombre
