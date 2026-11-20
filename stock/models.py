import uuid
from django.db import models
from django.utils import timezone
from part.models import Part

class StockLocation(models.Model):
    """InvenTree hierarchical storage locations."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True, default='')
    path = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'stock_locations'

    def __str__(self):
        return self.path or self.name

class StockItem(models.Model):
    """Cleanroom inventory and InvenTree Stock Item with serial tracking."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    part = models.ForeignKey(Part, on_delete=models.SET_NULL, null=True, blank=True, related_name='stock_items')
    item_code = models.CharField(max_length=128, unique=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=64, default='Optical')
    quantity_on_hand = models.FloatField(default=0.0)
    quantity_allocated = models.FloatField(default=0.0)
    reorder_point = models.FloatField(default=0.0)
    unit = models.CharField(max_length=32, default='PCS')
    batch_lot_number = models.CharField(max_length=128, blank=True, default='')
    storage_location = models.CharField(max_length=255, blank=True, default='')
    location = models.ForeignKey(StockLocation, on_delete=models.SET_NULL, null=True, blank=True, related_name='items')
    is_serialized = models.BooleanField(default=False)
    serial_numbers = models.JSONField(default=list, blank=True, null=True)
    status = models.CharField(max_length=64, default='AVAILABLE')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'stock_items'

    def __str__(self):
        return f"{self.item_code} - {self.name} ({self.quantity_on_hand} {self.unit})"

class StockTracking(models.Model):
    """Audit log for stock movements, adjustments, and allocations."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stock_item = models.ForeignKey(StockItem, on_delete=models.CASCADE, related_name='tracking_history')
    change_type = models.CharField(max_length=64, default='ADJUST')
    quantity_delta = models.FloatField(default=0.0)
    notes = models.TextField(blank=True, default='')
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'stock_tracking'
