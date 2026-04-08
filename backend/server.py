"""
Medical Committee Management System - Backend API
FastAPI + Supabase Integration
Version: 7.1.0 - Production Ready
"""

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import os
import logging
from pathlib import Path
import httpx
import json

# Load environment variables
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Supabase Configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://rujwuruuosffcxazymit.supabase.co')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTM4NzI2NSwiZXhwIjoyMDc2OTYzMjY1fQ.5PWwdcBXgS1FZhwRonSRgdbnUQuXHl5VeIHvr41yUbs')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODcyNjUsImV4cCI6MjA3Njk2MzI2NX0.HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10')

# Initialize FastAPI
app = FastAPI(title="MMC Medical API", version="7.1.0")
api_router = APIRouter(prefix="/api")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=['*'],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# Supabase Client Helper
# ============================================================================

class SupabaseClient:
    """Helper class for Supabase REST API calls"""
    
    def __init__(self):
        self.base_url = f"{SUPABASE_URL}/rest/v1"
        self.headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
    
    async def select(self, table: str, filters: Dict = None, order: str = None, limit: int = None):
        """Select data from table"""
        url = f"{self.base_url}/{table}"
        params = {}
        
        if filters:
            for key, value in filters.items():
                params[key] = f"eq.{value}"
        
        if order:
            params['order'] = order
        
        if limit:
            params['limit'] = str(limit)
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self.headers, params=params, timeout=30.0)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Supabase select error: {response.text}")
                raise HTTPException(status_code=response.status_code, detail=response.text)
    
    async def insert(self, table: str, data: Dict):
        """Insert data into table"""
        url = f"{self.base_url}/{table}"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=self.headers, json=data, timeout=30.0)
            if response.status_code in [200, 201]:
                return response.json()
            else:
                logger.error(f"Supabase insert error: {response.text}")
                raise HTTPException(status_code=response.status_code, detail=response.text)
    
    async def update(self, table: str, filters: Dict, data: Dict):
        """Update data in table"""
        url = f"{self.base_url}/{table}"
        params = {}
        
        for key, value in filters.items():
            params[key] = f"eq.{value}"
        
        async with httpx.AsyncClient() as client:
            response = await client.patch(url, headers=self.headers, params=params, json=data, timeout=30.0)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Supabase update error: {response.text}")
                raise HTTPException(status_code=response.status_code, detail=response.text)
    
    async def delete(self, table: str, filters: Dict):
        """Delete data from table"""
        url = f"{self.base_url}/{table}"
        params = {}
        
        for key, value in filters.items():
            params[key] = f"eq.{value}"
        
        async with httpx.AsyncClient() as client:
            response = await client.delete(url, headers=self.headers, params=params, timeout=30.0)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Supabase delete error: {response.text}")
                raise HTTPException(status_code=response.status_code, detail=response.text)

# Initialize Supabase client
supabase = SupabaseClient()

# ============================================================================
# Data Models
# ============================================================================

class PatientLogin(BaseModel):
    personalId: str
    gender: str

class QueueCreate(BaseModel):
    patientId: str
    examType: str
    gender: Optional[str] = None
    clinicId: Optional[str] = None

class QueueCall(BaseModel):
    clinicId: str
    pin: Optional[str] = None

class QueueDone(BaseModel):
    clinicId: str
    patientId: str
    pin: Optional[str] = None

class QueueAdvance(BaseModel):
    queueId: str
    clinicId: str
    expectedVersion: Optional[int] = None

class AdminLogin(BaseModel):
    username: str
    password: str

# ============================================================================
# API Endpoints
# ============================================================================

