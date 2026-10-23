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


class Viaje(models.Model):
    class Estado(models.TextChoices):
        # Mapean el Status de la base Destinations de Notion.
        DESEO = 'deseo', 'Deseo'                    # Not started
        INVESTIGANDO = 'investigando', 'Investigando'
        EN_CURSO = 'en_curso', 'En curso'           # In progress
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

    @property
    def realizado(self):
        return self.estado in (self.Estado.EN_CURSO, self.Estado.HECHO)


class Visita(models.Model):
    class TipoPresencia(models.TextChoices):
        # De más a menos intensa en el mapa.
        ESTADIA = 'estadia', 'Estadía'
        PASO = 'paso', 'De paso'
        TRANSITO = 'transito', 'Tránsito'

    viaje = models.ForeignKey(Viaje, on_delete=models.CASCADE, related_name='visitas')
    region = models.ForeignKey(Region, on_delete=models.PROTECT, related_name='visitas')
    tipo_presencia = models.CharField(max_length=10, choices=TipoPresencia.choices, default=TipoPresencia.ESTADIA)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['viaje', 'region'], name='visita_unica_por_viaje')]

    def __str__(self):
        return f'{self.viaje} → {self.region} ({self.get_tipo_presencia_display()})'
