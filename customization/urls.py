from django.urls import path
from customization import views

urlpatterns = [
    # Customization presets (Save / Load / Export / Import)
    path('customization/presets', views.CustomizationPresetListView.as_view(), name='customization_presets'),
    path('customization/presets/<uuid:preset_id>', views.CustomizationPresetDetailView.as_view(), name='customization_preset_detail'),
    path('customization/presets/<uuid:preset_id>/apply', views.CustomizationPresetApplyView.as_view(), name='customization_preset_apply'),
    path('customization/export', views.CustomizationExportView.as_view(), name='customization_export'),
    path('customization/import', views.CustomizationImportView.as_view(), name='customization_import'),

    # Settings and baselines
    path('settings', views.SettingsView.as_view(), name='portal_settings'),
    path('settings/baselines', views.BaselinesListView.as_view(), name='portal_baselines'),
    path('cards/settings', views.SettingsView.as_view(), name='cards_settings'),
]
