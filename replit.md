# Overview

MMC-MMS (Military Medical Committee Management System) is a comprehensive queue management system designed for military medical facilities. The system manages patient flow through multiple clinics, handles dynamic routing based on examination types, and provides real-time notifications and reporting capabilities.

The application serves both patients and administrative staff, offering features like PIN-based authentication, queue position tracking, clinic management, and comprehensive reporting. It's deployed on Vercel with a Supabase PostgreSQL backend.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend is built with **React 18 + Vite**, utilizing a modern component-based architecture:

- **Build Tool**: Vite 5.x for fast development and optimized production builds
- **UI Framework**: React with shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theming supporting multiple color schemes
- **State Management**: React Context API for global state, local component state for UI
- **Routing**: Single-page application pattern with conditional rendering
- **Internationalization**: RTL (Right-to-Left) support for Arabic with English fallbacks

The frontend follows a component-driven design with reusable UI components in `frontend/src/components/ui/` and page-level components for different views (patient portal, admin dashboard, clinic displays).

## Backend Architecture

The backend uses a **serverless architecture** on Vercel:

- **API Layer**: Vercel Serverless Functions (Node.js) in the `/api` directory
- **Main Router**: `/api/index.js` handles all `/api/*` requests and routes to appropriate handlers
- **API Version**: All endpoints follow `/api/v1/*` convention
- **Response Format**: Standardized JSON responses with success/error patterns
- **CORS**: Configured for cross-origin requests with appropriate headers

Key architectural decisions:
- **Serverless Functions**: Chosen for automatic scaling and reduced infrastructure management
- **Centralized Routing**: Single entry point (`api/index.js`) simplifies request handling and middleware application
- **Stateless Design**: Each request is independent, relying on database state rather than server memory

## Data Storage

**Supabase PostgreSQL** serves as the primary database:

- **Database**: PostgreSQL hosted on Supabase
- **Schema**: 30+ tables covering patients, queues, clinics, routes, PINs, and audit logs
- **Security**: Row Level Security (RLS) policies protect sensitive data
- **Real-time**: Supabase Realtime for live queue updates
- **Client**: `@supabase/supabase-js` client library for database operations

The system uses a hybrid storage approach:
- **Permanent Storage**: Supabase for all persistent data (patients, queues, clinics, etc.)
- **KV-like Interface**: `SupabaseKV` class in `lib/supabase-enhanced.js` provides key-value storage abstraction over Supabase tables
- **Local Fallback**: Local storage in browser for offline capabilities

Database design rationale:
- Supabase chosen for managed PostgreSQL with built-in authentication, real-time subscriptions, and REST API
- RLS policies ensure data isolation and security at the database level
- Normalized schema with separate tables for different entities (patients, queues, clinics) for data integrity

## Authentication & Authorization

**Dual authentication system**:

1. **Patient Authentication**: 
   - Personal ID + Gender verification
   - Session-based (24-hour expiry)
   - PIN verification for clinic access

2. **Admin Authentication**:
   - Supabase Auth for admin users
   - JWT tokens for API authentication
   - Role-based access control

Security features:
- Rate limiting (100 requests/minute per IP)
- Input validation for all user inputs
- CORS headers with origin whitelisting
- Session management with secure tokens

## Key Business Logic

### Dynamic Routing System

Located in `lib/routing.js`, this system determines the optimal clinic path for each patient:

- **Route Mapping**: Different examination types (recruitment, promotion, transfer, etc.) have predefined clinic sequences
- **Gender-Specific Routes**: Male and female patients follow different paths for certain examinations
- **Weight-Based Selection**: Clinics are prioritized based on queue length and capacity using a scoring algorithm
- **Load Balancing**: Empty clinics receive highest priority to distribute patient load

Rationale: Dynamic routing reduces wait times by directing patients to less crowded clinics while maintaining medical workflow requirements.

### PIN System

Managed in `lib/helpers-enhanced.js` and related endpoints:

- **Generation**: 2-digit PINs (01-99) generated per clinic per patient
- **Expiration**: PINs expire after 5 minutes of non-use
- **Validation**: Strict verification before allowing clinic entry
- **Anti-Duplication**: Lock mechanism prevents duplicate PIN generation

Design choice: Short expiration ensures timely patient flow while preventing queue jumping.

### Queue Management

Core queue logic handles patient progression through clinics:

- **Status Tracking**: waiting → called → in-service → completed
- **Position Management**: Automatic position updates as queue progresses
- **Real-time Updates**: Server-Sent Events (SSE) notify displays of queue changes
- **Conflict Prevention**: Lock manager (`lib/lock-manager.js`) prevents race conditions

