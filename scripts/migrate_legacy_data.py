#!/usr/bin/env python
"""Migrates data from legacy SQLite databases (admins.db, users.db, manufacturing.db)
into Masar Django models and seeds InvenTree Parts, Categories, Locations, and Presets.
"""
import os
import sys
import json
import sqlite3
import uuid
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'masar_backend.settings')
import django
django.setup()

from identity.models import (
    ServerAdmin, Organization, ProductionUnit as OrgProductionUnit,
    TenantUser, UserRole, UserOrganization, PipelineStage,
    StageProcurementRequest, StageFinishedProduct, CustomRole,
    TrackingParameter, ProcuredComponent
)
from part.models import PartCategory, Part, BomItem, PartParameter
from stock.models import StockLocation, StockItem
from production.models import ProductionUnit as HardwareProductionUnit, BuildOrder
from procurement.models import Company, PurchaseOrder
from customization.models import InvenTreeSetting, CustomizationPreset, PortalBaseline

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')

def parse_json(val, default):
    if not val or val == 'null':
        return default
    if isinstance(val, (dict, list)):
        return val
    try:
        res = json.loads(val)
        return default if res is None else res
    except Exception:
        return default

def migrate_admins():
    db_path = os.path.join(DATA_DIR, 'admins.db')
    if not os.path.exists(db_path):
        print(f"[-] {db_path} not found, skipping admins")
        return
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT id, email, password_hash, full_name, role, is_active FROM server_admins")
    count = 0
    for row in cur.fetchall():
        uid, email, pw_hash, full_name, role, is_active = row
        ServerAdmin.objects.update_or_create(
            email=email,
            defaults={
                'id': uuid.UUID(uid) if uid else uuid.uuid4(),
                'password_hash': pw_hash,
                'full_name': full_name,
                'role': role,
                'is_active': bool(is_active)
            }
        )
        count += 1
    print(f"[+] Migrated {count} server admin(s)")

def migrate_users():
    db_path = os.path.join(DATA_DIR, 'users.db')
    if not os.path.exists(db_path):
        print(f"[-] {db_path} not found, skipping users")
        return
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Organizations
    cur.execute("SELECT id, slug, name, is_active FROM organizations")
    for row in cur.fetchall():
        oid, slug, name, is_active = row
        Organization.objects.update_or_create(
            slug=slug,
            defaults={
                'id': uuid.UUID(oid),
                'name': name,
                'is_active': bool(is_active)
            }
        )
    print("[+] Migrated organizations")

    # Production Units
    cur.execute("SELECT id, organization_id, code, name, description FROM production_units")
    for row in cur.fetchall():
        puid, org_id, code, name, desc = row
        org = Organization.objects.filter(id=org_id).first()
        if org:
            OrgProductionUnit.objects.update_or_create(
                organization=org, code=code,
                defaults={
                    'id': uuid.UUID(puid),
                    'name': name,
                    'description': desc
                }
            )
    print("[+] Migrated organizational production units")

    # Users
    cur.execute("SELECT id, organization_id, email, password_hash, full_name, is_active FROM users")
    for row in cur.fetchall():
        uid, org_id, email, pw_hash, full_name, is_active = row
        org = Organization.objects.filter(id=org_id).first()
        if org:
            TenantUser.objects.update_or_create(
                email=email,
                defaults={
                    'id': uuid.UUID(uid),
                    'organization': org,
                    'password_hash': pw_hash,
                    'full_name': full_name,
                    'is_active': bool(is_active)
                }
            )
    print("[+] Migrated tenant users")

    # User Roles
    cur.execute("SELECT user_id, role, production_unit_id, business_unit_id FROM user_roles")
    for row in cur.fetchall():
        user_id, role, pu_id, bu_id = row
        user = TenantUser.objects.filter(id=user_id).first()
        pu = OrgProductionUnit.objects.filter(id=pu_id).first() if pu_id else None
        if user:
            UserRole.objects.get_or_create(
                user=user, role=role, production_unit=pu,
                defaults={'business_unit_id': bu_id}
            )
    print("[+] Migrated user roles")

    # Pipeline stages
    cur.execute("SELECT id, production_unit_id, stage_key, name, sequence_num, description, output_product_name, output_product_code, input_items, intermediate_statuses, custom_fields, assembly_type, parent_stage_key FROM pu_pipeline_stages")
    for row in cur.fetchall():
        sid, pu_id, skey, name, seq, desc, out_name, out_code, inp, inter, cust, asm_type, parent_key = row
        pu = OrgProductionUnit.objects.filter(id=pu_id).first()
        if pu:
            PipelineStage.objects.update_or_create(
                production_unit=pu, stage_key=skey,
                defaults={
                    'id': uuid.UUID(sid),
                    'name': name,
                    'sequence_num': seq,
                    'description': desc or '',
                    'output_product_name': out_name or '',
                    'output_product_code': out_code or '',
                    'input_items': parse_json(inp, []),
                    'intermediate_statuses': parse_json(inter, []),
                    'custom_fields': parse_json(cust, []),
                    'assembly_type': asm_type or '',
                    'parent_stage_key': parent_key or ''
                }
            )
    print("[+] Migrated pipeline stages")

    # Finished products
    cur.execute("SELECT id, production_unit_id, stage_key, serial_number, product_code, product_name, status, immutable_fields, bom_components, created_by FROM pu_stage_finished_products")
    for row in cur.fetchall():
        fpid, pu_id, skey, sn, pcode, pname, st, imm, bom, cby = row
        pu = OrgProductionUnit.objects.filter(id=pu_id).first()
        if pu:
            StageFinishedProduct.objects.update_or_create(
                serial_number=sn,
                defaults={
                    'id': uuid.UUID(fpid),
                    'production_unit': pu,
                    'stage_key': skey,
                    'product_code': pcode,
                    'product_name': pname,
                    'status': st,
                    'immutable_fields': parse_json(imm, {}),
                    'bom_components': parse_json(bom, []),
                    'created_by': cby
                }
            )
    print("[+] Migrated stage finished products")

