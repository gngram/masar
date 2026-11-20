from django.urls import path
from part import views

urlpatterns = [
    # Parts API
    path('parts/categories', views.PartCategoryListView.as_view(), name='part_categories'),
    path('parts', views.PartListView.as_view(), name='parts_list'),
    path('parts/<uuid:part_id>', views.PartDetailView.as_view(), name='part_detail'),
    path('parts/<uuid:part_id>/bom', views.PartBoMView.as_view(), name='part_bom'),
    path('parts/<uuid:part_id>/bom/items', views.PartBoMView.as_view(), name='part_bom_add_item'),

    # BoM item verification
    path('bom/items/<uuid:item_id>', views.BoMItemDetailView.as_view(), name='bom_item_detail'),
    path('bom/items/<uuid:item_id>/verify-checksum', views.BoMItemChecksumVerifyView.as_view(), name='bom_item_verify_checksum'),

    # Backward compatibility aliases for Go /api/v1/modules
    path('modules', views.PartListView.as_view(), name='compat_modules_list'),
    path('modules/<uuid:part_id>', views.PartDetailView.as_view(), name='compat_module_detail'),
    path('modules/<uuid:part_id>/bom', views.PartBoMView.as_view(), name='compat_module_bom'),
    path('modules/<uuid:part_id>/bom/items', views.PartBoMView.as_view(), name='compat_module_bom_add_item'),
]
