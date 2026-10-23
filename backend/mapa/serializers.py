from rest_framework import serializers

from .models import Region, Viaje, Visita

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
