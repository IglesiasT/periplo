from urllib.parse import urlsplit

from django.http import JsonResponse

HOSTS_LOCALES = {'localhost', '127.0.0.1', '::1'}
METODOS_SEGUROS = {'GET', 'HEAD', 'OPTIONS'}


class SoloOrigenLocalMiddleware:
    """La API no tiene usuarios ni CSRF: cualquier página abierta en el navegador podría mandarle un formulario
    mientras el servidor está prendido. Los navegadores avisan de dónde viene cada pedido que escribe (Origin):
    se rechaza si no es de esta máquina. Los pedidos sin Origin (curl, los tests) no vienen de una página ajena."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origen = request.headers.get('Origin')
        if request.method not in METODOS_SEGUROS and origen and urlsplit(origen).hostname not in HOSTS_LOCALES:
            return JsonResponse({'detail': 'Este pedido viene de otro sitio.'}, status=403)
        return self.get_response(request)
