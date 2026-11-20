import uuid
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework import status
from stock.models import StockLocation, StockItem, StockTracking

def api_response(success=True, data=None, error=None, status_code=200):
    payload = {"success": success}
    if data is not None:
        payload["data"] = data
    if error is not None:
        payload["error"] = error
    return JsonResponse(payload, status=status_code)

def serialize_stock_item(item):
    return {
        "id": str(item.id),
        "item_code": item.item_code,
        "name": item.name,
        "category": item.category,
        "quantity_on_hand": item.quantity_on_hand,
        "quantity_allocated": item.quantity_allocated,
        "reorder_point": item.reorder_point,
        "unit": item.unit,
        "batch_lot_number": item.batch_lot_number,
        "storage_location": item.storage_location,
        "is_serialized": item.is_serialized,
        "serial_numbers": item.serial_numbers,
        "status": item.status,
        "updated_at": item.updated_at.isoformat()
    }

class StockItemListView(APIView):
    def get(self, request):
        qs = StockItem.objects.all().order_by('category', 'item_code')
        category = request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        return api_response(data=[serialize_stock_item(i) for i in qs])

    def post(self, request):
        data = request.data
        item_code = data.get('item_code')
        name = data.get('name')
        if not item_code or not name:
            return api_response(success=False, error="item_code and name are required", status_code=status.HTTP_400_BAD_REQUEST)

        item = StockItem.objects.create(
            item_code=item_code,
            name=name,
            category=data.get('category', 'Optical'),
            quantity_on_hand=float(data.get('quantity_on_hand', 0.0)),
            quantity_allocated=float(data.get('quantity_allocated', 0.0)),
            reorder_point=float(data.get('reorder_point', 0.0)),
            unit=data.get('unit', 'PCS'),
            batch_lot_number=data.get('batch_lot_number', ''),
            storage_location=data.get('storage_location', ''),
            is_serialized=bool(data.get('is_serialized', False)),
            serial_numbers=data.get('serial_numbers', []),
            status=data.get('status', 'AVAILABLE')
        )
        return api_response(data=serialize_stock_item(item), status_code=status.HTTP_201_CREATED)

class StockItemCategoryUpdateView(APIView):
    def patch(self, request, item_id):
        item = StockItem.objects.filter(id=item_id).first()
        if not item:
            return api_response(success=False, error="Stock item not found", status_code=status.HTTP_404_NOT_FOUND)
        new_cat = request.data.get('category')
        if new_cat:
            item.category = new_cat
            item.save()
        return api_response(data=serialize_stock_item(item))

class StockItemFieldUpdateView(APIView):
    def patch(self, request, item_id):
        item = StockItem.objects.filter(id=item_id).first()
        if not item:
            return api_response(success=False, error="Stock item not found", status_code=status.HTTP_404_NOT_FOUND)

        field = request.data.get('field')
        value = request.data.get('value')
        
        allowed_fields = [
            'name', 'quantity_on_hand', 'quantity_allocated', 'reorder_point',
            'unit', 'batch_lot_number', 'storage_location', 'status'
        ]
        if field in allowed_fields:
            if field in ('quantity_on_hand', 'quantity_allocated', 'reorder_point'):
                try:
                    value = float(value)
                except ValueError:
                    return api_response(success=False, error=f"Invalid numeric value for {field}", status_code=status.HTTP_400_BAD_REQUEST)
            setattr(item, field, value)
            item.save()
            return api_response(data=serialize_stock_item(item))

        return api_response(success=False, error=f"Field {field} cannot be updated", status_code=status.HTTP_400_BAD_REQUEST)

class StockItemDetailView(APIView):
    def get(self, request, item_id):
        item = StockItem.objects.filter(id=item_id).first()
        if not item:
            return api_response(success=False, error="Stock item not found", status_code=status.HTTP_404_NOT_FOUND)
        return api_response(data=serialize_stock_item(item))

    def delete(self, request, item_id):
        StockItem.objects.filter(id=item_id).delete()
        return api_response(data={"message": "Stock item deleted successfully"})

class StockLocationListView(APIView):
    def get(self, request):
        locations = StockLocation.objects.all().order_by('name')
        res = []
        for loc in locations:
            res.append({
                "id": str(loc.id),
                "parent_id": str(loc.parent_id) if loc.parent_id else None,
                "name": loc.name,
                "description": loc.description,
                "path": loc.path or loc.name,
                "items_count": loc.items.count()
            })
        return api_response(data=res)

    def post(self, request):
        name = request.data.get('name', '').strip()
        desc = request.data.get('description', '')
        parent_id = request.data.get('parent_id')
        parent = StockLocation.objects.filter(id=parent_id).first() if parent_id else None
        path = f"{parent.path} / {name}" if parent else name
        loc = StockLocation.objects.create(name=name, description=desc, parent=parent, path=path)
        return api_response(data={"id": str(loc.id), "name": loc.name, "path": loc.path}, status_code=status.HTTP_201_CREATED)

class StockCardView(APIView):
    def get(self, request):
        items = StockItem.objects.all()
        total_skus = items.count()
        total_items_in_stock = sum(int(i.quantity_on_hand) for i in items)
        low_stock_alerts_count = sum(1 for i in items if i.quantity_on_hand <= i.reorder_point)
        quarantined_items_count = sum(1 for i in items if i.status == 'QUARANTINED')

        return api_response(data={
            "total_skus": total_skus,
            "total_items_in_stock": total_items_in_stock,
            "low_stock_alerts_count": low_stock_alerts_count,
            "quarantined_items_count": quarantined_items_count,
            "items": [serialize_stock_item(i) for i in items]
        })
