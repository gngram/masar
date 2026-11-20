from django.urls import path
from cards import views

urlpatterns = [
    path('cards/dashboard', views.DashboardCardView.as_view(), name='cards_dashboard'),
]
