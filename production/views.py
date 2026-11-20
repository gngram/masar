import uuid
from django.utils import timezone
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework import status
from production.models import ProductionUnit, BuildOrder

def api_response(success=True, data=None, error=None, status_code=200):
    payload = {"success": success}
    if data is not None:
        payload["data"] = data
    if error is not None:
        payload["error"] = error
    return JsonResponse(payload, status=status_code)

def serialize_unit(u):
    return {
        "id": str(u.id),
        "serial_number": u.serial_number,
        "unit_type": u.unit_type,
        "system_set_id": u.system_set_id,
        "paired_peer_serial": u.paired_peer_serial,
        "product_baseline": u.product_baseline,
        "hw_revision": u.hw_revision,
        "mechanical_revision": u.mechanical_revision,
        "sw_version": u.sw_version,
        "fw_version": u.fw_version,
        "fw_checksum_sha256": u.fw_checksum_sha256,
        "critical_components": u.critical_components,
        "deviations": u.deviations,
        "rework_history": u.rework_history,
        "inspection_records": u.inspection_records,
        "test_executions": u.test_executions,
        "release_status": u.release_status,
        "created_at": u.created_at.isoformat(),
        "updated_at": u.updated_at.isoformat(),
    }

class ProductionUnitListView(APIView):
    def get(self, request):
        units = ProductionUnit.objects.all().order_by('-created_at')
        unit_type = request.query_params.get('unit_type')
        if unit_type:
            units = units.filter(unit_type=unit_type)
        return api_response(data=[serialize_unit(u) for u in units])

    def post(self, request):
        d = request.data
        sn = d.get('serial_number')
        ut = d.get('unit_type')
        if not sn or not ut:
            return api_response(success=False, error="serial_number and unit_type are required", status_code=status.HTTP_400_BAD_REQUEST)

        if ProductionUnit.objects.filter(serial_number=sn).exists():
            return api_response(success=False, error="unit serial number already exists", status_code=status.HTTP_409_CONFLICT)

        unit = ProductionUnit.objects.create(
            serial_number=sn,
            unit_type=ut,
            product_baseline=d.get('product_baseline', {}),
            hw_revision=d.get('hw_revision', 'REV-3.2-A'),
            mechanical_revision=d.get('mechanical_revision', 'MECH-ENC-IP67-R2'),
            sw_version=d.get('sw_version', 'v2.4.1'),
            fw_version=d.get('fw_version', 'v4.1.0-sec'),
            fw_checksum_sha256=d.get('fw_checksum_sha256', ''),
            critical_components=d.get('critical_components', []),
            release_status=d.get('release_status', 'IN_ASSEMBLY')
        )
        return api_response(data=serialize_unit(unit), status_code=status.HTTP_201_CREATED)

class ProductionUnitDetailView(APIView):
    def get(self, request, unit_id):
        u = ProductionUnit.objects.filter(id=unit_id).first()
        if not u:
            return api_response(success=False, error="Production unit not found", status_code=status.HTTP_404_NOT_FOUND)
        return api_response(data=serialize_unit(u))

class PairUnitsView(APIView):
    def post(self, request):
        sender_id = request.data.get('sender_id')
        receiver_id = request.data.get('receiver_id')
        system_set_id = request.data.get('system_set_id', '').strip()

        if not sender_id or not receiver_id or not system_set_id:
            return api_response(success=False, error="sender_id, receiver_id, and system_set_id are required", status_code=status.HTTP_400_BAD_REQUEST)

        sender = ProductionUnit.objects.filter(id=sender_id).first()
        receiver = ProductionUnit.objects.filter(id=receiver_id).first()

        if not sender or not receiver:
            return api_response(success=False, error="One or both units not found", status_code=status.HTTP_404_NOT_FOUND)

        if sender.unit_type == receiver.unit_type:
            return api_response(success=False, error="Can only pair one SENDER with one RECEIVER", status_code=status.HTTP_400_BAD_REQUEST)

        sender.pair_with(receiver, system_set_id)
        return api_response(data={"message": "Units paired successfully", "system_set_id": system_set_id})

class UnpairUnitView(APIView):
    def post(self, request, unit_id):
        unit = ProductionUnit.objects.filter(id=unit_id).first()
        if not unit:
            return api_response(success=False, error="Unit not found", status_code=status.HTTP_404_NOT_FOUND)

        peer = None
        if unit.paired_peer_serial:
            peer = ProductionUnit.objects.filter(serial_number=unit.paired_peer_serial).first()
        unit.unpair(peer)
        return api_response(data={"message": "Unit unpaired successfully"})

