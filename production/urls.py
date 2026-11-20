from django.urls import path
from production import views

urlpatterns = [
    path('production/units', views.ProductionUnitListView.as_view(), name='production_units'),
    path('production/units/<uuid:unit_id>', views.ProductionUnitDetailView.as_view(), name='production_unit_detail'),
    path('production/pair', views.PairUnitsView.as_view(), name='pair_units'),
    path('production/units/<uuid:unit_id>/unpair', views.UnpairUnitView.as_view(), name='unpair_unit'),
    path('production/units/<uuid:unit_id>/rework', views.AddReworkView.as_view(), name='add_rework'),
    path('production/units/<uuid:unit_id>/deviations', views.AddDeviationView.as_view(), name='add_deviation'),
    path('production/units/<uuid:unit_id>/tests', views.AddTestExecutionView.as_view(), name='add_test'),

    # Build orders
    path('build/orders', views.BuildOrderListView.as_view(), name='build_orders'),

    # Production card endpoint
    path('cards/production-status', views.ProductionStatusCardView.as_view(), name='cards_production_status'),
]
