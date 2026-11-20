from django.test import TestCase, Client
from production.models import ProductionUnit

class ProductionTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.alice = ProductionUnit.objects.create(
            serial_number="QKD-TX-ALICE-01",
            unit_type="SENDER_ALICE",
            hw_revision="REV-3.2-A",
            mechanical_revision="MECH-IP67",
            sw_version="v2.4.1",
            fw_version="v4.1.0",
            fw_checksum_sha256="hash-alice"
        )
        self.bob = ProductionUnit.objects.create(
            serial_number="QKD-RX-BOB-01",
            unit_type="RECEIVER_BOB",
            hw_revision="REV-3.2-A",
            mechanical_revision="MECH-IP67",
            sw_version="v2.4.1",
            fw_version="v4.1.0",
            fw_checksum_sha256="hash-bob"
        )

    def test_pair_and_unpair_units(self):
        # Pair
        res = self.client.post('/api/v1/production/pair', {
            'sender_id': str(self.alice.id),
            'receiver_id': str(self.bob.id),
            'system_set_id': 'SET-ALPHA-01'
        }, content_type='application/json')
        self.assertEqual(res.status_code, 200)

        self.alice.refresh_from_db()
        self.bob.refresh_from_db()
        self.assertEqual(self.alice.system_set_id, 'SET-ALPHA-01')
        self.assertEqual(self.alice.paired_peer_serial, self.bob.serial_number)
        self.assertEqual(self.bob.paired_peer_serial, self.alice.serial_number)

        # Unpair
        res_unpair = self.client.post(f'/api/v1/production/units/{self.alice.id}/unpair')
        self.assertEqual(res_unpair.status_code, 200)
        self.alice.refresh_from_db()
        self.bob.refresh_from_db()
        self.assertIsNone(self.alice.system_set_id)
        self.assertIsNone(self.bob.system_set_id)

    def test_add_rework_and_test(self):
        # Add rework
        res_rwk = self.client.post(f'/api/v1/production/units/{self.alice.id}/rework', {
            'rework_ticket': 'RWK-001',
            'description': 'Thermal alignment',
            'action_taken': 'Adjusted heatsink'
        }, content_type='application/json')
        self.assertEqual(res_rwk.status_code, 200)
        self.alice.refresh_from_db()
        self.assertEqual(len(self.alice.rework_history), 1)

        # Add test
        res_test = self.client.post(f'/api/v1/production/units/{self.alice.id}/tests', {
            'passed': True,
            'optical_metrics': {'visibility': 99.2}
        }, content_type='application/json')
        self.assertEqual(res_test.status_code, 200)
        self.alice.refresh_from_db()
        self.assertEqual(self.alice.release_status, 'TEST_PASSED')
