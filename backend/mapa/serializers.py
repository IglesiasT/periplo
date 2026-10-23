from rest_framework import serializers

from .models import Region, Ruta, Viaje, Visita
from .rutas import longitud_km

AVISO_NOTION = 'Viene de Notion: se edita allá y se trae con sincronizar_notion.'


class VisitaSerializer(serializers.ModelSerializer):
    # La región se manda y se devuelve por código (AR-A, ARG...), el mismo id que usa el mapa.
    region = serializers.SlugRelatedField(slug_field='codigo', queryset=Region.objects.all())
    region_nombre = serializers.CharField(source='region.nombre', read_only=True)
    region_nivel = serializers.CharField(source='region.nivel', read_only=True)
    # Códigos de las regiones que la contienen (provincia, país): el mapa los resalta en cualquier zoom.
    region_ancestros = serializers.SerializerMethodField()

    class Meta:
        model = Visita
        fields = ['id', 'viaje', 'region', 'region_nombre', 'region_nivel', 'region_ancestros',
                  'tipo_presencia', 'realizada', 'desde_notion']
        read_only_fields = ['desde_notion']

    def get_region_ancestros(self, visita) -> list[str]:
        codigos, region = [], visita.region.padre
        while region is not None:
            codigos.append(region.codigo)
            region = region.padre
        return codigos


class RutaSerializer(serializers.ModelSerializer):
    """Con coordenadas: para dibujarla. Crear por acá es para rutas dibujadas; los archivos van por /importar/."""

    class Meta:
        model = Ruta
        fields = ['id', 'viaje', 'nombre', 'coordenadas', 'longitud_km', 'origen']
        read_only_fields = ['longitud_km', 'origen']

    def validate_coordenadas(self, coordenadas):
        valido = isinstance(coordenadas, list) and len(coordenadas) >= 2 and all(
            isinstance(p, list) and len(p) == 2 and all(isinstance(n, (int, float)) for n in p)
            and -180 <= p[0] <= 180 and -90 <= p[1] <= 90
            for p in coordenadas
        )
        if not valido:
            raise serializers.ValidationError('Tiene que ser una lista de al menos dos puntos [lon, lat].')
        return coordenadas

    def create(self, datos):
        return Ruta.objects.create(**datos, longitud_km=longitud_km(datos['coordenadas']), origen=Ruta.Origen.DIBUJADA)

    def update(self, ruta, datos):
        if 'coordenadas' in datos:
            datos['longitud_km'] = longitud_km(datos['coordenadas'])
        return super().update(ruta, datos)


class RutaResumenSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ruta
        fields = ['id', 'nombre', 'longitud_km', 'origen']


class ViajeSerializer(serializers.ModelSerializer):
    visitas = VisitaSerializer(many=True, read_only=True)
    rutas = RutaResumenSerializer(many=True, read_only=True)

    class Meta:
        model = Viaje
        fields = ['id', 'nombre', 'estado', 'fecha_inicio', 'fecha_fin', 'notion_id', 'notas', 'visitas', 'rutas']
        read_only_fields = ['notion_id']

    def validate(self, datos):
        inicio = datos.get('fecha_inicio', getattr(self.instance, 'fecha_inicio', None))
        fin = datos.get('fecha_fin', getattr(self.instance, 'fecha_fin', None))
        if inicio and fin and fin < inicio:
            raise serializers.ValidationError({'fecha_fin': 'No puede ser anterior a la fecha de inicio.'})

        # Nombre y estado de un viaje de Notion los pisa el sync: solo se pueden editar fechas y notas.
        if self.instance and self.instance.notion_id:
            for campo in ('nombre', 'estado'):
                if campo in datos and datos[campo] != getattr(self.instance, campo):
                    raise serializers.ValidationError({campo: AVISO_NOTION})
        return datos
