from django.test import TestCase, Client

class CardsTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_cards_dashboard(self):
        res = self.client.get('/api/v1/cards/dashboard')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])
        self.assertIn('total_units_in_production', data['data'])
        self.assertIn('first_pass_yield_pct', data['data'])

    def test_cards_settings(self):
        res = self.client.get('/api/v1/cards/settings')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])
        self.assertIn('auth_config', data['data'])
