from django.urls import path
from identity import views

urlpatterns = [
    # Identity & unified login
    path('identity/login', views.UnifiedLoginView.as_view(), name='identity_login'),
    path('admin/login', views.AdminLoginView.as_view(), name='admin_login'),

    # Registration & Invite
    path('auth/login', views.UnifiedLoginView.as_view(), name='auth_login'),
    path('auth/register-invite', views.RegisterInviteView.as_view(), name='register_invite'),
    path('auth/my-production-units', views.MyProductionUnitsView.as_view(), name='my_pus'),

    # Dedicated Production Units
    path('auth/production-units', views.DedicatedProductionUnitsView.as_view(), name='dedicated_pus'),
    path('auth/business-units', views.DedicatedProductionUnitsView.as_view(), name='dedicated_bus'),
    path('auth/production-units/<uuid:pu_id>', views.ProductionUnitDetailView.as_view(), name='pu_detail'),
    path('auth/business-units/<uuid:pu_id>', views.ProductionUnitDetailView.as_view(), name='bu_detail'),

    # Users in PU & Admin creation
    path('auth/production-units/<uuid:pu_id>/users', views.PUUsersView.as_view(), name='pu_users'),
    path('auth/business-units/<uuid:pu_id>/users', views.PUUsersView.as_view(), name='bu_users'),
    path('auth/production-units/<uuid:pu_id>/admin', views.CreatePUAdminView.as_view(), name='create_pu_admin'),
    path('auth/business-units/<uuid:pu_id>/admin', views.CreatePUAdminView.as_view(), name='create_bu_admin'),

    # User invitation & role management in PU
    path('auth/production-units/<uuid:pu_id>/invite-user', views.InviteUserView.as_view(), name='invite_user'),
    path('auth/production-units/<uuid:pu_id>/users/<uuid:user_id>/roles', views.AddUserRoleView.as_view(), name='add_user_role'),
    path('auth/production-units/<uuid:pu_id>/users/<uuid:user_id>/roles/<str:role>', views.RemoveUserRoleView.as_view(), name='remove_user_role'),
    path('auth/production-units/<uuid:pu_id>/users/<uuid:user_id>', views.RemoveUserFromPUView.as_view(), name='remove_user_from_pu'),
    path('auth/business-units/<uuid:pu_id>/users/<uuid:user_id>', views.RemoveUserFromPUView.as_view(), name='remove_user_from_bu'),

    # Pipeline stages
    path('auth/production-units/<uuid:pu_id>/stages', views.PipelineStagesView.as_view(), name='pipeline_stages'),
    path('auth/production-units/<uuid:pu_id>/stages/<uuid:stage_id>', views.PipelineStageDetailView.as_view(), name='pipeline_stage_detail'),
    path('auth/production-units/<uuid:pu_id>/stages/<uuid:stage_id>/config', views.PipelineStageConfigView.as_view(), name='pipeline_stage_config'),

    # Stage procurement requests
    path('auth/production-units/<uuid:pu_id>/stages/<str:stage_key>/requests', views.StageProcurementRequestsView.as_view(), name='stage_proc_requests'),
    path('auth/production-units/<uuid:pu_id>/requests/<uuid:req_id>/approve', views.ApproveProcurementRequestView.as_view(), name='approve_proc_request'),

    # Stage finished products & BOM
    path('auth/production-units/<uuid:pu_id>/stages/<str:stage_key>/products', views.StageFinishedProductsView.as_view(), name='stage_products'),
    path('auth/production-units/<uuid:pu_id>/stages/<str:stage_key>/products/<uuid:product_id>', views.FinishedProductDetailView.as_view(), name='stage_product_detail'),
    path('auth/production-units/<uuid:pu_id>/products/<uuid:product_id>/properties', views.FinishedProductDetailView.as_view(), name='stage_product_properties'),
    path('auth/production-units/<uuid:pu_id>/products/<uuid:product_id>/bom', views.FinishedProductBoMView.as_view(), name='stage_product_bom'),

    # Roles
    path('auth/production-units/<uuid:pu_id>/roles', views.CustomRolesView.as_view(), name='pu_roles'),
    path('auth/production-units/<uuid:pu_id>/roles/<str:role_key>', views.CustomRoleDetailView.as_view(), name='delete_custom_role'),

    # Tracking parameters
    path('auth/production-units/<uuid:pu_id>/parameters', views.TrackingParametersView.as_view(), name='pu_tracking_parameters'),
    path('auth/production-units/<uuid:pu_id>/parameters/<str:param_key>', views.TrackingParameterDetailView.as_view(), name='pu_tracking_parameter_detail'),
    path('auth/production-units/<uuid:pu_id>/stages/<str:stage_key>/parameters', views.StageParametersView.as_view(), name='stage_parameters'),

    # Procured components catalog (Receive -> Inspect -> Store & Kit)
    path('auth/production-units/<uuid:pu_id>/procured-components', views.ProcuredComponentsView.as_view(), name='pu_procured_components'),
    path('auth/production-units/<uuid:pu_id>/procured-components/<str:item_code>', views.ProcuredComponentDetailView.as_view(), name='pu_procured_component_detail'),

    # Sub-assemblies under Build
    path('auth/production-units/<uuid:pu_id>/sub-assemblies', views.SubAssembliesView.as_view(), name='pu_sub_assemblies'),
    path('auth/production-units/<uuid:pu_id>/sub-assemblies/<str:stage_key>', views.SubAssemblyDetailView.as_view(), name='pu_sub_assembly_detail'),

    # Inspect action (OK vs Faulty defect recording)
    path('auth/production-units/<uuid:pu_id>/inspect/<uuid:product_id>', views.InspectProductView.as_view(), name='inspect_product'),

    # Parameter carry-forward across units
    path('auth/production-units/<uuid:pu_id>/stages/<str:stage_key>/record-parameters', views.RecordStageParametersView.as_view(), name='stage_record_parameters'),
]

