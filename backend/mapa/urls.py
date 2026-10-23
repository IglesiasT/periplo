from django.urls import path
from rest_framework.routers import DefaultRouter

from . import api, views

# El router genera /viajes/, /viajes/<id>/, /visitas/... a partir de los ViewSets
# (y /rutas/importar/, /rutas/<id>/marcar_transito/ a partir de sus @action).
router = DefaultRouter()
router.register('viajes', api.ViajeViewSet, basename='viaje')
router.register('visitas', api.VisitaViewSet, basename='visita')
router.register('rutas', api.RutaViewSet, basename='ruta')

urlpatterns = [
    path('estados/', views.estados, name='estados'),
    path('estadisticas/', views.estadisticas, name='estadisticas'),
    *router.urls,
]
