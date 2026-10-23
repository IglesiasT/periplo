from django.contrib import admin

from .models import Region, Ruta, Viaje, Visita


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ['codigo', 'nombre', 'nivel', 'padre', 'continente', 'area_km2']
    list_filter = ['nivel', 'continente']
    search_fields = ['codigo', 'nombre']
    raw_id_fields = ['padre']


class VisitaInline(admin.TabularInline):
    model = Visita
    autocomplete_fields = ['region']
    fields = ['region', 'tipo_presencia', 'realizada', 'desde_notion']
    readonly_fields = ['desde_notion']
    extra = 1


@admin.register(Viaje)
class ViajeAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'estado', 'fecha_inicio', 'fecha_fin', 'notion_id']
    list_filter = ['estado']
    search_fields = ['nombre']
    inlines = [VisitaInline]


@admin.register(Visita)
class VisitaAdmin(admin.ModelAdmin):
    """Incluye las visitas sin viaje (lugares sueltos de Notion o cargados a mano)."""
    list_display = ['region', 'viaje', 'tipo_presencia', 'realizada', 'desde_notion']
    list_filter = ['realizada', 'desde_notion', 'tipo_presencia']
    search_fields = ['region__nombre', 'viaje__nombre']
    autocomplete_fields = ['region', 'viaje']


@admin.register(Ruta)
class RutaAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'viaje', 'longitud_km', 'origen']
    list_filter = ['origen']
    exclude = ['coordenadas']
