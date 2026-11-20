# Masar (مسار) - Admin Customization User Guide

**Target Audience:** Server Super Administrators, Production Unit Administrators, Cleanroom Leads  
**Platform Version:** `v2.0.0-django`  
**Authentication Standard:** Role-Based Access Control (RBAC) + Bcrypt / OIDC Bearer Tokens  

---

## 1. Getting Started: Accessing the Admin Console

### 1.1. Default Admin Credentials

Masar comes configured with a default Server Super Admin account seeded in the database:

| Parameter | Value |
| :--- | :--- |
| **Portal URL** | `http://localhost:8080/` |
| **Admin Email** | `ganga.ram@tii.ae` |
| **Admin Password** | `Magic@008002` |
| **Role Authority** | `SERVER_SUPER_ADMIN` |

> [!NOTE]
> For API and programmatic integration, the master developer bypass header `X-Bypass-Token: masar-dev-bypass-secret-token-2026` can also be passed to authenticate automatically with full admin privileges.

---

### 1.2. Signing In & Navigating the Control Plane

1. Navigate to `http://localhost:8080/` in your browser.
2. Under the **Sign In** tab, input the admin email and password.
3. Click **Sign In →**.
4. Upon successful authentication, as a Server Super Admin you will be presented with:
   - **Admin Governance Console** (`index.html?view=admin`): Manage organizations, production facilities, and team rosters.
   - **Manufacturing Hub** (`index.html?view=hub`): Direct operational view across cleanroom inventory, build orders, and test logs.
   - **Quick Toggle**: Use the badge in the top right header (`🛡️ Admin Console` $\leftrightarrow$ `🏭 View Hub`) to switch contexts instantly.

---

## 2. Facility & Production Unit Customization

Masar organizes manufacturing into multi-tenant **Production Units (PUs)** (e.g., cleanrooms, optical labs, cryogenic test bays).

### 2.1. Creating a New Production Unit
1. In the **Admin Governance Console** (`index.html?view=admin`), ensure you are on the **Production Units** overview.
2. Click **+ Add Production Unit** in the top action bar.
3. Complete the modal form:
   - **Unit Code**: Unique identifier (e.g., `PU_OPTICAL_BAY_02`).
   - **Display Name**: Human-readable name (e.g., `Cleanroom Optical Assembly Bay 2`).
   - **Description**: Operational scope, cleanroom classification (e.g., ISO Class 5 cleanroom for QKD Alice TX modules).
4. Click **Create Production Unit**.

### 2.2. Programmatic API (cURL)
```bash
curl -X POST http://localhost:8080/api/v1/auth/production-units \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "code": "PU_ALICE_PROD",
    "name": "Alice Transmitter Production Line",
    "description": "High-assurance quantum transmitter module manufacturing"
  }'
```

---

## 3. Team Governance, Custom Roles & Staff Invitations

### 3.1. Provisioning a Production Unit Admin
Every production unit can have dedicated line administrators:
1. From the Production Units grid, click **👥 Manage Team** on the desired facility card.
2. Under **Dedicated Line Administrator**, click **Assign / Update Admin**.
3. Enter the administrator's email, full name, and temporary password.
4. Click **Provision Line Admin**.

### 3.2. Inviting Personnel with One-Time Passwords (OTP)
1. On the team management page, click **+ Invite Team Member**.
2. Fill in:
   - **Email Address**: Staff corporate email (e.g., `engineer@tii.ae`).
   - **One-Time Password (OTP)**: Temporary password (click **🎲 Generate OTP** for a secure random key).
   - **Operational Roles**: Check one or more functional roles:
     - `PU_ADMIN`: Full administrative control over the unit.
     - `LINE_ENGINEER`: Assembly execution and rework authorization.
     - `QA_INSPECTOR`: Quality gates, FAT testing, and defect logging.
     - `CLEANROOM_OPERATOR`: Material receipt, kitting, and stock handling.
3. Click **Send Invitation**.

