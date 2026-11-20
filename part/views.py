import uuid
import hashlib
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework import status
from part.models import PartCategory, Part, BomItem, PartParameter

def api_response(success=True, data=None, error=None, status_code=200):
    payload = {"success": success}
    if data is not None:
        payload["data"] = data
    if error is not None:
        payload["error"] = error
    return JsonResponse(payload, status=status_code)

class PartCategoryListView(APIView):
    def get(self, request):
        categories = PartCategory.objects.all().order_by('name')
        data = []
        for cat in categories:
            data.append({
                "id": str(cat.id),
                "parent_id": str(cat.parent_id) if cat.parent_id else None,
                "name": cat.name,
                "description": cat.description,
                "path": cat.path or cat.name,
                "parts_count": cat.parts.count()
            })
        return api_response(data=data)

    def post(self, request):
        name = request.data.get('name', '').strip()
        desc = request.data.get('description', '')
        parent_id = request.data.get('parent_id')
        parent = PartCategory.objects.filter(id=parent_id).first() if parent_id else None
        path = f"{parent.path} / {name}" if parent else name
        cat = PartCategory.objects.create(name=name, description=desc, parent=parent, path=path)
        return api_response(data={"id": str(cat.id), "name": cat.name, "path": cat.path}, status_code=status.HTTP_201_CREATED)

class PartListView(APIView):
    def get(self, request):
        qs = Part.objects.all().select_related('category').order_by('ipn')
        cat_id = request.query_params.get('category')
        if cat_id:
            qs = qs.filter(category_id=cat_id)
        is_assembly = request.query_params.get('is_assembly')
        if is_assembly is not None:
            qs = qs.filter(is_assembly=(is_assembly.lower() in ('true', '1')))
        search = request.query_params.get('search')
        if search:
            qs = qs.filter(name__icontains=search) | qs.filter(ipn__icontains=search)

        items = []
        for p in qs:
            items.append({
                "id": str(p.id),
                "ipn": p.ipn,
                "name": p.name,
                "description": p.description,
                "revision": p.revision,
                "category": {
                    "id": str(p.category.id),
                    "name": p.category.name,
                    "path": p.category.path
                } if p.category else None,
                "is_assembly": p.is_assembly,
                "is_component": p.is_component,
                "units": p.units,
                "minimum_stock": p.minimum_stock,
                "default_location": p.default_location,
                "default_supplier": p.default_supplier,
                "created_at": p.created_at.isoformat(),
            })
        return api_response(data=items)

    def post(self, request):
        ipn = request.data.get('ipn') or request.data.get('item_code')
        name = request.data.get('name')
        if not ipn or not name:
            return api_response(success=False, error="IPN and name are required", status_code=status.HTTP_400_BAD_REQUEST)

        cat_id = request.data.get('category_id')
        cat = PartCategory.objects.filter(id=cat_id).first() if cat_id else None

        p, created = Part.objects.get_or_create(
            ipn=ipn,
            defaults={
                'name': name,
                'description': request.data.get('description', ''),
                'revision': request.data.get('revision', 'A'),
                'category': cat,
                'is_assembly': request.data.get('is_assembly', False),
                'is_component': request.data.get('is_component', True),
                'units': request.data.get('units', 'PCS'),
                'default_location': request.data.get('default_location', ''),
                'default_supplier': request.data.get('default_supplier', ''),
            }
        )
        return api_response(data={"id": str(p.id), "ipn": p.ipn, "name": p.name}, status_code=status.HTTP_201_CREATED)

class PartDetailView(APIView):
    def get(self, request, part_id):
        p = Part.objects.filter(id=part_id).select_related('category').prefetch_related('parameters', 'bom_items').first()
        if not p:
            return api_response(success=False, error="Part not found", status_code=status.HTTP_404_NOT_FOUND)

        params = list(p.parameters.values('name', 'value', 'unit'))
        data = {
            "id": str(p.id),
            "ipn": p.ipn,
            "name": p.name,
            "description": p.description,
            "revision": p.revision,
            "category": {"id": str(p.category.id), "name": p.category.name} if p.category else None,
            "is_assembly": p.is_assembly,
            "is_component": p.is_component,
            "units": p.units,
            "minimum_stock": p.minimum_stock,
            "parameters": params,
            "bom_items_count": p.bom_items.count()
        }
        return api_response(data=data)

    def put(self, request, part_id):
        p = Part.objects.filter(id=part_id).first()
        if not p:
            return api_response(success=False, error="Part not found", status_code=status.HTTP_404_NOT_FOUND)
        for field in ['name', 'description', 'revision', 'units', 'minimum_stock', 'default_location', 'default_supplier']:
            if field in request.data:
                setattr(p, field, request.data[field])
        p.save()
        return api_response(data={"id": str(p.id), "message": "Updated successfully"})

    def delete(self, request, part_id):
        Part.objects.filter(id=part_id).delete()
        return api_response(data={"message": "Part deleted"})

