from django.test import TestCase, Client
from customization.models import CustomizationPreset

class CustomizationTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_save_and_load_preset(self):
        # Save customization
        res = self.client.post('/api/v1/customization/presets', {
            'name': 'QA Custom Preset',
            'description': 'QA optimized view',
            'is_active': True,
            'layout_config': {
                'visible_cards': ['dashboard', 'production'],
                'active_theme': 'indigo-enterprise'
            }
        }, content_type='application/json')
        self.assertEqual(res.status_code, 201)
        data = res.json()['data']
        preset_id = data['id']

        # List presets
        res_list = self.client.get('/api/v1/customization/presets')
        self.assertEqual(res_list.status_code, 200)

        # Apply preset
        res_apply = self.client.post(f'/api/v1/customization/presets/{preset_id}/apply')
        self.assertEqual(res_apply.status_code, 200)
        p = CustomizationPreset.objects.get(id=preset_id)
        self.assertTrue(p.is_active)

    def test_export_and_import(self):
        # Export
        res_exp = self.client.get('/api/v1/customization/export')
        self.assertEqual(res_exp.status_code, 200)
        exp_data = res_exp.json()['data']

        # Import
        res_imp = self.client.post('/api/v1/customization/import', exp_data, content_type='application/json')
        self.assertEqual(res_imp.status_code, 201)
