"""
Fotos: lectura del EXIF (GPS y fecha) y generación de miniaturas con Pillow.
"""
import io
from dataclasses import dataclass
from datetime import datetime

from django.utils import timezone
from PIL import ExifTags, Image, ImageOps, UnidentifiedImageError

LADO_MINIATURA = 480


class ErrorFoto(Exception):
    pass


@dataclass
class DatosFoto:
    lat: float | None
    lon: float | None
    tomada_en: datetime | None
    miniatura: bytes   # JPEG


def a_grados(valor, referencia: str) -> float:
    """EXIF guarda (grados, minutos, segundos) y la letra del hemisferio: (23, 34, 39.6) S -> -23.5777."""
    grados, minutos, segundos = (float(x) for x in valor)
    decimal = grados + minutos / 60 + segundos / 3600
    return -decimal if referencia in ('S', 'W') else decimal


def leer_gps(exif: Image.Exif) -> tuple[float, float] | tuple[None, None]:
    gps = exif.get_ifd(ExifTags.IFD.GPSInfo)
    try:
        lat = a_grados(gps[ExifTags.GPS.GPSLatitude], gps[ExifTags.GPS.GPSLatitudeRef])
        lon = a_grados(gps[ExifTags.GPS.GPSLongitude], gps[ExifTags.GPS.GPSLongitudeRef])
    except (KeyError, TypeError, ValueError, ZeroDivisionError):
        return None, None
    # Algunas apps escriben 0,0 cuando no tienen ubicación.
    return (lat, lon) if (lat, lon) != (0.0, 0.0) else (None, None)


def leer_fecha(exif: Image.Exif) -> datetime | None:
    texto = exif.get_ifd(ExifTags.IFD.Exif).get(ExifTags.Base.DateTimeOriginal)
    try:
        # El EXIF no dice la zona horaria: se asume la configurada en Django.
        return timezone.make_aware(datetime.strptime(str(texto).strip(), '%Y:%m:%d %H:%M:%S'))
    except ValueError:
        return None


def leer_foto(contenido: bytes) -> DatosFoto:
    try:
        imagen = Image.open(io.BytesIO(contenido))
        imagen.load()
    except UnidentifiedImageError as e:
        raise ErrorFoto('Formato no soportado. Se aceptan JPG, PNG y WebP '
                        '(las HEIC del iPhone todavía no: exportalas como JPG).') from e

    exif = imagen.getexif()
    lat, lon = leer_gps(exif)

    # Las fotos verticales suelen guardarse acostadas con un dato de "orientación": se enderezan antes de achicar.
    miniatura = ImageOps.exif_transpose(imagen).convert('RGB')
    miniatura.thumbnail((LADO_MINIATURA, LADO_MINIATURA))
    salida = io.BytesIO()
    miniatura.save(salida, 'JPEG', quality=80)
    return DatosFoto(lat=lat, lon=lon, tomada_en=leer_fecha(exif), miniatura=salida.getvalue())
