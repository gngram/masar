import uuid
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework import status
from procurement.models import Company, PurchaseOrder

def api_response(success=True, data=None, error=None, status_code=200):
    payload = {"success": success}
    if data is not None:
        payload["data"] = data
    if error is not None:
        payload["error"] = error
    return JsonResponse(payload, status=status_code)

def serialize_po(po):
    return {
        "id": str(po.id),
        "po_number": po.po_number,
        "supplier_name": po.supplier_name,
        "status": po.status,
        "total_amount": po.total_amount,
        "currency": po.currency,
        "issued_date": po.issued_date.isoformat(),
        "expected_delivery": po.expected_delivery.isoformat() if po.expected_delivery else None,
        "created_by": str(po.created_by),
        "items": po.items,
        "created_at": po.created_at.isoformat(),
        "updated_at": po.updated_at.isoformat(),
    }

class PurchaseOrderListView(APIView):
    def get(self, request):
        orders = PurchaseOrder.objects.all().order_by('-issued_date')
        return api_response(data=[serialize_po(o) for o in orders])

    def post(self, request):
        d = request.data
        po_num = d.get('po_number') or f"PO-{uuid.uuid4().hex[:6].upper()}"
        supp_name = d.get('supplier_name', '').strip()
        if not supp_name:
            return api_response(success=False, error="supplier_name is required", status_code=status.HTTP_400_BAD_REQUEST)

        supp, _ = Company.objects.get_or_create(name=supp_name, defaults={'is_supplier': True})
        po = PurchaseOrder.objects.create(
            po_number=po_num,
            supplier=supp,
            supplier_name=supp_name,
            status=d.get('status', 'DRAFT'),
            total_amount=float(d.get('total_amount', 0.0)),
            currency=d.get('currency', 'USD'),
            items=d.get('items', [])
        )
        return api_response(data=serialize_po(po), status_code=status.HTTP_201_CREATED)

class PurchaseOrderDetailView(APIView):
    def get(self, request, po_id):
        po = PurchaseOrder.objects.filter(id=po_id).first()
        if not po:
            return api_response(success=False, error="Purchase order not found", status_code=status.HTTP_404_NOT_FOUND)
        return api_response(data=serialize_po(po))

class SupplierListView(APIView):
    def get(self, request):
        suppliers = Company.objects.filter(is_supplier=True).order_by('name')
        res = []
        for s in suppliers:
            res.append({
                "id": str(s.id),
                "name": s.name,
                "description": s.description,
                "website": s.website,
                "orders_count": s.orders.count()
            })
        return api_response(data=res)

class ProcurementCardView(APIView):
    def get(self, request):
        orders = PurchaseOrder.objects.all().order_by('-issued_date')
        open_orders = sum(1 for o in orders if o.status in ('DRAFT', 'SUBMITTED', 'APPROVED'))
        pending_delivery = sum(1 for o in orders if o.status == 'APPROVED')
        monthly_spend = sum(o.total_amount for o in orders if o.status in ('APPROVED', 'FULFILLED'))

        return api_response(data={
            "open_orders_count": open_orders,
            "pending_delivery_count": pending_delivery,
            "monthly_spend_usd": monthly_spend,
            "orders": [serialize_po(o) for o in orders]
        })
