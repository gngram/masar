import uuid
from django.db import models
from django.utils import timezone

class InvenTreeSetting(models.Model):
    """Global system configuration key-value store."""
    key = models.CharField(max_length=128, primary_key=True)
    value = models.TextField(default='')
    description = models.TextField(blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inventree_settings'

    def __str__(self):
        return f"{self.key}: {self.value}"

class CustomizationPreset(models.Model):
    """Saved user/organization workspace customization profile.
    Stores customizable layout, dashboard card order/visibility, sidebar pinned items, and theme.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=False)
    is_default = models.BooleanField(default=False)
    user_email = models.CharField(max_length=255, blank=True, default='')
    layout_config = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customization_presets'

    def __str__(self):
        return f"{self.name} ({'Active' if self.is_active else 'Inactive'})"

class PortalBaseline(models.Model):
    """Controlled engineering baseline configuration."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    baseline_id = models.CharField(max_length=128, unique=True)
    name = models.CharField(max_length=255)
    bom_revision = models.CharField(max_length=64)
    hw_revision = models.CharField(max_length=64)
    mechanical_revision = models.CharField(max_length=64)
    fw_version = models.CharField(max_length=64)
    drawing_references = models.JSONField(default=list, blank=True)
    specification_refs = models.JSONField(default=list, blank=True)
    procedure_revisions = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'portal_baselines'

    def __str__(self):
        return f"{self.baseline_id} - {self.name}"