class PartBoMView(APIView):
    def get(self, request, part_id):
        part = Part.objects.filter(id=part_id).first()
        if not part:
            return api_response(success=False, error="Part not found", status_code=status.HTTP_404_NOT_FOUND)

        bom_items = BomItem.objects.filter(part=part).order_by('item_code')
        items = []
        for b in bom_items:
            items.append({
                "id": str(b.id),
                "part_id": str(b.part_id),
                "sub_part_id": str(b.sub_part_id) if b.sub_part_id else None,
                "parent_id": str(b.parent_bom_item_id) if b.parent_bom_item_id else None,
                "item_code": b.item_code,
                "item_type": b.item_type,
                "name": b.name,
                "description": b.description,
                "revision": b.revision,
                "manufacturer_part_number": b.manufacturer_part_number,
                "supplier_name": b.supplier_name,
                "quantity": b.quantity,
                "unit": b.unit,
                "reference": b.reference,
                "is_critical_path": b.is_critical_path,
                "checksum_sha256": b.checksum_sha256,
            })
        return api_response(data={
            "module_id": str(part.id),
            "assembly": part.name,
            "items": items,
            "total_items": len(items)
        })

    def post(self, request, part_id):
        part = Part.objects.filter(id=part_id).first()
        if not part:
            return api_response(success=False, error="Part not found", status_code=status.HTTP_404_NOT_FOUND)

        item_code = request.data.get('item_code')
        name = request.data.get('name')
        if not item_code or not name:
            return api_response(success=False, error="item_code and name are required", status_code=status.HTTP_400_BAD_REQUEST)

        parent_bom_id = request.data.get('parent_id')
        parent_bom = BomItem.objects.filter(id=parent_bom_id).first() if parent_bom_id else None

        sub_part_id = request.data.get('sub_part_id')
        sub_part = Part.objects.filter(id=sub_part_id).first() if sub_part_id else None

        b = BomItem.objects.create(
            part=part,
            sub_part=sub_part,
            parent_bom_item=parent_bom,
            item_code=item_code,
            item_type=request.data.get('item_type', 'COMPONENT'),
            name=name,
            description=request.data.get('description', ''),
            revision=request.data.get('revision', 'A'),
            manufacturer_part_number=request.data.get('manufacturer_part_number', ''),
            supplier_name=request.data.get('supplier_name', ''),
            quantity=float(request.data.get('quantity', 1.0)),
            unit=request.data.get('unit', 'PCS'),
            reference=request.data.get('reference', ''),
            is_critical_path=bool(request.data.get('is_critical_path', False)),
            checksum_sha256=request.data.get('checksum_sha256', '')
        )
        return api_response(data={"id": str(b.id), "item_code": b.item_code}, status_code=status.HTTP_201_CREATED)

class BoMItemDetailView(APIView):
    def get(self, request, item_id):
        b = BomItem.objects.filter(id=item_id).first()
        if not b:
            return api_response(success=False, error="BoM item not found", status_code=status.HTTP_404_NOT_FOUND)
        return api_response(data={
            "id": str(b.id),
            "item_code": b.item_code,
            "name": b.name,
            "quantity": b.quantity,
            "checksum_sha256": b.checksum_sha256
        })

    def delete(self, request, item_id):
        BomItem.objects.filter(id=item_id).delete()
        return api_response(data={"message": "BoM item deleted"})

class BoMItemChecksumVerifyView(APIView):
    def post(self, request, item_id):
        b = BomItem.objects.filter(id=item_id).first()
        if not b:
            return api_response(success=False, error="BoM item not found", status_code=status.HTTP_404_NOT_FOUND)
        candidate = request.data.get('checksum_sha256', '').strip()
        matched = (b.checksum_sha256.lower() == candidate.lower())
        return api_response(data={"item_id": str(b.id), "matched": matched, "expected": b.checksum_sha256})
