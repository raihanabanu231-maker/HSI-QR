# HSA Auto Vacuum Hose Application & Vision Inspection Suite

An enterprise-grade industrial vision inspection, master data management, and 100x30mm thermal label printing suite built for automotive manufacturing lines (HSA / HSI Vacuum Hose assemblies).

---

## Complete Production Workflow

### 1. Master Admin Stage
- **Upload Master Data**: Master Admin uploads an Excel file (`.xlsx`, `.xls`) or CSV containing production items (e.g., `VACUUM HOSE PART LIST.xlsx`).
- **Dynamic Ingestion**: The system automatically parses:
  - `MODEL NO` (e.g. `SU2B`, `BC4B`, `MQ4I`, `BC4I`, `DN7I`, `AI3`, `AH2/AI3`)
  - `PART NAME` (e.g. `VACUUM HOSE`)
  - `PART NO` (e.g. `59130BX350`, `59130BX400`, `59130BP000`)
  - `SUB PART NO` (e.g. `59130BX350` or variant sub-assembly)
  - `ALC CODE` (e.g. `VH30`, `VH95`, `VH45`, `VH25`, `VH15`, `V599`, `CVH4`)
  - `SL NO` & `REMARKS`
- **Master Inventory Table**: Admin can search, filter, manually add individual parts, and export daily inspection reports as Excel (`.xlsx`).

### 2. Operator Process Stage
1. **Cascading Master Data Dropdowns**:
   - **Select Model No**: Dropdown populated dynamically from Master Data.
   - **Select Part**: Dropdown filters based on the chosen Model No.
   - **Select Sub Part No**: Dropdown displays matching sub part numbers with ALC codes and serial numbers.
2. **Start Button (Safety Lockout)**:
   - Clicking **"START PROCESS"** immediately **locks/disables all three dropdowns** (`Model No`, `Part`, `Sub Part No`) to prevent accidental part mixing during the production run.
   - A **"STOP / UNLOCK"** button allows unlocking the dropdowns when switching batches.
3. **Folder Selection & Inspection Watcher**:
   - Operator selects target drop folder (e.g., `C:\Inspection\DropZone`).
   - Supports **Live Auto-Watcher** (polling every 3.5 seconds) and on-demand folder scans.
   - Includes **"Simulate OK Drop"** and **"Simulate NG Drop"** buttons for immediate testing.
4. **Visual Display of OK Images & Not OK (NG) Images**:
   - **OK Images Panel**: Displays thumbnails of all approved inspection images with click-to-zoom, approval stamp, and the **auto-generated 100x30mm label**.
   - **Not OK (NG) Images Panel**: Displays thumbnails of defective images with reject stamps and an explicit alert: *Label printing blocked for NG item*.
5. **100x30mm Industrial Label Printing**:
   - Matches the official Excel diagram layout:
     - 5 vertical columns rotated 90°: `SL NO`, `MODEL`, `PART NO`, `PART NAME`, `ALC CODE`
     - Bottom composite barcode string: e.g. `T05APRT1234510001ATPL500ALC9876`
     - Right section: High-density 2D QR Code + batch code `P587T000`
   - Formatted for direct browser thermal print (`100mm x 30mm`) and Windows system printers.

---

## Folder Structure

```
qr-project/
  backend/            Node.js Express server + Neon PostgreSQL DB
    server.js         Master data upload, cascading dropdowns, folder watcher, 100x30 QR generator
    db.js             Neon Postgres schema (master_parts, logs, label_logs)
    qr-output/        Generated 100x30 barcode images (.png)
    .env              Neon database connection string
  frontend/           React + Vite application
    src/
      App.jsx         Operator Process Stage, Cascading Dropdowns, OK/NG Panels, Master Admin
      App.css         Industrial dark mode + 100x30mm label layout & print styles
```

---

## Running the Application

### 1. Backend Server
In the `backend` folder:
```bash
cd backend
npm install
npm start
```
Runs at: `http://localhost:5000`

### 2. Frontend Web App
In the `frontend` folder:
```bash
cd frontend
npm install
npm run dev
```
Runs at: `http://localhost:3000` (or `http://localhost:5173`)
