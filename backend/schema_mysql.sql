-- ========================================================
-- HSI AUTOMATED MES VERIFICATION SYSTEM - MYSQL SCHEMA
-- ========================================================

CREATE DATABASE IF NOT EXISTS hsi_qr_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hsi_qr_db;

-- 1. Master Parts Table
CREATE TABLE IF NOT EXISTS master_parts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sl_no VARCHAR(100),
  model_no VARCHAR(150) NOT NULL,
  part_name VARCHAR(255) NOT NULL DEFAULT '',
  part_no VARCHAR(150) NOT NULL,
  sub_part_no VARCHAR(150) NOT NULL,
  alc_code VARCHAR(100) DEFAULT '',
  remarks TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_master_model (model_no),
  INDEX idx_master_part (part_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Inspection Logs Table
CREATE TABLE IF NOT EXISTS logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  folder_name VARCHAR(255) NOT NULL,
  folder_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT,
  status VARCHAR(20) NOT NULL, -- 'OK' or 'NG'
  model_no VARCHAR(150),
  part_no VARCHAR(150),
  sub_part_no VARCHAR(150),
  alc_code VARCHAR(100),
  operator VARCHAR(100) DEFAULT 'operator',
  shift VARCHAR(50) DEFAULT 'Shift 1',
  trace_number VARCHAR(100),
  pressure VARCHAR(50) DEFAULT '0.850',
  pack_qty VARCHAR(50) DEFAULT '1 / 1',
  remark TEXT,
  printed TINYINT(1) NOT NULL DEFAULT 0,
  sl_no VARCHAR(100),
  composite_code VARCHAR(255),
  scanned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  printed_at DATETIME NULL,
  INDEX idx_logs_folder (folder_path),
  INDEX idx_logs_status (status),
  INDEX idx_logs_scanned_at (scanned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. 100x30 Thermal Label Printing Logs
CREATE TABLE IF NOT EXISTS label_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sl_no VARCHAR(100),
  model_no VARCHAR(150),
  part_no VARCHAR(150),
  sub_part_no VARCHAR(150),
  part_name VARCHAR(255),
  alc_code VARCHAR(100),
  composite_code VARCHAR(255),
  batch_code VARCHAR(100),
  qr_file VARCHAR(255),
  printed_by VARCHAR(100) DEFAULT 'operator',
  printed TINYINT(1) DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_labels_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Legacy Master QR Logs
CREATE TABLE IF NOT EXISTS part_qr_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_name VARCHAR(150) NOT NULL DEFAULT 'MASTER PART LIST',
  sl_no VARCHAR(100),
  model VARCHAR(150),
  part_no VARCHAR(150) NOT NULL,
  part_name VARCHAR(255),
  alc_code VARCHAR(100),
  remarks TEXT,
  qr_code_file VARCHAR(255),
  printed TINYINT(1) NOT NULL DEFAULT 0,
  printed_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  printed_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. System Users & Role Permissions Table
CREATE TABLE IF NOT EXISTS system_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL DEFAULT 'Pass@123',
  full_name VARCHAR(255) NOT NULL DEFAULT '',
  role VARCHAR(50) NOT NULL DEFAULT 'OPERATOR',
  line_assigned VARCHAR(100) DEFAULT 'Line 2',
  shift_assigned VARCHAR(100) DEFAULT 'Shift 1',
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Default System Users Seed
INSERT IGNORE INTO system_users (username, password, full_name, role, line_assigned, shift_assigned, status)
VALUES 
  ('admin', 'Admin@123', 'System Administrator', 'ADMIN', 'All Lines', 'All Shifts', 'ACTIVE'),
  ('operator', 'Operator@123', 'Line 2 Operator', 'OPERATOR', 'Line 2', 'Shift 1', 'ACTIVE'),
  ('supervisor', 'Super@123', 'Line Supervisor', 'SUPERVISOR', 'Line 2', 'Shift 2', 'ACTIVE'),
  ('quality', 'Quality@123', 'Quality Assurance Inspector', 'QUALITY_INSPECTOR', 'Line 1', 'Shift 1', 'ACTIVE');