Architecture decision: SSE chosen over WebSockets for simpler unidirectional updates from server to clients.

## API Structure

RESTful API with versioned endpoints:

- `/api/v1/patient/*` - Patient operations (login, status, queue joining)
- `/api/v1/queue/*` - Queue management (status, updates, SSE stream)
- `/api/v1/pin/*` - PIN generation and validation
- `/api/v1/clinic/*` - Clinic information and management
- `/api/v1/admin/*` - Administrative operations
- `/api/v1/reports/*` - Reporting and analytics
- `/api/v1/stats/*` - Dashboard statistics

Endpoints follow consistent patterns:
- GET for retrieval
- POST for creation
- PUT for updates
- DELETE for removal
- OPTIONS for CORS preflight

## Deployment Architecture

**Production Environment**:
- **Frontend Hosting**: Vercel Edge Network (CDN)
- **API Hosting**: Vercel Serverless Functions
- **Database**: Supabase Cloud (PostgreSQL)
- **Domain**: Custom domain with SSL/TLS

**Development Environment**:
- **Frontend**: Vite dev server on port 5000
- **API Proxy**: Express server (`server.js`) proxies API requests locally
- **Database**: Same Supabase instance (development isolation via environment variables)

Build process:
1. Frontend builds to `frontend/dist/` via Vite
2. Vercel deploys static assets to CDN
3. API functions deployed as serverless endpoints
4. Environment variables injected at runtime

# External Dependencies

## Third-Party Services

### Supabase
- **Purpose**: PostgreSQL database, authentication, and real-time subscriptions
- **Integration**: `@supabase/supabase-js` client library
- **Configuration**: Environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- **Tables**: 30+ tables including patients, queue, clinics, routes, pins, audit logs
- **Features Used**: Database, Auth, Realtime subscriptions, Row Level Security

### Vercel
- **Purpose**: Frontend hosting and serverless API deployment
- **Platform**: Vercel Edge Network for CDN and serverless functions
- **Configuration**: `vercel.json` for build settings, rewrites, and headers
- **Environment**: Production and preview deployments with environment variable management

## NPM Dependencies

### Frontend Core
- `react` & `react-dom` (18.x) - UI framework
- `vite` (5.x) - Build tool and dev server
- `@vitejs/plugin-react` - React integration for Vite

### UI Components
- `@radix-ui/*` - Headless UI components (dialog, select, tabs, toast, etc.)
- `lucide-react` - Icon library
- `tailwindcss` - Utility-first CSS framework
- `tailwindcss-animate` - Animation utilities
- `class-variance-authority` & `clsx` - Conditional class composition

### API & Data
- `@supabase/supabase-js` - Supabase client
- `axios` - HTTP client (used in some components)
- `date-fns` - Date manipulation utilities

### Backend Runtime
- `@vercel/node` - Vercel serverless function helpers
- `express` - Local development server
- `cors` - CORS middleware
- `helmet` - Security headers middleware
- `dotenv` - Environment variable management

### Utilities
- `qrcode` - QR code generation (for patient access)
- `ws` - WebSocket support (for real-time features)

## Database Schema

The Supabase PostgreSQL database contains:

**Core Tables**:
- `patients` - Patient records with RLS
- `queue` - Active queue entries with status tracking
- `clinics` - Clinic configuration and metadata
- `routes` - Examination type definitions
- `route_steps` - Individual clinic steps in routes

**Management Tables**:
- `admins` - Administrator accounts
- `clinic_pins` - PIN records per clinic
- `clinic_counters` - Queue numbering per clinic
- `clinic_queue_reservations` - Reserved queue slots

**Audit & Backup**:
- `queue_audit` - Audit trail for queue changes
- `queue_backup_*` - Periodic queue backups
- `queue_pending` - Pending queue entries
- `queue_resettle` - Queue reorganization records

All tables use RLS policies for row-level security, ensuring users can only access data they're authorized to see.

## Environment Variables

Required environment variables:

**Supabase**:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Public anon key for client-side access
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations

**Database** (Direct PostgreSQL access):
- `POSTGRES_URL` - Full database connection string
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_DATABASE` - Connection components

**Application**:
- `VITE_API_BASE_URL` - Base URL for API requests
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` - Client-side Supabase configuration
- `API_ORIGIN` - Origin for API requests

All sensitive keys are stored in Vercel environment variables and never committed to version control.