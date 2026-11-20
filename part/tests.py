from django.test import TestCase, Client
from part.models import PartCategory, Part, BomItem

class PartTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.cat = PartCategory.objects.create(name="Optics", path="Optics")
        self.part_assembly = Part.objects.create(
            ipn="QKD-TX-ALICE",
            name="Alice Transmitter",
            is_assembly=True,
            is_component=False,
            category=self.cat
        )
        self.part_component = Part.objects.create(
            ipn="OPT-LD-1550",
            name="Laser Diode 1550nm",
            is_assembly=False,
            is_component=True,
            category=self.cat
        )
        self.bom_item = BomItem.objects.create(
            part=self.part_assembly,
            sub_part=self.part_component,
            item_code="BOM-LD-01",
            name="Laser Diode Item",
            quantity=1.0,
            checksum_sha256="abc123sha"
        )

    def test_list_parts(self):
        res = self.client.get('/api/v1/parts')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])
        self.assertEqual(len(data['data']), 2)

    def test_part_bom(self):
        res = self.client.get(f'/api/v1/parts/{self.part_assembly.id}/bom')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['data']['total_items'], 1)
        self.assertEqual(data['data']['items'][0]['item_code'], "BOM-LD-01")

    def test_verify_checksum(self):
        res = self.client.post(f'/api/v1/bom/items/{self.bom_item.id}/verify-checksum', {
            'checksum_sha256': 'abc123sha'
        }, content_type='application/json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()['data']['matched'])
