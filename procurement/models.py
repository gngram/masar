import uuid
from django.db import models
from django.utils import timezone

class Company(models.Model):
    """InvenTree Company model representing Suppliers and Manufacturers."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, default='')
    website = models.URLField(blank=True, default='')
    is_supplier = models.BooleanField(default=True)
    is_manufacturer = models.BooleanField(default=False)
    is_customer = models.BooleanField(default=False)
    contact_name = models.CharField(max_length=255, blank=True, default='')
    contact_email = models.EmailField(blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'companies'
        verbose_name_plural = 'Companies'

    def __str__(self):
        return self.name

class PurchaseOrder(models.Model):
    """Vendor procurement orders for cleanroom components and raw hardware."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    po_number = models.CharField(max_length=128, unique=True)
    supplier = models.ForeignKey(Company, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    supplier_name = models.CharField(max_length=255)
    status = models.CharField(max_length=32, default='APPROVED')  # DRAFT, SUBMITTED, APPROVED, FULFILLED, CANCELLED
    total_amount = models.FloatField(default=0.0)
    currency = models.CharField(max_length=16, default='USD')
    issued_date = models.DateTimeField(default=timezone.now)
    expected_delivery = models.DateTimeField(null=True, blank=True)
    created_by = models.UUIDField(default=uuid.uuid4)
    items = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'purchase_orders'

    def __str__(self):
        return f"{self.po_number} ({self.supplier_name}) - {self.status}"