def migrate_manufacturing():
    db_path = os.path.join(DATA_DIR, 'manufacturing.db')
    if not os.path.exists(db_path):
        print(f"[-] {db_path} not found, skipping manufacturing")
        return
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Hardware Production Units (Alice & Bob)
    cur.execute("SELECT id, serial_number, unit_type, system_set_id, paired_peer_serial, product_baseline, hw_revision, mechanical_revision, sw_version, fw_version, fw_checksum_sha256, critical_components, deviations, rework_history, inspection_records, test_executions, release_status FROM production_units")
    for row in cur.fetchall():
        uid, sn, ut, set_id, peer_sn, baseline, hw_rev, mech_rev, sw_v, fw_v, fw_sha, crit, devs, reworks, insp, tests, rel = row
        HardwareProductionUnit.objects.update_or_create(
            serial_number=sn,
            defaults={
                'id': uuid.UUID(uid) if uid else uuid.uuid4(),
                'unit_type': ut,
                'system_set_id': set_id,
                'paired_peer_serial': peer_sn,
                'product_baseline': parse_json(baseline, {}),
                'hw_revision': hw_rev or 'REV-3.2-A',
                'mechanical_revision': mech_rev or 'MECH-ENC-IP67-R2',
                'sw_version': sw_v or 'v2.4.1',
                'fw_version': fw_v or 'v4.1.0-sec',
                'fw_checksum_sha256': fw_sha or '',
                'critical_components': parse_json(crit, []),
                'deviations': parse_json(devs, []),
                'rework_history': parse_json(reworks, []),
                'inspection_records': parse_json(insp, []),
                'test_executions': parse_json(tests, []),
                'release_status': rel or 'IN_ASSEMBLY'
            }
        )
    print("[+] Migrated hardware production units (Alice & Bob)")

    # Stock Items
    cur.execute("SELECT id, item_code, name, category, quantity_on_hand, quantity_allocated, reorder_point, unit, batch_lot_number, storage_location, is_serialized, serial_numbers, status FROM stock_items")
    for row in cur.fetchall():
        sid, icode, name, cat, q_hand, q_alloc, reorder, unit, batch, loc, is_ser, serials, st = row
        StockItem.objects.update_or_create(
            item_code=icode,
            defaults={
                'id': uuid.UUID(sid) if sid else uuid.uuid4(),
                'name': name,
                'category': cat or 'Optical',
                'quantity_on_hand': float(q_hand or 0),
                'quantity_allocated': float(q_alloc or 0),
                'reorder_point': float(reorder or 0),
                'unit': unit or 'PCS',
                'batch_lot_number': batch or '',
                'storage_location': loc or '',
                'is_serialized': bool(is_ser),
                'serial_numbers': parse_json(serials, []),
                'status': st or 'AVAILABLE'
            }
        )
    print("[+] Migrated cleanroom stock items")

    # Purchase Orders
    cur.execute("SELECT id, po_number, supplier_name, status, total_amount, currency, items FROM purchase_orders")
    for row in cur.fetchall():
        poid, ponum, sname, st, tot, curr, items = row
        supp, _ = Company.objects.get_or_create(name=sname, defaults={'is_supplier': True})
        PurchaseOrder.objects.update_or_create(
            po_number=ponum,
            defaults={
                'id': uuid.UUID(poid) if poid else uuid.uuid4(),
                'supplier': supp,
                'supplier_name': sname,
                'status': st or 'APPROVED',
                'total_amount': float(tot or 0),
                'currency': curr or 'USD',
                'items': parse_json(items, [])
            }
        )
    print("[+] Migrated purchase orders")