### 3.3. How Staff Accept Invitations
1. The invited staff navigates to `http://localhost:8080/`.
2. Click the **Accept Invitation & Register** tab.
3. Input their invited email, the OTP provided by the admin, their full name, and their desired permanent password.
4. Click **Activate Account & Sign In →**.

### 3.4. Creating Custom Organizational Roles
If your facility requires specialized roles (e.g., `Cryogenic Technician`, `Fiber Splicer`):
```bash
curl -X POST http://localhost:8080/api/v1/auth/production-units/<PU_ID>/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "role_key": "CRYO_SPECIALIST",
    "name": "Cryogenic Characterization Specialist",
    "description": "Authorized to execute 4K dilution refrigerator optical FAT testing"
  }'
```

---

## 4. Customizing the 7 Lifecycle Pipeline Stages

Masar models manufacturing through 7 sequential lifecycle stages:

```
1. RECEIVE ──▶ 2. INSPECT ──▶ 3. STORE & KIT ──▶ 4. BUILD ──▶ 5. TEST ──▶ 6. RELEASE ──▶ 7. PACKAGE
```

### 4.1. Customizing Stage Sequence and Metadata
1. Navigate to **Pipeline Traceability** (`pipeline.html`) from the sidebar or click **⚡ Traceability Chain** on a facility card.
2. As an Admin, click **✏️ Edit Stage** on any stage card.
3. You can modify:
   - **Stage Name**: e.g., Rename `Test` to `Cryogenic Optical Characterization`.
   - **Sequence Number**: Alter the progression order.
   - **Description**: Add Standard Operating Procedure (SOP) instructions for cleanroom operators.
   - **Output Product Code & Name**: Designate the product milestone produced at this stage.

### 4.2. Adding Custom Pipeline Stages
To introduce an extra intermediate stage (e.g., `PRE_ENCAPSULATION_CLEAN`):
```bash
curl -X POST http://localhost:8080/api/v1/auth/production-units/<PU_ID>/stages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "stage_key": "CLEAN_PLASMA",
    "name": "Plasma Surface Treatment",
    "sequence_num": 35,
    "description": "Pre-epoxy vacuum plasma cleaning chamber",
    "assembly_type": "CHAIN"
  }'
```

---

## 5. Customizing Engineering Tracking Parameters

Tracking parameters ensure quantitative engineering telemetry is logged during assembly and carried forward with the serial number.

### 5.1. Creating Parameters
1. Open the **Build & Sub-Assemblies Console** (`build.html`) or navigate to `pipeline.html`.
2. Click **⚙️ Tracking Parameters Catalog**.
3. Click **+ New Tracking Parameter** and configure:
   - **Parameter Key**: e.g., `optical_power`, `center_wavelength`, `extinction_ratio`.
   - **Display Name**: e.g., `Optical Output Power`.
   - **Unit**: e.g., `dBm`, `nm`, `dB`, `Hz`.
   - **Data Type**: `NUMERIC`, `TEXT`, `BOOLEAN`, or `SELECT`.
   - **Default / Target Value**: e.g., `-3.5`.
   - **Critical Path Flag**: Mark as critical for FAT release gates.
4. Click **Save Parameter**.

### 5.2. Assigning Parameters to Stages
To enforce that QA Inspectors record specific parameters at `INSPECT` or `TEST`:
```bash
curl -X POST http://localhost:8080/api/v1/auth/production-units/<PU_ID>/stages/INSPECT/parameters \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "parameter_keys": ["optical_power", "center_wavelength", "visual_inspection_score"]
  }'
```

---

## 6. Customizing Procured Components & Build Sub-Assemblies

### 6.1. Adding Raw Procured Components
1. Go to `stage.html?stage=RECEIVE&tab=procured`.
2. Click **+ Add Procured Component**.
3. Input:
   - **Item Code**: e.g., `OPT-LD-1550-DFB`.
   - **Name**: e.g., `1550nm Pulsed DFB Laser Diode`.
   - **Category**: `Optics`.
   - **Supplier**: e.g., `Eblana Photonics`.
   - **Unit**: `PCS`.
   - **Technical Specs**: JSON key-values (e.g. `{"linewidth": "2MHz", "package": "TO-56"}`).
