from django.urls import path
from procurement import views

urlpatterns = [
    path('procurement/orders', views.PurchaseOrderListView.as_view(), name='procurement_orders'),
    path('procurement/orders/<uuid:po_id>', views.PurchaseOrderDetailView.as_view(), name='procurement_order_detail'),
    path('procurement/suppliers', views.SupplierListView.as_view(), name='procurement_suppliers'),
    path('cards/procurement', views.ProcurementCardView.as_view(), name='cards_procurement'),
]