def seed_inventree_features():
    """Populates InvenTree categories, parts catalog, BoM items, storage locations, and customization presets."""
    print("[*] Seeding InvenTree Parts, Categories, Locations, and Customization Presets...")

    # 1. Categories
    cat_optical, _ = PartCategory.objects.get_or_create(
        name="Optical Systems",
        defaults={'path': "Optical Systems", 'description': "Single-photon lasers, SNSPD detectors, attenuators, and optical benches"}
    )
    cat_lasers, _ = PartCategory.objects.get_or_create(
        name="Pulsed Lasers",
        parent=cat_optical,
        defaults={'path': "Optical Systems / Pulsed Lasers", 'description': "1550nm narrow linewidth DFB semiconductor laser sources"}
    )
    cat_detectors, _ = PartCategory.objects.get_or_create(
        name="Detectors & Cryo",
        parent=cat_optical,
        defaults={'path': "Optical Systems / Detectors & Cryo", 'description': "Superconducting nanowire detectors and low-noise cryo stages"}
    )
    cat_elec, _ = PartCategory.objects.get_or_create(
        name="Processing Electronics",
        defaults={'path': "Processing Electronics", 'description': "Xilinx UltraScale+ FPGA cores and high-speed TDC digitizers"}
    )
    cat_assemblies, _ = PartCategory.objects.get_or_create(
        name="Complete Assemblies",
        defaults={'path': "Complete Assemblies", 'description': "Factory integrated Alice Transmitter and Bob Receiver enclosures"}
    )

    # 2. Locations
    loc_cleanroom, _ = StockLocation.objects.get_or_create(
        name="Cleanroom Bay",
        defaults={'path': "Cleanroom Bay", 'description': "ISO Class 5 Optical Cleanroom Assembly Facility"}
    )
    loc_c1, _ = StockLocation.objects.get_or_create(
        name="Cabinet C-1 (Optics)",
        parent=loc_cleanroom,
        defaults={'path': "Cleanroom Bay / Cabinet C-1 (Optics)", 'description': "Active optical diode storage"}
    )
    loc_c2, _ = StockLocation.objects.get_or_create(
        name="Cabinet C-2 (Cryo)",
        parent=loc_cleanroom,
        defaults={'path': "Cleanroom Bay / Cabinet C-2 (Cryo)", 'description': "Cryogenic SNSPD wafer containers"}
    )
    loc_esd, _ = StockLocation.objects.get_or_create(
        name="ESD Vault B-4",
        defaults={'path': "ESD Vault B-4", 'description': "Static-safe FPGA and microelectronics storage"}
    )

    # 3. Parts Catalog
    part_alice, _ = Part.objects.get_or_create(
        ipn="QKD-TX-ALICE",
        defaults={
            'name': "Alice Optical Transmitter Assembly",
            'description': "Complete 1550nm quantum transmitter with state preparation and attenuation",
            'revision': "REV-3.2-A",
            'category': cat_assemblies,
            'is_assembly': True,
            'is_component': False,
            'is_salable': True,
            'units': "PCS",
            'default_location': "Cleanroom Bay"
        }
    )

    part_bob, _ = Part.objects.get_or_create(
        ipn="QKD-RX-BOB",
        defaults={
            'name': "Bob Optical Receiver Cryo-Station",
            'description': "Cryogenic single-photon receiver station with SNSPD detectors and FPGA TDC",
            'revision': "REV-3.2-A",
            'category': cat_assemblies,
            'is_assembly': True,
            'is_component': False,
            'is_salable': True,
            'units': "PCS",
            'default_location': "Cleanroom Bay"
        }
    )

    part_laser, _ = Part.objects.get_or_create(
        ipn="OPT-LD-1550-DFB",
        defaults={
            'name': "DFB Pulsed Laser Diode 1550nm",
            'description': "Narrow linewidth pulsed diode for single-photon preparation",
            'revision': "B.2",
            'category': cat_lasers,
            'is_assembly': False,
            'is_component': True,
            'units': "PCS",
            'minimum_stock': 5.0,
            'default_location': "Cleanroom Bay / Cabinet C-1 (Optics)",
            'default_supplier': "Advanced Optical Foundry"
        }
    )

    part_detector, _ = Part.objects.get_or_create(
        ipn="DET-SNSPD-01",
        defaults={
            'name': "Superconducting Nanowire Single Photon Detector",
            'description': "Cryogenic SNSPD with dark count < 50 Hz and > 90% quantum efficiency",
            'revision': "A.1",
            'category': cat_detectors,
            'is_assembly': False,
            'is_component': True,
            'units': "PCS",
            'minimum_stock': 4.0,
            'default_location': "Cleanroom Bay / Cabinet C-2 (Cryo)",
            'default_supplier': "CryoQuantum Corp"
        }
    )

    part_fpga, _ = Part.objects.get_or_create(
        ipn="ELEC-FPGA-KU15P",
        defaults={
            'name': "Xilinx UltraScale+ FPGA KU15P Core",
            'description': "Real-time key distillation and post-processing acceleration processor",
            'revision': "C.0",
            'category': cat_elec,
            'is_assembly': False,
            'is_component': True,
            'units': "PCS",
            'minimum_stock': 6.0,
            'default_location': "ESD Vault B-4",
            'default_supplier': "Xilinx Semiconductor"
        }
    )

    # Link Stock Items to Parts
    StockItem.objects.filter(item_code="OPT-LD-1550-DFB").update(part=part_laser, location=loc_c1)
    StockItem.objects.filter(item_code="DET-SNSPD-01").update(part=part_detector, location=loc_c2)
    StockItem.objects.filter(item_code="ELEC-FPGA-KU15P").update(part=part_fpga, location=loc_esd)

    # 4. BoM Hierarchy for Alice
    BomItem.objects.get_or_create(
        part=part_alice, item_code="BOM-ALICE-LD-01",
        defaults={
            'sub_part': part_laser,
            'name': "1550nm Laser Diode Source",
            'item_type': "OPTICAL",
            'quantity': 1.0,
            'reference': "LD1",
            'is_critical_path': True,
            'checksum_sha256': "e0e9b942d99cbb28ffbe8e70a4421b4700d2adfcbe3a493f0b2f5b4976a16182"
        }
    )

    BomItem.objects.get_or_create(
        part=part_alice, item_code="BOM-ALICE-FPGA-01",
        defaults={
            'sub_part': part_fpga,
            'name': "Transmitter Controller FPGA",
            'item_type': "ELECTRONIC",
            'quantity': 1.0,
            'reference': "U1",
            'is_critical_path': True,
            'checksum_sha256': "a7b3c942d99cbb28ffbe8e70a4421b4700d2adfcbe3a493f0b2f5b4976a17777"
        }
    )

    # BoM Hierarchy for Bob
    BomItem.objects.get_or_create(
        part=part_bob, item_code="BOM-BOB-DET-01",
        defaults={
            'sub_part': part_detector,
            'name': "SNSPD Single Photon Detector Core",
            'item_type': "CRYOGENIC_OPTICAL",
            'quantity': 2.0,
            'reference': "DET1-DET2",
            'is_critical_path': True,
            'checksum_sha256': "f4b89912c99cbb28ffbe8e70a4421b4700d2adfcbe3a493f0b2f5b4976a19999"
        }
    )

    # 5. Parameters
    PartParameter.objects.get_or_create(part=part_laser, name="Operating Wavelength", defaults={'value': "1550.12", 'unit': "nm"})
    PartParameter.objects.get_or_create(part=part_laser, name="Pulse Repetition Rate", defaults={'value': "1000", 'unit': "MHz"})
    PartParameter.objects.get_or_create(part=part_detector, name="Dark Count Rate", defaults={'value': "45.2", 'unit': "Hz"})
    PartParameter.objects.get_or_create(part=part_detector, name="Quantum Efficiency", defaults={'value': "91.5", 'unit': "%"})

    # 6. Controlled Baselines
    PortalBaseline.objects.get_or_create(
        baseline_id="BL-QKD-V2.1-PROD",
        defaults={
            'name': "TII QKD Industrial Production Baseline Release 2.1",
            'bom_revision': "REV-B.3",
            'hw_revision': "REV-3.2-A",
            'mechanical_revision': "MECH-ENC-IP67-R2",
            'fw_version': "v4.1.0-sec",
            'drawing_references': ["DWG-OPT-1550-01", "DWG-PCBA-KU15-02"],
            'specification_refs': ["SPEC-QKD-OPT-04", "SPEC-CRYPTO-SEC-01"],
            'procedure_revisions': ["SOP-MFG-OPT-ALIGN-R4", "SOP-TEST-QBER-R2"],
            'is_active': True
        }
    )

    # 7. Customization Presets (Save/Load Profiles)
    presets = [
        {
            "name": "Default Manufacturing Workspace",
            "description": "Complete production view with all traceability, inventory, and line governance cards.",
            "is_active": True,
            "is_default": True,
            "layout_config": {
                "visible_cards": ["admin", "dashboard", "production", "stock", "procurement", "settings"],
                "card_order": ["admin", "dashboard", "production", "stock", "procurement", "settings"],
                "pinned_sidebar_links": ["index.html", "dashboard.html", "parts.html", "production.html", "stock.html", "procurement.html"],
                "active_theme": "dark-slate",
                "sidebar_collapsed": False,
                "table_page_size": 25,
            }
        },
        {
            "name": "Cleanroom Operator Layout",
            "description": "Streamlined focus on Cleanroom Stock, Assembly parts, and in-progress inspection gates.",
            "is_active": False,
            "is_default": False,
            "layout_config": {
                "visible_cards": ["production", "stock", "dashboard"],
                "card_order": ["stock", "production", "dashboard"],
                "pinned_sidebar_links": ["stock.html", "parts.html", "production.html", "assembly.html"],
                "active_theme": "emerald-tech",
                "sidebar_collapsed": False,
                "table_page_size": 50,
            }
        },
        {
            "name": "QA Optical Inspector View",
            "description": "Optimized for optical characterization, test executions, and engineering deviations.",
            "is_active": False,
            "is_default": False,
            "layout_config": {
                "visible_cards": ["dashboard", "production", "settings"],
                "card_order": ["production", "dashboard", "settings"],
                "pinned_sidebar_links": ["production.html", "dashboard.html", "parts.html"],
                "active_theme": "indigo-enterprise",
                "sidebar_collapsed": False,
                "table_page_size": 20,
            }
        },
        {
            "name": "Executive Production Overview",
            "description": "High-level summary KPIs, first-pass yield tracking, and procurement commitments.",
            "is_active": False,
            "is_default": False,
            "layout_config": {
                "visible_cards": ["dashboard", "procurement", "admin"],
                "card_order": ["dashboard", "procurement", "admin"],
                "pinned_sidebar_links": ["dashboard.html", "procurement.html", "index.html"],
                "active_theme": "dark-slate",
                "sidebar_collapsed": True,
                "table_page_size": 15,
            }
        }
    ]

    for p in presets:
        CustomizationPreset.objects.get_or_create(
            name=p['name'],
            defaults={
                'description': p['description'],
                'is_active': p['is_active'],
                'is_default': p['is_default'],
                'layout_config': p['layout_config']
            }
        )
    print("[+] Seeded InvenTree features and Customization presets!")

