import os
from django.conf import settings
from django.urls import path, include, re_path
from django.http import HttpResponse, JsonResponse
from django.views.static import serve

def serve_page(template_name):
    def view(request):
        file_path = os.path.join(settings.BASE_DIR, 'web', template_name)
        if os.path.exists(file_path):
            with open(file_path, 'rb') as f:
                return HttpResponse(f.read(), content_type='text/html; charset=utf-8')
        return HttpResponse(f"Page {template_name} not found", status=404)
    return view

def healthz(request):
    return JsonResponse({
        "status": "healthy",
        "service": "masar-manufacturing-portal",
        "engine": "python-django-inventree",
        "auth": "oidc-ready"
    })

urlpatterns = [
    # Health probe
    path('healthz', healthz, name='healthz'),

    # REST APIs namespace /api/v1/
    path('api/v1/', include('identity.urls')),
    path('api/v1/', include('part.urls')),
    path('api/v1/', include('stock.urls')),
    path('api/v1/', include('production.urls')),
    path('api/v1/', include('procurement.urls')),
    path('api/v1/', include('customization.urls')),
    path('api/v1/', include('cards.urls')),

    # Frontend HTML Pages
    path('', serve_page('index.html'), name='root'),
    path('index.html', serve_page('index.html'), name='index'),
    path('dashboard', serve_page('dashboard.html'), name='dashboard_alias'),
    path('dashboard.html', serve_page('dashboard.html'), name='dashboard'),
    path('production', serve_page('production.html'), name='production_alias'),
    path('production.html', serve_page('production.html'), name='production'),
    path('stock', serve_page('stock.html'), name='stock_alias'),
    path('stock.html', serve_page('stock.html'), name='stock'),
    path('procurement', serve_page('procurement.html'), name='procurement_alias'),
    path('procurement.html', serve_page('procurement.html'), name='procurement'),
    path('settings', serve_page('settings.html'), name='settings_alias'),
    path('settings.html', serve_page('settings.html'), name='settings'),
    path('pipeline', serve_page('pipeline.html'), name='pipeline_alias'),
    path('pipeline.html', serve_page('pipeline.html'), name='pipeline'),
    path('stage', serve_page('stage.html'), name='stage_alias'),
    path('stage.html', serve_page('stage.html'), name='stage'),
    path('assembly', serve_page('assembly.html'), name='assembly_alias'),
    path('assembly.html', serve_page('assembly.html'), name='assembly'),
    path('build', serve_page('build.html'), name='build_alias'),
    path('build.html', serve_page('build.html'), name='build'),
    path('parts', serve_page('parts.html'), name='parts_alias'),
    path('parts.html', serve_page('parts.html'), name='parts'),

    # Static assets serving
    re_path(r'^css/(?P<path>.*)$', serve, {'document_root': os.path.join(settings.BASE_DIR, 'web', 'css')}),
    re_path(r'^js/(?P<path>.*)$', serve, {'document_root': os.path.join(settings.BASE_DIR, 'web', 'js')}),
    re_path(r'^assets/(?P<path>.*)$', serve, {'document_root': os.path.join(settings.BASE_DIR, 'web', 'assets')}),
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': os.path.join(settings.BASE_DIR, 'web')}),
]