class AddReworkView(APIView):
    def post(self, request, unit_id):
        unit = ProductionUnit.objects.filter(id=unit_id).first()
        if not unit:
            return api_response(success=False, error="Unit not found", status_code=status.HTTP_404_NOT_FOUND)

        rework = {
            "id": str(uuid.uuid4()),
            "rework_ticket": request.data.get('rework_ticket', f"RWK-{uuid.uuid4().hex[:6].upper()}"),
            "description": request.data.get('description', ''),
            "action_taken": request.data.get('action_taken', ''),
            "before_status": request.data.get('before_status', ''),
            "after_status": request.data.get('after_status', ''),
            "technician": request.data.get('technician', 'Technician'),
            "rework_date": timezone.now().isoformat()
        }
        unit.rework_history.append(rework)
        unit.save()
        return api_response(data={"message": "Rework recorded", "rework": rework})

class AddDeviationView(APIView):
    def post(self, request, unit_id):
        unit = ProductionUnit.objects.filter(id=unit_id).first()
        if not unit:
            return api_response(success=False, error="Unit not found", status_code=status.HTTP_404_NOT_FOUND)

        deviation = {
            "id": str(uuid.uuid4()),
            "deviation_ref": request.data.get('deviation_ref', f"DEV-{uuid.uuid4().hex[:6].upper()}"),
            "description": request.data.get('description', ''),
            "reason": request.data.get('reason', ''),
            "approved_by": request.data.get('approved_by', 'Lead Architect'),
            "approval_date": timezone.now().isoformat(),
            "status": "APPROVED"
        }
        unit.deviations.append(deviation)
        unit.save()
        return api_response(data={"message": "Deviation recorded", "deviation": deviation})

class AddTestExecutionView(APIView):
    def post(self, request, unit_id):
        unit = ProductionUnit.objects.filter(id=unit_id).first()
        if not unit:
            return api_response(success=False, error="Unit not found", status_code=status.HTTP_404_NOT_FOUND)

        passed = bool(request.data.get('passed', True))
        test = {
            "id": str(uuid.uuid4()),
            "test_procedure_rev": request.data.get('test_procedure_rev', 'PROC-QKD-FAT-REV-3'),
            "test_date": timezone.now().isoformat(),
            "passed": passed,
            "optical_metrics": request.data.get('optical_metrics', {}),
            "test_report_id": request.data.get('test_report_id', f"TR-{uuid.uuid4().hex[:6].upper()}"),
            "test_report_revision": request.data.get('test_report_revision', 'Rev 1.0'),
            "report_url": request.data.get('report_url', ''),
            "operator": request.data.get('operator', 'QA Officer')
        }
        unit.test_executions.append(test)
        unit.release_status = 'TEST_PASSED' if passed else 'QUARANTINED'
        unit.save()
        return api_response(data={"message": "Test execution recorded", "test": test})

class BuildOrderListView(APIView):
    def get(self, request):
        orders = BuildOrder.objects.all().order_by('-created_at')
        res = []
        for bo in orders:
            res.append({
                "id": str(bo.id),
                "reference": bo.reference,
                "title": bo.title,
                "part": {"id": str(bo.part.id), "name": bo.part.name, "ipn": bo.part.ipn} if bo.part else None,
                "quantity": bo.quantity,
                "status": bo.status,
                "created_at": bo.created_at.isoformat()
            })
        return api_response(data=res)

    def post(self, request):
        d = request.data
        ref = d.get('reference') or f"BO-{uuid.uuid4().hex[:6].upper()}"
        bo = BuildOrder.objects.create(
            reference=ref,
            title=d.get('title', 'Assembly Build Run'),
            quantity=float(d.get('quantity', 1.0)),
            status=d.get('status', 'PENDING'),
            notes=d.get('notes', '')
        )
        return api_response(data={"id": str(bo.id), "reference": bo.reference}, status_code=status.HTTP_201_CREATED)

class ProductionStatusCardView(APIView):
    def get(self, request):
        units = ProductionUnit.objects.all().order_by('-created_at')
        senders = sum(1 for u in units if 'SENDER' in u.unit_type.upper())
        receivers = sum(1 for u in units if 'RECEIVER' in u.unit_type.upper())
        paired = len(set(u.system_set_id for u in units if u.system_set_id))
        reworks = sum(1 for u in units if len(u.rework_history) > 0)
        deviations = sum(len(u.deviations) for u in units)
        released = sum(1 for u in units if u.release_status in ('RELEASED', 'ACCEPTED', 'TEST_PASSED'))

        return api_response(data={
            "units": [serialize_unit(u) for u in units],
            "total_senders": senders,
            "total_receivers": receivers,
            "total_paired_sets": paired,
            "units_under_rework": reworks,
            "active_deviations": deviations,
            "units_released": released
        })
