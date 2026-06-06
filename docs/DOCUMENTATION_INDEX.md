# Documentation Index (The Map of Truth)

This index defines the official hierarchy of documentation. If a file is not listed here as "Canonical", it should be treated as "Historical" or "Deprecated".

## 1. Canonical References (Source of Truth)
| Document | Purpose | Authority |
| :--- | :--- | :--- |
| [README.md](../README.md) | High-level project overview and setup. | 100% |
| [FULL_SYSTEM_GUIDE.md](FULL_SYSTEM_GUIDE.md) | Complete technical logic and flow description. | 100% |
| [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) | Diagnostics, troubleshooting, and recovery. | 100% |
| [BACKEND_OPERATIONS_GUIDE.md](../../love-api/BACKEND_OPERATIONS_GUIDE.md) | API, Database, and Edge Function internals. | 100% |

## 2. API & Integration Map
| Path | Screen | Functionality |
| :--- | :--- | :--- |
| `/api/v1/patient/login` | `LoginPage.jsx` | Patient authentication. |
| `/api/v1/queue/enter` | `ExamSelectionPage.jsx` | Enrolling in a medical pathway. |
| `/api/v1/queue/status` | `PatientPage.jsx` | Live queue position tracking. |
| `/api/v1/queue/call` | `DoctorDashboard.jsx` | Calling next patient (Doctor action). |
| `/api/v1/admin/login` | `ClinicLoginPage.jsx` | Admin/Clinic authentication. |

## 3. Deprecated / Historical (Do Not Use)
The following files are preserved for historical context but **do not reflect live system behavior**:
- `PIN_VALIDATION_FIX.md` (Superseded by persistent login)
- `ISSUE-PIN-LEAK.md` (Superseded by JWT-based security)
- `FINAL_SUMMARY.md` (Historical delivery report)
- `COMPLETE_PROJECT_REPORT.md` (Historical status)
- `docs/API_INTEGRATION_COMPLETE.md` (Old architecture)

## 4. Maintenance Rule
Any update to the system logic **MUST** be reflected in the Canonical documents first. If there is a conflict between a "Historical" file and a "Canonical" file, the Canonical file is always correct.
