# Masar (مسار) - Production Traceability & Inventory Platform

**Masar** (مسار, Arabic for *Path* or *Trajectory*) is an industrial hardware traceability and manufacturing execution platform powered by **Python Django** and inspired by the **InvenTree** architecture. Designed for high-assurance hardware manufacturing, quantum communication hardware (QKD), assembly verification, multi-tenant organizational governance, and customizable workspaces.

## Key Architecture & Features

- **Python Django Backend**: Powered by Django 5.2 and Django REST Framework with embedded SQLite storage (`data/masar.db`).
- **InvenTree Feature Set**:
  - **Parts & Categories**: Multi-level Parts catalog, hierarchical category trees, engineering parameters, and cryptographic BoM verification.
  - **Stock & Locations**: Hierarchical storage locations (Cleanroom bays, cabinets, ESD vaults), serialized inventory tracking, batch/lot tracking, and low-stock alerts.
  - **Build Orders & Manufacturing**: Build order runs, stock allocation, and component consumption.
  - **Suppliers & Procurement**: Companies catalog, vendor parts, purchase orders, and fulfillment tracking.
- **Hardware Traceability Register**: Unit-level lifecycle tracking for Sender (Alice) and Receiver (Bob) modules, product baselines, hardware/firmware revisions, Alice-Bob system pairing, rework actions, deviations, and optical test characterization.
- **InvenTree-Style Web Interface**:
  - Collapsible Left Navigation Sidebar with live Part Category and Storage Location trees.
  - Modern Tabbed Interface across all detail views.
  - Sleek dark slate styling consistent with industrial manufacturing standards.
- **Customization Engine (Save & Load)**:
  - Save custom operational workspace profiles (e.g. Cleanroom Operator, Optical QA Inspector, Executive Overview).
  - Load and activate presets instantly.
  - Export and import customization profiles as JSON.
- **3-Tier Multi-Tenant Governance**: Server Super Admin, Production Unit Admins, Line Engineers, QA Inspectors, and Cleanroom Operators with JWT/Token auth and developer bypass mode (`X-Bypass-Token`).

## Quickstart

### With Nix Shell:
```bash
nix-shell
run          # Starts Django on 0.0.0.0:8080
```

### Direct Python:
```bash
python3 manage.py migrate
python3 manage.py runserver 0.0.0.0:8080
```

Access the portal at `http://localhost:8080/`.

### Run Test Suite:
```bash
python3 manage.py test
python3 scripts/verify_system.py
```
