# HostelConnect

HostelConnect is a full-stack hostel management system with role-based modules for Student, Warden, Admin, Technician, and Security users.

This file is the single source of project documentation.

## Tech Stack

- Frontend: React + Vite
- Backend: Flask (Python)
- Database: MySQL

## Project Structure

```text
hostel/
	backend/
		app.py
		database_schema.sql
		setup_database.py
		seed_optional_data.py
		apply_holiday_mode_migration.py
		requirements.txt
	frontend/
		src/
		package.json
```

## Core Features

- Authentication and role-based access
- Student flows: leave, outpass, complaints, room, mess, parcels
- Warden operations: approvals, monitoring, student management
- Admin operations: users, wardens, students, reports, configuration
- Technician workflows: assignments and task history
- Security workflows: gate, parcels, visitors, logs
- Agentic monitoring support (complaint/leave/outpass/security)

## Feature Catalog

### Authentication and Access Control

- Role-based login for student, warden, admin, technician, and security users
- Protected route access based on role
- Password change support from user-facing modules
- Session-based client auth flow with role-aware dashboard redirection

### Student Module

- Outpass request submission and status tracking
- Leave request submission with calendar/history view
- Complaint creation and complaint progress tracking
- Mess menu viewing by day and meal type
- Parcel status view for waiting and collected parcels
- Room details and hostel assignment visibility
- Student dashboard with summary cards and recent activity

### Warden Module

- Outpass approval and rejection workflow
- Leave approval and rejection workflow
- Registration review and status handling
- Complaint supervision and operational follow-up
- Room and room-change management screens
- Technician coordination screens
- Warden dashboard with operational metrics
- Agentic alert views for monitoring exceptions

### Admin Module

- Central user management across roles
- Dedicated management pages for students, wardens, technicians, and security staff
- Registration oversight and status filtering
- Hostel block management and allocation-related administration
- Reports and dashboard summaries
- Security and system-level administrative controls

### Technician Module

- Assigned task list for active complaint work
- Task history and completion tracking
- Technician dashboard summary views

### Security Module

- Outpass gate-level verification and handling
- Visitor registration and entry/exit tracking
- Parcel logging and handover monitoring
- Daily logs and security activity tracking

### Agentic Monitoring and Alerts

- Complaint monitoring with alert tables and escalation fields
- Leave monitoring with alert generation support
- Outpass monitoring fields for overdue/grace/risk behavior
- Security risk profile and autonomous security alert structures
- Audit log table for sensitive action trail recording

### Database and Setup Utilities

- Consolidated schema definition in `backend/database_schema.sql`
- One-command schema application script
- Separate optional data seeding script for non-structural defaults
- Holiday mode/OTP schema verification helper script

## Module Workflows

### Authentication Workflow

1. User opens login page and selects role context (student/staff path via identifier).
2. Credentials are submitted to backend login API.
3. Backend validates user, role, and status.
4. Frontend stores authenticated user context.
5. User is redirected to role-specific dashboard.

### Student Workflow

1. Student logs in and lands on student dashboard.
2. Student chooses a module: outpass, leave, complaints, mess, parcels, or room.
3. Student submits requests (outpass/leave/complaint) with required details.
4. Backend stores request and updates status lifecycle.
5. Student tracks status/history from module pages and dashboard widgets.

### Warden Workflow

1. Warden logs in and views operational dashboard.
2. Warden reviews pending queues: registrations, outpasses, leaves, complaints.
3. Warden opens a request, verifies context, and approves/rejects/escalates.
4. Backend updates status, timestamps, and related monitoring fields.
5. Students and dashboards reflect updated decisions in real time via refresh.

### Admin Workflow

1. Admin logs in to centralized management area.
2. Admin navigates to entity pages (users, wardens, students, technicians, security, reports).
3. Admin performs create/update/status actions.
4. Backend persists role-specific data and cross-table updates.
5. Admin verifies changes via filtered tables and dashboard summaries.

### Technician Workflow

1. Technician logs in and opens assigned task list.
2. Technician reviews complaint details and priority.
3. Technician updates progress/status notes while working.
4. Backend records timeline and resolution updates.
5. Completed tasks move to history and feed operational analytics.

### Security Workflow

1. Security user logs in and accesses gate operations modules.
2. Security validates outpass movement, visitor entries, and parcel handling.
3. Security logs events/incidents and captures required metadata.
4. Backend updates security logs and linked request states.
5. Alerts and risk indicators surface in dashboards when thresholds trigger.

### Agentic Monitoring Workflow

1. System evaluates complaint/leave/outpass/security records on schedule or event.
2. Rule conditions detect anomalies, delays, or risk patterns.
3. Alert rows are created in corresponding agentic alert tables.
4. Warden/Admin/Security views consume and act on generated alerts.
5. Follow-up actions resolve alert status and improve monitoring state.

### Setup and Data Workflow

1. Run schema setup to create full database structure.
2. Optionally run seed script for mess menu and room amenity defaults.
3. Start backend and frontend services.
4. Authenticate and operate modules by role.
5. Maintain schema consistency from consolidated schema file.

## Database Model

- Main schema file: `backend/database_schema.sql`
- The schema has been consolidated to include migration end-state structural changes.
- Demo/sample insert data has been removed from main schema.

### Optional Seed Data

Use `backend/seed_optional_data.py` to populate non-structural defaults:

- default room amenities (for empty amenity fields)
- weekly mess menu baseline

## Local Setup

### 1) Backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2) Frontend dependencies

```bash
cd frontend
npm install
```

### 3) Create database and apply schema

Run from repository root:

```bash
python backend/setup_database.py
```

If your MySQL database name differs, update database settings in backend scripts/config first.

### 4) (Optional) Seed default non-structural data

```bash
python backend/seed_optional_data.py
```

### 5) Start backend

```bash
cd backend
python app.py
```

Backend default URL: `http://localhost:5000`

### 6) Start frontend

```bash
cd frontend
npm run dev
```

Frontend default URL: `http://localhost:5173`

## Important Scripts

- `backend/setup_database.py`: applies consolidated schema
- `backend/seed_optional_data.py`: optional data seeding
- `backend/app.py`: main API server
- `backend/apply_holiday_mode_migration.py`: schema verifier for holiday mode OTP objects

## Notes

- Migrations were consolidated into the main schema for fresh setups.
- Keep backups before applying schema changes in production environments.
- Use environment-specific MySQL credentials rather than hardcoding for deployment.
