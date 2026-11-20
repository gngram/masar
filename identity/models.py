import uuid
from django.db import models
from django.utils import timezone
import bcrypt

def hash_password(plain_password: str) -> str:
    """Hash password using bcrypt with standard work factor."""
    salt = bcrypt.gensalt(rounds=10)
    hashed = bcrypt.hashpw(plain_password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash."""
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

class ServerAdmin(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=64, default='SERVER_SUPER_ADMIN')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    last_login_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'server_admins'

    def set_password(self, raw_password):
        self.password_hash = hash_password(raw_password)

    def check_password(self, raw_password):
        return verify_password(raw_password, self.password_hash)

class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(unique=True, max_length=128)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'organizations'

class ProductionUnit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='production_units')
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'org_production_units'
        unique_together = ('organization', 'code')

class TenantUser(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.RESTRICT, related_name='users')
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255)
    full_name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    last_login_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'users'

    def set_password(self, raw_password):
        self.password_hash = hash_password(raw_password)

    def check_password(self, raw_password):
        return verify_password(raw_password, self.password_hash)

class UserRole(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(TenantUser, on_delete=models.CASCADE, related_name='roles')
    role = models.CharField(max_length=64)
    production_unit = models.ForeignKey(ProductionUnit, on_delete=models.CASCADE, null=True, blank=True, related_name='user_roles')
    business_unit_id = models.CharField(max_length=64, null=True, blank=True)

    class Meta:
        db_table = 'user_roles'
        unique_together = ('user', 'role', 'production_unit')

class UserOrganization(models.Model):
    user = models.ForeignKey(TenantUser, on_delete=models.CASCADE)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)

    class Meta:
        db_table = 'user_organizations'
        unique_together = ('user', 'organization')

class TrackingParameter(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    production_unit = models.ForeignKey(ProductionUnit, on_delete=models.CASCADE, related_name='tracking_parameters')
    param_key = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    unit = models.CharField(max_length=64, blank=True, default='')
    data_type = models.CharField(max_length=32, default='NUMERIC')  # NUMERIC, TEXT, BOOLEAN, SELECT
    default_value = models.CharField(max_length=255, blank=True, default='')
    is_critical = models.BooleanField(default=False)
    options = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'pu_tracking_parameters'
        unique_together = ('production_unit', 'param_key')

class ProcuredComponent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    production_unit = models.ForeignKey(ProductionUnit, on_delete=models.CASCADE, related_name='procured_components')
    item_code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=128, blank=True, default='')
    supplier = models.CharField(max_length=255, blank=True, default='')
    unit = models.CharField(max_length=32, default='PCS')
    specifications = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'pu_procured_components'
        unique_together = ('production_unit', 'item_code')

class PipelineStage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    production_unit = models.ForeignKey(ProductionUnit, on_delete=models.CASCADE, related_name='pipeline_stages')
    stage_key = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    sequence_num = models.IntegerField(default=0)
    description = models.TextField(blank=True, default='')
    output_product_name = models.CharField(max_length=255, blank=True, default='')
    output_product_code = models.CharField(max_length=64, blank=True, default='')
    input_items = models.JSONField(default=list, blank=True)
    intermediate_statuses = models.JSONField(default=list, blank=True)
    custom_fields = models.JSONField(default=list, blank=True)
    assembly_type = models.CharField(max_length=64, blank=True, default='')
    parent_stage_key = models.CharField(max_length=64, blank=True, default='')
    assigned_parameters = models.JSONField(default=list, blank=True)
    is_subassembly = models.BooleanField(default=False)
    bom_inputs = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'pu_pipeline_stages'
        unique_together = ('production_unit', 'stage_key')

class StageProcurementRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    production_unit = models.ForeignKey(ProductionUnit, on_delete=models.CASCADE, related_name='procurement_requests')
    stage_key = models.CharField(max_length=64)
    target_source = models.CharField(max_length=64)
    source_stage_key = models.CharField(max_length=64, blank=True, default='')
    item_code = models.CharField(max_length=64)
    item_name = models.CharField(max_length=255)
    requested_by = models.CharField(max_length=255)
    status = models.CharField(max_length=32, default='PENDING')
    allocated_serial_number = models.CharField(max_length=128, blank=True, default='')
    approved_by = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pu_stage_procurement_requests'

class StageFinishedProduct(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    production_unit = models.ForeignKey(ProductionUnit, on_delete=models.CASCADE, related_name='finished_products')
    stage_key = models.CharField(max_length=64)
    serial_number = models.CharField(max_length=128, unique=True)
    product_code = models.CharField(max_length=64)
    product_name = models.CharField(max_length=255)
    status = models.CharField(max_length=32, default='AVAILABLE')
    inspection_status = models.CharField(max_length=32, default='OK')  # OK, FAULTY, PENDING
    defect_reason = models.TextField(blank=True, default='')
    component_origin = models.CharField(max_length=32, default='PROCURED')  # PROCURED, SUBASSEMBLY_OUTPUT
    immutable_fields = models.JSONField(default=dict, blank=True)
    bom_components = models.JSONField(default=list, blank=True)
    parameter_values = models.JSONField(default=dict, blank=True)
    created_by = models.CharField(max_length=255)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'pu_stage_finished_products'

class CustomRole(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    production_unit = models.ForeignKey(ProductionUnit, on_delete=models.CASCADE, related_name='custom_roles')
    role_key = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'pu_custom_roles'
        unique_together = ('production_unit', 'role_key')

class ApiToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    token = models.CharField(max_length=255, unique=True)
    user = models.ForeignKey(TenantUser, null=True, blank=True, on_delete=models.CASCADE)
    server_admin = models.ForeignKey(ServerAdmin, null=True, blank=True, on_delete=models.CASCADE)
    is_server_admin = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'api_tokens'

