from rest_framework import serializers

from .models import Foto, Region, Viaje, Visita

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
        return visita.region.codigos_hacia_arriba()[1:]


class ViajeSerializer(serializers.ModelSerializer):
    visitas = VisitaSerializer(many=True, read_only=True)

    class Meta:
        model = Viaje
        fields = ['id', 'nombre', 'estado', 'fecha_inicio', 'fecha_fin', 'notion_id', 'notas', 'visitas']
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


class FotoSerializer(serializers.ModelSerializer):
    """Para leer y editar la descripción. Las fotos se suben con multipart (ver FotoViewSet.create)."""

    archivo = serializers.SerializerMethodField()
    miniatura = serializers.SerializerMethodField()
    region = serializers.SlugRelatedField(slug_field='codigo', read_only=True)
    region_nombre = serializers.CharField(source='region.nombre', read_only=True, default=None)
    region_en_viaje = serializers.SerializerMethodField()

    class Meta:
        model = Foto
        fields = ['id', 'viaje', 'visita', 'archivo', 'miniatura', 'lat', 'lon', 'tomada_en',
                  'region', 'region_nombre', 'region_en_viaje', 'descripcion']
        read_only_fields = ['viaje', 'visita', 'lat', 'lon', 'tomada_en']

    # URLs relativas (/media/...): el navegador las pide a Vite, que las reenvía a Django.
    def get_archivo(self, foto) -> str:
        return foto.archivo.url

    def get_miniatura(self, foto) -> str | None:
        return foto.miniatura.url if foto.miniatura else None

    def get_region_en_viaje(self, foto) -> bool | None:
        """¿El viaje ya tiene una visita en la región de la foto (o en una que la contiene)? Si no, la app la sugiere."""
        if foto.region is None or foto.viaje is None:
            return None
        return foto.viaje.visitas.filter(region__codigo__in=foto.region.codigos_hacia_arriba()).exists()
