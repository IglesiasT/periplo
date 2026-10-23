from django.urls import path, re_path
from rest_framework.routers import DefaultRouter

from . import api, views

# El router genera /viajes/, /viajes/<id>/, /visitas/... a partir de los ViewSets
# (y /rutas/importar/, /rutas/<id>/marcar_transito/ a partir de sus @action).
router = DefaultRouter()
router.register('viajes', api.ViajeViewSet, basename='viaje')
router.register('visitas', api.VisitaViewSet, basename='visita')
router.register('rutas', api.RutaViewSet, basename='ruta')
router.register('fotos', api.FotoViewSet, basename='foto')

urlpatterns = [
    path('estados/', views.estados, name='estados'),
    path('estadisticas/', views.estadisticas, name='estadisticas'),
    path('logros/', views.logros, name='logros'),
    path('historia/', views.historia, name='historia'),
    # re_path y no <int:anio>: los años a. C. son negativos.
    re_path(r'^historia/(?P<anio>-?\d+)/$', views.epoca, name='epoca'),
    path('fichas/', views.fichas, name='fichas'),
    path('regiones/<str:codigo>/', views.region, name='region'),
    path('regiones/<str:codigo>/ficha/', views.ficha, name='ficha'),
    *router.urls,
]