4. Click **Register Component**.

### 6.2. Creating Sub-Assemblies under `BUILD`
1. Navigate to `build.html`.
2. Click **+ Create Sub-Assembly**.
3. Configure the hierarchy:
   - **Sub-Assembly Key**: e.g., `BUILD_OPTICAL_CORE`.
   - **Name**: `Alice Optical Modulator Core`.
   - **Output Product Code**: `ASM-OPT-001`.
   - **BoM Component Inputs**: Add line items specifying input origins (procured parts or prior sub-assemblies).
   - **Assigned Engineering Parameters**: Attach parameters to monitor.
4. Click **Save Sub-Assembly**.

---

## 7. Customizing InvenTree Parts, Categories & Cleanroom Stock

### 7.1. Part Categories & Parts Catalog (`parts.html`)
1. Click **Parts & BoM** in the left sidebar.
2. In the left panel, click **+ New Category** to construct multi-level trees (e.g. `Optics / Lasers / DFB`).
3. Click **+ New Part** to create a catalog item:
   - **Internal Part Number (IPN)**: e.g., `MASAR-PRT-0042`.
   - **Revision**: `Rev B`.
   - **Category**: Select category from the tree.
   - **Is Assembly**: Check if this part contains an engineering Bill of Materials.
   - **Minimum Stock Threshold**: Triggers automated low-stock warnings when inventory drops below this value.

### 7.2. Hierarchical Storage Locations (`stock.html`)
1. Click **Cleanroom Stock** in the left sidebar.
2. Click **+ New Location** to mirror cleanroom topology:
   - Level 1: `Cleanroom ISO-5 Main Vault`
   - Level 2: `Cleanroom ISO-5 Main Vault / Nitrogen Dry Box 01`
   - Level 3: `Cleanroom ISO-5 Main Vault / Nitrogen Dry Box 01 / Shelf B`
3. Click **+ New Stock Item** to log serialized inventory, batch numbers, and initial quantities.

---

## 8. Workspace Layout Customization (Save, Load, Export & Import)

Every operator, QA engineer, or manager can customize the platform's visual presentation.

### 8.1. Using the Workspace Customizer Modal
1. Click **🎨 Customize View** (available in the top navigation bar or left sidebar).
2. The **Workspace Customizer** modal will open:
   - **Hub Card Visibility**: Check/uncheck cards (`Admin`, `Dashboard`, `Production`, `Stock`, `Procurement`, `Settings`).
   - **Accent Themes**: Select from:
     - `Dark Slate (Masar Default)`: Industrial slate high-contrast theme.
     - `Emerald Tech`: Cleanroom green styling.
     - `Indigo Enterprise`: Modern corporate theme.
     - `Cyber Amber`: High-visibility warning theme.
   - **Save As New Preset**: Enter a name (e.g., `Optical QA Inspector Profile`) and click **Save As New Preset**.

### 8.2. Exporting and Importing Presets (JSON)
- **Exporting**: In the customizer modal or in `settings.html`, click **📥 Export JSON**. A configuration file (`masar_preset_<timestamp>.json`) downloads to your machine.
- **Importing**: Click **Upload Preset File** and select your JSON configuration. The platform loads the preset and activates the layout immediately.

---

## 9. Admin CLI & Quick Management Commands

For system administrators working directly inside the host shell:

```bash
# Enter the developer environment
nix-shell

# Run the complete automated system verification test
python3 scripts/verify_system.py

# Run Django unit test suite
python3 manage.py test

# Open interactive Django shell
python3 manage.py shell
```

### Python Django Shell Quick Administration Snippet:
```python
# Launch python3 manage.py shell
from identity.models import ServerAdmin, ProductionUnit, TenantUser

# Create or reset Server Super Admin password
admin, _ = ServerAdmin.objects.get_or_create(email="newadmin@tii.ae")
admin.set_password("NewSecurePassword2026!")
admin.full_name = "Lead Architect"
admin.save()
print("Admin password updated successfully.")
```
