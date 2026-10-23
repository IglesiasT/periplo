from django.urls import path

from . import views

urlpatterns = [
    path('visitas/', views.visitas, name='visitas'),
]
