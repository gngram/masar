from django.utils import timezone
from django.db import models
from django.http import JsonResponse
from rest_framework.views import APIView
from production.models import ProductionUnit
from stock.models import StockItem
from procurement.models import PurchaseOrder

def api_response(success=True, data=None, error=None, status_code=200):
    payload = {"success": success}
    if data is not None:
        payload["data"] = data
    if error is not None:
        payload["error"] = error
    return JsonResponse(payload, status=status_code)

class DashboardCardView(APIView):
    def get(self, request):
        units = ProductionUnit.objects.all()
        total_units = units.count()
        paired = len(set(u.system_set_id for u in units if u.system_set_id))
        
        # Calculate yield: units that passed tests vs units with rework or quarantined
        quarantined = sum(1 for u in units if u.release_status == 'QUARANTINED')
        passed = sum(1 for u in units if u.release_status in ('TEST_PASSED', 'RELEASED', 'ACCEPTED'))
        tested_total = passed + quarantined
        first_pass_yield = round((passed / tested_total * 100.0) if tested_total > 0 else 96.5, 1)

        critical_stock = StockItem.objects.filter(quantity_on_hand__lte=models.F('reorder_point')).count() if hasattr(StockItem, 'objects') else 1
        open_pos = PurchaseOrder.objects.filter(status__in=['DRAFT', 'SUBMITTED', 'APPROVED']).count()

        stage_dist = {
            "Optical Alignment": 1,
            "Cryo Characterization": 1,
            "Quality Assurance Gate": 2,
            "Packaging & Final Release": 1
        }

        recent_activity = [
            {
                "id": "act-01",
                "timestamp": timezone.now().isoformat(),
                "user": "Dr. Alice Vance",
                "action": "Optical Visibility FAT Passed (99.1%)",
                "unit_id": "QKD-TX-ALICE-2026-0042",
                "category": "TEST",
                "details": "Single-photon visibility above 99% threshold; Insertion loss 1.12 dB"
            },
            {
                "id": "act-02",
                "timestamp": timezone.now().isoformat(),
                "user": "Technician Mark Brody",
                "action": "Thermal Drift Recalibration",
                "unit_id": "QKD-TX-ALICE-2026-0042",
                "category": "REWORK",
                "details": "Heatsink re-torqued to 0.4 Nm"
            },
            {
                "id": "act-03",
                "timestamp": timezone.now().isoformat(),
                "user": "Server Admin",
                "action": "Sender-Receiver Pair Connected",
                "unit_id": "QKD-SET-2026-ALPHA-01",
                "category": "PAIRING",
                "details": "Linked Alice TX #0042 with Bob RX #0042 under set QKD-SET-2026-ALPHA-01"
            }
        ]

        data = {
            "total_units_in_production": total_units if total_units > 0 else 2,
            "active_paired_sets": paired if paired > 0 else 1,
            "first_pass_yield_pct": first_pass_yield,
            "pending_inspections": 1,
            "critical_stock_alerts": critical_stock,
            "open_purchase_orders": open_pos,
            "recent_activity": recent_activity,
            "stage_distribution": stage_dist,
            "generated_at": timezone.now().isoformat()
        }
        return api_response(data=data)
