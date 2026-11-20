from django.urls import path
from stock import views

urlpatterns = [
    path('stock/items', views.StockItemListView.as_view(), name='stock_items'),
    path('stock/items/<uuid:item_id>', views.StockItemDetailView.as_view(), name='stock_item_detail'),
    path('stock/items/<uuid:item_id>/category', views.StockItemCategoryUpdateView.as_view(), name='stock_item_category'),
    path('stock/items/<uuid:item_id>/field', views.StockItemFieldUpdateView.as_view(), name='stock_item_field'),
    path('stock/locations', views.StockLocationListView.as_view(), name='stock_locations'),
    path('cards/stock', views.StockCardView.as_view(), name='cards_stock'),
]
