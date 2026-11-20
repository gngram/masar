import uuid
from django.db import models
from django.utils import timezone

class PartCategory(models.Model):
    """InvenTree-style hierarchical part categories."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True, default='')
    path = models.CharField(max_length=255, blank=True, default='')
    default_location = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'part_categories'
        verbose_name_plural = 'Part Categories'

    def __str__(self):
        return self.path or self.name

class Part(models.Model):
    """Core Part model representing components, sub-assemblies, and top-level assemblies."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ipn = models.CharField(max_length=128, unique=True, verbose_name="Internal Part Number")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    revision = models.CharField(max_length=32, default='A')
    category = models.ForeignKey(PartCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='parts')
    is_assembly = models.BooleanField(default=False)
    is_component = models.BooleanField(default=True)
    is_salable = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    units = models.CharField(max_length=32, default='PCS')
    minimum_stock = models.FloatField(default=0.0)
    default_location = models.CharField(max_length=255, blank=True, default='')
    default_supplier = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'parts'

    def __str__(self):
        return f"{self.ipn} - {self.name}"

class BomItem(models.Model):
    """InvenTree & Masar BoM Item connecting parent assemblies to child components."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    part = models.ForeignKey(Part, on_delete=models.CASCADE, related_name='bom_items')
    sub_part = models.ForeignKey(Part, on_delete=models.CASCADE, null=True, blank=True, related_name='used_in_boms')
    parent_bom_item = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='sub_items')
    item_code = models.CharField(max_length=128)
    item_type = models.CharField(max_length=64, default='COMPONENT')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    revision = models.CharField(max_length=32, blank=True, default='')
    manufacturer_part_number = models.CharField(max_length=128, blank=True, default='')
    supplier_name = models.CharField(max_length=255, blank=True, default='')
    quantity = models.FloatField(default=1.0)
    unit = models.CharField(max_length=32, default='PCS')
    reference = models.CharField(max_length=128, blank=True, default='')
    is_critical_path = models.BooleanField(default=False)
    checksum_sha256 = models.CharField(max_length=128, blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bom_items'
        unique_together = ('part', 'item_code')

class PartParameter(models.Model):
    """Technical parameters and optical specifications for a part."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    part = models.ForeignKey(Part, on_delete=models.CASCADE, related_name='parameters')
    name = models.CharField(max_length=128)
    value = models.CharField(max_length=255)
    unit = models.CharField(max_length=32, blank=True, default='')

    class Meta:
        db_table = 'part_parameters'
