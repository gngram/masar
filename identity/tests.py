from django.test import TestCase, Client
from identity.models import (
    ServerAdmin, Organization, ProductionUnit, TenantUser, UserRole,
    PipelineStage, StageFinishedProduct, TrackingParameter, ProcuredComponent
)

class IdentityTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.admin = ServerAdmin.objects.create(
            email="admin@tii.ae",
            full_name="Super Admin",
            role="SERVER_SUPER_ADMIN"
        )
        self.admin.set_password("AdminPass123!")
        self.admin.save()

        self.org = Organization.objects.create(slug="tii", name="TII")
        self.pu = ProductionUnit.objects.create(organization=self.org, code="PU_01", name="Unit 1")

        self.user = TenantUser.objects.create(
            organization=self.org,
            email="engineer@tii.ae",
            full_name="Alice Engineer",
            is_active=True
        )
        self.user.set_password("UserPass123!")
        self.user.save()
        UserRole.objects.create(user=self.user, role="LINE_ENGINEER", production_unit=self.pu)

    def test_admin_login(self):
        res = self.client.post('/api/v1/identity/login', {
            'email': 'admin@tii.ae',
            'password': 'AdminPass123!'
        }, content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['is_server_admin'])
        self.assertTrue(data['token'].startswith('adm_'))

    def test_user_login(self):
        res = self.client.post('/api/v1/identity/login', {
            'email': 'engineer@tii.ae',
            'password': 'UserPass123!'
        }, content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertFalse(data['is_server_admin'])
        self.assertTrue(data['token'].startswith('usr_'))

    def test_invalid_login(self):
        res = self.client.post('/api/v1/identity/login', {
            'email': 'admin@tii.ae',
            'password': 'WrongPassword'
        }, content_type='application/json')
        self.assertEqual(res.status_code, 401)

    def test_tracking_parameters_api(self):
        # 1. Create a tracking parameter
        res = self.client.post(f'/api/v1/auth/production-units/{self.pu.id}/parameters', {
            'param_key': 'optical_power',
            'name': 'Optical Output Power',
            'unit': 'dBm',
            'data_type': 'NUMERIC',
            'default_value': '13.5',
            'is_critical': True
        }, content_type='application/json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()['param_key'], 'optical_power')

        # 2. List parameters
        res = self.client.get(f'/api/v1/auth/production-units/{self.pu.id}/parameters')
        self.assertEqual(res.status_code, 200)
        params = res.json()['parameters']
        self.assertTrue(any(p['param_key'] == 'optical_power' for p in params))

        # 3. Assign to a stage
        stage = PipelineStage.objects.create(
            production_unit=self.pu,
            stage_key='INSPECT',
            name='Inspect'
        )
        res = self.client.post(f'/api/v1/auth/production-units/{self.pu.id}/stages/INSPECT/parameters', {
            'parameter_keys': ['optical_power']
        }, content_type='application/json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('optical_power', res.json()['assigned_parameters'])

        # 4. Fetch stage parameters
        res = self.client.get(f'/api/v1/auth/production-units/{self.pu.id}/stages/INSPECT/parameters')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()['parameters']), 1)
        self.assertEqual(res.json()['parameters'][0]['unit'], 'dBm')

    def test_procured_components_api(self):
        # 1. Create procured component
        res = self.client.post(f'/api/v1/auth/production-units/{self.pu.id}/procured-components', {
            'item_code': 'OPT-LD-1550',
            'name': '1550nm Laser Diode',
            'category': 'Optics',
            'supplier': 'Eblana Photonics',
            'unit': 'PCS',
            'specifications': {'wavelength': '1550nm'}
        }, content_type='application/json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()['item_code'], 'OPT-LD-1550')

        # 2. List procured components (accessible across Receive, Inspect, Store & Kit)
        res = self.client.get(f'/api/v1/auth/production-units/{self.pu.id}/procured-components')
        self.assertEqual(res.status_code, 200)
        comps = res.json()['components']
        self.assertEqual(len(comps), 1)
        self.assertEqual(comps[0]['name'], '1550nm Laser Diode')

    def test_subassemblies_api(self):
        # 1. Create sub-assembly under Build with BoM inputs referencing procured part and subassembly output
        res = self.client.post(f'/api/v1/auth/production-units/{self.pu.id}/sub-assemblies', {
            'stage_key': 'BUILD_OPTICAL',
            'name': 'Optical Engine Assembly',
            'sequence_num': 2,
            'description': 'Assembles optical base and laser diode',
            'output_product_name': 'Optical Core Sub-Module',
            'output_product_code': 'ASM-OPT-001',
            'bom_inputs': [
                {'item_code': 'OPT-LD-1550', 'name': 'Laser Diode', 'quantity': 1, 'type': 'procured'},
                {'item_code': 'ASM-BASE-001', 'name': 'Baseplate', 'quantity': 1, 'type': 'subassembly_output'}
            ],
            'assigned_parameters': ['optical_power', 'operating_temperature']
        }, content_type='application/json')
        self.assertEqual(res.status_code, 201)

        # 2. List subassemblies
        res = self.client.get(f'/api/v1/auth/production-units/{self.pu.id}/sub-assemblies')
        self.assertEqual(res.status_code, 200)
        sub_list = res.json()['sub_assemblies']
        self.assertEqual(len(sub_list), 1)
        sa = sub_list[0]
        self.assertEqual(sa['stage_key'], 'BUILD_OPTICAL')
        self.assertEqual(sa['output_product_code'], 'ASM-OPT-001')
        self.assertEqual(len(sa['bom_inputs']), 2)

    def test_inspect_defect_filtering_and_action(self):
        # Create stage and products
        stage = PipelineStage.objects.create(
            production_unit=self.pu,
            stage_key='INSPECT',
            name='Inspect'
        )
        p1 = StageFinishedProduct.objects.create(
            production_unit=self.pu,
            stage_key='INSPECT',
            product_name='1550nm DFB Laser',
            serial_number='SN-OPT-001',
            status='AVAILABLE',
            inspection_status='PENDING'
        )
        p2 = StageFinishedProduct.objects.create(
            production_unit=self.pu,
            stage_key='INSPECT',
            product_name='1550nm DFB Laser',
            serial_number='SN-OPT-002',
            status='AVAILABLE',
            inspection_status='OK'
        )

        # Mark p1 as FAULTY with defect reason
        res = self.client.post(f'/api/v1/auth/production-units/{self.pu.id}/inspect/{p1.id}', {
            'inspection_status': 'FAULTY',
            'defect_reason': 'Cracked ferrule collar',
            'parameters': {'visual_score': '3.0'},
            'recorded_by': 'QA Engineer'
        }, content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['inspection_status'], 'FAULTY')
        self.assertEqual(data['defect_reason'], 'Cracked ferrule collar')

        # Filter by inspection_status=FAULTY
        res_faulty = self.client.get(f'/api/v1/auth/production-units/{self.pu.id}/stages/INSPECT/products?inspection_status=FAULTY')
        self.assertEqual(res_faulty.status_code, 200)
        products_faulty = res_faulty.json().get('products', [])
        self.assertEqual(len(products_faulty), 1)
        self.assertEqual(products_faulty[0]['serial_number'], 'SN-OPT-001')
        self.assertEqual(products_faulty[0]['defect_reason'], 'Cracked ferrule collar')

        # Filter by inspection_status=OK
        res_ok = self.client.get(f'/api/v1/auth/production-units/{self.pu.id}/stages/INSPECT/products?inspection_status=OK')
        self.assertEqual(res_ok.status_code, 200)
        products_ok = res_ok.json().get('products', [])
        self.assertEqual(len(products_ok), 1)
        self.assertEqual(products_ok[0]['serial_number'], 'SN-OPT-002')

    def test_parameter_carry_forward(self):
        # 1. Product is inspected at INSPECT and gets first parameter
        p = StageFinishedProduct.objects.create(
            production_unit=self.pu,
            stage_key='INSPECT',
            product_name='Quantum Receiver',
            serial_number='SN-QRX-900',
            status='AVAILABLE',
            inspection_status='OK'
        )
        self.client.post(f'/api/v1/auth/production-units/{self.pu.id}/inspect/{p.id}', {
            'inspection_status': 'OK',
            'parameters': {'visual_score': '9.8'},
            'units': {'visual_score': '/10'},
            'recorded_by': 'Inspector Dave'
        }, content_type='application/json')

        p.refresh_from_db()
        self.assertIn('visual_score', p.parameter_values)
        self.assertEqual(p.parameter_values['visual_score']['value'], '9.8')
        self.assertEqual(p.parameter_values['visual_score']['stage_key'], 'INSPECT')

        # 2. Product progresses to TEST stage and records test parameters
        res = self.client.post(f'/api/v1/auth/production-units/{self.pu.id}/stages/TEST/record-parameters', {
            'product_id': str(p.id),
            'parameters': {'optical_power': '14.2', 'extinction_ratio': '28.5'},
            'units': {'optical_power': 'dBm', 'extinction_ratio': 'dB'},
            'recorded_by': 'Test Eng Sarah'
        }, content_type='application/json')
        self.assertEqual(res.status_code, 200)

        p.refresh_from_db()
        # Verify carry-forward: ALL parameters preserved across stages!
        self.assertEqual(len(p.parameter_values), 3)
        self.assertEqual(p.parameter_values['visual_score']['value'], '9.8')
        self.assertEqual(p.parameter_values['visual_score']['stage_key'], 'INSPECT')
        self.assertEqual(p.parameter_values['optical_power']['value'], '14.2')
        self.assertEqual(p.parameter_values['optical_power']['stage_key'], 'TEST')
        self.assertEqual(p.parameter_values['extinction_ratio']['value'], '28.5')
        self.assertEqual(p.parameter_values['extinction_ratio']['stage_key'], 'TEST')

    def test_pu_users_roles_format(self):
        # Verify /auth/production-units/{pu_id}/users returns role objects with 'role' key
        res = self.client.get(f'/api/v1/auth/production-units/{self.pu.id}/users')
        self.assertEqual(res.status_code, 200)
        users = res.json()['users']
        self.assertTrue(len(users) > 0)
        target_user = next((u for u in users if u['email'] == 'engineer@tii.ae'), None)
        self.assertIsNotNone(target_user)
        self.assertTrue(len(target_user['roles']) > 0)
        # Ensure role has 'role' string property
        self.assertIn('role', target_user['roles'][0])
        self.assertEqual(target_user['roles'][0]['role'], 'LINE_ENGINEER')


