from django.test import TestCase, Client
from stock.models import StockItem, StockLocation

class StockTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.item = StockItem.objects.create(
            item_code="DET-SNSPD-01",
            name="Single Photon Detector",
            category="Optical",
            quantity_on_hand=8.0,
            reorder_point=4.0,
            status="AVAILABLE"
        )

    def test_list_stock_items(self):
        res = self.client.get('/api/v1/stock/items')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])
        self.assertEqual(len(data['data']), 1)

    def test_update_item_field(self):
        res = self.client.patch(f'/api/v1/stock/items/{self.item.id}/field', {
            'field': 'quantity_on_hand',
            'value': 12.0
        }, content_type='application/json')
        self.assertEqual(res.status_code, 200)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity_on_hand, 12.0)

    def test_stock_card(self):
        res = self.client.get('/api/v1/cards/stock')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['data']['total_skus'], 1)
        self.assertEqual(data['data']['total_items_in_stock'], 8)