def seed_manufacturing_units_and_parameters():
    """Seeds the 7 default sequential manufacturing units, customizable Build sub-assemblies,
    15 tracking parameters, and procured components catalog across all Production Units.
    """
    print("[*] Seeding 7 Manufacturing Units, Build Sub-Assemblies, Tracking Parameters, and Procured Components...")

    # Default 15 Tracking Parameters
    PARAMETERS = [
        {"param_key": "optical_power", "name": "Optical Power", "unit": "dBm", "data_type": "NUMERIC", "default_value": "-3.50", "is_critical": True},
        {"param_key": "center_wavelength", "name": "Center Wavelength", "unit": "nm", "data_type": "NUMERIC", "default_value": "1550.12", "is_critical": True},
        {"param_key": "dark_count_rate", "name": "Dark Count Rate", "unit": "Hz", "data_type": "NUMERIC", "default_value": "45.0", "is_critical": True},
        {"param_key": "quantum_efficiency", "name": "Quantum Efficiency", "unit": "%", "data_type": "NUMERIC", "default_value": "91.5", "is_critical": True},
        {"param_key": "insertion_loss", "name": "Insertion Loss", "unit": "dB", "data_type": "NUMERIC", "default_value": "1.25", "is_critical": False},
        {"param_key": "polarization_extinction", "name": "Polarization Extinction Ratio", "unit": "dB", "data_type": "NUMERIC", "default_value": "26.5", "is_critical": True},
        {"param_key": "operating_temperature", "name": "Operating Temperature", "unit": "°C", "data_type": "NUMERIC", "default_value": "21.4", "is_critical": False},
        {"param_key": "laser_diode_current", "name": "Laser Diode Drive Current", "unit": "mA", "data_type": "NUMERIC", "default_value": "48.2", "is_critical": False},
        {"param_key": "timing_jitter", "name": "Timing Jitter (FWHM)", "unit": "ps", "data_type": "NUMERIC", "default_value": "38.0", "is_critical": True},
        {"param_key": "return_loss", "name": "Optical Return Loss", "unit": "dB", "data_type": "NUMERIC", "default_value": "52.0", "is_critical": False},
        {"param_key": "mechanical_torque", "name": "Mounting Screws Torque", "unit": "Nm", "data_type": "NUMERIC", "default_value": "0.85", "is_critical": False},
        {"param_key": "esd_safe_check", "name": "ESD Safety Verification", "unit": "", "data_type": "BOOLEAN", "default_value": "PASS", "is_critical": True},
        {"param_key": "firmware_checksum", "name": "Firmware Build Checksum", "unit": "", "data_type": "TEXT", "default_value": "SHA256:7f9a2b8e34c1...", "is_critical": True},
        {"param_key": "visual_inspection_score", "name": "Cleanliness & Visual Grade", "unit": "Grade", "data_type": "SELECT", "default_value": "CLASS_A", "is_critical": False, "options": ["CLASS_A", "CLASS_B", "CLASS_C", "REJECT"]},
        {"param_key": "packaging_integrity", "name": "Hermetic Seal Pressure Integrity", "unit": "kPa", "data_type": "NUMERIC", "default_value": "101.3", "is_critical": False},
    ]

    # Procured Components Catalog
    PROCURED_COMPONENTS = [
        {
            "item_code": "OPT-LD-1550-DFB",
            "name": "DFB Pulsed Laser Diode 1550nm",
            "category": "Optical Systems / Pulsed Lasers",
            "supplier": "Advanced Optical Foundry",
            "unit": "PCS",
            "specifications": {"wavelength_nm": 1550.12, "linewidth_khz": 100, "pulse_width_ps": 50}
        },
        {
            "item_code": "DET-SNSPD-01",
            "name": "Superconducting Nanowire Single Photon Detector",
            "category": "Optical Systems / Detectors & Cryo",
            "supplier": "CryoQuantum Corp",
            "unit": "PCS",
            "specifications": {"efficiency_pct": 91.5, "dark_counts_hz": 45.0, "jitter_ps": 38.0}
        },
        {
            "item_code": "ELEC-FPGA-KU15P",
            "name": "Xilinx UltraScale+ FPGA KU15P Core",
            "category": "Processing Electronics",
            "supplier": "Xilinx Semiconductor",
            "unit": "PCS",
            "specifications": {"lut_count": 523000, "dsp_slices": 1968, "transceiver_speed_gbps": 32.75}
        },
        {
            "item_code": "OPT-BASE-ALU-01",
            "name": "Precision Invar Baseplate Chassis",
            "category": "Mechanical Hardware",
            "supplier": "Precision MechWorks",
            "unit": "PCS",
            "specifications": {"material": "Invar 36", "thermal_expansion": "1.2 ppm/K", "flatness_um": 5}
        },
        {
            "item_code": "OPT-FIBER-SMF28",
            "name": "Corning SMF-28 Ultra Optical Fiber Spool",
            "category": "Passive Optics",
            "supplier": "Corning Optical",
            "unit": "M",
            "specifications": {"attenuation_db_km": 0.18, "mode_field_dia_um": 9.2}
        },
        {
            "item_code": "ELEC-PSU-12V",
            "name": "Low-Noise Regulated DC Power Supply Unit",
            "category": "Power Systems",
            "supplier": "SynQor Power",
            "unit": "PCS",
            "specifications": {"output_voltage_v": 12.0, "ripple_mv_p_p": 5.0, "max_current_a": 10.0}
        }
    ]

    # The 7 Default Manufacturing Units
    DEFAULT_UNITS = [
        {
            "stage_key": "RECEIVE",
            "name": "Receive",
            "sequence_num": 1,
            "description": "Receipt and intake of externally procured components and raw materials from vendors.",
            "output_product_name": "Received Material Lots",
            "output_product_code": "RCV-LOT",
            "assembly_type": "CHAIN",
            "assigned_parameters": ["visual_inspection_score", "esd_safe_check", "operating_temperature"],
            "input_items": [
                {"item_code": "OPT-LD-1550-DFB", "name": "DFB Pulsed Laser Diode 1550nm", "source_type": "VENDOR"},
                {"item_code": "DET-SNSPD-01", "name": "Superconducting Nanowire Single Photon Detector", "source_type": "VENDOR"},
                {"item_code": "ELEC-FPGA-KU15P", "name": "Xilinx UltraScale+ FPGA KU15P Core", "source_type": "VENDOR"},
                {"item_code": "OPT-BASE-ALU-01", "name": "Precision Invar Baseplate Chassis", "source_type": "VENDOR"}
            ]
        },
        {
            "stage_key": "INSPECT",
            "name": "Inspect",
            "sequence_num": 2,
            "description": "Incoming QA inspection: verification against specs, separating OK (Conforming) and Faulty products.",
            "output_product_name": "QA-Verified Component Lots",
            "output_product_code": "INSP-VERIFIED",
            "assembly_type": "CHAIN",
            "assigned_parameters": [
                "optical_power", "center_wavelength", "insertion_loss",
                "polarization_extinction", "visual_inspection_score", "esd_safe_check",
                "dark_count_rate", "quantum_efficiency", "return_loss", "laser_diode_current"
            ],
            "input_items": [
                {"item_code": "RCV-LOT", "name": "Received Material Lots", "source_type": "PREVIOUS_STAGE", "source_stage_key": "RECEIVE"}
            ]
        },
        {
            "stage_key": "STORE_KIT",
            "name": "Store & Kit",
            "sequence_num": 3,
            "description": "Cleanroom inventory storage of conforming items and preparation of kitted production bins.",
            "output_product_name": "Cleanroom Production Kit",
            "output_product_code": "KIT-PROD-01",
            "assembly_type": "CHAIN",
            "assigned_parameters": ["visual_inspection_score", "operating_temperature", "esd_safe_check"],
            "input_items": [
                {"item_code": "INSP-VERIFIED", "name": "QA-Verified Component Lots", "source_type": "PREVIOUS_STAGE", "source_stage_key": "INSPECT"}
            ]
        },
        {
            "stage_key": "BUILD",
            "name": "Build",
            "sequence_num": 4,
            "description": "Manufacturing, integration, and assembly across customized sub-assemblies.",
            "output_product_name": "Integrated Quantum Enclosure",
            "output_product_code": "QKD-SYS-INTEG",
            "assembly_type": "CHAIN",
            "assigned_parameters": ["mechanical_torque", "laser_diode_current", "firmware_checksum", "esd_safe_check"],
            "input_items": [
                {"item_code": "KIT-PROD-01", "name": "Cleanroom Production Kit", "source_type": "PREVIOUS_STAGE", "source_stage_key": "STORE_KIT"}
            ]
        },
        {
            "stage_key": "TEST",
            "name": "Test",
            "sequence_num": 5,
            "description": "Comprehensive optical, electronic, functional, and environmental qualification testing.",
            "output_product_name": "Qualified Hardware Unit",
            "output_product_code": "QKD-TESTED-01",
            "assembly_type": "CHAIN",
            "assigned_parameters": [
                "optical_power", "center_wavelength", "timing_jitter",
                "dark_count_rate", "quantum_efficiency", "polarization_extinction",
                "operating_temperature", "return_loss"
            ],
            "input_items": [
                {"item_code": "QKD-SYS-INTEG", "name": "Integrated Quantum Enclosure", "source_type": "PREVIOUS_STAGE", "source_stage_key": "BUILD"}
            ]
        },
        {
            "stage_key": "RELEASE",
            "name": "Release",
            "sequence_num": 6,
            "description": "Engineering compliance verification, documentation baseline lock, and quality release sign-off.",
            "output_product_name": "Authorized Release Product",
            "output_product_code": "QKD-RELEASED",
            "assembly_type": "CHAIN",
            "assigned_parameters": ["firmware_checksum", "esd_safe_check", "optical_power", "quantum_efficiency", "visual_inspection_score"],
            "input_items": [
                {"item_code": "QKD-TESTED-01", "name": "Qualified Hardware Unit", "source_type": "PREVIOUS_STAGE", "source_stage_key": "TEST"}
            ]
        },
        {
            "stage_key": "PACKAGE",
            "name": "Package",
            "sequence_num": 7,
            "description": "Cleanroom protective packaging, labeling, barcode generation, and dispatch container sealing.",
            "output_product_name": "Final Packaged Quantum System",
            "output_product_code": "QKD-PKG-DISPATCH",
            "assembly_type": "CHAIN",
            "assigned_parameters": ["packaging_integrity", "visual_inspection_score", "esd_safe_check"],
            "input_items": [
                {"item_code": "QKD-RELEASED", "name": "Authorized Release Product", "source_type": "PREVIOUS_STAGE", "source_stage_key": "RELEASE"}
            ]
        }
    ]

    # Default Sub-Assemblies under BUILD
    DEFAULT_SUB_ASSEMBLIES = [
        {
            "stage_key": "BUILD_BASEPLATE",
            "name": "Baseplate Sub-Assembly",
            "sequence_num": 1,
            "parent_stage_key": "BUILD",
            "is_subassembly": True,
            "description": "Invar optical baseplate alignment, precision machining check, and shock absorber mounting.",
            "output_product_name": "Optical Baseplate Module",
            "output_product_code": "SUB-BASE-01",
            "assigned_parameters": ["mechanical_torque", "operating_temperature", "esd_safe_check"],
            "bom_inputs": [
                {"type": "procured", "item_code": "OPT-BASE-ALU-01", "name": "Precision Invar Baseplate Chassis", "quantity": 1, "unit": "PCS"}
            ]
        },
        {
            "stage_key": "BUILD_OPTICAL",
            "name": "Optical Engine Sub-Assembly",
            "sequence_num": 2,
            "parent_stage_key": "BUILD",
            "is_subassembly": True,
            "description": "Integration of 1550nm pulsed laser diode and optical collimators onto baseplate.",
            "output_product_name": "Calibrated Optical Engine",
            "output_product_code": "SUB-OPT-ENG-02",
            "assigned_parameters": ["optical_power", "center_wavelength", "laser_diode_current", "polarization_extinction"],
            "bom_inputs": [
                {"type": "subassembly_output", "item_code": "SUB-BASE-01", "name": "Optical Baseplate Module", "quantity": 1, "unit": "PCS", "source_stage_key": "BUILD_BASEPLATE"},
                {"type": "procured", "item_code": "OPT-LD-1550-DFB", "name": "DFB Pulsed Laser Diode 1550nm", "quantity": 1, "unit": "PCS"},
                {"type": "procured", "item_code": "OPT-FIBER-SMF28", "name": "Corning SMF-28 Ultra Optical Fiber Spool", "quantity": 5, "unit": "M"}
            ]
        },
        {
            "stage_key": "BUILD_ELECTRONICS",
            "name": "Processing Electronics Sub-Assembly",
            "sequence_num": 3,
            "parent_stage_key": "BUILD",
            "is_subassembly": True,
            "description": "Installation of Xilinx UltraScale+ FPGA controller board and power supply harness.",
            "output_product_name": "FPGA Signal Processor Board",
            "output_product_code": "SUB-ELEC-KU15-03",
            "assigned_parameters": ["firmware_checksum", "esd_safe_check", "operating_temperature"],
            "bom_inputs": [
                {"type": "procured", "item_code": "ELEC-FPGA-KU15P", "name": "Xilinx UltraScale+ FPGA KU15P Core", "quantity": 1, "unit": "PCS"},
                {"type": "procured", "item_code": "ELEC-PSU-12V", "name": "Low-Noise Regulated DC Power Supply Unit", "quantity": 1, "unit": "PCS"}
            ]
        },
        {
            "stage_key": "BUILD_FINAL_INTEGRATION",
            "name": "Final System Integration",
            "sequence_num": 4,
            "parent_stage_key": "BUILD",
            "is_subassembly": True,
            "description": "Final housing closure, wiring harness lock, and inter-module fiber coupling.",
            "output_product_name": "Alice QKD Optical Transmitter",
            "output_product_code": "QKD-TX-ALICE",
            "assigned_parameters": ["mechanical_torque", "firmware_checksum", "optical_power", "esd_safe_check"],
            "bom_inputs": [
                {"type": "subassembly_output", "item_code": "SUB-OPT-ENG-02", "name": "Calibrated Optical Engine", "quantity": 1, "unit": "PCS", "source_stage_key": "BUILD_OPTICAL"},
                {"type": "subassembly_output", "item_code": "SUB-ELEC-KU15-03", "name": "FPGA Signal Processor Board", "quantity": 1, "unit": "PCS", "source_stage_key": "BUILD_ELECTRONICS"}
            ]
        }
    ]

    for pu in OrgProductionUnit.objects.all():
        print(f"[*] Configuring Production Unit: {pu.code} - {pu.name}")

        # Seed Tracking Parameters
        for p in PARAMETERS:
            TrackingParameter.objects.update_or_create(
                production_unit=pu,
                param_key=p['param_key'],
                defaults={
                    'name': p['name'],
                    'unit': p['unit'],
                    'data_type': p['data_type'],
                    'default_value': p['default_value'],
                    'is_critical': p['is_critical'],
                    'options': p.get('options', [])
                }
            )

        # Seed Procured Components Catalog
        for c in PROCURED_COMPONENTS:
            ProcuredComponent.objects.update_or_create(
                production_unit=pu,
                item_code=c['item_code'],
                defaults={
                    'name': c['name'],
                    'category': c['category'],
                    'supplier': c['supplier'],
                    'unit': c['unit'],
                    'specifications': c['specifications'],
                    'is_active': True
                }
            )

        # Seed The 7 Default Units
        for u in DEFAULT_UNITS:
            PipelineStage.objects.update_or_create(
                production_unit=pu,
                stage_key=u['stage_key'],
                defaults={
                    'name': u['name'],
                    'sequence_num': u['sequence_num'],
                    'description': u['description'],
                    'output_product_name': u['output_product_name'],
                    'output_product_code': u['output_product_code'],
                    'assembly_type': u.get('assembly_type', 'CHAIN'),
                    'parent_stage_key': '',
                    'is_subassembly': False,
                    'assigned_parameters': u.get('assigned_parameters', []),
                    'input_items': u.get('input_items', []),
                    'intermediate_statuses': ['PENDING', 'IN_PROGRESS', 'QUALITY_CHECK', 'APPROVED', 'DONE']
                }
            )

        # Seed Default Sub-Assemblies under BUILD
        for sa in DEFAULT_SUB_ASSEMBLIES:
            PipelineStage.objects.update_or_create(
                production_unit=pu,
                stage_key=sa['stage_key'],
                defaults={
                    'name': sa['name'],
                    'sequence_num': sa['sequence_num'],
                    'description': sa['description'],
                    'output_product_name': sa['output_product_name'],
                    'output_product_code': sa['output_product_code'],
                    'assembly_type': 'BUILD_SUBASSEMBLY',
                    'parent_stage_key': 'BUILD',
                    'is_subassembly': True,
                    'assigned_parameters': sa.get('assigned_parameters', []),
                    'bom_inputs': sa.get('bom_inputs', []),
                    'intermediate_statuses': ['PENDING', 'ASSEMBLING', 'ALIGNMENT', 'INSPECTION', 'COMPLETED']
                }
            )

        # Seed Sample Finished Products in INSPECT for OK vs Faulty testing
        inspect_stage = PipelineStage.objects.filter(production_unit=pu, stage_key="INSPECT").first()
        if inspect_stage:
            # OK Product 1
            StageFinishedProduct.objects.update_or_create(
                serial_number=f"SN-INSP-OK-001-{pu.code}",
                defaults={
                    'production_unit': pu,
                    'stage_key': 'INSPECT',
                    'product_code': 'OPT-LD-1550-DFB',
                    'product_name': 'DFB Pulsed Laser Diode 1550nm',
                    'status': 'AVAILABLE',
                    'inspection_status': 'OK',
                    'defect_reason': '',
                    'component_origin': 'PROCURED',
                    'created_by': 'Admin QA',
                    'parameter_values': {
                        'optical_power': {'value': '-3.45', 'unit': 'dBm', 'stage_key': 'INSPECT', 'recorded_by': 'Admin QA'},
                        'center_wavelength': {'value': '1550.11', 'unit': 'nm', 'stage_key': 'INSPECT', 'recorded_by': 'Admin QA'},
                        'visual_inspection_score': {'value': 'CLASS_A', 'unit': 'Grade', 'stage_key': 'INSPECT', 'recorded_by': 'Admin QA'}
                    }
                }
            )
            # OK Product 2
            StageFinishedProduct.objects.update_or_create(
                serial_number=f"SN-INSP-OK-002-{pu.code}",
                defaults={
                    'production_unit': pu,
                    'stage_key': 'INSPECT',
                    'product_code': 'DET-SNSPD-01',
                    'product_name': 'Superconducting Nanowire Single Photon Detector',
                    'status': 'AVAILABLE',
                    'inspection_status': 'OK',
                    'defect_reason': '',
                    'component_origin': 'PROCURED',
                    'created_by': 'Admin QA',
                    'parameter_values': {
                        'dark_count_rate': {'value': '42.1', 'unit': 'Hz', 'stage_key': 'INSPECT', 'recorded_by': 'Admin QA'},
                        'quantum_efficiency': {'value': '92.4', 'unit': '%', 'stage_key': 'INSPECT', 'recorded_by': 'Admin QA'},
                        'visual_inspection_score': {'value': 'CLASS_A', 'unit': 'Grade', 'stage_key': 'INSPECT', 'recorded_by': 'Admin QA'}
                    }
                }
            )
            # FAULTY Product
            StageFinishedProduct.objects.update_or_create(
                serial_number=f"SN-INSP-FLT-001-{pu.code}",
                defaults={
                    'production_unit': pu,
                    'stage_key': 'INSPECT',
                    'product_code': 'OPT-LD-1550-DFB',
                    'product_name': 'DFB Pulsed Laser Diode 1550nm',
                    'status': 'REJECTED',
                    'inspection_status': 'FAULTY',
                    'defect_reason': 'Optical power output below threshold (-8.2 dBm vs min -4.0 dBm). Center wavelength drift > 0.5 nm.',
                    'component_origin': 'PROCURED',
                    'created_by': 'Admin QA',
                    'parameter_values': {
                        'optical_power': {'value': '-8.20', 'unit': 'dBm', 'stage_key': 'INSPECT', 'recorded_by': 'Admin QA'},
                        'center_wavelength': {'value': '1550.85', 'unit': 'nm', 'stage_key': 'INSPECT', 'recorded_by': 'Admin QA'},
                        'visual_inspection_score': {'value': 'REJECT', 'unit': 'Grade', 'stage_key': 'INSPECT', 'recorded_by': 'Admin QA'}
                    }
                }
            )

    print("[+] Successfully seeded 7 Manufacturing Units, Build Sub-Assemblies, Parameters & Procured Catalog!")

def main():
    print("==================================================")
    print(" MASAR LEGACY DATA MIGRATION & INVENTREE SEEDING")
    print("==================================================")
    migrate_admins()
    migrate_users()
    migrate_manufacturing()
    seed_inventree_features()
    seed_manufacturing_units_and_parameters()
    print("==================================================")
    print(" Migration completed successfully!")
    print("==================================================")

if __name__ == '__main__':
    main()