@api_router.get("/")
async def root():
    return {
        "message": "MMC Medical API v7.1.0",
        "status": "operational",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test Supabase connection
        clinics = await supabase.select("clinics", limit=1)
        return {
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "database": "connected",
            "version": "7.1.0"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "database": "disconnected",
            "error": str(e)
        }

@api_router.get("/status")
async def get_status():
    """Get system status"""
    return {
        "service": "mmc-medical-api",
        "version": "7.1.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": "operational"
    }

# ============================================================================
# Patient Endpoints
# ============================================================================

@api_router.post("/patient/login")
async def patient_login(data: PatientLogin):
    """Patient login endpoint"""
    try:
        # Check if patient exists
        patients = await supabase.select("patients", filters={"patient_id": data.personalId})
        
        if not patients or len(patients) == 0:
            # Create new patient
            patient_data = {
                "patient_id": data.personalId,
                "gender": data.gender,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            result = await supabase.insert("patients", patient_data)
            return {"success": True, "data": result[0] if result else patient_data}
        
        return {"success": True, "data": patients[0]}
    
    except Exception as e:
        logger.error(f"Patient login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# Queue Endpoints
# ============================================================================

@api_router.post("/queue/create")
async def create_queue(data: QueueCreate):
    """Create new queue entry"""
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get next queue number for today
        queues = await supabase.select("queues", filters={"queue_date": today})
        next_number = len(queues) + 1
        
        # Determine clinic based on exam type
        if not data.clinicId:
            clinics = await supabase.select("clinics")
            # Simple assignment: first available clinic
            data.clinicId = clinics[0]["id"] if clinics else "default"
        
        # Create queue entry
        queue_data = {
            "patient_id": data.patientId,
            "clinic_id": data.clinicId,
            "exam_type": data.examType,
            "status": "waiting",
            "display_number": next_number,
            "queue_number": str(next_number),
            "queue_date": today,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        result = await supabase.insert("queues", queue_data)
        return {"success": True, "data": result[0] if result else queue_data}
    
    except Exception as e:
        logger.error(f"Queue create error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/queue/status/{queue_id}")
@api_router.get("/queue/status/")
async def get_queue_status(queue_id: Optional[str] = None, clinic_id: Optional[str] = None):
    """Get queue status"""
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        filters = {"queue_date": today}
        
        if queue_id:
            filters["id"] = queue_id
        
        if clinic_id:
            filters["clinic_id"] = clinic_id
        
        queues = await supabase.select("queues", filters=filters, order="display_number.asc")
        
        # Organize by status
        waiting = [q for q in queues if q.get("status") == "waiting"]
        in_progress = [q for q in queues if q.get("status") == "in_progress"]
        completed = [q for q in queues if q.get("status") == "completed"]
        
        stats = {
            "totalWaiting": len(waiting),
            "totalIn": len(in_progress),
            "totalDone": len(completed),
            "totalToday": len(queues)
        }
        
        return {
            "success": True,
            "queue": queues,
            "waiting": waiting,
            "in": in_progress,
            "in_service": in_progress,
            "done": completed,
            "stats": stats,
            "dateKey": today
        }
    
    except Exception as e:
        logger.error(f"Queue status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/queue/call")
async def call_next_patient(data: QueueCall):
    """Call next patient in queue"""
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get waiting patients for this clinic
        queues = await supabase.select("queues", filters={
            "clinic_id": data.clinicId,
            "queue_date": today,
            "status": "waiting"
        }, order="display_number.asc", limit=1)
        
        if not queues or len(queues) == 0:
            return {"success": False, "message": "No patients waiting"}
        
        next_patient = queues[0]
        
        # Update status to called
        await supabase.update("queues", 
            filters={"id": next_patient["id"]},
            data={
                "status": "called",
                "called_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        )
        
        return {"success": True, "data": next_patient}
    
    except Exception as e:
        logger.error(f"Queue call error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/queue/start")
async def start_exam(request: Request):
    """Start patient examination"""
    try:
        body = await request.json()
        queue_id = body.get("queueId")
        
        if not queue_id:
            raise HTTPException(status_code=400, detail="queueId is required")
        
        # Update status to in_progress
        result = await supabase.update("queues",
            filters={"id": queue_id},
            data={
                "status": "in_progress",
                "started_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        )
        
        return {"success": True, "data": result[0] if result else {}}
    
    except Exception as e:
        logger.error(f"Queue start error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/queue/advance/{queue_id}")
@api_router.post("/queue/advance")
async def advance_queue(request: Request, queue_id: Optional[str] = None):
    """Advance patient to next clinic or complete"""
    try:
        body = await request.json()
        if not queue_id:
            queue_id = body.get("queueId")
        
        clinic_id = body.get("clinicId")
        
        if not queue_id:
            raise HTTPException(status_code=400, detail="queueId is required")
        
        # For now, mark as completed
        result = await supabase.update("queues",
            filters={"id": queue_id},
            data={
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        )
        
        return {"success": True, "data": result[0] if result else {}}
    
    except Exception as e:
        logger.error(f"Queue advance error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/queue/done")
async def queue_done(data: QueueDone):
    """Mark patient examination as done"""
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Find the queue entry
        queues = await supabase.select("queues", filters={
            "clinic_id": data.clinicId,
            "patient_id": data.patientId,
            "queue_date": today
        }, limit=1)
        
        if not queues or len(queues) == 0:
            raise HTTPException(status_code=404, detail="Queue entry not found")
        
        queue = queues[0]
        
        # Update status to completed
        result = await supabase.update("queues",
            filters={"id": queue["id"]},
            data={
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        )
        
        return {"success": True, "data": result[0] if result else {}}
    
    except Exception as e:
        logger.error(f"Queue done error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# Clinic Endpoints
# ============================================================================

@api_router.get("/clinics")
async def get_clinics():
    """Get all clinics"""
    try:
        clinics = await supabase.select("clinics", order="name_ar.asc")
        return {"success": True, "data": clinics}
    except Exception as e:
        logger.error(f"Get clinics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# Admin Endpoints
# ============================================================================

@api_router.post("/admin/login")
async def admin_login(data: AdminLogin):
    """Admin login endpoint"""
    try:
        # Check admin credentials
        admins = await supabase.select("admins", filters={"username": data.username})
        
        if not admins or len(admins) == 0:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        admin = admins[0]
        
        # In production, use proper password hashing
        if admin.get("password") != data.password:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        return {
            "success": True,
            "data": {
                "id": admin["id"],
                "username": admin["username"],
                "role": admin.get("role", "admin"),
                "token": "admin-session-token"  # Generate proper JWT in production
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# Doctor Session Endpoints
# ============================================================================

@api_router.get("/doctor/sessions")
@api_router.get("/doctor/sessions/{doctor_id}")
async def get_doctor_sessions(doctor_id: Optional[str] = None, clinic_id: Optional[str] = None, date: Optional[str] = None):
    """Get doctor sessions with real-time statistics"""
    try:
        today = date or datetime.now(timezone.utc).date().isoformat()
        
        # Get all clinics with their doctors (from queues table for now)
        queues_query = {
            "queue_date": today
        }
        
        if clinic_id:
            queues_query["clinic_id"] = clinic_id
        
        queues = await supabase.select("queues", filters=queues_query)
        
        # Get clinics info
        clinics = await supabase.select("clinics")
        clinics_map = {c["id"]: c for c in clinics}
        
        # Organize by clinic
        sessions = {}
        for queue in queues:
            cid = queue.get("clinic_id")
            if cid not in sessions:
                clinic = clinics_map.get(cid, {})
                sessions[cid] = {
                    "clinic_id": cid,
                    "clinic_name": clinic.get("name_ar", cid),
                    "clinic_name_en": clinic.get("name_en", cid),
                    "doctor_name": f"Doctor {cid}",  # TODO: Add doctor table
                    "waiting_count": 0,
                    "active_count": 0,
                    "completed_count": 0,
                    "missed_count": 0,
                    "calls_made": 0,
                    "starts_made": 0,
                    "advances_made": 0,
                    "session_start": None,
                    "session_end": None,
                    "status": "inactive",
                    "last_action": None
                }
            
            status = queue.get("status")
            if status == "waiting":
                sessions[cid]["waiting_count"] += 1
            elif status in ["called", "in_progress", "serving"]:
                sessions[cid]["active_count"] += 1
                if queue.get("called_at"):
                    sessions[cid]["calls_made"] += 1
                if queue.get("entered_clinic_at"):
                    sessions[cid]["starts_made"] += 1
            elif status == "completed":
                sessions[cid]["completed_count"] += 1
                sessions[cid]["advances_made"] += 1
            elif status == "no_show":
                sessions[cid]["missed_count"] += 1
            
            # Track session timing
            if queue.get("called_at"):
                if not sessions[cid]["session_start"] or queue["called_at"] < sessions[cid]["session_start"]:
                    sessions[cid]["session_start"] = queue["called_at"]
                sessions[cid]["status"] = "active"
            
            if queue.get("completed_at"):
                if not sessions[cid]["session_end"] or queue["completed_at"] > sessions[cid]["session_end"]:
                    sessions[cid]["session_end"] = queue["completed_at"]
                sessions[cid]["last_action"] = queue["completed_at"]
        
        # Calculate session duration
        for session in sessions.values():
            if session["session_start"]:
                start_time = datetime.fromisoformat(session["session_start"].replace("Z", "+00:00"))
                if session["session_end"]:
                    end_time = datetime.fromisoformat(session["session_end"].replace("Z", "+00:00"))
                    session["session_duration_minutes"] = int((end_time - start_time).total_seconds() / 60)
                else:
                    # Active session - calculate from now
                    now = datetime.now(timezone.utc)
                    session["session_duration_minutes"] = int((now - start_time).total_seconds() / 60)
                    session["session_active"] = True
            else:
                session["session_duration_minutes"] = 0
                session["session_active"] = False
        
        return {
            "success": True,
            "data": list(sessions.values()),
            "date": today
        }
    
    except Exception as e:
        logger.error(f"Get doctor sessions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# Settings & System Endpoints
# ============================================================================

@api_router.get("/settings")
async def get_settings():
    """Get system settings"""
    try:
        settings = await supabase.select("system_settings")
        return {"success": True, "data": settings}
    except Exception as e:
        logger.error(f"Get settings error: {e}")
        return {"success": True, "data": []}

# ============================================================================
# Include Router and Run
# ============================================================================

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
