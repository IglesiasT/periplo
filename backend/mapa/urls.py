from django.urls import path, re_path
from rest_framework.routers import DefaultRouter

from .vistas import fichas, historia, numeros, regiones, viajes

# El router genera /viajes/, /viajes/<id>/, /visitas/... a partir de los ViewSets.
router = DefaultRouter()
router.register('viajes', viajes.ViajeViewSet, basename='viaje')
router.register('visitas', viajes.VisitaViewSet, basename='visita')
router.register('fotos', viajes.FotoViewSet, basename='foto')

urlpatterns = [
    path('estados/', regiones.estados, name='estados'),
    path('estadisticas/', numeros.estadisticas, name='estadisticas'),
    path('logros/', numeros.logros, name='logros'),
    path('historia/', historia.historia, name='historia'),
    # re_path y no <int:anio>: los años a. C. son negativos.
    re_path(r'^historia/(?P<anio>-?\d+)/$', historia.epoca, name='epoca'),
    path('fichas/', fichas.fichas, name='fichas'),
    path('encuadre/', regiones.encuadre, name='encuadre'),
    path('regiones/<str:codigo>/', regiones.region, name='region'),
    path('regiones/<str:codigo>/ficha/', fichas.ficha, name='ficha'),
    *router.urls,
]
