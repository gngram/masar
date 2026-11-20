import json
import uuid
from django.utils import timezone
from django.db import models
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from identity.models import (
    ServerAdmin, Organization, ProductionUnit, TenantUser,
    UserRole, UserOrganization, PipelineStage, StageProcurementRequest,
    StageFinishedProduct, CustomRole, ApiToken, TrackingParameter,
    ProcuredComponent, verify_password, hash_password
)

def api_response(success=True, data=None, error=None, status_code=200):
    payload = {"success": success}
    if data is not None:
        payload["data"] = data
    if error is not None:
        payload["error"] = error
    return JsonResponse(payload, status=status_code)

class UnifiedLoginView(APIView):
    """POST /api/v1/identity/login: authenticates ServerAdmin, then TenantUser."""
    def post(self, request):
        email = request.data.get('email', '').strip()
        password = request.data.get('password', '')

        if not email or not password:
            return JsonResponse({"error": "Invalid login request payload"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Check Server Admin
        admin = ServerAdmin.objects.filter(email=email).first()
        if admin and admin.check_password(password):
            if not admin.is_active:
                return JsonResponse({"error": "Administrator account is inactive"}, status=status.HTTP_403_FORBIDDEN)
            token = f"adm_{uuid.uuid4().hex}"
            ApiToken.objects.create(token=token, server_admin=admin, is_server_admin=True)
            admin.last_login_at = timezone.now()
            admin.save()
            return JsonResponse({
                "is_server_admin": True,
                "token": token,
                "admin": {
                    "id": str(admin.id),
                    "email": admin.email,
                    "full_name": admin.full_name,
                    "role": admin.role,
                    "is_active": admin.is_active,
                }
            })

        # 2. Check Tenant User
        user = TenantUser.objects.filter(email=email).first()
        if user and user.check_password(password):
            if not user.is_active:
                return JsonResponse({
                    "error": "Account is not yet activated. Please use the 'Accept Invitation & Register' tab with your one-time password to complete registration."
                }, status=status.HTTP_403_FORBIDDEN)
            token = f"usr_{uuid.uuid4().hex}"
            ApiToken.objects.create(token=token, user=user, is_server_admin=False)
            user.last_login_at = timezone.now()
            user.save()
            roles = list(user.roles.values('role', 'production_unit_id'))
            return JsonResponse({
                "is_server_admin": False,
                "token": token,
                "user": {
                    "id": str(user.id),
                    "organization_id": str(user.organization_id),
                    "email": user.email,
                    "full_name": user.full_name,
                    "is_active": user.is_active,
                    "roles": roles,
                }
            })

        return JsonResponse({"error": "Invalid email or password"}, status=status.HTTP_401_UNAUTHORIZED)

class AdminLoginView(APIView):
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        admin = ServerAdmin.objects.filter(email=email).first()
        if admin and admin.check_password(password):
            token = f"adm_{uuid.uuid4().hex}"
            ApiToken.objects.create(token=token, server_admin=admin, is_server_admin=True)
            return JsonResponse({
                "token": token,
                "admin": {
                    "id": str(admin.id),
                    "email": admin.email,
                    "full_name": admin.full_name,
                    "role": admin.role
                }
            })
        return JsonResponse({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

class RegisterInviteView(APIView):
    def post(self, request):
        email = request.data.get('email', '').strip()
        otp = request.data.get('one_time_password', '')
        full_name = request.data.get('full_name', '').strip()
        new_password = request.data.get('new_password', '')

        user = TenantUser.objects.filter(email=email).first()
        if not user:
            return JsonResponse({"error": "User invitation not found"}, status=status.HTTP_404_NOT_FOUND)

        if not user.check_password(otp):
            return JsonResponse({"error": "Invalid one-time password"}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        if full_name:
            user.full_name = full_name
        user.is_active = True
        user.save()

        token = f"usr_{uuid.uuid4().hex}"
        ApiToken.objects.create(token=token, user=user, is_server_admin=False)
        return JsonResponse({"token": token, "user": {"id": str(user.id), "email": user.email, "full_name": user.full_name}})

class DedicatedProductionUnitsView(APIView):
    def get(self, request):
        org = Organization.objects.first()
        if not org:
            org = Organization.objects.create(slug="tii-industrial", name="Technology Innovation Institute (TII)")
        pus = ProductionUnit.objects.filter(organization=org)
        res = []
        for pu in pus:
            res.append({
                "id": str(pu.id),
                "organization_id": str(pu.organization_id),
                "code": pu.code,
                "name": pu.name,
                "description": pu.description,
                "created_at": pu.created_at.isoformat()
            })
        return JsonResponse({
            "production_units": res,
            "business_units": res,
            "data": res
        })

    def post(self, request):
        org = Organization.objects.first()
        if not org:
            org = Organization.objects.create(slug="tii-industrial", name="Technology Innovation Institute (TII)")
        code = request.data.get('code', '').strip()
        name = request.data.get('name', '').strip()
        description = request.data.get('description', '').strip()
        pu, created = ProductionUnit.objects.get_or_create(
            organization=org, code=code,
            defaults={'name': name, 'description': description}
        )
        return JsonResponse({
            "id": str(pu.id),
            "organization_id": str(pu.organization_id),
            "code": pu.code,
            "name": pu.name,
            "description": pu.description
        }, status=status.HTTP_201_CREATED)

class ProductionUnitDetailView(APIView):
    def delete(self, request, pu_id):
        ProductionUnit.objects.filter(id=pu_id).delete()
        return JsonResponse({"message": "Production unit deleted successfully"})

class MyProductionUnitsView(APIView):
    def get(self, request):
        org = Organization.objects.first()
        if not org:
            return JsonResponse({"production_units": [], "data": []})
        pus = ProductionUnit.objects.filter(organization=org)
        res = []
        for pu in pus:
            res.append({
                "id": str(pu.id),
                "code": pu.code,
                "name": pu.name,
                "description": pu.description
            })
        return JsonResponse({
            "production_units": res,
            "business_units": res,
            "data": res
        })

class PUUsersView(APIView):
    def get(self, request, pu_id):
        roles = UserRole.objects.filter(production_unit_id=pu_id).select_related('user')
        users_map = {}
        for r in roles:
            uid = str(r.user.id)
            if uid not in users_map:
                users_map[uid] = {
                    "id": uid,
                    "email": r.user.email,
                    "full_name": r.user.full_name,
                    "is_active": r.user.is_active,
                    "roles": []
                }
            users_map[uid]["roles"].append({
                "role": r.role,
                "role_key": r.role,
                "production_unit_id": str(r.production_unit_id) if r.production_unit_id else None
            })
        users_list = list(users_map.values())
        return JsonResponse({"users": users_list, "data": users_list})

class CreatePUAdminView(APIView):
    def post(self, request, pu_id):
        pu = ProductionUnit.objects.filter(id=pu_id).first()
        if not pu:
            return JsonResponse({"error": "Production unit not found"}, status=status.HTTP_404_NOT_FOUND)
        email = request.data.get('email', '').strip()
        full_name = request.data.get('full_name', '').strip()
        raw_password = request.data.get('password', '')

        user, created = TenantUser.objects.get_or_create(
            email=email,
            defaults={'organization': pu.organization, 'full_name': full_name, 'is_active': True}
        )
        user.set_password(raw_password)
        user.save()
        UserRole.objects.get_or_create(user=user, role='PU_ADMIN', production_unit=pu)
        return JsonResponse({"id": str(user.id), "email": user.email, "full_name": user.full_name})

class InviteUserView(APIView):
    def post(self, request, pu_id):
        pu = ProductionUnit.objects.filter(id=pu_id).first()
        if not pu:
            return JsonResponse({"error": "Production unit not found"}, status=status.HTTP_404_NOT_FOUND)
        email = request.data.get('email', '').strip()
        otp = request.data.get('one_time_password', '')
        roles = request.data.get('roles', [])

        user, created = TenantUser.objects.get_or_create(
            email=email,
            defaults={'organization': pu.organization, 'full_name': 'Invited Member', 'is_active': False}
        )
        user.set_password(otp)
        user.save()
        for r in roles:
            UserRole.objects.get_or_create(user=user, role=r, production_unit=pu)
        return JsonResponse({"message": "User invited successfully", "id": str(user.id)})

class AddUserRoleView(APIView):
    def post(self, request, pu_id, user_id):
        role = request.data.get('role')
        user = TenantUser.objects.filter(id=user_id).first()
        pu = ProductionUnit.objects.filter(id=pu_id).first()
        if not user or not pu:
            return JsonResponse({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        UserRole.objects.get_or_create(user=user, role=role, production_unit=pu)
        return JsonResponse({"message": "Role added"})

class RemoveUserRoleView(APIView):
    def delete(self, request, pu_id, user_id, role):
        UserRole.objects.filter(production_unit_id=pu_id, user_id=user_id, role=role).delete()
        return JsonResponse({"message": "Role removed"})

class RemoveUserFromPUView(APIView):
    def delete(self, request, pu_id, user_id):
        UserRole.objects.filter(production_unit_id=pu_id, user_id=user_id).delete()
        return JsonResponse({"message": "User unassigned from production unit"})

class PipelineStagesView(APIView):
    def get(self, request, pu_id):
        stages = PipelineStage.objects.filter(production_unit_id=pu_id).order_by('sequence_num')
        assembly_type = request.query_params.get('assembly_type')
        if assembly_type and assembly_type != 'ALL':
            stages = stages.filter(assembly_type=assembly_type)
        res = []
        for s in stages:
            res.append({
                "id": str(s.id),
                "production_unit_id": str(s.production_unit_id),
                "stage_key": s.stage_key,
                "name": s.name,
                "sequence_num": s.sequence_num,
                "description": s.description,
                "output_product_name": s.output_product_name,
                "output_product_code": s.output_product_code,
                "input_items": s.input_items,
                "intermediate_statuses": s.intermediate_statuses,
                "custom_fields": s.custom_fields,
                "assembly_type": s.assembly_type,
                "parent_stage_key": s.parent_stage_key,
                "assigned_parameters": s.assigned_parameters or [],
                "is_subassembly": s.is_subassembly,
                "bom_inputs": s.bom_inputs or [],
            })
        return JsonResponse({"stages": res, "data": res})

    def post(self, request, pu_id):
        pu = ProductionUnit.objects.filter(id=pu_id).first()
        stage_key = request.data.get('stage_key')
        name = request.data.get('name')
        seq = request.data.get('sequence_num', 0)
        desc = request.data.get('description', '')
        assembly_type = request.data.get('assembly_type', '')
        parent_stage_key = request.data.get('parent_stage_key', '')
        assigned_params = request.data.get('assigned_parameters', [])
        bom_inputs = request.data.get('bom_inputs', [])
        is_sub = request.data.get('is_subassembly', False)

        stage, created = PipelineStage.objects.get_or_create(
            production_unit=pu, stage_key=stage_key,
            defaults={
                'name': name,
                'sequence_num': seq,
                'description': desc,
                'assembly_type': assembly_type,
                'parent_stage_key': parent_stage_key,
                'assigned_parameters': assigned_params,
                'bom_inputs': bom_inputs,
                'is_subassembly': is_sub,
            }
        )
        return JsonResponse({"id": str(stage.id), "stage_key": stage.stage_key, "name": stage.name}, status=status.HTTP_201_CREATED)

class PipelineStageDetailView(APIView):
    def put(self, request, pu_id, stage_id):
        stage = PipelineStage.objects.filter(production_unit_id=pu_id, id=stage_id).first()
        if not stage:
            return JsonResponse({"error": "Stage not found"}, status=status.HTTP_404_NOT_FOUND)
        if 'name' in request.data: stage.name = request.data['name']
        if 'sequence_num' in request.data: stage.sequence_num = request.data['sequence_num']
        if 'description' in request.data: stage.description = request.data['description']
        stage.save()
        return JsonResponse({"id": str(stage.id), "message": "Updated successfully"})

    def delete(self, request, pu_id, stage_id):
        PipelineStage.objects.filter(production_unit_id=pu_id, id=stage_id).delete()
        return JsonResponse({"message": "Stage deleted"})

class PipelineStageConfigView(APIView):
    def put(self, request, pu_id, stage_id):
        stage = PipelineStage.objects.filter(production_unit_id=pu_id, id=stage_id).first()
        if not stage:
            return JsonResponse({"error": "Stage not found"}, status=status.HTTP_404_NOT_FOUND)
        if 'output_product_name' in request.data: stage.output_product_name = request.data['output_product_name']
        if 'output_product_code' in request.data: stage.output_product_code = request.data['output_product_code']
        if 'input_items' in request.data: stage.input_items = request.data['input_items']
        if 'intermediate_statuses' in request.data: stage.intermediate_statuses = request.data['intermediate_statuses']
        if 'custom_fields' in request.data: stage.custom_fields = request.data['custom_fields']
        if 'assigned_parameters' in request.data: stage.assigned_parameters = request.data['assigned_parameters']
        if 'bom_inputs' in request.data: stage.bom_inputs = request.data['bom_inputs']
        if 'is_subassembly' in request.data: stage.is_subassembly = request.data['is_subassembly']
        stage.save()
        return JsonResponse({"id": str(stage.id), "message": "Configuration updated"})

class StageProcurementRequestsView(APIView):
    def get(self, request, pu_id, stage_key):
        reqs = StageProcurementRequest.objects.filter(production_unit_id=pu_id, stage_key=stage_key)
        res = []
        for r in reqs:
            res.append({
                "id": str(r.id),
                "stage_key": r.stage_key,
                "target_source": r.target_source,
                "source_stage_key": r.source_stage_key,
                "item_code": r.item_code,
                "item_name": r.item_name,
                "requested_by": r.requested_by,
                "status": r.status,
                "allocated_serial_number": r.allocated_serial_number,
                "approved_by": r.approved_by,
                "created_at": r.created_at.isoformat()
            })
        return JsonResponse({"requests": res, "data": res})

    def post(self, request, pu_id, stage_key):
        pu = ProductionUnit.objects.filter(id=pu_id).first()
        r = StageProcurementRequest.objects.create(
            production_unit=pu,
            stage_key=stage_key,
            target_source=request.data.get('target_source', 'INVENTORY'),
            source_stage_key=request.data.get('source_stage_key', ''),
            item_code=request.data.get('item_code', ''),
            item_name=request.data.get('item_name', ''),
            requested_by=request.data.get('requested_by', 'Operator')
        )
        return JsonResponse({"id": str(r.id), "status": r.status}, status=status.HTTP_201_CREATED)

class ApproveProcurementRequestView(APIView):
    def post(self, request, pu_id, req_id):
        req = StageProcurementRequest.objects.filter(production_unit_id=pu_id, id=req_id).first()
        if not req:
            return JsonResponse({"error": "Request not found"}, status=status.HTTP_404_NOT_FOUND)
        req.allocated_serial_number = request.data.get('allocated_serial_number', '')
        req.approved_by = request.data.get('approved_by', 'Manager')
        req.status = 'APPROVED'
        req.save()
        return JsonResponse({"id": str(req.id), "status": req.status})

class StageFinishedProductsView(APIView):
    def get(self, request, pu_id, stage_key):
        prods = StageFinishedProduct.objects.filter(production_unit_id=pu_id, stage_key=stage_key)
        insp_status = request.query_params.get('inspection_status')
        if insp_status and insp_status != 'ALL':
            prods = prods.filter(inspection_status=insp_status)
        res = []
        for p in prods:
            res.append({
                "id": str(p.id),
                "stage_key": p.stage_key,
                "serial_number": p.serial_number,
                "product_code": p.product_code,
                "product_name": p.product_name,
                "status": p.status,
                "inspection_status": p.inspection_status,
                "defect_reason": p.defect_reason,
                "component_origin": p.component_origin,
                "immutable_fields": p.immutable_fields,
                "bom_components": p.bom_components,
                "parameter_values": p.parameter_values or {},
                "created_by": p.created_by,
                "created_at": p.created_at.isoformat()
            })
        return JsonResponse({"products": res, "data": res})

    def post(self, request, pu_id, stage_key):
        pu = ProductionUnit.objects.filter(id=pu_id).first()
        sn = request.data.get('serial_number') or f"SN-{uuid.uuid4().hex[:8].upper()}"
        p = StageFinishedProduct.objects.create(
            production_unit=pu,
            stage_key=stage_key,
            serial_number=sn,
            product_code=request.data.get('product_code', ''),
            product_name=request.data.get('product_name', ''),
            status=request.data.get('status', 'AVAILABLE'),
            inspection_status=request.data.get('inspection_status', 'OK'),
            defect_reason=request.data.get('defect_reason', ''),
            component_origin=request.data.get('component_origin', 'PROCURED'),
            immutable_fields=request.data.get('immutable_fields', {}),
            bom_components=request.data.get('bom_components', []),
            parameter_values=request.data.get('parameter_values', {}),
            created_by=request.data.get('created_by', 'Operator')
        )
        return JsonResponse({"id": str(p.id), "serial_number": p.serial_number}, status=status.HTTP_201_CREATED)

class FinishedProductDetailView(APIView):
    def put(self, request, pu_id, stage_key=None, product_id=None):
        p = StageFinishedProduct.objects.filter(production_unit_id=pu_id, id=product_id).first()
        if not p:
            return JsonResponse({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)
        if 'properties' in request.data:
            p.immutable_fields.update(request.data['properties'])
        if 'inspection_status' in request.data:
            p.inspection_status = request.data['inspection_status']
        if 'defect_reason' in request.data:
            p.defect_reason = request.data['defect_reason']
        if 'parameter_values' in request.data:
            p.parameter_values.update(request.data['parameter_values'])
        p.save()
        return JsonResponse({"id": str(p.id), "message": "Updated product"})

class FinishedProductBoMView(APIView):
    def get(self, request, pu_id, product_id):
        p = StageFinishedProduct.objects.filter(production_unit_id=pu_id, id=product_id).first()
        if not p:
            return JsonResponse({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)
        return JsonResponse({"bom_components": p.bom_components, "product": p.product_name})

class CustomRolesView(APIView):
    def get(self, request, pu_id):
        built_in_roles = [
            {"role_key": "PU_ADMIN", "name": "Production Unit Admin", "description": "Full administrative control over production line."},
            {"role_key": "LINE_ENGINEER", "name": "Line Engineer", "description": "Assembly execution and rework authorization."},
            {"role_key": "QA_INSPECTOR", "name": "QA Inspector", "description": "Quality gate approval and test reporting."},
            {"role_key": "CLEANROOM_OPERATOR", "name": "Cleanroom Operator", "description": "Stock movements and assembly workstation processing."}
        ]
        custom = list(CustomRole.objects.filter(production_unit_id=pu_id).values('role_key', 'name', 'description'))
        return JsonResponse({"roles": built_in_roles + custom})

    def post(self, request, pu_id):
        pu = ProductionUnit.objects.filter(id=pu_id).first()
        role_key = request.data.get('role_key', '').strip()
        name = request.data.get('name', '').strip()
        desc = request.data.get('description', '').strip()
        cr, created = CustomRole.objects.get_or_create(
            production_unit=pu, role_key=role_key,
            defaults={'name': name, 'description': desc}
        )
        return JsonResponse({"role_key": cr.role_key, "name": cr.name}, status=status.HTTP_201_CREATED)

class CustomRoleDetailView(APIView):
    def delete(self, request, pu_id, role_key):
        CustomRole.objects.filter(production_unit_id=pu_id, role_key=role_key).delete()
        return JsonResponse({"message": "Role deleted"})

class TrackingParametersView(APIView):
    def get(self, request, pu_id):
        params = TrackingParameter.objects.filter(production_unit_id=pu_id).order_by('name')
        res = []
        for p in params:
            res.append({
                "id": str(p.id),
                "param_key": p.param_key,
                "name": p.name,
                "unit": p.unit,
                "data_type": p.data_type,
                "default_value": p.default_value,
                "is_critical": p.is_critical,
                "options": p.options or []
            })
        return JsonResponse({"parameters": res, "data": res})

    def post(self, request, pu_id):
        pu = ProductionUnit.objects.filter(id=pu_id).first()
        if not pu:
            return JsonResponse({"error": "Production Unit not found"}, status=status.HTTP_404_NOT_FOUND)
        key = request.data.get('param_key', '').strip().lower().replace(' ', '_')
        if not key:
            return JsonResponse({"error": "param_key is required"}, status=status.HTTP_400_BAD_REQUEST)
        param, created = TrackingParameter.objects.update_or_create(
            production_unit=pu, param_key=key,
            defaults={
                'name': request.data.get('name', key),
                'unit': request.data.get('unit', ''),
                'data_type': request.data.get('data_type', 'NUMERIC'),
                'default_value': request.data.get('default_value', ''),
                'is_critical': request.data.get('is_critical', False),
                'options': request.data.get('options', [])
            }
        )
        return JsonResponse({"param_key": param.param_key, "name": param.name, "created": created}, status=status.HTTP_201_CREATED)

class TrackingParameterDetailView(APIView):
    def put(self, request, pu_id, param_key):
        param = TrackingParameter.objects.filter(production_unit_id=pu_id, param_key=param_key).first()
        if not param:
            return JsonResponse({"error": "Parameter not found"}, status=status.HTTP_404_NOT_FOUND)
        if 'name' in request.data: param.name = request.data['name']
        if 'unit' in request.data: param.unit = request.data['unit']
        if 'data_type' in request.data: param.data_type = request.data['data_type']
        if 'default_value' in request.data: param.default_value = request.data['default_value']
        if 'is_critical' in request.data: param.is_critical = request.data['is_critical']
        if 'options' in request.data: param.options = request.data['options']
        param.save()
        return JsonResponse({"param_key": param.param_key, "message": "Parameter updated"})

    def delete(self, request, pu_id, param_key):
        TrackingParameter.objects.filter(production_unit_id=pu_id, param_key=param_key).delete()
        return JsonResponse({"message": "Parameter deleted"})

class StageParametersView(APIView):
    def get(self, request, pu_id, stage_key):
        stage = PipelineStage.objects.filter(production_unit_id=pu_id, stage_key=stage_key).first()
        if not stage:
            return JsonResponse({"error": "Stage not found"}, status=status.HTTP_404_NOT_FOUND)
        keys = stage.assigned_parameters or []
        params = TrackingParameter.objects.filter(production_unit_id=pu_id, param_key__in=keys)
        param_map = {p.param_key: p for p in params}
        res = []
        for k in keys:
            if k in param_map:
                p = param_map[k]
                res.append({
                    "id": str(p.id),
                    "param_key": p.param_key,
                    "name": p.name,
                    "unit": p.unit,
                    "data_type": p.data_type,
                    "default_value": p.default_value,
                    "is_critical": p.is_critical,
                    "options": p.options or []
                })
            else:
                res.append({"param_key": k, "name": k, "unit": "", "data_type": "TEXT", "default_value": "", "is_critical": False, "options": []})
        return JsonResponse({"parameter_keys": keys, "parameters": res, "data": res})

    def post(self, request, pu_id, stage_key):
        stage = PipelineStage.objects.filter(production_unit_id=pu_id, stage_key=stage_key).first()
        if not stage:
            return JsonResponse({"error": "Stage not found"}, status=status.HTTP_404_NOT_FOUND)
        keys = request.data.get('parameter_keys', [])
        stage.assigned_parameters = keys
        stage.save()
        return JsonResponse({"stage_key": stage.stage_key, "assigned_parameters": stage.assigned_parameters})

class ProcuredComponentsView(APIView):
    def get(self, request, pu_id):
        items = ProcuredComponent.objects.filter(production_unit_id=pu_id, is_active=True).order_by('name')
        res = []
        for it in items:
            res.append({
                "id": str(it.id),
                "item_code": it.item_code,
                "name": it.name,
                "category": it.category,
                "supplier": it.supplier,
                "unit": it.unit,
                "specifications": it.specifications or {},
                "created_at": it.created_at.isoformat()
            })
        return JsonResponse({"components": res, "data": res})

    def post(self, request, pu_id):
        pu = ProductionUnit.objects.filter(id=pu_id).first()
        if not pu:
            return JsonResponse({"error": "Production Unit not found"}, status=status.HTTP_404_NOT_FOUND)
        code = request.data.get('item_code', '').strip().upper()
        if not code:
            return JsonResponse({"error": "item_code is required"}, status=status.HTTP_400_BAD_REQUEST)
        comp, created = ProcuredComponent.objects.update_or_create(
            production_unit=pu, item_code=code,
            defaults={
                'name': request.data.get('name', code),
                'category': request.data.get('category', ''),
                'supplier': request.data.get('supplier', ''),
                'unit': request.data.get('unit', 'PCS'),
                'specifications': request.data.get('specifications', {}),
                'is_active': True
            }
        )
        return JsonResponse({"item_code": comp.item_code, "name": comp.name, "created": created}, status=status.HTTP_201_CREATED)

class ProcuredComponentDetailView(APIView):
    def delete(self, request, pu_id, item_code):
        ProcuredComponent.objects.filter(production_unit_id=pu_id, item_code=item_code).delete()
        return JsonResponse({"message": "Component deleted"})

class SubAssembliesView(APIView):
    def get(self, request, pu_id):
        sub_assemblies = PipelineStage.objects.filter(
            production_unit_id=pu_id
        ).filter(
            models.Q(parent_stage_key='BUILD') | models.Q(is_subassembly=True) | models.Q(stage_key__startswith='BUILD_')
        ).order_by('sequence_num')
        res = []
        for sa in sub_assemblies:
            wip_count = StageFinishedProduct.objects.filter(production_unit_id=pu_id, stage_key=sa.stage_key).count()
            res.append({
                "id": str(sa.id),
                "stage_key": sa.stage_key,
                "name": sa.name,
                "sequence_num": sa.sequence_num,
                "description": sa.description,
                "output_product_name": sa.output_product_name,
                "output_product_code": sa.output_product_code,
                "parent_stage_key": sa.parent_stage_key or 'BUILD',
                "is_subassembly": True,
                "bom_inputs": sa.bom_inputs or [],
                "assigned_parameters": sa.assigned_parameters or [],
                "intermediate_statuses": sa.intermediate_statuses or ['PENDING', 'ASSEMBLING', 'ALIGNMENT', 'INSPECTION', 'COMPLETED'],
                "wip_count": wip_count
            })
        return JsonResponse({"sub_assemblies": res, "data": res})

    def post(self, request, pu_id):
        pu = ProductionUnit.objects.filter(id=pu_id).first()
        if not pu:
            return JsonResponse({"error": "Production Unit not found"}, status=status.HTTP_404_NOT_FOUND)
        key = request.data.get('stage_key', '').strip().upper()
        if not key:
            key = f"BUILD_SUB_{uuid.uuid4().hex[:6].upper()}"
        if not key.startswith('BUILD_'):
            key = f"BUILD_{key}"
        name = request.data.get('name', 'New Sub-Assembly')
        seq = request.data.get('sequence_num', 1)
        desc = request.data.get('description', '')
        out_name = request.data.get('output_product_name', '')
        out_code = request.data.get('output_product_code', '')
        bom_inputs = request.data.get('bom_inputs', [])
        assigned_params = request.data.get('assigned_parameters', [])

        stage, created = PipelineStage.objects.update_or_create(
            production_unit=pu, stage_key=key,
            defaults={
                'name': name,
                'sequence_num': seq,
                'description': desc,
                'output_product_name': out_name,
                'output_product_code': out_code,
                'assembly_type': 'BUILD_SUBASSEMBLY',
                'parent_stage_key': 'BUILD',
                'is_subassembly': True,
                'bom_inputs': bom_inputs,
                'assigned_parameters': assigned_params,
                'intermediate_statuses': ['PENDING', 'ASSEMBLING', 'ALIGNMENT', 'INSPECTION', 'COMPLETED']
            }
        )
        return JsonResponse({"id": str(stage.id), "stage_key": stage.stage_key, "name": stage.name}, status=status.HTTP_201_CREATED)

class SubAssemblyDetailView(APIView):
    def put(self, request, pu_id, stage_key):
        stage = PipelineStage.objects.filter(production_unit_id=pu_id, stage_key=stage_key).first()
        if not stage:
            return JsonResponse({"error": "Sub-assembly not found"}, status=status.HTTP_404_NOT_FOUND)
        if 'name' in request.data: stage.name = request.data['name']
        if 'sequence_num' in request.data: stage.sequence_num = request.data['sequence_num']
        if 'description' in request.data: stage.description = request.data['description']
        if 'output_product_name' in request.data: stage.output_product_name = request.data['output_product_name']
        if 'output_product_code' in request.data: stage.output_product_code = request.data['output_product_code']
        if 'bom_inputs' in request.data: stage.bom_inputs = request.data['bom_inputs']
        if 'assigned_parameters' in request.data: stage.assigned_parameters = request.data['assigned_parameters']
        stage.save()
        return JsonResponse({"stage_key": stage.stage_key, "message": "Sub-assembly updated"})

    def delete(self, request, pu_id, stage_key):
        PipelineStage.objects.filter(production_unit_id=pu_id, stage_key=stage_key).delete()
        return JsonResponse({"message": "Sub-assembly deleted"})

class InspectProductView(APIView):
    def post(self, request, pu_id, product_id):
        p = StageFinishedProduct.objects.filter(production_unit_id=pu_id, id=product_id).first()
        if not p:
            return JsonResponse({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)
        status_val = request.data.get('inspection_status', 'OK').upper()
        p.inspection_status = status_val
        p.defect_reason = request.data.get('defect_reason', '')
        if status_val == 'FAULTY':
            p.status = 'REJECTED'
        else:
            p.status = 'AVAILABLE'
        # Record inspected parameters if provided
        params = request.data.get('parameters', {})
        if params:
            now_iso = timezone.now().isoformat()
            recorded_by = request.data.get('recorded_by', 'QA Inspector')
            current_vals = p.parameter_values or {}
            for k, v in params.items():
                unit = request.data.get('units', {}).get(k, '')
                current_vals[k] = {
                    'value': str(v),
                    'unit': unit,
                    'stage_key': 'INSPECT',
                    'recorded_by': recorded_by,
                    'recorded_at': now_iso
                }
            p.parameter_values = current_vals
        p.save()
        return JsonResponse({
            "id": str(p.id),
            "serial_number": p.serial_number,
            "inspection_status": p.inspection_status,
            "defect_reason": p.defect_reason,
            "parameter_values": p.parameter_values
        })

class RecordStageParametersView(APIView):
    def post(self, request, pu_id, stage_key):
        product_id = request.data.get('product_id')
        serial_number = request.data.get('serial_number')
        query = StageFinishedProduct.objects.filter(production_unit_id=pu_id)
        if product_id:
            p = query.filter(id=product_id).first()
        elif serial_number:
            p = query.filter(serial_number=serial_number).first()
        else:
            return JsonResponse({"error": "product_id or serial_number required"}, status=status.HTTP_400_BAD_REQUEST)
        if not p:
            return JsonResponse({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)

        new_params = request.data.get('parameters', {})
        units = request.data.get('units', {})
        recorded_by = request.data.get('recorded_by', 'Operator')
        now_iso = timezone.now().isoformat()

        # Carry forward previous parameters and merge new ones
        vals = p.parameter_values or {}
        for k, v in new_params.items():
            vals[k] = {
                'value': str(v),
                'unit': units.get(k, ''),
                'stage_key': stage_key,
                'recorded_by': recorded_by,
                'recorded_at': now_iso
            }
        p.parameter_values = vals
        p.save()
        return JsonResponse({
            "id": str(p.id),
            "serial_number": p.serial_number,
            "parameter_values": p.parameter_values,
            "message": "Parameters recorded and carried forward successfully"
        })

