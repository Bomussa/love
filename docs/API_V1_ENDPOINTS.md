# API v1 Endpoints

## Admin
- `POST /api/v1/admin/login`
- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users`
- `PATCH /api/v1/admin/users/:id`
- `DELETE /api/v1/admin/users/:id`

## Clinics
- `GET /api/v1/clinics`
- `POST /api/v1/clinics`
- `PATCH /api/v1/clinics/:id`
- `DELETE /api/v1/clinics/:id`
- `GET /api/v1/clinics/:id/pin`

## Queue
- `GET /api/v1/queue/:clinicId`
- `POST /api/v1/queue/join`
- `GET /api/v1/queue/status/:clinicId/:patientId`
- `POST /api/v1/queue/position` (Body: `clinicId`, `patientId` أو `sessionId`)
- `POST /api/v1/queue/call-next/:clinicId`
- `POST /api/v1/queue/priority-call`
- `POST /api/v1/queue/complete-current/:clinicId`
- `POST /api/v1/queue/move-to-end`
- `DELETE /api/v1/queue/:id`

## Reports
- `GET /api/v1/reports/daily`
- `GET /api/v1/reports/custom`

## Settings
- `GET /api/v1/settings`
- `POST /api/v1/settings`

## Patients
- `GET /api/v1/patients/search`
- `GET /api/v1/patients/:id`
- `POST /api/v1/patients`
- `PATCH /api/v1/patients/:id`

## Events
- `GET /api/v1/events`
- `POST /api/v1/events`

## Notifications
- `GET /api/v1/notifications`
- `POST /api/v1/notifications/mark-read`

## Health Check
- `GET /api/v1/health`


## PIN
- `POST /functions/v1/pin-generate` (body: `clinic_id`)
- `POST /functions/v1/pin-verify` (body: `clinic_id`, `pin`)
- `POST /rpc/verify_clinic_pin` (params: `p_clinic_id`, `p_pin`)

> ملاحظة: العمود المعياري في جدول `pins` هو `clinic_id` وليس `clinic_code`.
