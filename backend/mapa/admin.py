from django.contrib import admin

from .models import Region, Viaje, Visita


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ['codigo', 'nombre', 'nivel', 'padre', 'continente', 'area_km2']
    list_filter = ['nivel', 'continente']
    search_fields = ['codigo', 'nombre']
    raw_id_fields = ['padre']


class VisitaInline(admin.TabularInline):
    model = Visita
    autocomplete_fields = ['region']
    extra = 1


@admin.register(Viaje)
class ViajeAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'estado', 'fecha_inicio', 'fecha_fin']
    list_filter = ['estado']
    search_fields = ['nombre']
    inlines = [VisitaInline]
