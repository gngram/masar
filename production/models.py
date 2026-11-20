import uuid
from django.db import models
from django.utils import timezone
from part.models import Part

class BuildOrder(models.Model):
    """InvenTree Build Order for managing assembly runs."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=128, unique=True)
    part = models.ForeignKey(Part, on_delete=models.SET_NULL, null=True, blank=True, related_name='build_orders')
    title = models.CharField(max_length=255)
    quantity = models.FloatField(default=1.0)
    status = models.CharField(max_length=32, default='PENDING')  # PENDING, IN_PRODUCTION, COMPLETED, CANCELLED
    target_date = models.DateTimeField(null=True, blank=True)
    completed_date = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'build_orders'

    def __str__(self):
        return f"{self.reference} ({self.title}) - {self.status}"

class ProductionUnit(models.Model):
    """Core hardware traceability register for Alice (Sender) and Bob (Receiver) units."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    serial_number = models.CharField(max_length=128, unique=True)
    unit_type = models.CharField(max_length=64)  # SENDER_ALICE, RECEIVER_BOB
    system_set_id = models.CharField(max_length=128, null=True, blank=True)
    paired_peer_serial = models.CharField(max_length=128, null=True, blank=True)
    product_baseline = models.JSONField(default=dict, blank=True)
    hw_revision = models.CharField(max_length=64)
    mechanical_revision = models.CharField(max_length=64)
    sw_version = models.CharField(max_length=64)
    fw_version = models.CharField(max_length=64)
    fw_checksum_sha256 = models.CharField(max_length=128)
    critical_components = models.JSONField(default=list, blank=True)
    deviations = models.JSONField(default=list, blank=True)
    rework_history = models.JSONField(default=list, blank=True)
    inspection_records = models.JSONField(default=list, blank=True)
    test_executions = models.JSONField(default=list, blank=True)
    release_status = models.CharField(max_length=64, default='IN_ASSEMBLY')
    build_order = models.ForeignKey(BuildOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='units')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hardware_production_units'

    def __str__(self):
        return f"{self.serial_number} [{self.unit_type}] - {self.release_status}"

    def pair_with(self, peer, set_id):
        self.system_set_id = set_id
        self.paired_peer_serial = peer.serial_number
        peer.system_set_id = set_id
        peer.paired_peer_serial = self.serial_number
        self.save()
        peer.save()

    def unpair(self, peer=None):
        self.system_set_id = None
        self.paired_peer_serial = None
        self.save()
        if peer:
            peer.system_set_id = None
            peer.paired_peer_serial = None
            peer.save()
