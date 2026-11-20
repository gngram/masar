import json
import uuid
from django.http import JsonResponse
from django.conf import settings as django_settings
from rest_framework.views import APIView
from rest_framework import status
from customization.models import InvenTreeSetting, CustomizationPreset, PortalBaseline

def api_response(success=True, data=None, error=None, status_code=200):
    payload = {"success": success}
    if data is not None:
        payload["data"] = data
    if error is not None:
        payload["error"] = error
    return JsonResponse(payload, status=status_code)

DEFAULT_LAYOUT = {
    "visible_cards": ["admin", "dashboard", "production", "stock", "procurement", "settings"],
    "card_order": ["admin", "dashboard", "production", "stock", "procurement", "settings"],
    "pinned_sidebar_links": ["index.html", "dashboard.html", "parts.html", "production.html", "stock.html", "procurement.html"],
    "active_theme": "dark-slate",
    "sidebar_collapsed": False,
    "table_page_size": 25,
    "stock_low_alert_threshold": 5
}

def serialize_preset(p):
    return {
        "id": str(p.id),
        "name": p.name,
        "description": p.description,
        "is_active": p.is_active,
        "is_default": p.is_default,
        "user_email": p.user_email,
        "layout_config": p.layout_config,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
    }

class CustomizationPresetListView(APIView):
    def get(self, request):
        presets = CustomizationPreset.objects.all().order_by('-is_active', 'name')
        if not presets.exists():
            # Seed default preset
            default_p = CustomizationPreset.objects.create(
                name="Default Manufacturing Workspace",
                description="Comprehensive industrial production view with full traceability, stock metrics, and admin cards.",
                is_active=True,
                is_default=True,
                layout_config=DEFAULT_LAYOUT
            )
            presets = [default_p]
        return api_response(data=[serialize_preset(p) for p in presets])

    def post(self, request):
        name = request.data.get('name', '').strip()
        if not name:
            return api_response(success=False, error="Preset name is required", status_code=status.HTTP_400_BAD_REQUEST)

        config = request.data.get('layout_config', {})
        set_active = bool(request.data.get('is_active', False))

        if set_active:
            CustomizationPreset.objects.all().update(is_active=False)

        preset = CustomizationPreset.objects.create(
            name=name,
            description=request.data.get('description', ''),
            is_active=set_active,
            user_email=request.data.get('user_email', ''),
            layout_config=config or DEFAULT_LAYOUT
        )
        return api_response(data=serialize_preset(preset), status_code=status.HTTP_201_CREATED)

class CustomizationPresetApplyView(APIView):
    def post(self, request, preset_id):
        preset = CustomizationPreset.objects.filter(id=preset_id).first()
        if not preset:
            return api_response(success=False, error="Preset not found", status_code=status.HTTP_404_NOT_FOUND)

        CustomizationPreset.objects.all().update(is_active=False)
        preset.is_active = True
        preset.save()
        return api_response(data={"message": f"Applied preset '{preset.name}'", "preset": serialize_preset(preset)})

class CustomizationPresetDetailView(APIView):
    def get(self, request, preset_id):
        preset = CustomizationPreset.objects.filter(id=preset_id).first()
        if not preset:
            return api_response(success=False, error="Preset not found", status_code=status.HTTP_404_NOT_FOUND)
        return api_response(data=serialize_preset(preset))

    def put(self, request, preset_id):
        preset = CustomizationPreset.objects.filter(id=preset_id).first()
        if not preset:
            return api_response(success=False, error="Preset not found", status_code=status.HTTP_404_NOT_FOUND)

        if 'name' in request.data: preset.name = request.data['name']
        if 'description' in request.data: preset.description = request.data['description']
        if 'layout_config' in request.data: preset.layout_config = request.data['layout_config']
        if 'is_active' in request.data and request.data['is_active']:
            CustomizationPreset.objects.all().update(is_active=False)
            preset.is_active = True
        preset.save()
        return api_response(data=serialize_preset(preset))

    def delete(self, request, preset_id):
        CustomizationPreset.objects.filter(id=preset_id).delete()
        return api_response(data={"message": "Preset deleted"})

class CustomizationExportView(APIView):
    def get(self, request):
        active = CustomizationPreset.objects.filter(is_active=True).first()
        if not active:
            active = CustomizationPreset.objects.first()
        payload = {
            "format": "masar_customization_preset_v1",
            "name": active.name if active else "Custom Preset",
            "layout_config": active.layout_config if active else DEFAULT_LAYOUT
        }
        return api_response(data=payload)

class CustomizationImportView(APIView):
    def post(self, request):
        config = request.data.get('layout_config') or request.data
        name = request.data.get('name', f"Imported Preset ({uuid.uuid4().hex[:4]})")
        
        CustomizationPreset.objects.all().update(is_active=False)
        p = CustomizationPreset.objects.create(
            name=name,
            description="Imported from JSON configuration",
            is_active=True,
            layout_config=config if isinstance(config, dict) else DEFAULT_LAYOUT
        )
        return api_response(data=serialize_preset(p), status_code=status.HTTP_201_CREATED)

class SettingsView(APIView):
    def get(self, request):
        baselines = PortalBaseline.objects.filter(is_active=True)
        bl_data = []
        for b in baselines:
            bl_data.append({
                "baseline_id": b.baseline_id,
                "name": b.name,
                "bom_revision": b.bom_revision,
                "hw_revision": b.hw_revision,
                "mechanical_revision": b.mechanical_revision,
                "fw_version": b.fw_version,
                "drawing_references": b.drawing_references,
                "specification_refs": b.specification_refs,
                "procedure_revisions": b.procedure_revisions,
            })

        active_preset = CustomizationPreset.objects.filter(is_active=True).first()

        data = {
            "auth_config": {
                "oidc_provider": "Keycloak Enterprise",
                "issuer_url": "https://auth.qkd.internal/auth/realms/manufacturing",
                "client_id": "masar-manufacturing-portal",
                "dev_bypass_active": django_settings.AUTH_BYPASS_ENABLED
            },
            "controlled_doc_repo_url": "https://docs.qkd.internal/controlled-repo",
            "active_baselines": bl_data,
            "active_customization": serialize_preset(active_preset) if active_preset else None,
            "system_version": "v2.0.0-django",
            "environment": "development"
        }
        return api_response(data=data)

    def put(self, request):
        # Update settings if provided
        return api_response(data={"message": "Settings updated"})

class BaselinesListView(APIView):
    def get(self, request):
        baselines = PortalBaseline.objects.filter(is_active=True)
        res = []
        for b in baselines:
            res.append({
                "baseline_id": b.baseline_id,
                "name": b.name,
                "bom_revision": b.bom_revision,
                "hw_revision": b.hw_revision,
                "mechanical_revision": b.mechanical_revision,
                "fw_version": b.fw_version,
            })
        return api_response(data=res)
