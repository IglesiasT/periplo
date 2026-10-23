from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import Foto


@receiver(post_delete, sender=Foto)
def borrar_archivos_de_foto(sender, instance: Foto, **kwargs):
    """Borrar el registro no borra los archivos del disco. Esta señal corre después de cualquier borrado
    de una Foto, incluido el borrado en cascada al eliminar su viaje."""
    instance.archivo.delete(save=False)
    instance.miniatura.delete(save=False)
