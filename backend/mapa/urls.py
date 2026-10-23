from django.urls import path
from rest_framework.routers import DefaultRouter

from . import api, views

# El router genera /viajes/, /viajes/<id>/, /visitas/, /visitas/<id>/ a partir de los ViewSets.
router = DefaultRouter()
router.register('viajes', api.ViajeViewSet, basename='viaje')
router.register('visitas', api.VisitaViewSet, basename='visita')

urlpatterns = [
    path('estados/', views.estados, name='estados'),
    path('estadisticas/', views.estadisticas, name='estadisticas'),
    *router.urls,
]
