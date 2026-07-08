from flask import Flask, request, jsonify, g
from flask_cors import CORS
import mysql.connector
from flask import Flask, request, jsonify, g
from flask_cors import CORS
import mysql.connector
from werkzeug.security import check_password_hash, generate_password_hash
from datetime import datetime, date, time, timedelta
from functools import wraps
import os
import json
import logging
import base64
import smtplib
import hashlib
import hmac
import secrets
import threading
import time as time_module
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from google.oauth2.service_account import Credentials
from google.auth.transport.requests import Request
from google.oauth2 import service_account
from googleapiclient.discovery import build

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO').upper()
if not app.logger.handlers:
    logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO))
app.logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))

# Email Configuration - Support both SMTP and Gmail API
USE_SMTP = os.getenv('EMAIL_USE_SMTP', 'true').lower() == 'true'

if USE_SMTP:
    # SMTP Configuration (Recommended)
    SMTP_CONFIG = {
        'smtp_server': os.getenv('SMTP_SERVER', 'smtp.gmail.com'),
        'smtp_port': int(os.getenv('SMTP_PORT', 587)),
        'sender_email': os.getenv('SENDER_EMAIL', 'noreply@example.com'),
        'sender_password': os.getenv('SENDER_PASSWORD', ''),
        'use_tls': True
    }
    print("Email mode: SMTP")
    print(f"Sender email: {SMTP_CONFIG['sender_email']}")
else:
    # Gmail API Configuration (OAuth2)
    CLIENT_SECRET_FILE = os.getenv(
        'CLIENT_SECRET_FILE',
        os.path.join(os.path.dirname(__file__), 'client_secret.json')
    )
    SENDER_EMAIL = os.getenv('SENDER_EMAIL', 'noreply@example.com')
    SCOPES = ['https://www.googleapis.com/auth/gmail.send']
    print("Email mode: Gmail API")

def get_gmail_service():
    """Get authenticated Gmail API service"""
    try:
        credentials = service_account.Credentials.from_service_account_file(
            CLIENT_SECRET_FILE, scopes=SCOPES)
        service = build('gmail', 'v1', credentials=credentials)
        return service
    except Exception as e:
        print(f"Error creating Gmail service: {str(e)}")
        return None

# MySQL Configuration
app.config['MYSQL_HOST'] = os.getenv('MYSQL_HOST', 'localhost')
app.config['MYSQL_USER'] = os.getenv('MYSQL_USER', 'root')
app.config['MYSQL_PASSWORD'] = os.getenv('MYSQL_PASSWORD', os.getenv('DB_PASSWORD', ''))
app.config['MYSQL_DB'] = os.getenv('MYSQL_DB', os.getenv('DB_NAME', 'hostelconnect_db'))

# File Upload Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'uploaded_files')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB max file size
ALLOWED_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png', 'gif', 'doc', 'docx'}

OUTPASS_GRACE_MINUTES = int(os.getenv('OUTPASS_GRACE_MINUTES', '30'))
OUTPASS_MONITOR_INTERVAL_SECONDS = int(os.getenv('OUTPASS_MONITOR_INTERVAL_SECONDS', '60'))
OUTPASS_MONITOR_ENABLED = os.getenv('OUTPASS_MONITOR_ENABLED', 'true').lower() == 'true'
OUTPASS_MONITOR_THREAD_STARTED = False

COMPLAINT_MONITOR_INTERVAL_SECONDS = int(os.getenv('COMPLAINT_MONITOR_INTERVAL_SECONDS', '60'))
COMPLAINT_MONITOR_ENABLED = os.getenv('COMPLAINT_MONITOR_ENABLED', 'true').lower() == 'true'
COMPLAINT_MONITOR_THREAD_STARTED = False
COMPLAINT_ASSIGNMENT_SLA_HOURS = int(os.getenv('COMPLAINT_ASSIGNMENT_SLA_HOURS', '2'))
COMPLAINT_DELAY_HOURS = int(os.getenv('COMPLAINT_DELAY_HOURS', '24'))
COMPLAINT_ESCALATION_HOURS = int(os.getenv('COMPLAINT_ESCALATION_HOURS', '48'))
COMPLAINT_TECH_REMINDER_HOURS = int(os.getenv('COMPLAINT_TECH_REMINDER_HOURS', '4'))

LEAVE_MONITOR_INTERVAL_SECONDS = int(os.getenv('LEAVE_MONITOR_INTERVAL_SECONDS', '60'))
LEAVE_MONITOR_ENABLED = os.getenv('LEAVE_MONITOR_ENABLED', 'true').lower() == 'true'
LEAVE_MONITOR_THREAD_STARTED = False
LEAVE_PENDING_SLA_HOURS = int(os.getenv('LEAVE_PENDING_SLA_HOURS', '6'))
LEAVE_LIMIT_30_DAYS = int(os.getenv('LEAVE_LIMIT_30_DAYS', '5'))

SECURITY_MONITOR_INTERVAL_SECONDS = int(os.getenv('SECURITY_MONITOR_INTERVAL_SECONDS', '60'))
SECURITY_MONITOR_ENABLED = os.getenv('SECURITY_MONITOR_ENABLED', 'true').lower() == 'true'
SECURITY_MONITOR_THREAD_STARTED = False
SECURITY_RESTRICTED_START_HOUR = int(os.getenv('SECURITY_RESTRICTED_START_HOUR', '22'))
SECURITY_RESTRICTED_END_HOUR = int(os.getenv('SECURITY_RESTRICTED_END_HOUR', '6'))
SECURITY_RISK_MEDIUM_THRESHOLD = int(os.getenv('SECURITY_RISK_MEDIUM_THRESHOLD', '35'))
SECURITY_RISK_HIGH_THRESHOLD = int(os.getenv('SECURITY_RISK_HIGH_THRESHOLD', '70'))

LOGIN_MAX_ATTEMPTS = int(os.getenv('LOGIN_MAX_ATTEMPTS', '5'))
LOGIN_LOCKOUT_MINUTES = int(os.getenv('LOGIN_LOCKOUT_MINUTES', '3'))
LOGIN_TRACKING_WINDOW_MINUTES = int(os.getenv('LOGIN_TRACKING_WINDOW_MINUTES', '15'))
LOGIN_ATTEMPT_STATE = {}
LOGIN_ATTEMPT_LOCK = threading.Lock()

ROLE_ROUTE_PREFIXES = {
    '/api/admin/': 'admin',
    '/api/warden/': 'warden',
    '/api/security/': 'security',
    '/api/technician/': 'technician'
}

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _cleanup_login_attempts(now):
    """Drop stale login attempt records from memory."""
    stale_cutoff = now - timedelta(minutes=LOGIN_TRACKING_WINDOW_MINUTES)
    stale_keys = [
        key for key, value in LOGIN_ATTEMPT_STATE.items()
        if value.get('last_attempt_at', now) < stale_cutoff and value.get('locked_until', now) < now
    ]
    for key in stale_keys:
        LOGIN_ATTEMPT_STATE.pop(key, None)


def is_login_locked(identifier):
    """Return lock status for an identifier."""
    now = datetime.now()
    with LOGIN_ATTEMPT_LOCK:
        _cleanup_login_attempts(now)
        state = LOGIN_ATTEMPT_STATE.get(identifier)
        if not state:
            return False, 0
        locked_until = state.get('locked_until')
        if locked_until and locked_until > now:
            seconds_remaining = int((locked_until - now).total_seconds())
            return True, seconds_remaining
        return False, 0


def record_failed_login(identifier):
    """Track a failed login and return remaining attempts before lock."""
    now = datetime.now()
    with LOGIN_ATTEMPT_LOCK:
        _cleanup_login_attempts(now)
        state = LOGIN_ATTEMPT_STATE.get(identifier)
        if not state or (now - state.get('first_attempt_at', now)) > timedelta(minutes=LOGIN_TRACKING_WINDOW_MINUTES):
            state = {
                'count': 0,
                'first_attempt_at': now,
                'last_attempt_at': now,
                'locked_until': None
            }
        state['count'] += 1
        state['last_attempt_at'] = now
        if state['count'] >= LOGIN_MAX_ATTEMPTS:
            state['locked_until'] = now + timedelta(minutes=LOGIN_LOCKOUT_MINUTES)
        LOGIN_ATTEMPT_STATE[identifier] = state
        remaining = max(0, LOGIN_MAX_ATTEMPTS - state['count'])
        return remaining


def clear_failed_login(identifier):
    """Clear lockout state for successful login."""
    with LOGIN_ATTEMPT_LOCK:
        LOGIN_ATTEMPT_STATE.pop(identifier, None)


def generate_otp_code():
    """Generate a cryptographically secure 6-digit OTP."""
    return str(secrets.randbelow(900000) + 100000)


def hash_otp_code(otp_code):
    """Return SHA-256 hash for OTP storage and comparison."""
    return hashlib.sha256(str(otp_code).encode('utf-8')).hexdigest()


def log_event(level, event, **fields):
    """Emit structured JSON logs with consistent envelope."""
    record = {
        'event': event,
        'request_id': getattr(g, 'request_id', None),
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        **fields
    }
    app.logger.log(level, json.dumps(record, default=str))


def ensure_audit_log_table():
    """Ensure audit_logs table exists for key security actions."""
    connection = get_db_connection()
    if not connection:
        return
    cursor = connection.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NULL,
          actor_identifier VARCHAR(255) NULL,
          actor_role VARCHAR(50) NULL,
          action VARCHAR(100) NOT NULL,
          target_type VARCHAR(100) NULL,
          target_id VARCHAR(100) NULL,
          outcome ENUM('success', 'failure') NOT NULL,
          details TEXT NULL,
          request_id VARCHAR(64) NULL,
          ip_address VARCHAR(64) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_audit_user_id (user_id),
          INDEX idx_audit_action (action),
          INDEX idx_audit_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)
    connection.commit()
    cursor.close()
    connection.close()


def log_audit_event(action, outcome, user_id=None, actor_identifier=None, actor_role=None, target_type=None, target_id=None, details=None):
    """Write a compact audit trail row for critical actions."""
    try:
        connection = get_db_connection()
        if not connection:
            return
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO audit_logs
            (user_id, actor_identifier, actor_role, action, target_type, target_id, outcome, details, request_id, ip_address)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                actor_identifier,
                actor_role,
                action,
                target_type,
                str(target_id) if target_id is not None else None,
                outcome,
                json.dumps(details or {}, default=str),
                getattr(g, 'request_id', None),
                request.remote_addr
            )
        )
        connection.commit()
        cursor.close()
        connection.close()
    except Exception as audit_error:
        app.logger.warning(f"Failed to write audit event: {audit_error}")


@app.before_request
def assign_request_id():
    """Attach a request identifier for response metadata and traceability."""
    g.request_id = request.headers.get('X-Request-Id') or secrets.token_hex(8)
    g.request_started_at = datetime.utcnow()


@app.after_request
def append_request_metadata(response):
    """Attach request metadata and emit per-request structured log."""
    response.headers['X-Request-Id'] = getattr(g, 'request_id', '')
    started_at = getattr(g, 'request_started_at', None)
    duration_ms = None
    if started_at:
        duration_ms = round((datetime.utcnow() - started_at).total_seconds() * 1000, 2)
    log_event(
        logging.INFO,
        'http_request',
        method=request.method,
        path=request.path,
        status=response.status_code,
        duration_ms=duration_ms,
        remote_addr=request.remote_addr
    )
    return response


def api_success(data=None, message=None, status_code=200, meta=None):
    """Build a normalized success response payload."""
    payload = {
        'success': True,
        'data': data if data is not None else {},
        'error': None,
        'meta': {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'request_id': getattr(g, 'request_id', None)
        }
    }
    if message:
        payload['message'] = message
    if meta:
        payload['meta'].update(meta)
    return jsonify(payload), status_code


def api_error(code, message, status_code=400, details=None, meta=None):
    """Build a normalized error response payload."""
    payload = {
        'success': False,
        'data': None,
        'message': message,
        'error': {
            'code': code,
            'message': message,
            'details': details or {}
        },
        'meta': {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'request_id': getattr(g, 'request_id', None)
        }
    }
    if meta:
        payload['meta'].update(meta)
    return jsonify(payload), status_code

# Helper function to serialize database results
def serialize_result(obj):
    """Convert datetime, date, time, and timedelta objects to strings"""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    elif isinstance(obj, time):
        return obj.strftime('%H:%M:%S')
    elif isinstance(obj, timedelta):
        total_seconds = int(obj.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    return obj

def serialize_row(row):
    """Serialize a database row dictionary"""
    if isinstance(row, dict):
        return {k: serialize_result(v) for k, v in row.items()}
    return row


def _extract_request_user_id():
    """Resolve acting user_id from headers, route params, query params, or JSON body."""
    header_user_id = request.headers.get('X-User-Id')
    if header_user_id:
        try:
            return int(header_user_id)
        except (TypeError, ValueError):
            return None

    view_user_id = request.view_args.get('user_id') if request.view_args else None
    if view_user_id is not None:
        try:
            return int(view_user_id)
        except (TypeError, ValueError):
            return None

    arg_user_id = request.args.get('user_id') or request.args.get('userId')
    if arg_user_id:
        try:
            return int(arg_user_id)
        except (TypeError, ValueError):
            return None

    payload = request.get_json(silent=True) or {}
    body_user_id = payload.get('user_id') or payload.get('userId')
    if body_user_id is not None:
        try:
            return int(body_user_id)
        except (TypeError, ValueError):
            return None

    return None


def _load_request_actor():
    """Load and cache the acting user for authorization checks."""
    if hasattr(g, 'request_actor'):
        return g.request_actor

    user_id = _extract_request_user_id()
    if not user_id:
        g.request_actor = None
        return None

    connection = get_db_connection()
    if not connection:
        g.request_actor = None
        return None

    cursor = connection.cursor(dictionary=True)
    cursor.execute(
        "SELECT id, role, status FROM users WHERE id = %s AND status = 'active'",
        (user_id,)
    )
    actor = cursor.fetchone()
    cursor.close()
    connection.close()

    declared_role = (request.headers.get('X-User-Role') or '').strip().lower()
    if actor and declared_role and actor.get('role') != declared_role:
        g.request_actor = {'invalid': True}
        return g.request_actor

    g.request_actor = actor
    return actor


def require_role(*allowed_roles):
    """Route-level RBAC guard based on current acting user."""
    normalized_roles = {str(role).strip().lower() for role in allowed_roles}

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            actor = _load_request_actor()
            if actor is None:
                return jsonify({'success': False, 'message': 'Authentication required'}), 401
            if actor.get('invalid'):
                return jsonify({'success': False, 'message': 'Role identity mismatch'}), 403
            actor_role = (actor.get('role') or '').strip().lower()
            if actor_role not in normalized_roles:
                return jsonify({'success': False, 'message': 'Access denied'}), 403
            return func(*args, **kwargs)

        return wrapper

    return decorator


@app.before_request
def enforce_prefix_role_access():
    """Apply role checks for privileged route prefixes."""
    if request.method == 'OPTIONS':
        return None

    path = request.path or ''
    for prefix, required_role in ROLE_ROUTE_PREFIXES.items():
        if path.startswith(prefix):
            actor = _load_request_actor()
            if actor is None:
                return jsonify({'success': False, 'message': 'Authentication required'}), 401
            if actor.get('invalid'):
                return jsonify({'success': False, 'message': 'Role identity mismatch'}), 403
            if (actor.get('role') or '').strip().lower() != required_role:
                return jsonify({'success': False, 'message': 'Access denied'}), 403
            break
    return None

def generate_staff_id(role, connection):
    """Generate unique staff ID for new staff members."""
    import random
    import string
    
    prefix_map = {
        'warden': 'WAR',
        'security': 'SEC',
        'technician': 'TEC'
    }
    
    prefix = prefix_map.get(role, 'STF')
    cursor = connection.cursor(dictionary=True)
    
    # Generate unique ID with bounded attempts to avoid infinite loops.
    for _ in range(2000):
        random_num = ''.join(random.choices(string.digits, k=3))
        staff_id = f"{prefix}{random_num}"
        
        # Check if this ID already exists
        cursor.execute("SELECT id FROM users WHERE staff_id = %s", (staff_id,))
        if not cursor.fetchone():
            cursor.close()
            return staff_id

    cursor.close()
    raise ValueError(f"Unable to generate unique staff ID for role {role}")


def ensure_role_staff_id(cursor, connection, user_id, role, existing_staff_id=None):
    """Ensure staff roles always have a unique, non-empty staff_id."""
    staff_roles = {'warden', 'technician', 'security'}
    if role not in staff_roles:
        return existing_staff_id

    normalized_staff_id = (existing_staff_id or '').strip()
    if normalized_staff_id:
        cursor.execute(
            "SELECT id FROM users WHERE staff_id = %s AND id != %s",
            (normalized_staff_id, user_id)
        )
        if cursor.fetchone():
            raise ValueError(f"Duplicate staff ID detected for {role}")
        return normalized_staff_id

    generated_staff_id = generate_staff_id(role, connection)
    cursor.execute("UPDATE users SET staff_id = %s WHERE id = %s", (generated_staff_id, user_id))
    return generated_staff_id

# Database connection helper
def get_db_connection():
    """Create and return a MySQL database connection"""
    try:
        connection = mysql.connector.connect(
            host=app.config['MYSQL_HOST'],
            user=app.config['MYSQL_USER'],
            password=app.config['MYSQL_PASSWORD'],
            database=app.config['MYSQL_DB']
        )
        return connection
    except mysql.connector.Error as err:
        print(f"Database connection error: {err}")
        return None


def _is_benign_migration_error(error_message):
    """Return True when SQL migration failure is due to an already-applied change."""
    normalized = (error_message or '').lower()
    benign_markers = [
        'duplicate column name',
        'duplicate key name',
        'already exists',
        'exists'
    ]
    return any(marker in normalized for marker in benign_markers)


def apply_sql_migrations():
    """Apply pending SQL files in backend/migrations and track them in schema_migrations."""
    migrations_dir = os.path.join(os.path.dirname(__file__), 'migrations')
    if not os.path.isdir(migrations_dir):
        return

    connection = get_db_connection()
    if not connection:
        print('Migration runner skipped: database connection unavailable')
        return

    cursor = connection.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          migration_name VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)
    connection.commit()

    cursor.execute("SELECT migration_name FROM schema_migrations")
    applied_migrations = {row[0] for row in cursor.fetchall()}

    migration_files = sorted(
        file_name for file_name in os.listdir(migrations_dir)
        if file_name.endswith('.sql')
    )

    for file_name in migration_files:
        if file_name in applied_migrations:
            continue

        migration_path = os.path.join(migrations_dir, file_name)
        with open(migration_path, 'r', encoding='utf-8') as migration_file:
            sql_script = migration_file.read().strip()

        if not sql_script:
            cursor.execute(
                "INSERT INTO schema_migrations (migration_name) VALUES (%s)",
                (file_name,)
            )
            connection.commit()
            continue

        try:
            for _ in cursor.execute(sql_script, multi=True):
                pass
            cursor.execute(
                "INSERT INTO schema_migrations (migration_name) VALUES (%s)",
                (file_name,)
            )
            connection.commit()
            print(f"Applied migration: {file_name}")
        except Exception as migration_error:
            if _is_benign_migration_error(str(migration_error)):
                cursor.execute(
                    "INSERT INTO schema_migrations (migration_name) VALUES (%s)",
                    (file_name,)
                )
                connection.commit()
                print(f"Marked migration as already applied: {file_name}")
            else:
                connection.rollback()
                cursor.close()
                connection.close()
                raise

    cursor.close()
    connection.close()


def ensure_outpass_monitoring_columns():
    """Ensure outpass monitoring columns exist for autonomous monitoring"""
    connection = get_db_connection()
    if not connection:
        return

    cursor = connection.cursor()
    alter_statements = [
        "ALTER TABLE outpasses ADD COLUMN monitor_state ENUM('on_time', 'grace_period', 'overdue') DEFAULT 'on_time'",
        "ALTER TABLE outpasses ADD COLUMN risk_level ENUM('low', 'medium', 'high') DEFAULT 'low'",
        "ALTER TABLE outpasses ADD COLUMN overdue_alert_sent_student TINYINT(1) DEFAULT 0",
        "ALTER TABLE outpasses ADD COLUMN overdue_alert_sent_parent TINYINT(1) DEFAULT 0",
        "ALTER TABLE outpasses ADD COLUMN overdue_notified_at DATETIME NULL",
        "CREATE INDEX idx_outpass_monitor_state ON outpasses(monitor_state)",
        "CREATE INDEX idx_outpass_risk_level ON outpasses(risk_level)"
    ]

    for statement in alter_statements:
        try:
            cursor.execute(statement)
            connection.commit()
        except Exception as e:
            if 'Duplicate column name' in str(e) or 'Duplicate key name' in str(e):
                continue
            print(f"Outpass monitoring setup warning: {e}")

    cursor.close()
    connection.close()


def ensure_holiday_mode_columns():
    """Ensure holiday mode and OTP columns exist in outpasses table"""
    connection = get_db_connection()
    if not connection:
        return

    cursor = connection.cursor()
    
    # First, try to modify status enum to include new statuses
    try:
        cursor.execute("""
            ALTER TABLE outpasses 
            MODIFY COLUMN status ENUM('pending', 'pending_otp', 'approved', 'approved_otp', 
                                      'rejected', 'exited', 'returned', 'overdue') DEFAULT 'pending'
        """)
        connection.commit()
    except Exception as e:
        if 'Duplicate column name' not in str(e):
            print(f"Status enum update warning: {e}")
    
    # Add holiday mode columns
    alter_statements = [
        "ALTER TABLE outpasses ADD COLUMN approval_method ENUM('manual', 'otp') DEFAULT 'manual'",
        "ALTER TABLE outpasses ADD COLUMN otp_code VARCHAR(6)",
        "ALTER TABLE outpasses MODIFY COLUMN otp_code VARCHAR(64)",
        "ALTER TABLE outpasses ADD COLUMN otp_sent_at DATETIME",
        "ALTER TABLE outpasses ADD COLUMN otp_verified_at DATETIME",
        "ALTER TABLE outpasses ADD COLUMN otp_attempts INT DEFAULT 0",
        "ALTER TABLE outpasses ADD COLUMN holiday_mode_request TINYINT(1) DEFAULT 0"
    ]

    for statement in alter_statements:
        try:
            cursor.execute(statement)
            connection.commit()
        except Exception as e:
            if 'Duplicate column name' in str(e) or 'Duplicate key name' in str(e):
                continue
            print(f"Holiday mode setup warning: {e}")

    cursor.close()
    connection.close()


def ensure_complaint_monitoring_columns():
    """Ensure complaint monitoring columns and alert table exist"""
    connection = get_db_connection()
    if not connection:
        return

    cursor = connection.cursor()

    try:
        cursor.execute("""
            ALTER TABLE complaints
            MODIFY COLUMN status ENUM('pending', 'assigned', 'in_progress', 'delayed', 'resolved', 'closed', 'cancelled') DEFAULT 'pending'
        """)
        connection.commit()
    except Exception as e:
        print(f"Complaint status enum update warning: {e}")

    alter_statements = [
        "ALTER TABLE complaints ADD COLUMN ai_priority ENUM('low', 'medium', 'high') DEFAULT 'low'",
        "ALTER TABLE complaints ADD COLUMN delayed_at DATETIME NULL",
        "ALTER TABLE complaints ADD COLUMN escalated_at DATETIME NULL",
        "ALTER TABLE complaints ADD COLUMN last_technician_update_at DATETIME NULL",
        "ALTER TABLE complaints ADD COLUMN last_reminder_sent_at DATETIME NULL",
        "ALTER TABLE complaints ADD COLUMN reminder_count INT DEFAULT 0",
        "CREATE INDEX idx_complaints_ai_priority ON complaints(ai_priority)",
        "CREATE INDEX idx_complaints_delayed_at ON complaints(delayed_at)",
        "CREATE INDEX idx_complaints_escalated_at ON complaints(escalated_at)"
    ]

    for statement in alter_statements:
        try:
            cursor.execute(statement)
            connection.commit()
        except Exception as e:
            if 'Duplicate column name' in str(e) or 'Duplicate key name' in str(e):
                continue
            print(f"Complaint monitoring setup warning: {e}")

    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS complaint_agentic_alerts (
              id INT AUTO_INCREMENT PRIMARY KEY,
              complaint_id INT NULL,
              alert_type ENUM('critical', 'unassigned_delay', 'delayed', 'technician_reminder', 'escalated', 'anomaly', 'recommendation') NOT NULL,
              severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
              alert_key VARCHAR(255) UNIQUE,
              title VARCHAR(255) NOT NULL,
              message TEXT NOT NULL,
              metadata_json JSON NULL,
              is_read TINYINT(1) DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
              INDEX idx_alert_type (alert_type),
              INDEX idx_alert_severity (severity),
              INDEX idx_alert_created_at (created_at),
              INDEX idx_alert_is_read (is_read)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        connection.commit()
    except Exception as e:
        print(f"Complaint alert table setup warning: {e}")

    cursor.close()
    connection.close()


def ensure_leave_monitoring_columns():
    """Ensure leave monitoring status/columns and alert table exist"""
    connection = get_db_connection()
    if not connection:
        return

    cursor = connection.cursor()

    try:
        cursor.execute("""
            ALTER TABLE leave_requests
            MODIFY COLUMN status ENUM('pending', 'approved', 'active', 'completed', 'expired', 'rejected', 'cancelled') DEFAULT 'pending'
        """)
        connection.commit()
    except Exception as e:
        print(f"Leave status enum update warning: {e}")

    alter_statements = [
        "ALTER TABLE leave_requests ADD COLUMN active_at DATETIME NULL",
        "ALTER TABLE leave_requests ADD COLUMN completed_at DATETIME NULL",
        "ALTER TABLE leave_requests ADD COLUMN expired_at DATETIME NULL",
        "ALTER TABLE leave_requests ADD COLUMN pending_alert_sent_at DATETIME NULL",
        "ALTER TABLE leave_requests ADD COLUMN ai_flagged TINYINT(1) DEFAULT 0",
        "ALTER TABLE leave_requests ADD COLUMN ai_flag_reason VARCHAR(255) NULL",
        "CREATE INDEX idx_leave_active_at ON leave_requests(active_at)",
        "CREATE INDEX idx_leave_completed_at ON leave_requests(completed_at)",
        "CREATE INDEX idx_leave_pending_alert_sent ON leave_requests(pending_alert_sent_at)"
    ]

    for statement in alter_statements:
        try:
            cursor.execute(statement)
            connection.commit()
        except Exception as e:
            if 'Duplicate column name' in str(e) or 'Duplicate key name' in str(e):
                continue
            print(f"Leave monitoring setup warning: {e}")

    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS leave_agentic_alerts (
              id INT AUTO_INCREMENT PRIMARY KEY,
              related_leave_id INT NULL,
              student_id INT NULL,
              alert_type ENUM('pending_too_long', 'frequent_leave', 'suspicious_pattern', 'attendance_conflict', 'limit_exceeded', 'recommendation') NOT NULL,
              severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
              detection_key VARCHAR(255) UNIQUE,
              title VARCHAR(255) NOT NULL,
              message TEXT NOT NULL,
              metadata_json JSON NULL,
              is_read TINYINT(1) DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (related_leave_id) REFERENCES leave_requests(id) ON DELETE SET NULL,
              FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
              INDEX idx_leave_alert_type (alert_type),
              INDEX idx_leave_alert_severity (severity),
              INDEX idx_leave_alert_created_at (created_at),
              INDEX idx_leave_alert_is_read (is_read)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        connection.commit()
    except Exception as e:
        print(f"Leave alert table setup warning: {e}")

    cursor.close()
    connection.close()


def ensure_security_monitoring_columns():
    """Ensure security monitoring tables exist"""
    connection = get_db_connection()
    if not connection:
        return

    cursor = connection.cursor()

    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS security_agentic_alerts (
              id INT AUTO_INCREMENT PRIMARY KEY,
              student_id INT NULL,
              related_outpass_id INT NULL,
              alert_type ENUM('late_return', 'missing_return', 'night_movement', 'unauthorized_exit_attempt', 'repeat_violation', 'risk_escalation', 'recommendation') NOT NULL,
              severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
              detection_key VARCHAR(255) UNIQUE,
              title VARCHAR(255) NOT NULL,
              message TEXT NOT NULL,
              metadata_json JSON NULL,
              is_read TINYINT(1) DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
              FOREIGN KEY (related_outpass_id) REFERENCES outpasses(id) ON DELETE SET NULL,
              INDEX idx_security_alert_type (alert_type),
              INDEX idx_security_alert_severity (severity),
              INDEX idx_security_alert_created_at (created_at),
              INDEX idx_security_alert_is_read (is_read)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        connection.commit()
    except Exception as e:
        print(f"Security alert table setup warning: {e}")

    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS security_student_risk_profiles (
              student_id INT PRIMARY KEY,
              risk_score INT DEFAULT 0,
              risk_level ENUM('low', 'medium', 'high') DEFAULT 'low',
              late_returns_30d INT DEFAULT 0,
              missing_returns_30d INT DEFAULT 0,
              unauthorized_exits_30d INT DEFAULT 0,
              night_movements_30d INT DEFAULT 0,
              violation_count_30d INT DEFAULT 0,
              last_incident_at DATETIME NULL,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
              INDEX idx_security_risk_level (risk_level),
              INDEX idx_security_risk_score (risk_score),
              INDEX idx_security_violation_count (violation_count_30d)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        connection.commit()
    except Exception as e:
        print(f"Security risk profile setup warning: {e}")

    cursor.close()
    connection.close()


def create_security_agentic_alert(cursor, alert_type, severity, title, message, student_id=None, related_outpass_id=None, detection_key=None, metadata=None):
    """Create or refresh Security Monitoring Agent alert"""
    key = detection_key or f"{alert_type}_{student_id or 'global'}_{related_outpass_id or 'na'}"
    metadata_json = json.dumps(metadata) if metadata else None

    cursor.execute("""
        INSERT INTO security_agentic_alerts
        (student_id, related_outpass_id, alert_type, severity, detection_key, title, message, metadata_json, is_read)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 0)
        ON DUPLICATE KEY UPDATE
            severity = VALUES(severity),
            title = VALUES(title),
            message = VALUES(message),
            metadata_json = VALUES(metadata_json),
            is_read = 0,
            updated_at = CURRENT_TIMESTAMP
    """, (student_id, related_outpass_id, alert_type, severity, key, title, message, metadata_json))


def is_restricted_movement_time(timestamp_value):
    """Check if timestamp falls within restricted movement hours"""
    if not timestamp_value:
        return False

    hour = timestamp_value.hour
    if SECURITY_RESTRICTED_START_HOUR < SECURITY_RESTRICTED_END_HOUR:
        return SECURITY_RESTRICTED_START_HOUR <= hour < SECURITY_RESTRICTED_END_HOUR
    return hour >= SECURITY_RESTRICTED_START_HOUR or hour < SECURITY_RESTRICTED_END_HOUR


def classify_security_risk(score):
    """Convert risk score to low/medium/high label"""
    if score >= SECURITY_RISK_HIGH_THRESHOLD:
        return 'high'
    if score >= SECURITY_RISK_MEDIUM_THRESHOLD:
        return 'medium'
    return 'low'


def fetch_security_insights_data(cursor):
    """Shared query set for security insights"""
    cursor.execute("""
        SELECT srp.student_id, srp.risk_score, srp.risk_level, srp.violation_count_30d,
               srp.late_returns_30d, srp.missing_returns_30d, srp.unauthorized_exits_30d, srp.night_movements_30d,
               u.name AS student_name, s.roll_number
        FROM security_student_risk_profiles srp
        JOIN students s ON srp.student_id = s.id
        JOIN users u ON s.user_id = u.id
        ORDER BY srp.violation_count_30d DESC, srp.risk_score DESC
        LIMIT 10
    """)
    top_violators = cursor.fetchall() or []

    cursor.execute("""
        SELECT
            COUNT(*) AS total_returns_30d,
            SUM(CASE WHEN late_minutes > 0 THEN 1 ELSE 0 END) AS late_returns_30d,
            ROUND(AVG(CASE WHEN late_minutes > 0 THEN late_minutes END), 2) AS avg_late_minutes
        FROM outpasses
        WHERE actual_return_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    """)
    late_stats = cursor.fetchone() or {}

    cursor.execute("""
        SELECT COUNT(*) AS unauthorized_exit_attempts_30d
        FROM security_logs
        WHERE activity_type = 'incident'
          AND description LIKE 'Unauthorized exit attempt%'
          AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    """)
    unauthorized_stats = cursor.fetchone() or {}

    return {
        'students_with_most_violations': [serialize_row(item) for item in top_violators],
        'late_return_statistics': {
            'total_returns_30d': int(late_stats.get('total_returns_30d') or 0),
            'late_returns_30d': int(late_stats.get('late_returns_30d') or 0),
            'avg_late_minutes': float(late_stats.get('avg_late_minutes') or 0)
        },
        'unauthorized_exit_attempts_30d': int(unauthorized_stats.get('unauthorized_exit_attempts_30d') or 0)
    }


def process_security_monitoring_cycle():
    """Autonomous Security Monitoring Agent cycle"""
    connection = get_db_connection()
    if not connection:
        return

    cursor = connection.cursor(dictionary=True)
    now_time = datetime.now()

    cursor.execute("""
        SELECT o.id, o.student_id, o.status, o.expected_return_time, o.actual_return_time,
               u.name AS student_name, s.roll_number
        FROM outpasses o
        JOIN students s ON o.student_id = s.id
        JOIN users u ON s.user_id = u.id
        WHERE o.status IN ('approved', 'approved_otp', 'exited', 'overdue')
          AND o.actual_return_time IS NULL
          AND o.expected_return_time IS NOT NULL
          AND o.expected_return_time < NOW()
    """)
    missing_students = cursor.fetchall() or []

    for row in missing_students:
        late_minutes = int((now_time - row['expected_return_time']).total_seconds() / 60)
        late_duration_str = format_late_duration(late_minutes)
        severity = 'critical' if late_minutes >= 120 else 'high'
        create_security_agentic_alert(
            cursor,
            alert_type='missing_return',
            severity=severity,
            title='Missing Student After Outpass Return Time',
            message=(
                f"{row.get('student_name')} ({row.get('roll_number')}) has not returned after approved outpass return time. "
                f"Delay: {late_duration_str}."
            ),
            student_id=row.get('student_id'),
            related_outpass_id=row.get('id'),
            detection_key=f"missing_return_{row.get('id')}",
            metadata={'late_minutes': late_minutes, 'status': row.get('status')}
        )

        cursor.execute("""
            UPDATE outpasses
            SET status = 'overdue', monitor_state = 'overdue', is_overdue = 1,
                late_minutes = GREATEST(%s, COALESCE(late_minutes, 0)),
                risk_level = 'high'
            WHERE id = %s
              AND actual_return_time IS NULL
        """, (late_minutes, row['id']))

    cursor.execute("""
        SELECT sl.id, sl.related_student_id AS student_id, sl.related_outpass_id, sl.description, sl.timestamp,
               u.name AS student_name, s.roll_number
        FROM security_logs sl
        LEFT JOIN students s ON sl.related_student_id = s.id
        LEFT JOIN users u ON s.user_id = u.id
        WHERE sl.activity_type = 'incident'
          AND sl.description LIKE 'Unauthorized exit attempt%'
          AND sl.timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ORDER BY sl.timestamp DESC
        LIMIT 200
    """)
    unauthorized_incidents = cursor.fetchall() or []

    for incident in unauthorized_incidents:
        create_security_agentic_alert(
            cursor,
            alert_type='unauthorized_exit_attempt',
            severity='high',
            title='Unauthorized Exit Attempt',
            message=incident.get('description') or 'Unauthorized exit attempt detected.',
            student_id=incident.get('student_id'),
            related_outpass_id=incident.get('related_outpass_id'),
            detection_key=f"unauthorized_exit_{incident.get('id')}",
            metadata={'log_id': incident.get('id'), 'timestamp': serialize_result(incident.get('timestamp'))}
        )

    cursor.execute("""
        SELECT sl.id, sl.related_student_id AS student_id, sl.related_outpass_id, sl.timestamp,
               u.name AS student_name, s.roll_number
        FROM security_logs sl
        LEFT JOIN students s ON sl.related_student_id = s.id
        LEFT JOIN users u ON s.user_id = u.id
        WHERE sl.activity_type = 'outpass'
          AND sl.timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ORDER BY sl.timestamp DESC
        LIMIT 500
    """)
    movement_logs = cursor.fetchall() or []

    for movement in movement_logs:
        if not is_restricted_movement_time(movement.get('timestamp')):
            continue

        create_security_agentic_alert(
            cursor,
            alert_type='night_movement',
            severity='medium',
            title='Restricted Hours Movement Detected',
            message=(
                f"Night movement logged for {movement.get('student_name') or 'student'} "
                f"({movement.get('roll_number') or 'N/A'}) during restricted hours."
            ),
            student_id=movement.get('student_id'),
            related_outpass_id=movement.get('related_outpass_id'),
            detection_key=f"night_movement_{movement.get('id')}",
            metadata={'log_id': movement.get('id'), 'timestamp': serialize_result(movement.get('timestamp'))}
        )

    cursor.execute("""
        SELECT s.id AS student_id, u.name AS student_name, s.roll_number
        FROM students s
        JOIN users u ON s.user_id = u.id
    """)
    students = cursor.fetchall() or []

    for student in students:
        student_id = student['student_id']

        cursor.execute("""
            SELECT COUNT(*) AS late_returns_30d
            FROM outpasses
            WHERE student_id = %s
              AND actual_return_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
              AND late_minutes > 0
        """, (student_id,))
        late_returns_30d = int((cursor.fetchone() or {}).get('late_returns_30d') or 0)

        cursor.execute("""
            SELECT COUNT(*) AS missing_returns_30d
            FROM outpasses
            WHERE student_id = %s
              AND status = 'overdue'
              AND actual_return_time IS NULL
              AND expected_return_time < NOW()
        """, (student_id,))
        missing_returns_30d = int((cursor.fetchone() or {}).get('missing_returns_30d') or 0)

        cursor.execute("""
            SELECT COUNT(*) AS unauthorized_exits_30d
            FROM security_logs
            WHERE related_student_id = %s
              AND activity_type = 'incident'
              AND description LIKE 'Unauthorized exit attempt%'
              AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        """, (student_id,))
        unauthorized_exits_30d = int((cursor.fetchone() or {}).get('unauthorized_exits_30d') or 0)

        cursor.execute("""
            SELECT COUNT(*) AS night_movements_30d
            FROM security_logs
            WHERE related_student_id = %s
              AND activity_type = 'outpass'
              AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
              AND (HOUR(timestamp) >= %s OR HOUR(timestamp) < %s)
        """, (student_id, SECURITY_RESTRICTED_START_HOUR, SECURITY_RESTRICTED_END_HOUR))
        night_movements_30d = int((cursor.fetchone() or {}).get('night_movements_30d') or 0)

        violation_count_30d = late_returns_30d + missing_returns_30d + unauthorized_exits_30d + night_movements_30d
        risk_score = (
            (late_returns_30d * 15)
            + (missing_returns_30d * 30)
            + (unauthorized_exits_30d * 25)
            + (night_movements_30d * 8)
        )
        risk_level = classify_security_risk(risk_score)

        cursor.execute("""
            INSERT INTO security_student_risk_profiles
            (student_id, risk_score, risk_level, late_returns_30d, missing_returns_30d, unauthorized_exits_30d,
             night_movements_30d, violation_count_30d, last_incident_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON DUPLICATE KEY UPDATE
                risk_score = VALUES(risk_score),
                risk_level = VALUES(risk_level),
                late_returns_30d = VALUES(late_returns_30d),
                missing_returns_30d = VALUES(missing_returns_30d),
                unauthorized_exits_30d = VALUES(unauthorized_exits_30d),
                night_movements_30d = VALUES(night_movements_30d),
                violation_count_30d = VALUES(violation_count_30d),
                last_incident_at = VALUES(last_incident_at),
                updated_at = CURRENT_TIMESTAMP
        """, (
            student_id,
            risk_score,
            risk_level,
            late_returns_30d,
            missing_returns_30d,
            unauthorized_exits_30d,
            night_movements_30d,
            violation_count_30d
        ))

        if late_returns_30d >= 2 or unauthorized_exits_30d >= 1 or missing_returns_30d >= 1:
            create_security_agentic_alert(
                cursor,
                alert_type='repeat_violation',
                severity='high' if violation_count_30d >= 3 else 'medium',
                title='Repeated Rule Violations',
                message=(
                    f"{student.get('student_name')} ({student.get('roll_number')}) has repeated security violations "
                    f"in last 30 days (late={late_returns_30d}, unauthorized={unauthorized_exits_30d}, "
                    f"missing={missing_returns_30d}, night={night_movements_30d})."
                ),
                student_id=student_id,
                detection_key=f"repeat_violation_{student_id}",
                metadata={
                    'late_returns_30d': late_returns_30d,
                    'unauthorized_exits_30d': unauthorized_exits_30d,
                    'missing_returns_30d': missing_returns_30d,
                    'night_movements_30d': night_movements_30d,
                    'risk_score': risk_score,
                    'risk_level': risk_level
                }
            )

        if risk_level == 'high':
            create_security_agentic_alert(
                cursor,
                alert_type='risk_escalation',
                severity='critical',
                title='High Security Risk Student',
                message=(
                    f"{student.get('student_name')} ({student.get('roll_number')}) is marked HIGH risk "
                    f"with score {risk_score}."
                ),
                student_id=student_id,
                detection_key=f"risk_escalation_{student_id}",
                metadata={'risk_score': risk_score, 'risk_level': risk_level}
            )

    connection.commit()
    cursor.close()
    connection.close()


def security_monitor_worker():
    """Background worker that continuously runs security monitoring"""
    print(f"Security Monitoring Agent started (interval={SECURITY_MONITOR_INTERVAL_SECONDS}s)")
    while True:
        try:
            process_security_monitoring_cycle()
        except Exception as e:
            print(f"Security monitor cycle error: {e}")
        time_module.sleep(SECURITY_MONITOR_INTERVAL_SECONDS)


def start_security_monitor_agent():
    """Start security monitoring thread once"""
    global SECURITY_MONITOR_THREAD_STARTED

    if not SECURITY_MONITOR_ENABLED:
        print("Security monitor disabled by configuration")
        return

    if SECURITY_MONITOR_THREAD_STARTED:
        return

    SECURITY_MONITOR_THREAD_STARTED = True
    monitor_thread = threading.Thread(target=security_monitor_worker, daemon=True, name='security-monitor-agent')
    monitor_thread.start()


def create_leave_agentic_alert(cursor, alert_type, severity, title, message, related_leave_id=None, student_id=None, detection_key=None, metadata=None):
    """Create or refresh leave monitoring alert"""
    key = detection_key or f"{alert_type}_{student_id or 'global'}_{related_leave_id or 'na'}"
    metadata_json = json.dumps(metadata) if metadata else None

    cursor.execute("""
        INSERT INTO leave_agentic_alerts
        (related_leave_id, student_id, alert_type, severity, detection_key, title, message, metadata_json, is_read)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 0)
        ON DUPLICATE KEY UPDATE
            severity = VALUES(severity),
            title = VALUES(title),
            message = VALUES(message),
            metadata_json = VALUES(metadata_json),
            is_read = 0,
            updated_at = CURRENT_TIMESTAMP
    """, (related_leave_id, student_id, alert_type, severity, key, title, message, metadata_json))


def get_consecutive_day_streak(date_values):
    """Return max streak length for sorted distinct date values"""
    if not date_values:
        return 0

    streak = 1
    max_streak = 1
    for idx in range(1, len(date_values)):
        prev_date = date_values[idx - 1]
        cur_date = date_values[idx]
        if (cur_date - prev_date).days == 1:
            streak += 1
            max_streak = max(max_streak, streak)
        else:
            streak = 1
    return max_streak


def generate_leave_recommendations(cursor):
    """Generate recommendations from leave monitoring metrics"""
    recommendations = []

    cursor.execute("""
        SELECT COUNT(*) AS pending_long
        FROM leave_requests
        WHERE status = 'pending'
          AND TIMESTAMPDIFF(HOUR, created_at, NOW()) >= %s
    """, (LEAVE_PENDING_SLA_HOURS,))
    pending_long = int((cursor.fetchone() or {}).get('pending_long') or 0)
    if pending_long > 0:
        recommendations.append({
            'type': 'approval_backlog',
            'severity': 'high',
            'message': f'{pending_long} leave requests are pending for more than {LEAVE_PENDING_SLA_HOURS} hours. Consider assigning approval duties across wardens.'
        })

    cursor.execute("""
        SELECT COUNT(*) AS frequent_students
        FROM leave_monitoring
        WHERE leave_count_last_30_days >= %s
    """, (LEAVE_LIMIT_30_DAYS,))
    frequent_students = int((cursor.fetchone() or {}).get('frequent_students') or 0)
    if frequent_students > 0:
        recommendations.append({
            'type': 'student_support',
            'severity': 'medium',
            'message': f'{frequent_students} students crossed leave frequency limits in the last 30 days. Schedule mentoring/counseling review.'
        })

    return recommendations


def get_important_hostel_event_dates(cursor):
    """Read important hostel event dates from system settings.

    Supported formats in `setting_value`:
    - JSON array: ["2026-03-10", "2026-03-15"]
    - CSV string: 2026-03-10,2026-03-15
    """
    cursor.execute("""
        SELECT setting_value
        FROM system_settings
        WHERE setting_key = 'important_hostel_event_dates'
        LIMIT 1
    """)
    row = cursor.fetchone()
    if not row or not row.get('setting_value'):
        return set()

    raw = str(row.get('setting_value')).strip()
    items = []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            items = [str(item).strip() for item in parsed]
        else:
            items = [value.strip() for value in raw.split(',') if value.strip()]
    except Exception:
        items = [value.strip() for value in raw.split(',') if value.strip()]

    event_dates = set()
    for item in items:
        try:
            event_dates.add(datetime.strptime(item, '%Y-%m-%d').date())
        except Exception:
            continue
    return event_dates


def process_leave_monitoring_cycle():
    """Autonomous monitoring cycle for internal leave management"""
    connection = get_db_connection()
    if not connection:
        return

    cursor = connection.cursor(dictionary=True)
    now_time = datetime.now()
    today = now_time.date()
    important_event_dates = get_important_hostel_event_dates(cursor)

    cursor.execute("""
        SELECT lr.*, s.roll_number, u.name AS student_name
        FROM leave_requests lr
        JOIN students s ON lr.student_id = s.id
        JOIN users u ON s.user_id = u.id
        WHERE lr.status IN ('pending', 'approved', 'active')
    """)
    leaves = cursor.fetchall() or []

    for leave in leaves:
        leave_id = leave['id']
        student_id = leave['student_id']

        if leave['status'] == 'pending':
            pending_hours = (now_time - leave['created_at']).total_seconds() / 3600 if leave.get('created_at') else 0
            if pending_hours >= LEAVE_PENDING_SLA_HOURS:
                create_leave_agentic_alert(
                    cursor,
                    alert_type='pending_too_long',
                    severity='high',
                    title=f'Pending Leave > {LEAVE_PENDING_SLA_HOURS}h',
                    message=f"Leave request #{leave_id} for {leave.get('student_name')} is pending for {round(pending_hours, 1)} hours.",
                    related_leave_id=leave_id,
                    student_id=student_id,
                    detection_key=f'pending_leave_{leave_id}',
                    metadata={'pending_hours': round(pending_hours, 1)}
                )
                cursor.execute(
                    "UPDATE leave_requests SET pending_alert_sent_at = COALESCE(pending_alert_sent_at, NOW()) WHERE id = %s",
                    (leave_id,)
                )

            # Pending request past leave end date is expired.
            if leave.get('to_date') and today > leave['to_date']:
                cursor.execute(
                    "UPDATE leave_requests SET status = 'expired', expired_at = NOW(), ai_flagged = 1, ai_flag_reason = %s WHERE id = %s",
                    ('Pending request expired without approval', leave_id)
                )

        if leave['status'] == 'approved' and leave.get('from_date') and leave.get('to_date'):
            if leave['from_date'] <= today <= leave['to_date']:
                cursor.execute(
                    "UPDATE leave_requests SET status = 'active', active_at = COALESCE(active_at, NOW()) WHERE id = %s",
                    (leave_id,)
                )
            elif today > leave['to_date']:
                cursor.execute(
                    "UPDATE leave_requests SET status = 'completed', completed_at = COALESCE(completed_at, NOW()) WHERE id = %s",
                    (leave_id,)
                )

        if leave['status'] == 'active' and leave.get('to_date') and today > leave['to_date']:
            cursor.execute(
                "UPDATE leave_requests SET status = 'completed', completed_at = COALESCE(completed_at, NOW()) WHERE id = %s",
                (leave_id,)
            )

    cursor.execute("""
        SELECT s.id AS student_id, u.name AS student_name, s.roll_number,
               COUNT(lr.id) AS leave_count_30d,
               SUM(lr.total_days) AS leave_days_30d,
               AVG(lr.total_days) AS avg_days,
               SUM(CASE WHEN lr.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
               SUM(CASE WHEN lr.status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count
        FROM students s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN leave_requests lr ON lr.student_id = s.id
            AND lr.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY s.id, u.name, s.roll_number
    """)
    student_metrics = cursor.fetchall() or []

    for metric in student_metrics:
        student_id = metric['student_id']
        leave_count = int(metric.get('leave_count_30d') or 0)
        avg_days = float(metric.get('avg_days') or 0)

        cursor.execute("""
            SELECT from_date
            FROM leave_requests
            WHERE student_id = %s
              AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            ORDER BY from_date ASC
        """, (student_id,))
        date_rows = cursor.fetchall() or []
        date_values = sorted(list({row['from_date'] for row in date_rows if row.get('from_date')}))
        streak = get_consecutive_day_streak(date_values)

        cursor.execute("""
            SELECT MAX(day_count) AS same_day_max
            FROM (
                SELECT from_date, COUNT(*) AS day_count
                FROM leave_requests
                WHERE student_id = %s
                  AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY from_date
            ) daily
        """, (student_id,))
        same_day_max = int((cursor.fetchone() or {}).get('same_day_max') or 0)

        cursor.execute("""
            SELECT COUNT(*) AS weekday_leaves
            FROM leave_requests
            WHERE student_id = %s
              AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
              AND DAYOFWEEK(from_date) BETWEEN 2 AND 6
              AND status IN ('approved', 'active', 'completed')
        """, (student_id,))
        weekday_leaves = int((cursor.fetchone() or {}).get('weekday_leaves') or 0)

        alert_level = 'low'
        if leave_count >= LEAVE_LIMIT_30_DAYS:
            alert_level = 'high'
            create_leave_agentic_alert(
                cursor,
                alert_type='limit_exceeded',
                severity='high',
                title='Leave Limit Exceeded',
                message=f"{metric.get('student_name')} ({metric.get('roll_number')}) has {leave_count} leave requests in 30 days.",
                student_id=student_id,
                detection_key=f'leave_limit_{student_id}',
                metadata={'leave_count_30d': leave_count}
            )

        if same_day_max >= 2:
            alert_level = 'high'
            create_leave_agentic_alert(
                cursor,
                alert_type='suspicious_pattern',
                severity='high',
                title='Multiple Same-Day Leave Requests',
                message=f"{metric.get('student_name')} submitted {same_day_max} leave requests on the same day in the last 30 days.",
                student_id=student_id,
                detection_key=f'same_day_leave_{student_id}',
                metadata={'same_day_max': same_day_max}
            )

        if streak >= 4:
            alert_level = 'critical'
            create_leave_agentic_alert(
                cursor,
                alert_type='suspicious_pattern',
                severity='critical',
                title='Repeated Daily Leave Pattern',
                message=f"{metric.get('student_name')} has a {streak}-day consecutive leave request streak.",
                student_id=student_id,
                detection_key=f'daily_streak_{student_id}',
                metadata={'streak_days': streak}
            )

        if weekday_leaves >= 4:
            create_leave_agentic_alert(
                cursor,
                alert_type='attendance_conflict',
                severity='medium',
                title='Attendance Conflict Pattern',
                message=f"{metric.get('student_name')} has {weekday_leaves} weekday leaves in 30 days. Review for class/CRT/activity attendance conflict.",
                student_id=student_id,
                detection_key=f'attendance_conflict_{student_id}',
                metadata={'weekday_leaves': weekday_leaves}
            )

        if important_event_dates:
            cursor.execute("""
                SELECT from_date, to_date
                FROM leave_requests
                WHERE student_id = %s
                  AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            """, (student_id,))
            leave_ranges = cursor.fetchall() or []

            overlap_count = 0
            for leave_range in leave_ranges:
                start_date = leave_range.get('from_date')
                end_date = leave_range.get('to_date')
                if not start_date or not end_date:
                    continue
                for event_date in important_event_dates:
                    if start_date <= event_date <= end_date:
                        overlap_count += 1
                        break

            if overlap_count > 0:
                create_leave_agentic_alert(
                    cursor,
                    alert_type='suspicious_pattern',
                    severity='high',
                    title='Leave During Important Hostel Event',
                    message=f"{metric.get('student_name')} has {overlap_count} leave requests overlapping important hostel event dates.",
                    student_id=student_id,
                    detection_key=f'event_overlap_{student_id}',
                    metadata={'event_overlap_count': overlap_count}
                )

        cursor.execute("""
            INSERT INTO leave_monitoring
            (student_id, leave_type, leave_count_last_30_days, leave_count_last_60_days, leave_count_last_90_days,
             leave_count_this_semester, average_days_per_leave, frequency_alert_level, flagged_by_ai)
            VALUES (%s, 'college_leave', %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                leave_count_last_30_days = VALUES(leave_count_last_30_days),
                leave_count_last_60_days = VALUES(leave_count_last_60_days),
                leave_count_last_90_days = VALUES(leave_count_last_90_days),
                leave_count_this_semester = VALUES(leave_count_this_semester),
                average_days_per_leave = VALUES(average_days_per_leave),
                frequency_alert_level = VALUES(frequency_alert_level),
                flagged_by_ai = VALUES(flagged_by_ai),
                last_updated = CURRENT_TIMESTAMP
        """, (
            student_id,
            leave_count,
            leave_count,
            leave_count,
            leave_count,
            avg_days,
            alert_level,
            1 if alert_level in ('high', 'critical') else 0
        ))

    for idx, rec in enumerate(generate_leave_recommendations(cursor), start=1):
        create_leave_agentic_alert(
            cursor,
            alert_type='recommendation',
            severity=rec['severity'],
            title='Leave Monitoring Recommendation',
            message=rec['message'],
            detection_key=f"leave_reco_{idx}_{datetime.now().strftime('%Y_%W')}",
            metadata={'type': rec['type']}
        )

    connection.commit()
    cursor.close()
    connection.close()


def leave_monitor_worker():
    """Background worker that continuously monitors leave requests"""
    print(f"Leave Agentic Monitor started (interval={LEAVE_MONITOR_INTERVAL_SECONDS}s)")
    while True:
        try:
            process_leave_monitoring_cycle()
        except Exception as e:
            print(f"Leave monitor cycle error: {e}")
        time_module.sleep(LEAVE_MONITOR_INTERVAL_SECONDS)


def start_leave_monitor_agent():
    """Start autonomous leave monitoring thread once"""
    global LEAVE_MONITOR_THREAD_STARTED

    if not LEAVE_MONITOR_ENABLED:
        print("Leave monitor disabled by configuration")
        return

    if LEAVE_MONITOR_THREAD_STARTED:
        return

    LEAVE_MONITOR_THREAD_STARTED = True
    monitor_thread = threading.Thread(target=leave_monitor_worker, daemon=True, name='leave-monitor-agent')
    monitor_thread.start()


def classify_complaint_priority(category, title, description):
    """Classify complaint as high/medium/low priority"""
    text = f"{category or ''} {title or ''} {description or ''}".lower()

    high_keywords = ['electricity', 'electrical', 'power', 'water', 'leak', 'security', 'shock', 'sparking']
    medium_keywords = ['maintenance', 'furniture', 'carpentry', 'room', 'door', 'window', 'plumbing', 'hvac']

    if category in ['electrical', 'plumbing', 'security'] or any(k in text for k in high_keywords):
        return 'high'
    if category in ['furniture', 'carpentry', 'hvac'] or any(k in text for k in medium_keywords):
        return 'medium'
    return 'low'


def create_complaint_agentic_alert(cursor, alert_type, severity, title, message, complaint_id=None, alert_key=None, metadata=None):
    """Create or refresh a complaint monitoring alert"""
    key = alert_key or f"{alert_type}_{complaint_id or 'global'}"
    metadata_json = json.dumps(metadata) if metadata else None

    cursor.execute("""
        INSERT INTO complaint_agentic_alerts
        (complaint_id, alert_type, severity, alert_key, title, message, metadata_json, is_read)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 0)
        ON DUPLICATE KEY UPDATE
            severity = VALUES(severity),
            title = VALUES(title),
            message = VALUES(message),
            metadata_json = VALUES(metadata_json),
            is_read = 0,
            updated_at = CURRENT_TIMESTAMP
    """, (complaint_id, alert_type, severity, key, title, message, metadata_json))


def generate_complaint_recommendations(cursor):
    """Generate dynamic recommendations from live complaint load"""
    recommendations = []

    cursor.execute("""
        SELECT COUNT(*) AS open_count
        FROM complaints
        WHERE status IN ('pending', 'assigned', 'in_progress', 'delayed')
    """)
    open_count = int((cursor.fetchone() or {}).get('open_count') or 0)

    cursor.execute("""
        SELECT COUNT(*) AS active_techs
        FROM technicians
        WHERE availability_status IN ('available', 'busy')
    """)
    active_techs = int((cursor.fetchone() or {}).get('active_techs') or 0)

    capacity_threshold = max(active_techs * 4, 8)
    if open_count > capacity_threshold:
        recommendations.append({
            'type': 'staffing',
            'severity': 'high',
            'message': f'Open complaints ({open_count}) exceed current technician capacity ({active_techs} active). Consider adding technicians or redistributing shifts.'
        })

    cursor.execute("""
        SELECT category, COUNT(*) AS total
        FROM complaints
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
        GROUP BY category
        ORDER BY total DESC
        LIMIT 1
    """)
    top_category = cursor.fetchone()
    if top_category and int(top_category.get('total') or 0) >= 8:
        recommendations.append({
            'type': 'infrastructure',
            'severity': 'medium',
            'message': f"Recurring '{top_category['category']}' issues detected ({top_category['total']} complaints in 14 days). Plan preventive infrastructure maintenance."
        })

    return recommendations


def process_complaint_monitoring_cycle():
    """Autonomous monitoring cycle for complaint operations"""
    connection = get_db_connection()
    if not connection:
        return

    cursor = connection.cursor(dictionary=True)

    cursor.execute("""
        SELECT c.id, c.category, c.title, c.description, c.status, c.priority, c.ai_priority,
               c.assigned_technician_id, c.assigned_at, c.created_at, c.resolved_at,
               c.delayed_at, c.escalated_at, c.last_technician_update_at,
               c.last_reminder_sent_at, c.reminder_count,
               s.roll_number, r.room_number, b.block_name,
               tech.name AS technician_name
        FROM complaints c
        JOIN students s ON c.student_id = s.id
        LEFT JOIN rooms r ON s.room_id = r.id
        LEFT JOIN blocks b ON r.block_id = b.id
        LEFT JOIN users tech ON c.assigned_technician_id = tech.id
        WHERE c.status IN ('pending', 'assigned', 'in_progress', 'delayed')
    """)
    open_complaints = cursor.fetchall() or []

    now_time = datetime.now()
    for complaint in open_complaints:
        complaint_id = complaint['id']
        complaint_age_hours = (now_time - complaint['created_at']).total_seconds() / 3600 if complaint.get('created_at') else 0

        auto_priority = classify_complaint_priority(complaint.get('category'), complaint.get('title'), complaint.get('description'))
        if complaint.get('ai_priority') != auto_priority:
            cursor.execute(
                "UPDATE complaints SET ai_priority = %s, priority = %s WHERE id = %s",
                (auto_priority, auto_priority, complaint_id)
            )

        if auto_priority == 'high':
            create_complaint_agentic_alert(
                cursor,
                alert_type='critical',
                severity='critical',
                title=f"Critical Complaint #{complaint_id}",
                message=f"High-priority complaint raised in Room {complaint.get('room_number') or 'N/A'} ({complaint.get('block_name') or 'Unknown block'}).",
                complaint_id=complaint_id,
                alert_key=f"critical_{complaint_id}",
                metadata={'category': complaint.get('category')}
            )

        if not complaint.get('assigned_technician_id') and complaint_age_hours >= COMPLAINT_ASSIGNMENT_SLA_HOURS:
            create_complaint_agentic_alert(
                cursor,
                alert_type='unassigned_delay',
                severity='high',
                title=f"Unassigned Complaint #{complaint_id}",
                message=f"Complaint #{complaint_id} has not been assigned for over {COMPLAINT_ASSIGNMENT_SLA_HOURS} hours.",
                complaint_id=complaint_id,
                alert_key=f"unassigned_delay_{complaint_id}",
                metadata={'age_hours': round(complaint_age_hours, 1)}
            )

        if complaint_age_hours >= COMPLAINT_DELAY_HOURS and complaint.get('status') != 'delayed':
            cursor.execute(
                "UPDATE complaints SET status = 'delayed', delayed_at = NOW() WHERE id = %s",
                (complaint_id,)
            )
            create_complaint_agentic_alert(
                cursor,
                alert_type='delayed',
                severity='high',
                title=f"Complaint Delayed #{complaint_id}",
                message=f"Complaint #{complaint_id} has remained unresolved for over {COMPLAINT_DELAY_HOURS} hours and is marked delayed.",
                complaint_id=complaint_id,
                alert_key=f"delayed_{complaint_id}",
                metadata={'age_hours': round(complaint_age_hours, 1)}
            )

        if complaint_age_hours >= COMPLAINT_ESCALATION_HOURS and not complaint.get('escalated_at'):
            cursor.execute(
                "UPDATE complaints SET escalated_at = NOW() WHERE id = %s",
                (complaint_id,)
            )
            create_complaint_agentic_alert(
                cursor,
                alert_type='escalated',
                severity='critical',
                title=f"Complaint Escalated #{complaint_id}",
                message=f"Complaint #{complaint_id} exceeded {COMPLAINT_ESCALATION_HOURS} hours unresolved and has been escalated to the warden.",
                complaint_id=complaint_id,
                alert_key=f"escalated_{complaint_id}",
                metadata={'age_hours': round(complaint_age_hours, 1)}
            )

        if complaint.get('assigned_technician_id') and complaint.get('assigned_at'):
            has_technician_updated = bool(complaint.get('last_technician_update_at'))
            hours_since_assignment = (now_time - complaint['assigned_at']).total_seconds() / 3600
            hours_since_last_reminder = None
            if complaint.get('last_reminder_sent_at'):
                hours_since_last_reminder = (now_time - complaint['last_reminder_sent_at']).total_seconds() / 3600

            if (
                not has_technician_updated and
                hours_since_assignment >= COMPLAINT_TECH_REMINDER_HOURS and
                (hours_since_last_reminder is None or hours_since_last_reminder >= COMPLAINT_TECH_REMINDER_HOURS)
            ):
                cursor.execute("""
                    UPDATE complaints
                    SET reminder_count = COALESCE(reminder_count, 0) + 1,
                        last_reminder_sent_at = NOW()
                    WHERE id = %s
                """, (complaint_id,))

                create_complaint_agentic_alert(
                    cursor,
                    alert_type='technician_reminder',
                    severity='medium',
                    title=f"Technician Reminder Needed #{complaint_id}",
                    message=f"No technician status update for complaint #{complaint_id} after assignment. Reminder generated for {complaint.get('technician_name') or 'assigned technician'}.",
                    complaint_id=complaint_id,
                    alert_key=f"tech_reminder_{complaint_id}_{int(hours_since_assignment)}",
                    metadata={'technician_name': complaint.get('technician_name')}
                )

    cursor.execute("""
        SELECT r.room_number, b.block_name, COUNT(*) AS total
        FROM complaints c
        JOIN students s ON c.student_id = s.id
        LEFT JOIN rooms r ON s.room_id = r.id
        LEFT JOIN blocks b ON r.block_id = b.id
        WHERE c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY r.room_number, b.block_name
        HAVING COUNT(*) >= 4
        ORDER BY total DESC
        LIMIT 5
    """)
    hotspot_rooms = cursor.fetchall() or []
    for item in hotspot_rooms:
        room_label = f"Room {item.get('room_number') or 'N/A'} - {item.get('block_name') or 'Unknown'}"
        create_complaint_agentic_alert(
            cursor,
            alert_type='anomaly',
            severity='high',
            title='Complaint Hotspot Detected',
            message=f"{room_label} generated {item['total']} complaints in the last 7 days.",
            alert_key=f"anomaly_room_{item.get('room_number')}_{item.get('block_name')}",
            metadata={'room_number': item.get('room_number'), 'block_name': item.get('block_name'), 'count': item['total']}
        )

    cursor.execute("""
        SELECT category, COUNT(*) AS total
        FROM complaints
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY category
        HAVING COUNT(*) >= 10
        ORDER BY total DESC
        LIMIT 3
    """)
    repeated_issues = cursor.fetchall() or []
    for item in repeated_issues:
        create_complaint_agentic_alert(
            cursor,
            alert_type='anomaly',
            severity='medium',
            title='Repeated Issue Pattern',
            message=f"Repeated '{item['category']}' complaints detected ({item['total']} in 7 days).",
            alert_key=f"anomaly_category_{item['category']}",
            metadata={'category': item['category'], 'count': item['total']}
        )

    for idx, rec in enumerate(generate_complaint_recommendations(cursor), start=1):
        create_complaint_agentic_alert(
            cursor,
            alert_type='recommendation',
            severity=rec['severity'],
            title='Operational Recommendation',
            message=rec['message'],
            alert_key=f"recommendation_{idx}_{datetime.now().strftime('%Y_%W')}",
            metadata={'type': rec['type']}
        )

    connection.commit()
    cursor.close()
    connection.close()


def complaint_monitor_worker():
    """Background worker that continuously monitors complaints"""
    print(f"Complaint Agentic Monitor started (interval={COMPLAINT_MONITOR_INTERVAL_SECONDS}s)")
    while True:
        try:
            process_complaint_monitoring_cycle()
        except Exception as e:
            print(f"Complaint monitor cycle error: {e}")
        time_module.sleep(COMPLAINT_MONITOR_INTERVAL_SECONDS)


def start_complaint_monitor_agent():
    """Start autonomous complaint monitoring thread once"""
    global COMPLAINT_MONITOR_THREAD_STARTED

    if not COMPLAINT_MONITOR_ENABLED:
        print("Complaint monitor disabled by configuration")
        return

    if COMPLAINT_MONITOR_THREAD_STARTED:
        return

    COMPLAINT_MONITOR_THREAD_STARTED = True
    monitor_thread = threading.Thread(target=complaint_monitor_worker, daemon=True, name='complaint-monitor-agent')
    monitor_thread.start()


def get_student_outpass_metrics(cursor, student_id, exclude_outpass_id=None):
    """Collect outpass behavior metrics for contextual risk analysis"""
    query = """
        SELECT
            COUNT(*) AS total_outpasses_30d,
            SUM(CASE WHEN is_overdue = 1 OR status = 'overdue' THEN 1 ELSE 0 END) AS overdue_count,
            SUM(CASE WHEN late_minutes > 0 THEN 1 ELSE 0 END) AS late_count,
            AVG(CASE WHEN late_minutes > 0 THEN late_minutes END) AS avg_late_minutes,
            MAX(CASE WHEN is_overdue = 1 OR status = 'overdue' THEN updated_at END) AS last_overdue_at
        FROM outpasses
        WHERE student_id = %s
          AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    """
    params = [student_id]

    if exclude_outpass_id is not None:
        query += " AND id <> %s"
        params.append(exclude_outpass_id)

    cursor.execute(query, tuple(params))
    row = cursor.fetchone() or {}

    total_outpasses_30d = int(row.get('total_outpasses_30d') or 0)
    overdue_count = int(row.get('overdue_count') or 0)
    late_count = int(row.get('late_count') or 0)
    avg_late_minutes = int(row.get('avg_late_minutes') or 0)
    late_rate = round((late_count / total_outpasses_30d) * 100, 2) if total_outpasses_30d > 0 else 0

    return {
        'total_outpasses_30d': total_outpasses_30d,
        'overdue_count': overdue_count,
        'late_count': late_count,
        'avg_late_minutes': avg_late_minutes,
        'late_rate': late_rate,
        'last_overdue_at': row.get('last_overdue_at')
    }


def classify_outpass_risk(metrics):
    """Classify outpass risk level based on behavior metrics (past 30 days)"""
    overdue_count = metrics.get('overdue_count', 0)
    late_rate = metrics.get('late_rate', 0)
    total_outpasses_30d = metrics.get('total_outpasses_30d', 0)

    if overdue_count >= 2 or late_rate >= 30 or total_outpasses_30d >= 5:
        return 'high'
    if overdue_count >= 1 or late_rate >= 15 or total_outpasses_30d >= 3:
        return 'medium'
    return 'low'


def get_monitor_state(expected_return_time, now_time, out_date=None):
    """Determine monitor state: on_time, grace_period, overdue
    
    Grace periods:
    - Same-day outpass: 3 hours (180 minutes)
    - Multi-day outpass: 2 days (2880 minutes)
    """
    if not expected_return_time:
        return 'on_time', 0

    if now_time <= expected_return_time:
        return 'on_time', 0

    late_minutes = int((now_time - expected_return_time).total_seconds() / 60)
    
    # Determine grace period based on same-day vs multi-day
    if out_date and expected_return_time:
        # Extract date from expected_return_time
        return_date = expected_return_time.date() if hasattr(expected_return_time, 'date') else expected_return_time
        out_date_obj = out_date.date() if hasattr(out_date, 'date') else out_date
        
        if return_date == out_date_obj:
            # Same-day outpass: 3 hours grace
            grace_minutes = 180
        else:
            # Multi-day outpass: 2 days grace
            grace_minutes = 2880
    else:
        # Fallback to default if dates not available
        grace_minutes = OUTPASS_GRACE_MINUTES
    
    if late_minutes <= grace_minutes:
        return 'grace_period', late_minutes
    return 'overdue', late_minutes


def format_late_duration(late_minutes):
    """Format delay minutes into readable duration (e.g., 6:05 hours, 1 day 2:30 hours)."""
    total_minutes = int(late_minutes or 0)
    if total_minutes <= 0:
        return '0:00 hours'

    days = total_minutes // (24 * 60)
    remaining = total_minutes % (24 * 60)
    hours = remaining // 60
    minutes = remaining % 60

    if days > 0:
        day_label = 'day' if days == 1 else 'days'
        return f"{days} {day_label} {hours}:{minutes:02d} hours"
    return f"{hours}:{minutes:02d} hours"


def send_outpass_overdue_email_student(student_email, student_name, outpass_id, late_minutes, expected_return_time, risk_level):
    """Send overdue alert email to student"""
    if not student_email:
        return False

    expected_return_str = expected_return_time.strftime('%d %b %Y, %I:%M %p') if expected_return_time else 'N/A'
    late_duration_str = format_late_duration(late_minutes)
    subject = f"⚠️ Outpass Overdue Alert - OP-{outpass_id}"
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="color: #dc2626;">Outpass Overdue Alert</h2>
        <p>Dear {student_name},</p>
        <p>Your approved outpass <strong>OP-{outpass_id}</strong> has crossed the allowed return time.</p>
        <ul>
          <li><strong>Expected Return:</strong> {expected_return_str}</li>
                    <li><strong>Current Delay:</strong> {late_duration_str}</li>
          <li><strong>Risk Level:</strong> {risk_level.upper()}</li>
        </ul>
        <p>Please return to hostel immediately and contact the warden office if there is an emergency.</p>
        <p>— HostelConnect Monitoring System</p>
      </body>
    </html>
    """
    return send_email(student_email, subject, html_body)


def send_outpass_overdue_email_parent(parent_email, parent_name, student_name, outpass_id, late_minutes, expected_return_time, risk_level):
    """Send overdue alert email to parent"""
    if not parent_email:
        return False

    expected_return_str = expected_return_time.strftime('%d %b %Y, %I:%M %p') if expected_return_time else 'N/A'
    late_duration_str = format_late_duration(late_minutes)
    subject = f"⚠️ Parent Alert: Delayed Return for {student_name}"
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="color: #b45309;">Student Outpass Delay Notification</h2>
        <p>Dear {parent_name or 'Parent/Guardian'},</p>
        <p>This is to inform you that <strong>{student_name}</strong> has not returned to hostel within the approved outpass time.</p>
        <ul>
          <li><strong>Outpass ID:</strong> OP-{outpass_id}</li>
          <li><strong>Expected Return:</strong> {expected_return_str}</li>
                    <li><strong>Current Delay:</strong> {late_duration_str}</li>
          <li><strong>Risk Level:</strong> {risk_level.upper()}</li>
        </ul>
        <p>Hostel warden has been notified and monitoring is active.</p>
        <p>— HostelConnect Monitoring System</p>
      </body>
    </html>
    """
    return send_email(parent_email, subject, html_body)


def process_outpass_monitoring_cycle():
    """Autonomous monitoring cycle for active outpasses"""
    connection = get_db_connection()
    if not connection:
        return

    cursor = connection.cursor(dictionary=True)
    now_time = datetime.now()

    cursor.execute("""
        SELECT
            o.id,
            o.student_id,
            o.status,
            o.out_date,
            o.expected_return_time,
            o.overdue_alert_sent_student,
            o.overdue_alert_sent_parent,
            u.name AS student_name,
            u.email AS student_email,
            s.parent_name,
            s.parent_email
        FROM outpasses o
        JOIN students s ON o.student_id = s.id
        JOIN users u ON s.user_id = u.id
        WHERE o.status IN ('exited', 'overdue')
          AND o.actual_return_time IS NULL
    """)

    active_outpasses = cursor.fetchall() or []

    for outpass in active_outpasses:
        monitor_state, late_minutes = get_monitor_state(
            outpass.get('expected_return_time'), 
            now_time, 
            outpass.get('out_date')
        )

        metrics = get_student_outpass_metrics(cursor, outpass['student_id'], outpass['id'])
        risk_level = classify_outpass_risk(metrics)

        new_status = 'overdue' if monitor_state == 'overdue' else 'exited'
        is_overdue = 1 if monitor_state == 'overdue' else 0
        grace_applied = 1 if monitor_state == 'grace_period' else 0

        student_alert_sent = int(outpass.get('overdue_alert_sent_student') or 0)
        parent_alert_sent = int(outpass.get('overdue_alert_sent_parent') or 0)
        should_set_notified_at = False

        if monitor_state == 'overdue':
            if student_alert_sent == 0:
                sent = send_outpass_overdue_email_student(
                    outpass.get('student_email'),
                    outpass.get('student_name'),
                    outpass['id'],
                    late_minutes,
                    outpass.get('expected_return_time'),
                    risk_level
                )
                if sent:
                    student_alert_sent = 1
                    should_set_notified_at = True

            if parent_alert_sent == 0:
                sent = send_outpass_overdue_email_parent(
                    outpass.get('parent_email'),
                    outpass.get('parent_name'),
                    outpass.get('student_name'),
                    outpass['id'],
                    late_minutes,
                    outpass.get('expected_return_time'),
                    risk_level
                )
                if sent:
                    parent_alert_sent = 1
                    should_set_notified_at = True

        notified_at = now_time if should_set_notified_at else None

        cursor.execute("""
            UPDATE outpasses
            SET status = %s,
                monitor_state = %s,
                risk_level = %s,
                is_overdue = %s,
                late_minutes = %s,
                grace_period_applied = %s,
                overdue_alert_sent_student = %s,
                overdue_alert_sent_parent = %s,
                overdue_notified_at = COALESCE(%s, overdue_notified_at)
            WHERE id = %s
        """, (
            new_status,
            monitor_state,
            risk_level,
            is_overdue,
            late_minutes,
            grace_applied,
            student_alert_sent,
            parent_alert_sent,
            notified_at,
            outpass['id']
        ))

    connection.commit()
    cursor.close()
    connection.close()


def outpass_monitor_worker():
    """Background worker that continuously monitors outpasses"""
    print(f"Outpass Agentic Monitor started (interval={OUTPASS_MONITOR_INTERVAL_SECONDS}s, grace={OUTPASS_GRACE_MINUTES}m)")
    while True:
        try:
            process_outpass_monitoring_cycle()
        except Exception as e:
            print(f"Outpass monitor cycle error: {e}")
        time_module.sleep(OUTPASS_MONITOR_INTERVAL_SECONDS)


def start_outpass_monitor_agent():
    """Start autonomous outpass monitoring thread once"""
    global OUTPASS_MONITOR_THREAD_STARTED

    if not OUTPASS_MONITOR_ENABLED:
        print("Outpass monitor disabled by configuration")
        return

    if OUTPASS_MONITOR_THREAD_STARTED:
        return

    OUTPASS_MONITOR_THREAD_STARTED = True
    monitor_thread = threading.Thread(target=outpass_monitor_worker, daemon=True, name='outpass-monitor-agent')
    monitor_thread.start()


def create_security_log(activity_type, description, related_student_id=None, related_visitor_id=None, 
                       related_outpass_id=None, related_parcel_id=None, severity='low', location=None, 
                       logged_by=None, action_taken=None, follow_up_required='no'):
    """Create a security log entry in the database"""
    try:
        connection = get_db_connection()
        if not connection:
            print('Failed to create security log: Database connection failed')
            return False
        
        cursor = connection.cursor()
        
        query = """
            INSERT INTO security_logs 
            (activity_type, description, related_student_id, related_visitor_id, related_outpass_id, 
             severity, location, logged_by, action_taken, follow_up_required)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        cursor.execute(query, (activity_type, description, related_student_id, related_visitor_id, 
                              related_outpass_id, severity, location, logged_by, action_taken, follow_up_required))
        connection.commit()
        
        cursor.close()
        connection.close()
        return True
        
    except Exception as e:
        print(f'Error creating security log: {e}')
        return False


def send_approval_email(student_email, student_name):
    """Send registration approval email to student"""
    try:
        subject = "🎉 Your HostelConnect Registration Has Been Approved!"
        
        html_body = f"""
        <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }}
                    .header h1 {{ margin: 0; font-size: 28px; }}
                    .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                    .content h2 {{ color: #667eea; margin-top: 0; }}
                    .highlight {{ background: #e8f4f8; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; }}
                    .button {{ display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                    .footer {{ text-align: center; margin-top: 30px; font-size: 12px; color: #666; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✓ Registration Approved!</h1>
                    </div>
                    <div class="content">
                        <h2>Hello {student_name},</h2>
                        <p>Great news! Your hostel registration at HostelConnect has been approved by the warden.</p>
                        
                        <div class="highlight">
                            <strong>✅ Your Status:</strong> ACTIVE<br>
                            <strong>📅 Approval Date:</strong> {datetime.now().strftime('%B %d, %Y')}<br>
                            <strong>🎯 Next Step:</strong> Room allocation and move-in process
                        </div>
                        
                        <h3>What's Next?</h3>
                        <ul>
                            <li>Check your dashboard for room assignment details</li>
                            <li>Review your hostel block and room allocation</li>
                            <li>Prepare for move-in as per hostel guidelines</li>
                            <li>Contact your warden for any queries</li>
                        </ul>
                        
                        <p>You can now access all hostel services including:</p>
                        <ul>
                            <li>🚪 Room allocation and management</li>
                            <li>📤 Outpass requests</li>
                            <li>📋 Leave applications</li>
                            <li>🍱 Mess management</li>
                            <li>🔧 Complaint & maintenance requests</li>
                        </ul>
                        
                        <p><a href="http://localhost:5173/student/dashboard" class="button">Go to Your Dashboard →</a></p>
                        
                        <p>If you have any questions or need assistance, please contact your hostel warden or the HostelConnect support team.</p>
                        
                        <p>Best regards,<br><strong>HostelConnect Team</strong></p>
                    </div>
                    <div class="footer">
                        <p>This is an automated email. Please do not reply to this message.</p>
                        <p>&copy; 2026 HostelConnect. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
        """
        
        send_email(student_email, subject, html_body)
        return True
    except Exception as e:
        print(f"Error preparing approval email: {str(e)}")
        return False


def send_rejection_email(student_email, student_name, rejection_reason):
    """Send registration rejection email to student"""
    try:
        subject = "📋 Update on Your HostelConnect Registration"
        
        html_body = f"""
        <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }}
                    .header h1 {{ margin: 0; font-size: 28px; }}
                    .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                    .content h2 {{ color: #f97316; margin-top: 0; }}
                    .highlight {{ background: #fee2e2; padding: 15px; border-left: 4px solid #f97316; margin: 20px 0; }}
                    .reason-box {{ background: #fff7ed; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #f97316; }}
                    .button {{ display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                    .footer {{ text-align: center; margin-top: 30px; font-size: 12px; color: #666; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Registration Status Update</h1>
                    </div>
                    <div class="content">
                        <h2>Hello {student_name},</h2>
                        <p>Thank you for submitting your hostel registration to HostelConnect.</p>
                        
                        <div class="highlight">
                            <strong>⚠️ Registration Status:</strong> REJECTED<br>
                            <strong>📅 Decision Date:</strong> {datetime.now().strftime('%B %d, %Y')}
                        </div>
                        
                        <h3>Reason for Rejection</h3>
                        <div class="reason-box">
                            {rejection_reason}
                        </div>
                        
                        <h3>What You Can Do</h3>
                        <ul>
                            <li>Review the rejection reason carefully</li>
                            <li>Address the issues mentioned in the rejection reason</li>
                            <li>Contact your hostel warden to clarify the requirements</li>
                            <li>You may reapply after fulfilling the necessary conditions</li>
                            <li>Reach out to HostelConnect support if you need assistance</li>
                        </ul>
                        
                        <p><strong>Important:</strong> Please resolve the issues indicated and contact the warden to understand the next steps for reapplication.</p>
                        
                        <p>We understand this may be disappointing, but we're here to help. Please don't hesitate to reach out with any questions.</p>
                        
                        <p>Best regards,<br><strong>HostelConnect Team</strong></p>
                    </div>
                    <div class="footer">
                        <p>This is an automated email. Please do not reply to this message.</p>
                        <p>&copy; 2026 HostelConnect. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
        """
        
        send_email(student_email, subject, html_body)
        return True
    except Exception as e:
        print(f"Error preparing rejection email: {str(e)}")


def send_outpass_approval_email(student_email, student_name, outpass_details):
    """Send outpass approval email to student"""
    try:
        subject = "✅ Your Outpass Request Has Been Approved"
        destination = outpass_details.get('destination', 'N/A')
        reason = outpass_details.get('reason', 'N/A')
        out_date = outpass_details.get('out_date', 'N/A')
        out_time = outpass_details.get('out_time', 'N/A')
        expected_return = outpass_details.get('expected_return_time', 'N/A')

        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #16a34a;">Outpass Approved</h2>
                    <p>Hello {student_name},</p>
                    <p>Your outpass request has been approved by the warden.</p>
                    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
                        <p><strong>Destination:</strong> {destination}</p>
                        <p><strong>Reason:</strong> {reason}</p>
                        <p><strong>Departure:</strong> {out_date} {out_time}</p>
                        <p><strong>Expected Return:</strong> {expected_return}</p>
                    </div>
                    <p>Please carry your student ID while exiting and returning.</p>
                    <p style="font-size: 12px; color: #6b7280;">This is an automated email. Please do not reply.</p>
                </div>
            </body>
        </html>
        """

        return send_email(student_email, subject, html_body)
    except Exception as e:
        print(f"Error preparing outpass approval email: {str(e)}")
        return False


def send_outpass_rejection_email(student_email, student_name, outpass_details, rejection_reason):
    """Send outpass rejection email to student"""
    try:
        subject = "❌ Your Outpass Request Was Rejected"
        destination = outpass_details.get('destination', 'N/A')
        reason = outpass_details.get('reason', 'N/A')
        out_date = outpass_details.get('out_date', 'N/A')
        out_time = outpass_details.get('out_time', 'N/A')

        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #dc2626;">Outpass Rejected</h2>
                    <p>Hello {student_name},</p>
                    <p>Your outpass request has been rejected by the warden.</p>
                    <div style="background: #fef2f2; padding: 15px; border-radius: 8px;">
                        <p><strong>Destination:</strong> {destination}</p>
                        <p><strong>Reason:</strong> {reason}</p>
                        <p><strong>Departure:</strong> {out_date} {out_time}</p>
                        <p><strong>Rejection Reason:</strong> {rejection_reason or 'Not specified'}</p>
                    </div>
                    <p>If you believe this is a mistake, contact the warden office.</p>
                    <p style="font-size: 12px; color: #6b7280;">This is an automated email. Please do not reply.</p>
                </div>
            </body>
        </html>
        """

        return send_email(student_email, subject, html_body)
    except Exception as e:
        print(f"Error preparing outpass rejection email: {str(e)}")
        return False


def send_leave_approval_email(student_email, student_name, from_date, to_date, leave_type, remark=''):
    """Send leave approval email to student"""
    try:
        subject = "✅ Your Leave Request Has Been Approved"
        def normalize_date(value):
            if isinstance(value, datetime):
                return value.date()
            if isinstance(value, date):
                return value
            return datetime.strptime(value, '%Y-%m-%d').date()

        from_date_obj = normalize_date(from_date)
        to_date_obj = normalize_date(to_date)

        from_date_formatted = from_date_obj.strftime('%B %d, %Y')
        to_date_formatted = to_date_obj.strftime('%B %d, %Y')
        total_days = (to_date_obj - from_date_obj).days + 1
        
        leave_type_display = leave_type.replace('_', ' ').title()
        
        # Build remark section conditionally
        remark_section = ''
        if remark and remark.strip():
            remark_section = f'<div class="remark"><strong>📝 Warden Remark:</strong> {remark}</div>'
        
        html_body = f"""
        <html>
            <head>
                <style>
                    body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1f2937; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 0; }}
                    .header {{ background: linear-gradient(135deg, #34d399 0%, #10b981 100%); color: white; padding: 40px 20px; text-align: center; }}
                    .header h1 {{ margin: 0; font-size: 28px; font-weight: 600; }}
                    .header p {{ margin: 10px 0 0 0; font-size: 16px; opacity: 0.95; }}
                    .content {{ background: white; padding: 40px 30px; }}
                    .content h2 {{ color: #10b981; margin: 0 0 20px 0; font-size: 22px; }}
                    .status-box {{ background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 4px; }}
                    .status-box strong {{ color: #047857; }}
                    .detail-box {{ background: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; margin: 15px 0; border-radius: 6px; }}
                    .detail-row {{ display: grid; grid-template-columns: auto 1fr; gap: 10px; margin: 10px 0; }}
                    .detail-label {{ font-weight: 600; color: #6b7280; min-width: 120px; }}
                    .detail-value {{ color: #1f2937; }}
                    .remark {{ background: #fef3c7; border-left: 4px solid #fbbf24; padding: 15px; margin: 20px 0; border-radius: 4px; }}
                    .remark strong {{ color: #92400e; }}
                    .action-box {{ background: #ecf9ff; border: 2px dashed #06b6d4; padding: 15px; margin: 20px 0; border-radius: 6px; }}
                    .footer {{ text-align: center; padding: 20px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✅ Leave Approved</h1>
                        <p>You're all set to stay at the hostel</p>
                    </div>
                    <div class="content">
                        <h2>Hello {student_name},</h2>
                        <p>Great news! Your college leave request has been approved by the warden. You are now marked as "In Hostel – Not Attending College" for the approved period.</p>
                        
                        <div class="status-box">
                            <strong>✓ Status: APPROVED</strong><br>
                            You are authorized to stay in the hostel and skip college during this period.
                        </div>
                        
                        <h3 style="color: #1f2937; margin: 25px 0 15px 0;">Leave Details</h3>
                        <div class="detail-box">
                            <div class="detail-row">
                                <span class="detail-label">📋 Leave Type:</span>
                                <span class="detail-value">{leave_type_display}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">📅 From Date:</span>
                                <span class="detail-value">{from_date_formatted}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">📅 To Date:</span>
                                <span class="detail-value">{to_date_formatted}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">⏱️ Total Days:</span>
                                <span class="detail-value">{total_days} days</span>
                            </div>
                        </div>
                        
                        <div class="action-box">
                            <strong>⚠️ Important:</strong>
                            <ul style="margin: 10px 0; padding-left: 20px;">
                                <li>Ensure security staff is aware of your status</li>
                                <li>Update your mentor/faculty about the leave</li>
                                <li>Inform mess for meal adjustments</li>
                                <li>Stay on hostel premises during this period</li>
                            </ul>
                        </div>
                        
                        {remark_section}
                        
                        <p style="margin-top: 25px; color: #6b7280;">If you have any questions or need to cancel your leave, contact the warden office immediately.</p>
                        
                        <p style="margin-top: 30px;">Best regards,<br><strong>HostelConnect Warden Team</strong></p>
                    </div>
                    <div class="footer">
                        <p>This is an automated email. Please do not reply to this message.</p>
                        <p>&copy; 2026 HostelConnect. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
        """
        
        send_email(student_email, subject, html_body)
        return True
    except Exception as e:
        print(f"Error preparing leave approval email: {str(e)}")
        return False


def send_leave_rejection_email(student_email, student_name, from_date, to_date, leave_type, rejection_reason=''):
    """Send leave rejection email to student"""
    try:
        subject = "❌ Your Leave Request Has Been Rejected"
        def normalize_date(value):
            if isinstance(value, datetime):
                return value.date()
            if isinstance(value, date):
                return value
            return datetime.strptime(value, '%Y-%m-%d').date()

        from_date_obj = normalize_date(from_date)
        to_date_obj = normalize_date(to_date)

        from_date_formatted = from_date_obj.strftime('%B %d, %Y')
        to_date_formatted = to_date_obj.strftime('%B %d, %Y')
        
        leave_type_display = leave_type.replace('_', ' ').title()
        
        # Build reason section conditionally
        if rejection_reason and rejection_reason.strip():
            reason_section = f'<div class="reason-box"><strong>📝 Reason for Rejection:</strong><p style="margin: 10px 0 0 0;">{rejection_reason}</p></div>'
        else:
            reason_section = '<div class="reason-box"><strong>📝 Reason for Rejection:</strong><p style="margin: 10px 0 0 0;">Not specified</p></div>'
        
        html_body = f"""
        <html>
            <head>
                <style>
                    body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1f2937; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 0; }}
                    .header {{ background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 40px 20px; text-align: center; }}
                    .header h1 {{ margin: 0; font-size: 28px; font-weight: 600; }}
                    .header p {{ margin: 10px 0 0 0; font-size: 16px; opacity: 0.95; }}
                    .content {{ background: white; padding: 40px 30px; }}
                    .status-box {{ background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 25px 0; border-radius: 4px; }}
                    .status-box strong {{ color: #991b1b; }}
                    .detail-box {{ background: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; margin: 15px 0; border-radius: 6px; }}
                    .detail-row {{ display: grid; grid-template-columns: auto 1fr; gap: 10px; margin: 10px 0; }}
                    .detail-label {{ font-weight: 600; color: #6b7280; min-width: 120px; }}
                    .detail-value {{ color: #1f2937; }}
                    .reason-box {{ background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px; }}
                    .reason-box strong {{ color: #991b1b; }}
                    .action-box {{ background: #eff6ff; border: 2px dashed #3b82f6; padding: 15px; margin: 20px 0; border-radius: 6px; }}
                    .footer {{ text-align: center; padding: 20px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>❌ Leave Rejected</h1>
                        <p>Your request could not be approved</p>
                    </div>
                    <div class="content">
                        <h2>Hello {student_name},</h2>
                        <p>Unfortunately, your college leave request has been rejected by the warden. Please review the reason below and contact the warden office if you need clarification.</p>
                        
                        <div class="status-box">
                            <strong>✗ Status: REJECTED</strong><br>
                            Your request has been declined. Please contact the warden for more information.
                        </div>
                        
                        <h3 style="color: #1f2937; margin: 25px 0 15px 0;">Leave Details</h3>
                        <div class="detail-box">
                            <div class="detail-row">
                                <span class="detail-label">📋 Leave Type:</span>
                                <span class="detail-value">{leave_type_display}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">📅 From Date:</span>
                                <span class="detail-value">{from_date_formatted}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">📅 To Date:</span>
                                <span class="detail-value">{to_date_formatted}</span>
                            </div>
                        </div>
                        
                        {reason_section}
                        
                        <div class="action-box">
                            <strong>ℹ️ Next Steps:</strong>
                            <ul style="margin: 10px 0; padding-left: 20px;">
                                <li>Contact the warden office to discuss your case</li>
                                <li>You may submit a revised request if applicable</li>
                                <li>Provide additional supporting documents if needed</li>
                                <li>Appeal for reconsideration if you believe this is an error</li>
                            </ul>
                        </div>
                        
                        <p style="margin-top: 25px; color: #6b7280;">If you have any questions or concerns, please visit the warden office or contact support.</p>
                        
                        <p style="margin-top: 30px;">Best regards,<br><strong>HostelConnect Warden Team</strong></p>
                    </div>
                    <div class="footer">
                        <p>This is an automated email. Please do not reply to this message.</p>
                        <p>&copy; 2026 HostelConnect. All rights reserved.</p>
                    </div>
                </body>
            </html>
            """
        
        send_email(student_email, subject, html_body)
        return True
    except Exception as e:
        print(f"Error preparing leave rejection email: {str(e)}")
        return False


@app.route('/api/warden/outpasses/approved', methods=['GET'])
def get_approved_outpasses():
    """Get approved outpass requests with alert status"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT o.*, s.roll_number, r.room_number, s.phone as student_phone,
                 s.parent_name, s.parent_phone, s.parent_email, s.emergency_contact,
                   u.name as student_name, u.email as student_email
            FROM outpasses o
            JOIN students s ON o.student_id = s.id
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms r ON s.room_id = r.id
            WHERE o.status IN ('approved', 'approved_otp', 'exited', 'overdue', 'returned')
            ORDER BY 
                CASE o.status
                    WHEN 'overdue' THEN 1
                    WHEN 'exited' THEN 2
                    WHEN 'approved' THEN 3
                    WHEN 'approved_otp' THEN 3
                    WHEN 'returned' THEN 4
                END,
                o.approved_at DESC
        """
        cursor.execute(query)
        outpasses = cursor.fetchall()

        enriched = []
        for row in outpasses:
            data = serialize_row(row)
            # Add alert status flags
            data['has_alert'] = (row.get('overdue_alert_sent_student') == 1 or 
                               row.get('overdue_alert_sent_parent') == 1)
            data['alert_sent_at'] = row.get('overdue_notified_at')
            enriched.append(data)

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': enriched}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/outpasses/alerts', methods=['GET'])
def get_warden_outpass_alerts():
    """Get outpasses with generated alerts (overdue notifications sent)"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT o.*, s.roll_number, r.room_number, s.phone as student_phone,
                 s.parent_name, s.parent_phone, s.parent_email, s.emergency_contact,
                   u.name as student_name, u.email as student_email,
                   b.block_name
            FROM outpasses o
            JOIN students s ON o.student_id = s.id
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms r ON s.room_id = r.id
            LEFT JOIN blocks b ON r.block_id = b.id
            WHERE (o.overdue_alert_sent_student = 1 OR o.overdue_alert_sent_parent = 1)
              AND o.status IN ('overdue', 'returned')
            ORDER BY o.overdue_notified_at DESC
            LIMIT 100
        """
        cursor.execute(query)
        alerts = cursor.fetchall()

        enriched = []
        for row in alerts:
            data = serialize_row(row)
            data['alert_to_student'] = row.get('overdue_alert_sent_student') == 1
            data['alert_to_parent'] = row.get('overdue_alert_sent_parent') == 1
            data['alert_sent_at'] = row.get('overdue_notified_at')
            enriched.append(data)

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': enriched, 'count': len(enriched)}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/outpasses/rejected', methods=['GET'])
def get_rejected_outpasses():
    """Get rejected outpass requests"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT o.*, s.roll_number, r.room_number, s.phone as student_phone,
                 s.parent_name, s.parent_phone, s.parent_email, s.emergency_contact,
                   u.name as student_name, u.email as student_email
            FROM outpasses o
            JOIN students s ON o.student_id = s.id
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms r ON s.room_id = r.id
            WHERE o.status = 'rejected'
            ORDER BY o.updated_at DESC
        """
        cursor.execute(query)
        outpasses = cursor.fetchall()

        outpasses = [serialize_row(row) for row in outpasses]

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': outpasses}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


def send_email(recipient_email, subject, html_body):
    """Send email using SMTP or Gmail API"""
    try:
        print(f"\n=== Starting email send process ===")
        print(f"Recipient: {recipient_email}")
        print(f"Subject: {subject}")
        print(f"Method: {'SMTP' if USE_SMTP else 'Gmail API'}")
        
        if USE_SMTP:
            return send_email_smtp(recipient_email, subject, html_body)
        else:
            return send_email_gmail_api(recipient_email, subject, html_body)
            
    except Exception as e:
        print(f"\nERROR in send_email wrapper:")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        return False

def send_email_smtp(recipient_email, subject, html_body):
    """Send email using SMTP (Gmail, Office365, etc)"""
    try:
        # Create message
        message = MIMEMultipart('alternative')
        message['Subject'] = subject
        message['From'] = SMTP_CONFIG['sender_email']
        message['To'] = recipient_email
        
        # Attach HTML content
        part = MIMEText(html_body, 'html')
        message.attach(part)
        
        # Send email via SMTP
        print(f"Connecting to {SMTP_CONFIG['smtp_server']}:{SMTP_CONFIG['smtp_port']}...")
        with smtplib.SMTP(SMTP_CONFIG['smtp_server'], SMTP_CONFIG['smtp_port']) as server:
            if SMTP_CONFIG['use_tls']:
                print("Starting TLS connection...")
                server.starttls()
            
            sender_password = SMTP_CONFIG['sender_password'].replace(' ', '')
            if not sender_password:
                print("ERROR: SMTP sender password missing. Set SENDER_PASSWORD env var.")
                return False

            print(f"Logging in as {SMTP_CONFIG['sender_email']}...")
            server.login(SMTP_CONFIG['sender_email'], sender_password)
            
            print(f"Sending email to {recipient_email}...")
            server.sendmail(SMTP_CONFIG['sender_email'], recipient_email, message.as_string())
        
        print(f"Email sent successfully to {recipient_email}")
        print(f"=== Email send complete ===")
        return True
    except Exception as e:
        print(f"\nERROR sending email via SMTP:")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        import traceback
        print(traceback.format_exc())
        print(f"=== Email send failed ===")
        return False

def send_email_gmail_api(recipient_email, subject, html_body):
    """Send email using Gmail API"""
    try:
        print(f"Client secret file exists: {os.path.exists(CLIENT_SECRET_FILE)}")
        print(f"Client secret path: {CLIENT_SECRET_FILE}")
        
        service = get_gmail_service()
        if not service:
            print(f"ERROR: Failed to get Gmail service for {recipient_email}")
            return False
        
        print("Gmail service created successfully")
        
        # Create message
        message = MIMEMultipart('alternative')
        message['Subject'] = subject
        message['From'] = SENDER_EMAIL
        message['To'] = recipient_email
        
        # Attach HTML content
        part = MIMEText(html_body, 'html')
        message.attach(part)
        
        # Send email via Gmail API
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
        send_message = {'raw': raw_message}
        
        result = service.users().messages().send(userId='me', body=send_message).execute()
        
        print(f"Email sent successfully to {recipient_email}")
        print(f"Message ID: {result.get('id')}")
        print(f"=== Email send complete ===")
        return True
    except Exception as e:
        print(f"\nERROR sending email via Gmail API:")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        import traceback
        print(traceback.format_exc())
        print(f"=== Email send failed ===")
        return False

# Test database connection on startup
@app.route('/api/test', methods=['GET'])
def test_connection():
    """Test endpoint to verify backend is running"""
    connection = get_db_connection()
    if connection:
        connection.close()
        return jsonify({
            'success': True,
            'message': 'Backend is running and database is connected!'
        }), 200
    else:
        return jsonify({
            'success': False,
            'message': 'Database connection failed'
        }), 500

# Login API Endpoint
@app.route('/api/login', methods=['POST'])
def login():
    """
    Authenticate user and return role-based information
    Expected input: { "email": "user@example.com", "password": "password123" }
    Note: "email" can also be a roll number or staff ID
    """
    try:
        # Get request data
        data = request.get_json()
        identifier = data.get('email', '') or data.get('roll_number', '') or data.get('rollNumber', '')
        identifier = str(identifier).strip().lower()
        password = data.get('password', '')

        # Validate input
        if not identifier or not password:
            log_audit_event(
                action='login',
                outcome='failure',
                actor_identifier=identifier or None,
                details={'reason': 'missing_credentials'}
            )
            return api_error(
                'AUTH_MISSING_CREDENTIALS',
                'Email/roll number/staff ID and password are required',
                400
            )

        is_locked, seconds_remaining = is_login_locked(identifier)
        if is_locked:
            log_audit_event(
                action='login',
                outcome='failure',
                actor_identifier=identifier,
                details={'reason': 'lockout', 'retry_after_seconds': seconds_remaining}
            )
            return api_error(
                'AUTH_TOO_MANY_ATTEMPTS',
                f'Too many failed attempts. Try again in {seconds_remaining} seconds.',
                429,
                details={'retry_after_seconds': seconds_remaining}
            )

        # Connect to database
        connection = get_db_connection()
        if not connection:
            return api_error('DB_CONNECTION_FAILED', 'Database connection failed', 500)

        cursor = connection.cursor(dictionary=True)

        # Query user by email, roll number, or staff ID
        query = """
            SELECT
                u.id,
                u.name,
                u.email,
                u.password,
                u.role,
                u.status,
                u.staff_id,
                COALESCE(NULLIF(u.roll_number, ''), s.roll_number) AS roll_number
            FROM users u
            LEFT JOIN students s ON s.user_id = u.id
            WHERE (
                LOWER(TRIM(u.email)) = %s
                OR LOWER(TRIM(COALESCE(NULLIF(u.roll_number, ''), s.roll_number))) = %s
                OR LOWER(TRIM(s.roll_number)) = %s
                OR LOWER(TRIM(u.staff_id)) = %s
            )
              AND u.status = 'active'
            LIMIT 1
        """
        cursor.execute(query, (identifier, identifier, identifier, identifier))
        user = cursor.fetchone()

        cursor.close()
        connection.close()

        # Check if user exists
        if not user:
            remaining_attempts = record_failed_login(identifier)
            log_audit_event(
                action='login',
                outcome='failure',
                actor_identifier=identifier,
                details={'reason': 'invalid_credentials', 'remaining_attempts': remaining_attempts}
            )
            return api_error(
                'AUTH_INVALID_CREDENTIALS',
                'Invalid email or password',
                401,
                details={'remaining_attempts': remaining_attempts}
            )

        # Verify password
        if not check_password_hash(user['password'], password):
            remaining_attempts = record_failed_login(identifier)
            log_audit_event(
                action='login',
                outcome='failure',
                user_id=user.get('id'),
                actor_identifier=identifier,
                actor_role=user.get('role'),
                details={'reason': 'invalid_credentials', 'remaining_attempts': remaining_attempts}
            )
            return api_error(
                'AUTH_INVALID_CREDENTIALS',
                'Invalid email or password',
                401,
                details={'remaining_attempts': remaining_attempts}
            )

        clear_failed_login(identifier)
        log_audit_event(
            action='login',
            outcome='success',
            user_id=user.get('id'),
            actor_identifier=identifier,
            actor_role=user.get('role'),
            details={'login_method': 'password'}
        )

        # Login successful - return user info (excluding password)
        response_data = {
            'userId': user['id'],
            'name': user['name'],
            'role': user['role']
        }
        
        # Include staff_id for staff members
        if user.get('staff_id'):
            response_data['staffId'] = user['staff_id']
        
        # Include roll_number for students
        if user.get('roll_number'):
            response_data['rollNumber'] = user['roll_number']
        
        return api_success(response_data, status_code=200)

    except Exception as e:
        log_event(logging.ERROR, 'login_error', error=str(e))
        return api_error('AUTH_LOGIN_FAILED', 'An error occurred during login', 500)

@app.route('/api/user/change-password', methods=['POST'])
def change_password():
    """
    Change user password
    Expected input: { "user_id": 1, "current_password": "old123", "new_password": "new123" }
    """
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')

        # Validate input
        if not user_id or not current_password or not new_password:
            return jsonify({
                'success': False,
                'message': 'User ID, current password, and new password are required'
            }), 400

        if len(new_password) < 6:
            return jsonify({
                'success': False,
                'message': 'New password must be at least 6 characters long'
            }), 400

        # Connect to database
        connection = get_db_connection()
        if not connection:
            return jsonify({
                'success': False,
                'message': 'Database connection failed'
            }), 500

        cursor = connection.cursor(dictionary=True)

        # Get current user password hash
        cursor.execute("SELECT password FROM users WHERE id = %s AND status = 'active'", (user_id,))
        user = cursor.fetchone()

        if not user:
            cursor.close()
            connection.close()
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404

        # Verify current password
        if not check_password_hash(user['password'], current_password):
            cursor.close()
            connection.close()
            return jsonify({
                'success': False,
                'message': 'Current password is incorrect'
            }), 401

        # Hash new password and update
        new_password_hash = generate_password_hash(new_password)
        cursor.execute("UPDATE users SET password = %s WHERE id = %s", (new_password_hash, user_id))
        connection.commit()

        cursor.close()
        connection.close()

        return jsonify({
            'success': True,
            'message': 'Password updated successfully'
        }), 200

    except Exception as e:
        print(f"Password change error: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'An error occurred while changing password'
        }), 500

# Create demo users endpoint (for testing only)
@app.route('/api/create-demo-users', methods=['POST'])
def create_demo_users():
    """
    Create demo users for each role (Development/Testing only)
    Remove this endpoint in production!
    """
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({
                'success': False,
                'message': 'Database connection failed'
            }), 500

        cursor = connection.cursor(dictionary=True)

        # Demo users with hashed passwords
        demo_users = [
            ('Rajesh Kumar', 'student@hostel.edu', 'CS2021049', generate_password_hash('student123'), 'student'),
            ('Mr. Sharma', 'warden@hostel.edu', None, generate_password_hash('warden123'), 'warden'),
            ('Admin User', 'admin@hostel.edu', None, generate_password_hash('admin123'), 'admin'),
            ('Ramesh Tech', 'technician@hostel.edu', None, generate_password_hash('tech123'), 'technician'),
            ('Suresh Guard', 'security@hostel.edu', None, generate_password_hash('security123'), 'security')
        ]

        insert_query = """
                        INSERT INTO users (name, email, roll_number, password, role, status)
                        VALUES (%s, %s, %s, %s, %s, 'active')
                        ON DUPLICATE KEY UPDATE
                            name=VALUES(name),
                            role=VALUES(role),
                            roll_number=VALUES(roll_number)
        """

        for user in demo_users:
            cursor.execute(insert_query, user)

        connection.commit()
        cursor.close()
        connection.close()

        return jsonify({
            'success': True,
            'message': 'Demo users created successfully',
            'users': [
                {'email': 'student@hostel.edu', 'password': 'student123', 'role': 'student'},
                {'email': 'warden@hostel.edu', 'password': 'warden123', 'role': 'warden'},
                {'email': 'admin@hostel.edu', 'password': 'admin123', 'role': 'admin'},
                {'email': 'technician@hostel.edu', 'password': 'tech123', 'role': 'technician'},
                {'email': 'security@hostel.edu', 'password': 'security123', 'role': 'security'}
            ]
        }), 200

    except Exception as e:
        print(f"Error creating demo users: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error: {str(e)}'
        }), 500

# Create demo student data (for testing only)
@app.route('/api/create-demo-student', methods=['POST'])
def create_demo_student():
    """Create demo student record linked to the student user"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Get student user_id
        cursor.execute("SELECT id FROM users WHERE email = 'student@hostel.edu'")
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'success': False, 'message': 'Student user not found'}), 404
        
        user_id = user['id']
        
        # Insert student record
        insert_query = """
            INSERT INTO students 
            (user_id, roll_number, branch, year, room_id, fee_status, registration_status, 
             phone, parent_phone, parent_name, blood_group)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                roll_number=VALUES(roll_number), branch=VALUES(branch), year=VALUES(year)
        """
        
        cursor.execute(insert_query, (
            user_id, 'CS2021049', 'Computer Science', 3, 1,  # room_id = 1 (Block A, Room 101)
            'paid', 'approved', '9876543210', '9876543211', 
            'Mr. Kumar (Father)', 'O+'
        ))
        
        connection.commit()
        student_id = cursor.lastrowid
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'message': 'Demo student created successfully',
            'student_id': student_id,
            'user_id': user_id
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# Logout endpoint (optional - mainly for clearing server-side sessions if needed)
@app.route('/api/logout', methods=['POST'])
def logout():
    """Logout endpoint (client will clear localStorage)"""
    return jsonify({
        'success': True,
        'message': 'Logged out successfully'
    }), 200

# ========================================
# STUDENT ENDPOINTS
# ========================================

@app.route('/api/student/profile/<int:user_id>', methods=['GET'])
def get_student_profile(user_id):
    """Get student profile details"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT s.*, u.name, u.email, u.status, u.created_at, 
                   b.block_name, r.room_number
            FROM students s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms r ON s.room_id = r.id
            LEFT JOIN blocks b ON r.block_id = b.id
            WHERE s.user_id = %s
        """
        cursor.execute(query, (user_id,))
        student = cursor.fetchone()
        
        if student:
            student = serialize_row(student)
            cursor.close()
            connection.close()
            return jsonify({'success': True, 'data': student}), 200
        else:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Student not found'}), 404
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/student/room/<int:user_id>', methods=['GET'])
def get_student_room_details(user_id):
    """Get room details for a student"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        cursor.execute("SELECT id, room_id FROM students WHERE user_id = %s", (user_id,))
        student = cursor.fetchone()

        if not student:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Student not found'}), 404

        if not student.get('room_id'):
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Room not assigned'}), 404

        room_query = """
            SELECT r.id AS room_id, r.room_number, r.floor, r.capacity, r.occupied_count,
                   r.room_type, r.rent_per_month, r.amenities, r.status,
                   b.id AS block_id, b.block_name
            FROM rooms r
            JOIN blocks b ON r.block_id = b.id
            WHERE r.id = %s
        """
        cursor.execute(room_query, (student['room_id'],))
        room = cursor.fetchone()

        if not room:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Room not found'}), 404

        roommates_query = """
            SELECT u.name, s.branch, s.year, s.user_id
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE s.room_id = %s AND s.user_id <> %s
            ORDER BY u.name
        """
        cursor.execute(roommates_query, (student['room_id'], user_id))
        roommates = cursor.fetchall()

        cursor.close()
        connection.close()

        return jsonify({
            'success': True,
            'data': {
                'room': room,
                'roommates': roommates
            }
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/student/room-change', methods=['POST'])
def submit_room_change_request():
    """Submit a room change request for a student"""
    try:
        data = request.get_json()
        user_id = data.get('userId')
        preferred_room = (data.get('preferredRoom') or '').strip()
        preferred_block = (data.get('preferredBlock') or '').strip()
        full_reason = (data.get('detailedReason') or '').strip()

        if not user_id or not preferred_block or not full_reason:
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        # Ensure table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS room_change_requests (
              id INT AUTO_INCREMENT PRIMARY KEY,
              student_id INT NOT NULL,
              current_room_id INT,
              requested_room_id INT,
              requested_block_id INT,
              preference_reason VARCHAR(255),
              full_reason TEXT NOT NULL,
              room_preference VARCHAR(100),
              status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
              approved_by INT,
              approved_at TIMESTAMP NULL,
              rejection_reason TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              
              FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
              FOREIGN KEY (current_room_id) REFERENCES rooms(id) ON DELETE SET NULL,
              FOREIGN KEY (requested_room_id) REFERENCES rooms(id) ON DELETE SET NULL,
              FOREIGN KEY (requested_block_id) REFERENCES blocks(id) ON DELETE SET NULL,
              FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
              INDEX idx_student_id (student_id),
              INDEX idx_status (status),
              INDEX idx_current_room (current_room_id),
              INDEX idx_requested_room (requested_room_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        connection.commit()

        # Get student info
        cursor.execute("SELECT id, room_id FROM students WHERE user_id = %s", (user_id,))
        student = cursor.fetchone()
        if not student:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Student not found'}), 404

        # Resolve block and room
        cursor.execute("SELECT id FROM blocks WHERE block_name = %s", (preferred_block,))
        block = cursor.fetchone()
        requested_block_id = block['id'] if block else None

        requested_room_id = None
        if preferred_room and requested_block_id:
            cursor.execute(
                "SELECT id FROM rooms WHERE block_id = %s AND room_number = %s",
                (requested_block_id, preferred_room)
            )
            requested_room = cursor.fetchone()
            requested_room_id = requested_room['id'] if requested_room else None

        preference_reason = full_reason[:250]
        room_preference = preferred_room or None

        cursor.execute("""
            INSERT INTO room_change_requests
            (student_id, current_room_id, requested_room_id, requested_block_id,
             preference_reason, full_reason, room_preference, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending')
        """, (
            student['id'],
            student.get('room_id'),
            requested_room_id,
            requested_block_id,
            preference_reason,
            full_reason,
            room_preference
        ))
        connection.commit()

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'message': 'Room change request submitted'}), 201

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/student/outpasses/<int:user_id>', methods=['GET'])
def get_student_outpasses(user_id):
    """Get all outpasses for a student"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # First get student_id from user_id
        cursor.execute("SELECT id FROM students WHERE user_id = %s", (user_id,))
        student = cursor.fetchone()
        
        if not student:
            return jsonify({'success': False, 'message': 'Student not found'}), 404
        
        # Get outpasses for this student
        query = """
            SELECT o.*, u.name as approved_by_name
            FROM outpasses o
            LEFT JOIN users u ON o.approved_by = u.id
            WHERE o.student_id = %s
            ORDER BY o.created_at DESC
        """
        cursor.execute(query, (student['id'],))
        outpasses = cursor.fetchall()
        
        # Serialize datetime/time objects
        outpasses = [serialize_row(row) for row in outpasses]
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': outpasses}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/student/complaints/<int:user_id>', methods=['GET'])
def get_student_complaints(user_id):
    """Get all complaints for a student and their roommates (same room)"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # First get student_id and room_id from user_id
        cursor.execute("SELECT id, room_id FROM students WHERE user_id = %s", (user_id,))
        student = cursor.fetchone()
        
        if not student:
            return jsonify({'success': False, 'message': 'Student not found'}), 404
        
        # Get all student IDs in the same room
        cursor.execute("""
            SELECT id FROM students WHERE room_id = %s
        """, (student['room_id'],))
        room_students = cursor.fetchall()
        student_ids = [s['id'] for s in room_students]
        
        if not student_ids:
            cursor.close()
            connection.close()
            return jsonify({'success': True, 'data': []}), 200
        
        # Get complaints for all students in this room
        placeholders = ','.join(['%s'] * len(student_ids))
        query = f"""
            SELECT c.*, 
                   t.name as technician_name, 
                   u.name as student_name,
                   r.room_number,
                   b.block_name
            FROM complaints c
            LEFT JOIN users t ON c.assigned_technician_id = t.id
            LEFT JOIN users u ON u.id = (SELECT user_id FROM students WHERE id = c.student_id)
            LEFT JOIN students s ON c.student_id = s.id
            LEFT JOIN rooms r ON s.room_id = r.id
            LEFT JOIN blocks b ON c.block_id = b.id
            WHERE c.student_id IN ({placeholders})
            ORDER BY c.created_at DESC
        """
        cursor.execute(query, student_ids)
        complaints = cursor.fetchall()
        
        # Serialize datetime objects for JSON response
        serialized_complaints = [serialize_row(complaint) for complaint in complaints]
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': serialized_complaints}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/student/leaves/<int:user_id>', methods=['GET'])
def get_student_leaves(user_id):
    """Get all leave requests for a student"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # First get student_id from user_id
        cursor.execute("SELECT id FROM students WHERE user_id = %s", (user_id,))
        student = cursor.fetchone()
        
        if not student:
            return jsonify({'success': False, 'message': 'Student not found'}), 404
        
        # Get leave requests for this student
        query = """
            SELECT lr.*, u.name as approved_by_name
            FROM leave_requests lr
            LEFT JOIN users u ON lr.approved_by = u.id
            WHERE lr.student_id = %s
            ORDER BY lr.created_at DESC
        """
        cursor.execute(query, (student['id'],))
        leaves = cursor.fetchall()

        leaves = [serialize_row(row) for row in leaves]
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': leaves}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/student/parcels/<int:user_id>', methods=['GET'])
def get_student_parcels(user_id):
    """Get all parcels for a student"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # First get student_id from user_id
        cursor.execute("SELECT id FROM students WHERE user_id = %s", (user_id,))
        student = cursor.fetchone()
        
        if not student:
            return jsonify({'success': False, 'message': 'Student not found'}), 404
        
        # Get parcels for this student
        query = """
            SELECT p.*
            FROM parcels p
            WHERE p.student_id = %s
            ORDER BY p.received_date DESC
        """
        cursor.execute(query, (student['id'],))
        parcels = cursor.fetchall()
        
        # Serialize the results (convert datetime objects)
        serialized_parcels = [serialize_row(p) for p in parcels]
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': serialized_parcels}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ========================================
# STUDENT WRITE ENDPOINTS (POST)
# ========================================

@app.route('/api/student/outpass', methods=['POST'])
def create_outpass():
    """Create a new outpass request"""
    try:
        data = request.get_json()
        student_id = data.get('student_id')  # This is user_id
        reason = data.get('reason')
        destination = data.get('destination')
        departure_date = data.get('departure_date')
        departure_time = data.get('departure_time')
        return_date = data.get('return_date')
        return_time = data.get('return_time')
        approval_method = data.get('approval_method', 'manual')  # 'manual' or 'otp'
        
        if not all([student_id, reason, destination, departure_date, departure_time, return_date, return_time]):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400

        try:
            departure_date_obj = datetime.strptime(departure_date, '%Y-%m-%d').date()
            return_date_obj = datetime.strptime(return_date, '%Y-%m-%d').date()
            departure_datetime = datetime.strptime(f"{departure_date} {departure_time}", '%Y-%m-%d %H:%M')
            return_datetime = datetime.strptime(f"{return_date} {return_time}", '%Y-%m-%d %H:%M')
        except ValueError:
            return jsonify({'success': False, 'message': 'Invalid date/time format.'}), 400

        if departure_date_obj < date.today() or return_date_obj < date.today():
            return jsonify({'success': False, 'message': 'Outpass dates cannot be in the past.'}), 400

        if departure_datetime < datetime.now():
            return jsonify({'success': False, 'message': 'Departure date and time must be from now onwards.'}), 400

        if return_datetime <= departure_datetime:
            return jsonify({'success': False, 'message': 'Expected return must be after departure date and time.'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Get actual student_id from user_id
        cursor.execute("SELECT id FROM students WHERE user_id = %s", (student_id,))
        student = cursor.fetchone()
        
        if not student:
            return jsonify({'success': False, 'message': 'Student not found'}), 404

        # Enforce holiday mode from warden-controlled system setting
        cursor.execute("""
            SELECT setting_value FROM system_settings
            WHERE setting_key = 'college_holiday_mode'
        """)
        holiday_mode_setting = cursor.fetchone()
        is_holiday_mode = (
            holiday_mode_setting and str(holiday_mode_setting.get('setting_value', '')).lower() == 'true'
        )

        # In holiday mode, exit date must be the current day
        if is_holiday_mode and departure_date_obj != date.today():
            cursor.close()
            connection.close()
            return jsonify({
                'success': False,
                'message': 'During holiday mode, outpass exit date must be today.'
            }), 400
        
        # Combine return_date and return_time into expected_return_time
        if return_time:
            expected_return = f"{return_date} {return_time}:00"
        else:
            expected_return = f"{return_date} 23:59:00"
        
        # Set default out_time if not provided
        if not departure_time:
            departure_time = "00:00:00"
        else:
            departure_time = f"{departure_time}:00"
        
        # Determine initial status based on approval method
        initial_status = 'pending_otp' if approval_method == 'otp' else 'pending'
        
        # Insert outpass request with holiday mode fields
        query = """
            INSERT INTO outpasses 
            (student_id, reason, destination, out_date, out_time, expected_return_time, 
             status, approval_method, holiday_mode_request)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (
            student['id'], reason, destination, departure_date, departure_time, 
            expected_return, initial_status, approval_method, 1 if is_holiday_mode else 0
        ))
        connection.commit()
        
        outpass_id = cursor.lastrowid
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True, 
            'id': outpass_id, 
            'message': 'Outpass request submitted',
            'status': initial_status,
            'holiday_mode': is_holiday_mode
        }), 201
        
    except Exception as e:
        print(f"Error creating outpass: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/student/outpass/<int:outpass_id>/send-otp', methods=['POST'])
def send_outpass_otp(outpass_id):
    """Send OTP to parent for outpass verification"""
    try:
        connection = get_db_connection()
        if not connection:
            return api_error('DB_CONNECTION_FAILED', 'Database connection failed', 500)

        cursor = connection.cursor(dictionary=True)
        
        # Get outpass details with parent information
        cursor.execute("""
            SELECT o.*, s.parent_phone, s.parent_email, s.parent_name, 
                   u.name as student_name, u.email as student_email
            FROM outpasses o
            JOIN students s ON o.student_id = s.id
            JOIN users u ON s.user_id = u.id
            WHERE o.id = %s AND o.status = 'pending_otp'
        """, (outpass_id,))
        
        outpass = cursor.fetchone()
        if not outpass:
            cursor.close()
            connection.close()
            log_audit_event(
                action='outpass_otp_send',
                outcome='failure',
                target_type='outpass',
                target_id=outpass_id,
                details={'reason': 'not_otp_eligible'}
            )
            return api_error('OUTPASS_NOT_OTP_ELIGIBLE', 'Outpass not found or not eligible for OTP', 404)
        
        # Check if parent email exists
        parent_email = outpass.get('parent_email')
        if not parent_email:
            cursor.close()
            connection.close()
            log_audit_event(
                action='outpass_otp_send',
                outcome='failure',
                target_type='outpass',
                target_id=outpass_id,
                details={'reason': 'parent_email_missing'}
            )
            return api_error('PARENT_EMAIL_MISSING', 'Parent email not found. Please update your profile with parent email.', 400)
        
        # Check if OTP was already sent recently (within 2 minutes to prevent spam)
        if outpass.get('otp_sent_at'):
            from datetime import datetime, timedelta
            otp_sent_time = outpass['otp_sent_at']
            if isinstance(otp_sent_time, str):
                otp_sent_time = datetime.fromisoformat(otp_sent_time)
            
            time_since_sent = datetime.now() - otp_sent_time
            if time_since_sent < timedelta(minutes=2):
                remaining_seconds = int((timedelta(minutes=2) - time_since_sent).total_seconds())
                cursor.close()
                connection.close()
                log_audit_event(
                    action='outpass_otp_send',
                    outcome='failure',
                    target_type='outpass',
                    target_id=outpass_id,
                    details={'reason': 'rate_limited', 'retry_after_seconds': remaining_seconds}
                )
                return api_error(
                    'OTP_RATE_LIMITED',
                    f'OTP already sent. Please wait {remaining_seconds} seconds before requesting again.',
                    429,
                    details={
                        'already_sent': True,
                        'parent_contact': parent_email,
                        'retry_after_seconds': remaining_seconds
                    }
                )
        
        # Generate secure 6-digit OTP and store only a hash.
        otp_code = generate_otp_code()
        otp_hash = hash_otp_code(otp_code)
        
        # Update outpass with OTP code and sent timestamp
        cursor.execute("""
            UPDATE outpasses 
            SET otp_code = %s, otp_sent_at = NOW()
            WHERE id = %s
        """, (otp_hash, outpass_id))
        connection.commit()
        
        # Send OTP via email to parent ONLY
        parent_email = outpass['parent_email']
        parent_name = outpass.get('parent_name', 'Parent/Guardian')
        parent_phone = outpass.get('parent_phone', 'Not provided')
        
        if parent_email:
            exit_date_text = 'N/A'
            exit_time_text = 'N/A'
            entry_date_text = 'N/A'
            entry_time_text = 'N/A'

            out_date_value = outpass.get('out_date')
            if isinstance(out_date_value, datetime):
                exit_date_text = out_date_value.strftime('%d %b %Y')
            elif isinstance(out_date_value, date):
                exit_date_text = out_date_value.strftime('%d %b %Y')
            elif isinstance(out_date_value, str):
                try:
                    exit_date_text = datetime.strptime(out_date_value[:10], '%Y-%m-%d').strftime('%d %b %Y')
                except ValueError:
                    exit_date_text = out_date_value

            out_time_value = outpass.get('out_time')
            if isinstance(out_time_value, datetime):
                exit_time_text = out_time_value.strftime('%I:%M %p')
            elif isinstance(out_time_value, time):
                exit_time_text = out_time_value.strftime('%I:%M %p')
            elif isinstance(out_time_value, str):
                parsed_out_time = None
                for time_fmt in ('%H:%M:%S', '%H:%M'):
                    try:
                        parsed_out_time = datetime.strptime(out_time_value, time_fmt)
                        break
                    except ValueError:
                        continue
                exit_time_text = parsed_out_time.strftime('%I:%M %p') if parsed_out_time else out_time_value

            expected_return_value = outpass.get('expected_return_time')
            if isinstance(expected_return_value, datetime):
                entry_date_text = expected_return_value.strftime('%d %b %Y')
                entry_time_text = expected_return_value.strftime('%I:%M %p')
            elif isinstance(expected_return_value, str):
                parsed_expected_return = None
                normalized_expected_return = expected_return_value.replace('T', ' ')
                for dt_fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M'):
                    try:
                        parsed_expected_return = datetime.strptime(normalized_expected_return, dt_fmt)
                        break
                    except ValueError:
                        continue
                if parsed_expected_return:
                    entry_date_text = parsed_expected_return.strftime('%d %b %Y')
                    entry_time_text = parsed_expected_return.strftime('%I:%M %p')
                else:
                    expected_parts = normalized_expected_return.split(' ')
                    if len(expected_parts) >= 2:
                        entry_date_text = expected_parts[0]
                        entry_time_text = expected_parts[1]
                    else:
                        entry_date_text = expected_return_value

            subject = f"🔐 Outpass OTP Verification - {outpass['student_name']}"
            body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #3b82f6;">🎓 HostelConnect - Outpass OTP Verification</h2>
                    <p>Dear {parent_name},</p>
                    <p>Your ward <strong>{outpass['student_name']}</strong> has requested an outpass during college holiday mode.</p>
                    
                    <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Destination:</strong> {outpass['destination']}</p>
                        <p style="margin: 5px 0;"><strong>Exit Date:</strong> {exit_date_text}</p>
                        <p style="margin: 5px 0;"><strong>Exit Time:</strong> {exit_time_text}</p>
                        <p style="margin: 5px 0;"><strong>Entry Date:</strong> {entry_date_text}</p>
                        <p style="margin: 5px 0;"><strong>Entry Time:</strong> {entry_time_text}</p>
                        <p style="margin: 5px 0;"><strong>Reason:</strong> {outpass['reason']}</p>
                    </div>
                    
                    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                        <p style="font-size: 14px; margin: 0 0 10px 0;">Your One-Time Password (OTP) is:</p>
                        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #3b82f6; margin: 10px 0;">
                            {otp_code}
                        </p>
                        <p style="font-size: 12px; color: #92400e; margin: 10px 0 0 0;">
                            ⚠️ Valid for 30 minutes. Do not share this OTP with anyone.
                        </p>
                    </div>
                    
                    <p style="font-size: 14px; color: #6b7280;">
                        If you approve this outpass, please share this OTP with your ward. 
                        If you did not authorize this request, please contact the hostel warden immediately.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="font-size: 12px; color: #9ca3af;">
                        — HostelConnect Management System<br>
                        This is an automated message. Please do not reply to this email.
                    </p>
                </div>
            </body>
            </html>
            """
            
            email_sent = send_email(parent_email, subject, body)
            
            cursor.close()
            connection.close()
            log_audit_event(
                action='outpass_otp_send',
                outcome='success',
                target_type='outpass',
                target_id=outpass_id,
                details={'email_sent': email_sent, 'parent_email': parent_email}
            )

            return api_success(
                {
                    'email_sent': email_sent,
                    'parent_email': parent_email
                },
                message=f'OTP sent successfully to parent email: {parent_email}',
                status_code=200
            )
        else:
            cursor.close()
            connection.close()
            log_audit_event(
                action='outpass_otp_send',
                outcome='failure',
                target_type='outpass',
                target_id=outpass_id,
                details={'reason': 'parent_email_not_available'}
            )
            return api_error('PARENT_EMAIL_MISSING', 'Parent email not available. Please update profile.', 400)
            
    except Exception as e:
        log_event(logging.ERROR, 'send_outpass_otp_error', outpass_id=outpass_id, error=str(e))
        return api_error('OTP_SEND_FAILED', 'Failed to send OTP', 500)


@app.route('/api/student/outpass/<int:outpass_id>/verify-otp', methods=['POST'])
def verify_outpass_otp(outpass_id):
    """Verify OTP and auto-approve outpass"""
    try:
        data = request.get_json()
        otp_input = data.get('otp')
        
        if not otp_input:
            log_audit_event(
                action='outpass_otp_verify',
                outcome='failure',
                target_type='outpass',
                target_id=outpass_id,
                details={'reason': 'otp_missing'}
            )
            return api_error('OTP_REQUIRED', 'OTP is required', 400)
        
        connection = get_db_connection()
        if not connection:
            return api_error('DB_CONNECTION_FAILED', 'Database connection failed', 500)

        cursor = connection.cursor(dictionary=True)
        
        # Get outpass with OTP details
        cursor.execute("""
            SELECT * FROM outpasses 
            WHERE id = %s AND status = 'pending_otp'
        """, (outpass_id,))
        
        outpass = cursor.fetchone()
        if not outpass:
            cursor.close()
            connection.close()
            log_audit_event(
                action='outpass_otp_verify',
                outcome='failure',
                target_type='outpass',
                target_id=outpass_id,
                details={'reason': 'outpass_not_found'}
            )
            return api_error('OUTPASS_NOT_FOUND', 'Outpass not found or already processed', 404)
        
        # Check OTP expiry (30 minutes)
        if outpass['otp_sent_at']:
            from datetime import datetime, timedelta
            otp_sent_time = outpass['otp_sent_at']
            if isinstance(otp_sent_time, str):
                otp_sent_time = datetime.fromisoformat(otp_sent_time)
            
            if datetime.now() - otp_sent_time > timedelta(minutes=30):
                cursor.close()
                connection.close()
                log_audit_event(
                    action='outpass_otp_verify',
                    outcome='failure',
                    target_type='outpass',
                    target_id=outpass_id,
                    details={'reason': 'otp_expired'}
                )
                return api_error('OTP_EXPIRED', 'OTP has expired. Please request a new OTP.', 400)
        
        # Increment OTP attempts
        cursor.execute("""
            UPDATE outpasses 
            SET otp_attempts = otp_attempts + 1
            WHERE id = %s
        """, (outpass_id,))
        connection.commit()
        
        # Check max attempts (5)
        if outpass['otp_attempts'] >= 5:
            cursor.close()
            connection.close()
            log_audit_event(
                action='outpass_otp_verify',
                outcome='failure',
                target_type='outpass',
                target_id=outpass_id,
                details={'reason': 'attempts_exceeded'}
            )
            return api_error('OTP_ATTEMPTS_EXCEEDED', 'Maximum OTP attempts exceeded. Please contact warden.', 400)
        
        # Verify OTP (supports hashed storage and legacy plaintext values).
        stored_otp = outpass.get('otp_code') or ''
        input_hash = hash_otp_code(otp_input)
        otp_matches = (
            (len(stored_otp) == 64 and hmac.compare_digest(stored_otp, input_hash))
            or (len(stored_otp) == 6 and hmac.compare_digest(stored_otp, str(otp_input)))
        )
        if otp_matches:
            # OTP is correct, auto-approve outpass
            cursor.execute("""
                UPDATE outpasses 
                SET status = 'approved_otp',
                    otp_verified_at = NOW(),
                    approved_at = NOW(),
                    otp_code = NULL
                WHERE id = %s
            """, (outpass_id,))
            connection.commit()
            
            cursor.close()
            connection.close()
            log_audit_event(
                action='outpass_otp_verify',
                outcome='success',
                target_type='outpass',
                target_id=outpass_id,
                details={'status': 'approved_otp'}
            )

            return api_success(
                {'status': 'approved_otp'},
                message='OTP verified successfully! Outpass approved.',
                status_code=200
            )
        else:
            cursor.close()
            connection.close()
            remaining_attempts = max(0, 5 - (outpass['otp_attempts'] + 1))
            log_audit_event(
                action='outpass_otp_verify',
                outcome='failure',
                target_type='outpass',
                target_id=outpass_id,
                details={'reason': 'invalid_otp', 'remaining_attempts': remaining_attempts}
            )
            return api_error(
                'OTP_INVALID',
                f'Invalid OTP. {remaining_attempts} attempts remaining.',
                400,
                details={'remaining_attempts': remaining_attempts}
            )
            
    except Exception as e:
        log_event(logging.ERROR, 'verify_outpass_otp_error', outpass_id=outpass_id, error=str(e))
        return api_error('OTP_VERIFY_FAILED', 'Failed to verify OTP', 500)


@app.route('/api/student/complaint', methods=['POST'])
def create_complaint():
    """Create a new complaint with auto-assignment to technician"""
    try:
        data = request.get_json()
        student_id = data.get('student_id')  # This is user_id
        issue_type = data.get('issue_type') or data.get('category')
        description = data.get('description')
        location = data.get('location')
        block_id = data.get('block_id')
        priority = data.get('priority', 'medium')
        
        if not all([student_id, issue_type, description]):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Get actual student_id from user_id
        cursor.execute("SELECT id FROM students WHERE user_id = %s", (student_id,))
        student = cursor.fetchone()
        
        if not student:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Student not found'}), 404
        
        # Normalize issue_type/category to consistent values (supports capitalized inputs)
        raw_category = (issue_type or '').strip().lower()
        raw_category = raw_category.replace('wi-fi', 'wifi').replace('wi fi', 'wifi')
        legacy_map = {
            'maintenance': 'other',
            'cleanliness': 'cleaning',
            'facilities': 'other',
            'hvac (heating/cooling)': 'hvac',
            'heating/cooling': 'hvac'
        }
        category = legacy_map.get(raw_category, raw_category or 'other')
        
        # Map category to technician specialization for auto-assignment
        # Only auto-assign for specific technical categories, not for 'other'
        specialization_map = {
            'electrical': ['electrical'],
            'plumbing': ['plumbing'],
            'carpentry': ['carpentry', 'furniture'],
            'furniture': ['carpentry', 'furniture'],
            'hvac': ['hvac (heating/cooling)', 'hvac', 'heating/cooling', 'heating', 'cooling'],
            'wifi': ['wifi', 'wi-fi', 'internet', 'network'],
            'internet': ['wifi', 'wi-fi', 'internet', 'network'],
            'cleaning': None,  # No auto-assign - manual by warden
            'security': None,  # No auto-assign - manual by warden
            'other': None  # No auto-assign - manual by warden
        }
        required_specializations = specialization_map.get(category)
        
        # Generate title from description (first 50 chars)
        title = description[:50] + ('...' if len(description) > 50 else '')
        auto_priority = classify_complaint_priority(category, title, description)
        if priority not in ['low', 'medium', 'high']:
            priority = auto_priority
        else:
            # Autonomous classifier takes precedence for consistency.
            priority = auto_priority
        
        # Try to find and assign an available technician
        assigned_technician_id = None
        complaint_status = 'pending'
        assigned_at = None
        
        if required_specializations:
            placeholders = ", ".join(["%s"] * len(required_specializations))
            query = f"""
                SELECT u.id, u.name
                FROM technicians t
                JOIN users u ON t.user_id = u.id
                WHERE LOWER(t.specialization) IN ({placeholders})
                AND t.availability_status IN ('available', 'busy')
                AND u.status = 'active'
                ORDER BY CASE WHEN t.availability_status = 'available' THEN 0 ELSE 1 END, u.id
                LIMIT 1
            """
            cursor.execute(query, tuple(s.lower() for s in required_specializations))
            technician = cursor.fetchone()
            
            if technician:
                assigned_technician_id = technician['id']
                complaint_status = 'assigned'
                assigned_at = datetime.now()
        
        # Insert complaint with assignment details
        query = """
            INSERT INTO complaints 
            (student_id, block_id, category, title, description, location, priority, ai_priority, status, assigned_technician_id, assigned_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (
            student['id'], block_id, category, title, description, location, priority, auto_priority,
            complaint_status, assigned_technician_id, assigned_at
        ))
        connection.commit()
        
        complaint_id = cursor.lastrowid

        if auto_priority == 'high':
            create_complaint_agentic_alert(
                cursor,
                alert_type='critical',
                severity='critical',
                title=f"Critical Complaint #{complaint_id}",
                message=f"High-priority complaint #{complaint_id} was submitted and requires immediate attention.",
                complaint_id=complaint_id,
                alert_key=f"critical_{complaint_id}",
                metadata={'category': category}
            )
            connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True, 
            'id': complaint_id, 
            'message': 'Complaint submitted' + (f' and assigned to technician' if assigned_technician_id else ''),
            'assigned': bool(assigned_technician_id),
            'status': complaint_status
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/student/leave', methods=['POST'])
def create_leave():
    """Create a new leave request"""
    try:
        data = request.get_json()
        student_id = data.get('student_id')  # This is user_id
        leave_type = data.get('leave_type')
        from_date = data.get('from_date')
        to_date = data.get('to_date')
        reason = data.get('reason', '')
        
        if not all([student_id, leave_type, from_date, to_date]):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Get actual student_id from user_id
        cursor.execute("SELECT id FROM students WHERE user_id = %s", (student_id,))
        student = cursor.fetchone()
        
        if not student:
            return jsonify({'success': False, 'message': 'Student not found'}), 404
        
        # Validate and calculate total_days
        from_dt = datetime.strptime(from_date, '%Y-%m-%d')
        to_dt = datetime.strptime(to_date, '%Y-%m-%d')

        if from_dt.date() < date.today() or to_dt.date() < date.today():
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Leave dates cannot be in the past.'}), 400

        if to_dt < from_dt:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'To date must be after or equal to from date.'}), 400

        total_days = (to_dt - from_dt).days + 1
        
        # Insert leave request using correct column names
        query = """
            INSERT INTO leave_requests 
            (student_id, leave_type, from_date, to_date, leave_reason, total_days, status)
            VALUES (%s, %s, %s, %s, %s, %s, 'pending')
        """
        cursor.execute(query, (student['id'], leave_type, from_date, to_date, reason, total_days))
        connection.commit()
        
        leave_id = cursor.lastrowid
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'id': leave_id, 'message': 'Leave request submitted'}), 201
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
        
        return jsonify({'success': True, 'id': leave_id, 'message': 'Leave request submitted'}), 201
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ========================================
# WARDEN ENDPOINTS
# ========================================

@app.route('/api/system/holiday-mode', methods=['GET', 'POST'])
def manage_holiday_mode():
    """Get or set college holiday mode status"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Ensure system_settings table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_settings (
              id INT AUTO_INCREMENT PRIMARY KEY,
              setting_key VARCHAR(100) UNIQUE NOT NULL,
              setting_value TEXT,
              description VARCHAR(255),
              updated_by INT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_setting_key (setting_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        connection.commit()
        
        if request.method == 'GET':
            # Get current holiday mode status
            cursor.execute("""
                SELECT setting_value FROM system_settings 
                WHERE setting_key = 'college_holiday_mode'
            """)
            result = cursor.fetchone()
            cursor.close()
            connection.close()
            
            holiday_mode = result['setting_value'] == 'true' if result else False
            return jsonify({'success': True, 'holidayMode': holiday_mode}), 200
            
        elif request.method == 'POST':
            # Set holiday mode status
            data = request.get_json()
            holiday_mode = data.get('holidayMode', False)
            updated_by = data.get('updated_by')  # Warden user_id
            
            cursor.execute("""
                INSERT INTO system_settings (setting_key, setting_value, updated_by)
                VALUES ('college_holiday_mode', %s, %s)
                ON DUPLICATE KEY UPDATE 
                    setting_value = VALUES(setting_value),
                    updated_by = VALUES(updated_by),
                    updated_at = CURRENT_TIMESTAMP
            """, ('true' if holiday_mode else 'false', updated_by))
            
            connection.commit()
            cursor.close()
            connection.close()
            
            return jsonify({'success': True, 'holidayMode': holiday_mode, 'message': 'Holiday mode updated'}), 200
            
    except Exception as e:
        print(f"Error managing holiday mode: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/warden/recent-activities', methods=['GET'])
def get_warden_recent_activities():
    """Get recent activities for warden dashboard"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        activities = []
        
        # Recent outpass approvals
        cursor.execute("""
            SELECT o.id, s.name as student_name, o.status, o.approved_at as activity_time,
                   'outpass' as activity_type
            FROM outpasses o
            JOIN students st ON o.student_id = st.id
            JOIN users s ON st.user_id = s.id
            WHERE o.status IN ('approved', 'approved_otp', 'exited', 'returned')
            AND o.approved_at IS NOT NULL
            ORDER BY o.approved_at DESC
            LIMIT 5
        """)
        outpass_activities = cursor.fetchall()
        for act in outpass_activities:
            activities.append({
                'id': f"outpass_{act['id']}",
                'action': 'Outpass approved',
                'student': act['student_name'],
                'time': act['activity_time'],
                'icon': '✅'
            })
        
        # Recent leave approvals
        cursor.execute("""
            SELECT lr.id, s.name as student_name, lr.status, lr.approved_at as activity_time,
                   'leave' as activity_type
            FROM leave_requests lr
            JOIN students st ON lr.student_id = st.id
            JOIN users s ON st.user_id = s.id
            WHERE lr.status = 'approved'
            AND lr.approved_at IS NOT NULL
            ORDER BY lr.approved_at DESC
            LIMIT 5
        """)
        leave_activities = cursor.fetchall()
        for act in leave_activities:
            activities.append({
                'id': f"leave_{act['id']}",
                'action': 'Leave approved',
                'student': act['student_name'],
                'time': act['activity_time'],
                'icon': '📝'
            })
        
        # Recent complaint resolutions
        cursor.execute("""
            SELECT c.id, s.name as student_name, c.status, c.updated_at as activity_time,
                   'complaint' as activity_type
            FROM complaints c
            JOIN students st ON c.student_id = st.id
            JOIN users s ON st.user_id = s.id
            WHERE c.status IN ('resolved', 'closed')
            ORDER BY c.updated_at DESC
            LIMIT 5
        """)
        complaint_activities = cursor.fetchall()
        for act in complaint_activities:
            activities.append({
                'id': f"complaint_{act['id']}",
                'action': 'Complaint resolved',
                'student': act['student_name'],
                'time': act['activity_time'],
                'icon': '🔧'
            })
        
        # Sort all activities by time and take top 10
        activities.sort(key=lambda x: x['time'] if x['time'] else datetime.min, reverse=True)
        activities = activities[:10]
        
        # Format time as relative
        now = datetime.now()
        for act in activities:
            if act['time']:
                time_diff = now - act['time']
                if time_diff.total_seconds() < 60:
                    act['time'] = 'Just now'
                elif time_diff.total_seconds() < 3600:
                    minutes = int(time_diff.total_seconds() / 60)
                    act['time'] = f"{minutes} min{'s' if minutes > 1 else ''} ago"
                elif time_diff.total_seconds() < 86400:
                    hours = int(time_diff.total_seconds() / 3600)
                    act['time'] = f"{hours} hour{'s' if hours > 1 else ''} ago"
                else:
                    days = time_diff.days
                    act['time'] = f"{days} day{'s' if days > 1 else ''} ago"
            else:
                act['time'] = 'Unknown'
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': activities}), 200
        
    except Exception as e:
        print(f"Error fetching recent activities: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/students', methods=['GET'])
def get_warden_students():
    """Get all students, including inactive ones, for the warden students page."""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT s.*, u.name, u.email, u.status, b.block_name, r.room_number
            FROM students s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms r ON s.room_id = r.id
            LEFT JOIN blocks b ON r.block_id = b.id
            ORDER BY u.created_at DESC
        """
        cursor.execute(query)
        students = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': students}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/hostel-blocks', methods=['GET'])
def get_warden_hostel_blocks():
    """Allow wardens to fetch hostel blocks for student room reassignment flows."""
    return get_hostel_blocks()


@app.route('/api/warden/rooms/<int:block_id>', methods=['GET'])
def get_warden_rooms_by_block(block_id):
    """Allow wardens to fetch rooms for a selected block."""
    return get_rooms_by_block(block_id)


@app.route('/api/warden/rooms/<int:room_id>', methods=['PUT'])
def update_warden_room(room_id):
    """Allow wardens to update room details via warden-scoped route."""
    return update_room(room_id)


@app.route('/api/warden/rooms/<int:room_id>', methods=['DELETE'])
def delete_warden_room(room_id):
    """Allow wardens to delete rooms via warden-scoped route."""
    return delete_room(room_id)


@app.route('/api/warden/user/<int:user_id>', methods=['PUT'])
def update_warden_student_details(user_id):
    """Allow wardens to update student details via warden-scoped route."""
    return update_user_details(user_id)


@app.route('/api/warden/user/<int:user_id>', methods=['DELETE'])
def delete_warden_student(user_id):
    """Allow wardens to delete student records via warden-scoped route."""
    return delete_user(user_id)


@app.route('/api/warden/user/<int:user_id>/status', methods=['PUT'])
def update_warden_student_status(user_id):
    """Allow wardens to activate/deactivate student accounts via warden-scoped route."""
    return update_user_status(user_id)


@app.route('/api/warden/user/<int:user_id>/password', methods=['PUT'])
def change_warden_student_password(user_id):
    """Allow wardens to change student passwords via warden-scoped route."""
    return change_user_password(user_id)


@app.route('/api/warden/dashboard', methods=['GET'])
def get_warden_dashboard():
    """Get summary stats for warden dashboard."""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        stats = {}

        cursor.execute("SELECT COUNT(*) AS count FROM students WHERE registration_status = 'approved'")
        stats['total_students'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) AS count FROM rooms")
        stats['total_rooms'] = cursor.fetchone()['count']

        cursor.execute("SELECT CAST(SUM(occupied_count) AS UNSIGNED) AS occupied FROM rooms")
        occupancy_row = cursor.fetchone()
        stats['occupied_rooms'] = int((occupancy_row or {}).get('occupied') or 0)

        cursor.execute("SELECT COUNT(*) AS count FROM leave_requests WHERE status = 'pending'")
        stats['pending_leaves'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) AS count FROM complaints WHERE status IN ('pending', 'assigned', 'in_progress', 'delayed')")
        stats['active_complaints'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) AS count FROM outpasses WHERE status IN ('pending', 'pending_otp')")
        stats['pending_outpasses'] = cursor.fetchone()['count']

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': stats}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/outpasses/pending', methods=['GET'])
def get_pending_outpasses():
    """Get pending outpass requests"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT o.*, s.roll_number, r.room_number, s.phone as student_phone,
                 s.parent_name, s.parent_phone, s.parent_email, s.emergency_contact,
                   u.name as student_name, u.email as student_email
            FROM outpasses o
            JOIN students s ON o.student_id = s.id
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms r ON s.room_id = r.id
            WHERE o.status IN ('pending', 'pending_otp')
            ORDER BY o.created_at DESC
        """
        cursor.execute(query)
        outpasses = cursor.fetchall()

        enriched_outpasses = []
        for row in outpasses:
            metrics = get_student_outpass_metrics(cursor, row['student_id'], row['id'])
            risk_level = classify_outpass_risk(metrics)
            has_overdue_warning = metrics['overdue_count'] > 0

            row['student_risk_level'] = risk_level
            row['previous_overdue_count'] = metrics['overdue_count']
            row['previous_late_count'] = metrics['late_count']
            row['last_overdue_at'] = metrics['last_overdue_at']
            row['has_overdue_warning'] = has_overdue_warning
            row['warning_message'] = '⚠ Previous overdue return detected' if has_overdue_warning else None

            enriched_outpasses.append(serialize_row(row))
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': enriched_outpasses}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/outpass/<int:outpass_id>/approve', methods=['POST'])
def approve_outpass(outpass_id):
    """Approve an outpass"""
    try:
        data = request.get_json(silent=True) or {}
        approved_by = data.get('approved_by')
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            UPDATE outpasses 
            SET status = 'approved', approved_by = %s, approved_at = NOW(), monitor_state = 'on_time'
            WHERE id = %s
        """
        cursor.execute(query, (approved_by, outpass_id))
        connection.commit()

        cursor.execute("SELECT student_id FROM outpasses WHERE id = %s", (outpass_id,))
        outpass_owner = cursor.fetchone()
        if outpass_owner:
            metrics = get_student_outpass_metrics(cursor, outpass_owner['student_id'], outpass_id)
            current_risk = classify_outpass_risk(metrics)
            cursor.execute(
                "UPDATE outpasses SET risk_level = %s WHERE id = %s",
                (current_risk, outpass_id)
            )
            connection.commit()

        cursor.execute(
            """
            SELECT u.email, u.name, o.destination, o.reason, o.out_date, o.out_time, o.expected_return_time, o.risk_level
            FROM outpasses o
            JOIN students s ON o.student_id = s.id
            JOIN users u ON s.user_id = u.id
            WHERE o.id = %s
            """,
            (outpass_id,)
        )
        student_info = cursor.fetchone()
        
        cursor.close()
        connection.close()

        email_sent = None
        if student_info and student_info.get('email'):
            email_sent = send_outpass_approval_email(student_info['email'], student_info['name'], student_info)
        
        return jsonify({'success': True, 'message': 'Outpass approved', 'email_sent': email_sent}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/outpass/<int:outpass_id>/reject', methods=['POST'])
def reject_outpass(outpass_id):
    """Reject an outpass"""
    try:
        data = request.get_json(silent=True) or {}
        approved_by = data.get('approved_by')
        rejection_reason = data.get('rejection_reason')
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            UPDATE outpasses 
            SET status = 'rejected', approved_by = %s, approved_at = NOW(), rejection_reason = %s
            WHERE id = %s
        """
        cursor.execute(query, (approved_by, rejection_reason, outpass_id))
        connection.commit()

        cursor.execute(
            """
            SELECT u.email, u.name, o.destination, o.reason, o.out_date, o.out_time
            FROM outpasses o
            JOIN students s ON o.student_id = s.id
            JOIN users u ON s.user_id = u.id
            WHERE o.id = %s
            """,
            (outpass_id,)
        )
        student_info = cursor.fetchone()
        
        cursor.close()
        connection.close()

        email_sent = None
        if student_info and student_info.get('email'):
            email_sent = send_outpass_rejection_email(
                student_info['email'],
                student_info['name'],
                student_info,
                rejection_reason
            )
        
        return jsonify({'success': True, 'message': 'Outpass rejected', 'email_sent': email_sent}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/leaves/pending', methods=['GET'])
def get_pending_leaves():
    """Get all pending leave requests for warden"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT lr.*, 
                   u.name as student_name, 
                   s.roll_number,
                   r.room_number,
                 b.block_name,
                 TIMESTAMPDIFF(HOUR, lr.created_at, NOW()) AS pending_hours
            FROM leave_requests lr
            JOIN students s ON lr.student_id = s.id
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms r ON s.room_id = r.id
            LEFT JOIN blocks b ON r.block_id = b.id
            ORDER BY lr.created_at DESC
        """
        cursor.execute(query)
        leaves = cursor.fetchall()

        leaves = [serialize_row(row) for row in leaves]
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': leaves}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/leave/<int:leave_id>/approve', methods=['POST'])
def approve_leave(leave_id):
    """Approve a leave request"""
    try:
        data = request.get_json()
        approved_by = data.get('approved_by')
        remark = data.get('remark', '')
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Get leave details and student info
        cursor.execute("""
            SELECT lr.*, u.email as student_email, u.name as student_name
            FROM leave_requests lr
            JOIN students s ON lr.student_id = s.id
            JOIN users u ON s.user_id = u.id
            WHERE lr.id = %s
        """, (leave_id,))
        leave = cursor.fetchone()
        
        if not leave:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Leave request not found'}), 404
        
        # Auto-switch to active when approved within leave period.
        approved_status = 'approved'
        leave_from = leave.get('from_date')
        leave_to = leave.get('to_date')
        today = datetime.now().date()
        if leave_from and leave_to and leave_from <= today <= leave_to:
            approved_status = 'active'

        # Update leave status
        update_query = """
            UPDATE leave_requests 
            SET status = %s, approved_by = %s, approved_at = NOW(), active_at = CASE WHEN %s = 'active' THEN NOW() ELSE active_at END
            WHERE id = %s
        """
        cursor.execute(update_query, (approved_status, approved_by, approved_status, leave_id))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        # Send approval email to student
        email_sent = False
        if leave['student_email']:
            email_sent = send_leave_approval_email(
                leave['student_email'],
                leave['student_name'],
                leave['from_date'],
                leave['to_date'],
                leave['leave_type'],
                remark
            )
        else:
            print("Leave approval email skipped: student email missing")

        return jsonify({'success': True, 'message': f'Leave {approved_status}', 'email_sent': email_sent, 'status': approved_status}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/leave/<int:leave_id>/reject', methods=['POST'])
def reject_leave(leave_id):
    """Reject a leave request"""
    try:
        data = request.get_json()
        approved_by = data.get('approved_by')
        rejection_reason = data.get('rejection_reason', '')
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Get leave details and student info
        cursor.execute("""
            SELECT lr.*, u.email as student_email, u.name as student_name
            FROM leave_requests lr
            JOIN students s ON lr.student_id = s.id
            JOIN users u ON s.user_id = u.id
            WHERE lr.id = %s
        """, (leave_id,))
        leave = cursor.fetchone()
        
        if not leave:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Leave request not found'}), 404
        
        # Update leave status to rejected
        update_query = """
            UPDATE leave_requests 
            SET status = 'rejected', approved_by = %s, approved_at = NOW(), rejection_reason = %s
            WHERE id = %s
        """
        cursor.execute(update_query, (approved_by, rejection_reason, leave_id))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        # Send rejection email to student
        email_sent = False
        if leave['student_email']:
            email_sent = send_leave_rejection_email(
                leave['student_email'],
                leave['student_name'],
                leave['from_date'],
                leave['to_date'],
                leave['leave_type'],
                rejection_reason
            )
        else:
            print("Leave rejection email skipped: student email missing")

        return jsonify({'success': True, 'message': 'Leave rejected', 'email_sent': email_sent}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/leave-history/<string:roll_number>', methods=['GET'])
def get_leave_history(roll_number):
    """Get leave history for a student by roll number"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT lr.*, au.name as approved_by_name
            FROM leave_requests lr
            JOIN students s ON lr.student_id = s.id
            LEFT JOIN users au ON lr.approved_by = au.id
            WHERE s.roll_number = %s
              AND lr.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            ORDER BY lr.created_at DESC
        """
        cursor.execute(query, (roll_number,))
        leaves = cursor.fetchall()

        # Serialize datetime objects
        leaves = [serialize_row(row) for row in leaves]

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': leaves}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/leaves/agentic-alerts', methods=['GET'])
def get_warden_leave_agentic_alerts():
    """Get leave alerts generated by autonomous monitoring"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        limit = int(request.args.get('limit', 100))
        limit = 100 if limit <= 0 or limit > 200 else limit

        cursor.execute("""
            SELECT la.*, lr.status AS leave_status, lr.leave_type, lr.from_date, lr.to_date,
                   u.name AS student_name, s.roll_number
            FROM leave_agentic_alerts la
            LEFT JOIN leave_requests lr ON la.related_leave_id = lr.id
            LEFT JOIN students s ON la.student_id = s.id
            LEFT JOIN users u ON s.user_id = u.id
            ORDER BY la.updated_at DESC
            LIMIT %s
        """, (limit,))
        rows = cursor.fetchall() or []

        alerts = []
        for row in rows:
            item = serialize_row(row)
            if row.get('metadata_json'):
                try:
                    item['metadata'] = row['metadata_json'] if isinstance(row['metadata_json'], dict) else json.loads(row['metadata_json'])
                except Exception:
                    item['metadata'] = None
            alerts.append(item)

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': alerts, 'count': len(alerts)}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


def fetch_weekly_leave_insights_data(cursor):
    """Shared query set for leave insights payload"""
    cursor.execute("""
        SELECT s.id AS student_id, u.name AS student_name, s.roll_number, COUNT(*) AS leave_count
        FROM leave_requests lr
        JOIN students s ON lr.student_id = s.id
        JOIN users u ON s.user_id = u.id
        WHERE lr.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY s.id, u.name, s.roll_number
        ORDER BY leave_count DESC
        LIMIT 5
    """)
    top_students = cursor.fetchall() or []

    cursor.execute("""
        SELECT ROUND(AVG(total_days), 2) AS avg_leave_duration_days
        FROM leave_requests
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    """)
    avg_duration = (cursor.fetchone() or {}).get('avg_leave_duration_days') or 0

    cursor.execute("""
        SELECT DAYNAME(from_date) AS day_name, COUNT(*) AS total
        FROM leave_requests
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DAYNAME(from_date)
        ORDER BY total DESC
    """)
    trends = cursor.fetchall() or []

    return {
        'students_highest_leave_frequency': [serialize_row(item) for item in top_students],
        'average_leave_duration_days': avg_duration,
        'leave_trends_by_day': [serialize_row(item) for item in trends]
    }


@app.route('/api/warden/leaves/insights/weekly', methods=['GET'])
def get_weekly_leave_insights():
    """Get weekly leave insights for warden dashboards"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        data = fetch_weekly_leave_insights_data(cursor)
        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': data}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/leaves/agentic-monitor', methods=['GET'])
def get_leave_agentic_monitor_payload():
    """Combined payload for leave monitoring dashboard widgets"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) AS expired,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
                SUM(CASE WHEN status = 'pending' AND TIMESTAMPDIFF(HOUR, created_at, NOW()) >= %s THEN 1 ELSE 0 END) AS pending_too_long
            FROM leave_requests
        """, (LEAVE_PENDING_SLA_HOURS,))
        summary = cursor.fetchone() or {}

        cursor.execute("""
            SELECT la.id, la.related_leave_id, la.student_id, la.alert_type, la.severity, la.title, la.message,
                   la.created_at, la.updated_at, lr.status AS leave_status, u.name AS student_name, s.roll_number
            FROM leave_agentic_alerts la
            LEFT JOIN leave_requests lr ON la.related_leave_id = lr.id
            LEFT JOIN students s ON la.student_id = s.id
            LEFT JOIN users u ON s.user_id = u.id
            ORDER BY la.updated_at DESC
            LIMIT 20
        """)
        alerts = [serialize_row(row) for row in (cursor.fetchall() or [])]

        # Show only newly requested leaves on the Leave page alert strip.
        cursor.execute("""
            SELECT lr.id AS leave_id, lr.student_id, lr.created_at, lr.leave_type, lr.from_date, lr.to_date,
                   lr.status AS leave_status, u.name AS student_name, s.roll_number
            FROM leave_requests lr
            JOIN students s ON lr.student_id = s.id
            JOIN users u ON s.user_id = u.id
            WHERE lr.status = 'pending'
            ORDER BY lr.created_at DESC
            LIMIT 10
        """)
        new_request_rows = cursor.fetchall() or []
        new_request_alerts = []
        for row in new_request_rows:
            item = serialize_row(row)
            new_request_alerts.append({
                'alert_type': 'new_leave_request',
                'severity': 'medium',
                'title': 'New Leave Request',
                'message': (
                    f"{item.get('student_name') or 'Student'} ({item.get('roll_number') or 'N/A'}) "
                    f"requested {item.get('leave_type') or 'leave'} from {item.get('from_date')} to {item.get('to_date')}."
                ),
                'related_leave_id': item.get('leave_id'),
                'student_id': item.get('student_id'),
                'created_at': item.get('created_at'),
                'leave_status': item.get('leave_status')
            })

        recommendations = generate_leave_recommendations(cursor)
        weekly_insights = fetch_weekly_leave_insights_data(cursor)

        cursor.close()
        connection.close()

        return jsonify({
            'success': True,
            'data': {
                'status_summary': summary,
                'alerts': alerts,
                'new_request_alerts': new_request_alerts,
                'recommendations': recommendations,
                'weekly_insights': weekly_insights
            }
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/security/agentic-alerts', methods=['GET'])
def get_warden_security_agentic_alerts():
    """Get security alerts generated by Security Monitoring Agent"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        limit = int(request.args.get('limit', 100))
        limit = 100 if limit <= 0 or limit > 200 else limit
        unread_only = request.args.get('unread_only', 'false').lower() == 'true'

        where_clause = "WHERE sa.is_read = 0" if unread_only else ""

        cursor.execute("""
            SELECT sa.*, u.name AS student_name, s.roll_number, o.status AS outpass_status,
                   o.expected_return_time, o.actual_return_time
            FROM security_agentic_alerts sa
            LEFT JOIN students s ON sa.student_id = s.id
            LEFT JOIN users u ON s.user_id = u.id
            LEFT JOIN outpasses o ON sa.related_outpass_id = o.id
            {where_clause}
            ORDER BY sa.updated_at DESC
            LIMIT %s
        """.format(where_clause=where_clause), (limit,))
        rows = cursor.fetchall() or []

        cursor.execute("SELECT COUNT(*) AS unread_count FROM security_agentic_alerts WHERE is_read = 0")
        unread_count = int((cursor.fetchone() or {}).get('unread_count') or 0)

        alerts = []
        for row in rows:
            item = serialize_row(row)
            if row.get('metadata_json'):
                try:
                    item['metadata'] = row['metadata_json'] if isinstance(row['metadata_json'], dict) else json.loads(row['metadata_json'])
                except Exception:
                    item['metadata'] = None
            alerts.append(item)

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': alerts, 'count': len(alerts), 'unread_count': unread_count}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/security/agentic-alerts/<int:alert_id>/acknowledge', methods=['POST'])
def acknowledge_security_agentic_alert(alert_id):
    """Mark one security alert as read/acknowledged"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor()
        cursor.execute("UPDATE security_agentic_alerts SET is_read = 1 WHERE id = %s", (alert_id,))
        connection.commit()

        updated = cursor.rowcount
        cursor.close()
        connection.close()

        if updated == 0:
            return jsonify({'success': False, 'message': 'Security alert not found'}), 404

        return jsonify({'success': True, 'message': 'Security alert acknowledged'}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/security/agentic-alerts/acknowledge-all', methods=['POST'])
def acknowledge_all_security_agentic_alerts():
    """Mark all unread security alerts as acknowledged"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor()
        cursor.execute("UPDATE security_agentic_alerts SET is_read = 1 WHERE is_read = 0")
        connection.commit()
        updated = cursor.rowcount

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'message': f'Acknowledged {updated} security alerts', 'updated': updated}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/security/insights/weekly', methods=['GET'])
def get_weekly_security_insights():
    """Get weekly insights for security monitoring"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        insights = fetch_security_insights_data(cursor)
        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': insights}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/security/agentic-monitor', methods=['GET'])
def get_security_agentic_monitor_payload():
    """Combined payload for Security Monitoring Agent dashboard widgets"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                SUM(CASE WHEN alert_type = 'late_return' THEN 1 ELSE 0 END) AS late_returns,
                SUM(CASE WHEN alert_type = 'missing_return' THEN 1 ELSE 0 END) AS missing_students,
                SUM(CASE WHEN alert_type = 'unauthorized_exit_attempt' THEN 1 ELSE 0 END) AS unauthorized_exit_attempts,
                SUM(CASE WHEN alert_type = 'night_movement' THEN 1 ELSE 0 END) AS night_movements,
                SUM(CASE WHEN severity IN ('high', 'critical') THEN 1 ELSE 0 END) AS high_priority_alerts
            FROM security_agentic_alerts
            WHERE updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        """)
        status_summary = cursor.fetchone() or {}

        cursor.execute("""
            SELECT COUNT(*) AS high_risk_students
            FROM security_student_risk_profiles
            WHERE risk_level = 'high'
        """)
        high_risk_students = int((cursor.fetchone() or {}).get('high_risk_students') or 0)
        status_summary['high_risk_students'] = high_risk_students

        cursor.execute("""
            SELECT sa.id, sa.alert_type, sa.severity, sa.title, sa.message, sa.student_id, sa.related_outpass_id,
                   sa.created_at, sa.updated_at, u.name AS student_name, s.roll_number
            FROM security_agentic_alerts sa
            LEFT JOIN students s ON sa.student_id = s.id
            LEFT JOIN users u ON s.user_id = u.id
            ORDER BY sa.updated_at DESC
            LIMIT 20
        """)
        alerts = [serialize_row(row) for row in (cursor.fetchall() or [])]

        cursor.execute("""
            SELECT srp.student_id, srp.risk_score, srp.risk_level, srp.violation_count_30d,
                   u.name AS student_name, s.roll_number
            FROM security_student_risk_profiles srp
            JOIN students s ON srp.student_id = s.id
            JOIN users u ON s.user_id = u.id
            ORDER BY srp.risk_score DESC, srp.violation_count_30d DESC
            LIMIT 10
        """)
        risk_profiles = [serialize_row(row) for row in (cursor.fetchall() or [])]

        insights = fetch_security_insights_data(cursor)

        cursor.close()
        connection.close()

        return jsonify({
            'success': True,
            'data': {
                'status_summary': status_summary,
                'alerts': alerts,
                'risk_profiles': risk_profiles,
                'weekly_insights': insights
            }
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/settings/colleges', methods=['GET'])
def get_colleges():
    """Get colleges list"""
    try:
        include_inactive = request.args.get('includeInactive') == 'true'

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        if include_inactive:
            cursor.execute("SELECT id, name, status FROM colleges ORDER BY name")
        else:
            cursor.execute("SELECT id, name, status FROM colleges WHERE status = 'active' ORDER BY name")
        colleges = cursor.fetchall()

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': colleges}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/settings/colleges', methods=['POST'])
def create_college():
    """Create a college"""
    try:
        data = request.get_json()
        name = (data.get('name') or '').strip()
        status = data.get('status', 'active')

        if not name:
            return jsonify({'success': False, 'message': 'College name is required'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor()
        cursor.execute("INSERT INTO colleges (name, status) VALUES (%s, %s)", (name, status))
        connection.commit()

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'message': 'College created'}), 201

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/settings/colleges/<int:college_id>', methods=['PUT'])
def update_college(college_id):
    """Update a college"""
    try:
        data = request.get_json()
        name = (data.get('name') or '').strip()
        status = data.get('status')

        if not name and status is None:
            return jsonify({'success': False, 'message': 'Nothing to update'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor()

        updates = []
        params = []
        if name:
            updates.append("name = %s")
            params.append(name)
        if status:
            updates.append("status = %s")
            params.append(status)

        query = "UPDATE colleges SET " + ", ".join(updates) + " WHERE id = %s"
        params.append(college_id)
        cursor.execute(query, params)
        connection.commit()

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'message': 'College updated'}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/settings/colleges/<int:college_id>', methods=['DELETE'])
def delete_college(college_id):
    """Delete a college"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor()
        cursor.execute("DELETE FROM colleges WHERE id = %s", (college_id,))
        connection.commit()

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'message': 'College deleted'}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/settings/branches', methods=['GET'])
def get_branches():
    """Get branches list"""
    try:
        include_inactive = request.args.get('includeInactive') == 'true'

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        if include_inactive:
            cursor.execute("SELECT id, name, status FROM branches ORDER BY name")
        else:
            cursor.execute("SELECT id, name, status FROM branches WHERE status = 'active' ORDER BY name")
        branches = cursor.fetchall()

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': branches}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/settings/branches', methods=['POST'])
def create_branch():
    """Create a branch"""
    try:
        data = request.get_json()
        name = (data.get('name') or '').strip()
        status = data.get('status', 'active')

        if not name:
            return jsonify({'success': False, 'message': 'Branch name is required'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor()
        cursor.execute("INSERT INTO branches (name, status) VALUES (%s, %s)", (name, status))
        connection.commit()

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'message': 'Branch created'}), 201

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/settings/branches/<int:branch_id>', methods=['PUT'])
def update_branch(branch_id):
    """Update a branch"""
    try:
        data = request.get_json()
        name = (data.get('name') or '').strip()
        status = data.get('status')

        if not name and status is None:
            return jsonify({'success': False, 'message': 'Nothing to update'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor()

        updates = []
        params = []
        if name:
            updates.append("name = %s")
            params.append(name)
        if status:
            updates.append("status = %s")
            params.append(status)

        query = "UPDATE branches SET " + ", ".join(updates) + " WHERE id = %s"
        params.append(branch_id)
        cursor.execute(query, params)
        connection.commit()

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'message': 'Branch updated'}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/settings/branches/<int:branch_id>', methods=['DELETE'])
def delete_branch(branch_id):
    """Delete a branch"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor()
        cursor.execute("DELETE FROM branches WHERE id = %s", (branch_id,))
        connection.commit()

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'message': 'Branch deleted'}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/complaints/all', methods=['GET'])
def get_all_complaints():
    """Get all complaints for warden"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
                 SELECT c.*, 
                   u.name as student_name, 
                   s.roll_number,
                   r.room_number,
                   b.block_name,
                     tech.name as technician_name,
                     TIMESTAMPDIFF(HOUR, c.created_at, NOW()) AS age_hours
            FROM complaints c
            JOIN students s ON c.student_id = s.id
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms r ON s.room_id = r.id
            LEFT JOIN blocks b ON r.block_id = b.id
            LEFT JOIN users tech ON c.assigned_technician_id = tech.id
            ORDER BY 
                CASE c.priority
                    WHEN 'urgent' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    WHEN 'low' THEN 4
                END,
                c.created_at DESC
        """
        cursor.execute(query)
        complaints = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        # Serialize datetime objects
        serialized_complaints = [serialize_row(complaint) for complaint in complaints]
        
        return jsonify({'success': True, 'data': serialized_complaints}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/complaints/agentic-alerts', methods=['GET'])
def get_warden_complaint_agentic_alerts():
    """Get complaint alerts generated by autonomous monitoring"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        limit = int(request.args.get('limit', 100))
        limit = 100 if limit <= 0 or limit > 200 else limit

        cursor.execute("""
            SELECT a.*, c.status AS complaint_status, c.priority, c.category
            FROM complaint_agentic_alerts a
            LEFT JOIN complaints c ON a.complaint_id = c.id
            ORDER BY a.updated_at DESC
            LIMIT %s
        """, (limit,))
        rows = cursor.fetchall() or []

        alerts = []
        for row in rows:
            item = serialize_row(row)
            if row.get('metadata_json'):
                try:
                    item['metadata'] = row['metadata_json'] if isinstance(row['metadata_json'], dict) else json.loads(row['metadata_json'])
                except Exception:
                    item['metadata'] = None
            alerts.append(item)

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': alerts, 'count': len(alerts)}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/complaints/insights/weekly', methods=['GET'])
def get_weekly_complaint_insights():
    """Get weekly complaint insights for operations monitoring"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        insights = fetch_weekly_complaint_insights_data(cursor)

        cursor.close()
        connection.close()

        return jsonify({
            'success': True,
            'data': insights
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/complaints/agentic-monitor', methods=['GET'])
def get_complaint_agentic_monitor_payload():
    """Combined payload for real-time complaint monitoring dashboard widgets"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS newly_submitted,
                SUM(CASE WHEN status IN ('assigned', 'in_progress') THEN 1 ELSE 0 END) AS in_progress,
                SUM(CASE WHEN status IN ('resolved', 'closed') THEN 1 ELSE 0 END) AS resolved,
                SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END) AS pending_too_long,
                SUM(CASE WHEN status = 'delayed' AND escalated_at IS NOT NULL THEN 1 ELSE 0 END) AS escalated
            FROM complaints
        """)
        status_summary = cursor.fetchone() or {}

        cursor.execute("""
            SELECT a.id, a.complaint_id, a.alert_type, a.severity, a.title, a.message, a.created_at, a.updated_at,
                   c.status AS complaint_status
            FROM complaint_agentic_alerts a
            LEFT JOIN complaints c ON a.complaint_id = c.id
            ORDER BY a.updated_at DESC
            LIMIT 20
        """)
        alerts = [serialize_row(row) for row in (cursor.fetchall() or [])]

        recommendations = generate_complaint_recommendations(cursor)
        weekly_payload = fetch_weekly_complaint_insights_data(cursor)

        cursor.close()
        connection.close()

        return jsonify({
            'success': True,
            'data': {
                'status_summary': status_summary,
                'alerts': alerts,
                'recommendations': recommendations,
                'weekly_insights': weekly_payload
            }
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


def fetch_weekly_complaint_insights_data(cursor):
    """Shared query set used by complaint insights APIs"""
    cursor.execute("""
        SELECT category, COUNT(*) AS total
        FROM complaints
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY category
        ORDER BY total DESC
        LIMIT 1
    """)
    top_category = cursor.fetchone() or {'category': None, 'total': 0}

    cursor.execute("""
        SELECT ROUND(AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)), 2) AS avg_resolution_hours
        FROM complaints
        WHERE resolved_at IS NOT NULL
          AND resolved_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    """)
    avg_resolution = (cursor.fetchone() or {}).get('avg_resolution_hours')

    cursor.execute("""
        SELECT u.id AS technician_id,
               u.name AS technician_name,
               COUNT(c.id) AS total_assigned,
               SUM(CASE WHEN c.status IN ('resolved', 'closed') THEN 1 ELSE 0 END) AS total_resolved,
               ROUND(AVG(CASE WHEN c.resolved_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, c.assigned_at, c.resolved_at) END), 2) AS avg_resolution_hours
        FROM users u
        JOIN technicians t ON t.user_id = u.id
        LEFT JOIN complaints c ON c.assigned_technician_id = u.id
            AND c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY u.id, u.name
        ORDER BY total_resolved DESC, total_assigned DESC
        LIMIT 10
    """)
    technician_performance = cursor.fetchall() or []

    cursor.execute("""
        SELECT
            COUNT(*) AS total_open,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS newly_submitted,
            SUM(CASE WHEN status IN ('assigned', 'in_progress') THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
            SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END) AS pending_too_long
        FROM complaints
        WHERE status IN ('pending', 'assigned', 'in_progress', 'delayed', 'resolved')
    """)
    snapshot = cursor.fetchone() or {}

    return {
        'most_frequent_complaint_type': top_category,
        'average_resolution_time_hours': avg_resolution or 0,
        'technician_performance': [serialize_row(item) for item in technician_performance],
        'status_snapshot': snapshot
    }


@app.route('/api/warden/complaints/pending', methods=['GET'])
def get_pending_complaints_warden():
    """Get pending complaints for warden"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT c.*, 
                   u.name as student_name, 
                   s.roll_number,
                   r.room_number,
                   b.name as block_name,
                   tech.name as technician_name
            FROM complaints c
            JOIN students s ON c.student_id = s.id
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms r ON s.room_id = r.id
            LEFT JOIN blocks b ON r.block_id = b.id
            LEFT JOIN users tech ON c.assigned_technician_id = tech.id
            WHERE c.status = 'pending'
            ORDER BY c.priority DESC, c.created_at ASC
        """
        cursor.execute(query)
        complaints = cursor.fetchall()
        
        serialized_complaints = [serialize_row(complaint) for complaint in complaints]
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': serialized_complaints}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/complaints/assigned', methods=['GET'])
def get_assigned_complaints_warden():
    """Get assigned/in-progress complaints for warden"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT c.*, 
                   u.name as student_name, 
                   s.roll_number,
                   r.room_number,
                   b.name as block_name,
                   tech.name as technician_name
            FROM complaints c
            JOIN students s ON c.student_id = s.id
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms r ON s.room_id = r.id
            LEFT JOIN blocks b ON r.block_id = b.id
            LEFT JOIN users tech ON c.assigned_technician_id = tech.id
            WHERE c.status IN ('assigned', 'in_progress', 'delayed')
            ORDER BY c.priority DESC, c.created_at ASC
        """
        cursor.execute(query)
        complaints = cursor.fetchall()
        
        serialized_complaints = [serialize_row(complaint) for complaint in complaints]
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': serialized_complaints}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/complaints/resolved', methods=['GET'])
def get_resolved_complaints_warden():
    """Get resolved/closed complaints for warden"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT c.*, 
                   u.name as student_name, 
                   s.roll_number,
                   r.room_number,
                   b.name as block_name,
                   tech.name as technician_name
            FROM complaints c
            JOIN students s ON c.student_id = s.id
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms r ON s.room_id = r.id
            LEFT JOIN blocks b ON r.block_id = b.id
            LEFT JOIN users tech ON c.assigned_technician_id = tech.id
            WHERE c.status IN ('resolved', 'closed')
            ORDER BY c.resolved_at DESC, c.created_at ASC
        """
        cursor.execute(query)
        complaints = cursor.fetchall()
        
        serialized_complaints = [serialize_row(complaint) for complaint in complaints]
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': serialized_complaints}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/complaint/<int:complaint_id>/assign', methods=['POST'])
def assign_complaint_warden(complaint_id):
    """Assign a complaint to a technician from warden view"""
    try:
        data = request.get_json()
        technician_id = data.get('technician_id')
        
        if not technician_id:
            return jsonify({'success': False, 'message': 'Technician ID required'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Verify complaint exists
        cursor.execute("SELECT id, status FROM complaints WHERE id = %s", (complaint_id,))
        complaint = cursor.fetchone()
        
        if not complaint:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Complaint not found'}), 404
        
        # Verify technician exists
        cursor.execute("SELECT id FROM users WHERE id = %s AND role = 'technician'", (technician_id,))
        technician = cursor.fetchone()
        
        if not technician:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Technician not found'}), 404
        
        # Update complaint
        cursor.execute("""
            UPDATE complaints 
            SET status = 'assigned', assigned_technician_id = %s, assigned_at = NOW(), last_technician_update_at = NULL
            WHERE id = %s
        """, (technician_id, complaint_id))
        
        # Add to history
        cursor.execute("""
            INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by)
            VALUES (%s, %s, 'assigned', NULL)
        """, (complaint_id, complaint['status']))
        
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'message': 'Complaint assigned to technician'}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/technicians', methods=['GET'])
def get_warden_technicians():
    """Get all technicians for warden assignments"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT 
                t.id,
                t.user_id,
                u.name,
                u.email,
                u.staff_id,
                t.specialization,
                t.phone,
                t.availability_status,
                COALESCE(SUM(CASE WHEN c.status IN ('assigned', 'in_progress') THEN 1 ELSE 0 END), 0) AS assigned_complaints
            FROM technicians t
            JOIN users u ON t.user_id = u.id
            LEFT JOIN complaints c ON c.assigned_technician_id = u.id
            GROUP BY t.id, t.user_id, u.name, u.email, u.staff_id, t.specialization, t.phone, t.availability_status
            ORDER BY u.name
        """
        cursor.execute(query)
        technicians = cursor.fetchall()

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': technicians}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/technicians', methods=['POST'])
def add_technician():
    """Add a new technician"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'email', 'password', 'specialization', 'phone']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'{field} is required'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        # Check if email already exists
        cursor.execute("SELECT id FROM users WHERE email = %s", (data['email'],))
        if cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Email already exists'}), 400

        # Hash password
        hashed_password = generate_password_hash(data['password'])

        # Generate staff_id for technician
        staff_id = generate_staff_id('technician', connection)

        # Insert user
        cursor.execute("""
            INSERT INTO users (name, email, password, role, status, staff_id)
            VALUES (%s, %s, %s, 'technician', 'active', %s)
        """, (data['name'], data['email'], hashed_password, staff_id))
        
        user_id = cursor.lastrowid

        # Insert technician profile
        cursor.execute("""
            INSERT INTO technicians (user_id, employee_id, specialization, phone, 
                                    alternate_phone, availability_status, expertise_areas)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            user_id,
            staff_id,
            data['specialization'],
            data['phone'],
            data.get('alternate_phone'),
            data.get('availability_status', 'available'),
            data.get('expertise_areas')
        ))

        connection.commit()
        cursor.close()
        connection.close()

        return jsonify({'success': True, 'message': 'Technician added successfully'}), 201

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/technicians/<int:technician_id>', methods=['PUT'])
def update_technician(technician_id):
    """Update technician details"""
    try:
        data = request.get_json()

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        # Get user_id from technician_id
        cursor.execute("SELECT user_id FROM technicians WHERE id = %s", (technician_id,))
        tech = cursor.fetchone()
        if not tech:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Technician not found'}), 404

        user_id = tech['user_id']

        # Update user table
        if data.get('name') or data.get('email') or data.get('password'):
            update_parts = []
            params = []
            if data.get('name'):
                update_parts.append("name = %s")
                params.append(data['name'])
            if data.get('email'):
                # Check if new email already exists
                cursor.execute("SELECT id FROM users WHERE email = %s AND id != %s", (data['email'], user_id))
                if cursor.fetchone():
                    cursor.close()
                    connection.close()
                    return jsonify({'success': False, 'message': 'Email already exists'}), 400
                update_parts.append("email = %s")
                params.append(data['email'])
            if data.get('password'):
                # Hash the new password
                hashed_password = generate_password_hash(data['password'])
                update_parts.append("password = %s")
                params.append(hashed_password)
            
            if update_parts:
                params.append(user_id)
                cursor.execute(f"UPDATE users SET {', '.join(update_parts)} WHERE id = %s", tuple(params))

        # Update technicians table
        tech_updates = []
        tech_params = []
        
        fields = ['specialization', 'phone', 'alternate_phone', 'availability_status', 'expertise_areas']
        
        for field in fields:
            if field in data:
                tech_updates.append(f"{field} = %s")
                tech_params.append(data[field])
        
        if tech_updates:
            tech_params.append(technician_id)
            cursor.execute(f"UPDATE technicians SET {', '.join(tech_updates)} WHERE id = %s", tuple(tech_params))

        connection.commit()
        cursor.close()
        connection.close()

        return jsonify({'success': True, 'message': 'Technician updated successfully'}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/technicians/<int:technician_id>', methods=['DELETE'])
def delete_technician(technician_id):
    """Delete a technician"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        # Get user_id
        cursor.execute("SELECT user_id FROM technicians WHERE id = %s", (technician_id,))
        tech = cursor.fetchone()
        if not tech:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Technician not found'}), 404

        # Delete technician (will cascade to user due to foreign key)
        cursor.execute("DELETE FROM users WHERE id = %s", (tech['user_id'],))
        
        connection.commit()
        cursor.close()
        connection.close()

        return jsonify({'success': True, 'message': 'Technician deleted successfully'}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/technicians/<int:technician_id>/status', methods=['PATCH'])
def update_technician_status(technician_id):
    """Update technician availability status (activate/deactivate)"""
    try:
        data = request.get_json()
        status = data.get('availability_status')
        
        if status not in ['available', 'busy', 'on_leave', 'off_duty']:
            return jsonify({'success': False, 'message': 'Invalid status'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        cursor.execute("UPDATE technicians SET availability_status = %s WHERE id = %s", (status, technician_id))
        
        if cursor.rowcount == 0:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Technician not found'}), 404

        connection.commit()
        cursor.close()
        connection.close()

        return jsonify({'success': True, 'message': 'Status updated successfully'}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/technicians/<int:technician_id>/password', methods=['PUT'])
def change_technician_password(technician_id):
    """Change password for a technician using technician_id."""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT user_id FROM technicians WHERE id = %s", (technician_id,))
        tech = cursor.fetchone()
        cursor.close()
        connection.close()

        if not tech:
            return jsonify({'success': False, 'message': 'Technician not found'}), 404

        return change_user_password(int(tech['user_id']))
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ========================================
# PROFILE ENDPOINTS
# ========================================

@app.route('/api/warden/profile/<int:user_id>', methods=['GET'])
def get_warden_profile(user_id):
    """Get warden profile details"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT u.id, u.name, u.email, u.status, u.created_at, u.staff_id,
                   w.phone, b.block_name
            FROM users u
            LEFT JOIN wardens w ON u.id = w.user_id
            LEFT JOIN blocks b ON b.warden_id = u.id
            WHERE u.id = %s AND u.role = 'warden'
        """
        cursor.execute(query, (user_id,))
        warden = cursor.fetchone()
        
        if warden:
            warden = serialize_row(warden)
            cursor.close()
            connection.close()
            return jsonify({'success': True, 'data': warden}), 200
        else:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Warden not found'}), 404
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/security/profile/<int:user_id>', methods=['GET'])
def get_security_profile(user_id):
    """Get security personnel profile details"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT u.id, u.name, u.email, u.status, u.created_at, u.staff_id,
                   sp.employee_id, sp.shift_timing, sp.gate_assigned, sp.phone
            FROM users u
            LEFT JOIN security_personnel sp ON u.id = sp.user_id
            WHERE u.id = %s AND u.role = 'security'
        """
        cursor.execute(query, (user_id,))
        security = cursor.fetchone()
        
        if security:
            security = serialize_row(security)
            cursor.close()
            connection.close()
            return jsonify({'success': True, 'data': security}), 200
        else:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Security personnel not found'}), 404
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/technician/profile/<int:user_id>', methods=['GET'])
def get_technician_profile(user_id):
    """Get technician profile details"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT u.id, u.name, u.email, u.status, u.created_at, u.staff_id,
                   t.employee_id, t.specialization, t.phone,
                   (SELECT COUNT(*) FROM complaints WHERE assigned_technician_id = u.id AND status IN ('assigned', 'in_progress')) as active_complaints,
                   (SELECT COUNT(*) FROM complaints WHERE assigned_technician_id = u.id AND status = 'resolved') as resolved_complaints
            FROM users u
            LEFT JOIN technicians t ON u.id = t.user_id
            WHERE u.id = %s AND u.role = 'technician'
        """
        cursor.execute(query, (user_id,))
        technician = cursor.fetchone()
        
        if technician:
            technician = serialize_row(technician)
            cursor.close()
            connection.close()
            return jsonify({'success': True, 'data': technician}), 200
        else:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Technician not found'}), 404
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/profile/<int:user_id>', methods=['GET'])
def get_admin_profile(user_id):
    """Get admin profile details"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT u.id, u.name, u.email, u.status, u.created_at
            FROM users u
            WHERE u.id = %s AND u.role = 'admin'
        """
        cursor.execute(query, (user_id,))
        admin = cursor.fetchone()
        
        if admin:
            admin = serialize_row(admin)
            cursor.close()
            connection.close()
            return jsonify({'success': True, 'data': admin}), 200
        else:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Admin not found'}), 404
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/room-change-requests', methods=['GET'])
def get_room_change_requests():
    """Get all room change requests"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # First, ensure the table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS room_change_requests (
              id INT AUTO_INCREMENT PRIMARY KEY,
              student_id INT NOT NULL,
              current_room_id INT,
              requested_room_id INT,
              requested_block_id INT,
              preference_reason VARCHAR(255),
              full_reason TEXT NOT NULL,
              room_preference VARCHAR(100),
              status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
              approved_by INT,
              approved_at TIMESTAMP NULL,
              rejection_reason TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              
              FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
              FOREIGN KEY (current_room_id) REFERENCES rooms(id) ON DELETE SET NULL,
              FOREIGN KEY (requested_room_id) REFERENCES rooms(id) ON DELETE SET NULL,
              FOREIGN KEY (requested_block_id) REFERENCES blocks(id) ON DELETE SET NULL,
              FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
              INDEX idx_student_id (student_id),
              INDEX idx_status (status),
              INDEX idx_current_room (current_room_id),
              INDEX idx_requested_room (requested_room_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        connection.commit()
        
        query = """
            SELECT rcr.*, 
                   u.name as student_name, 
                   u.email as student_email,
                   s.roll_number,
                   s.branch,
                   s.phone,
                   COALESCE(cr.room_number, acr.room_number) as current_room_number,
                   COALESCE(cb.block_name, acb.block_name) as current_block_name,
                   COALESCE(rr.room_number, NULLIF(rcr.room_preference, '')) as requested_room_number,
                   rb.block_name as requested_block_name,
                   rr.capacity as requested_room_capacity,
                   rr.occupied_count as requested_room_occupied
            FROM room_change_requests rcr
            JOIN students s ON rcr.student_id = s.id
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms cr ON rcr.current_room_id = cr.id
            LEFT JOIN blocks cb ON cr.block_id = cb.id
            LEFT JOIN room_allocations ra ON s.id = ra.student_id AND ra.status = 'active'
            LEFT JOIN rooms acr ON ra.room_id = acr.id
            LEFT JOIN blocks acb ON acr.block_id = acb.id
            LEFT JOIN rooms rr ON rcr.requested_room_id = rr.id
            LEFT JOIN blocks rb ON rcr.requested_block_id = rb.id
            ORDER BY rcr.created_at DESC
        """
        cursor.execute(query)
        requests = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': requests}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/room-change-request/<int:request_id>/approve', methods=['POST'])
def approve_room_change(request_id):
    """Approve a room change request"""
    try:
        data = request.get_json()
        approved_by = data.get('approved_by')
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Get request details
        cursor.execute("""
            SELECT rcr.*, s.room_id as current_student_room
            FROM room_change_requests rcr
            JOIN students s ON rcr.student_id = s.id
            WHERE rcr.id = %s
        """, (request_id,))
        req = cursor.fetchone()
        
        if not req:
            return jsonify({'success': False, 'message': 'Request not found'}), 404
        
        # Check if requested room has space
        if req['requested_room_id']:
            cursor.execute("""
                SELECT capacity, occupied_count 
                FROM rooms WHERE id = %s
            """, (req['requested_room_id'],))
            new_room = cursor.fetchone()
            
            if not new_room:
                return jsonify({'success': False, 'message': 'Requested room not found'}), 404
            
            if new_room['occupied_count'] >= new_room['capacity']:
                return jsonify({'success': False, 'message': 'Requested room is full'}), 400
        
        # Update old room if exists and is different from new room
        if req['current_student_room'] and req['current_student_room'] != req['requested_room_id']:
            cursor.execute("""
                UPDATE rooms 
                SET occupied_count = GREATEST(0, occupied_count - 1),
                    status = CASE 
                        WHEN occupied_count - 1 <= 0 THEN 'available'
                        WHEN occupied_count - 1 < capacity THEN 'available' 
                        ELSE status 
                    END
                WHERE id = %s
            """, (req['current_student_room'],))
            
            # Mark old allocation as transferred
            cursor.execute("""
                UPDATE room_allocations 
                SET status = 'transferred', checkout_date = CURDATE()
                WHERE student_id = %s AND status = 'active'
            """, (req['student_id'],))
        
        # Update new room (only if different from current room)
        if req['requested_room_id'] and req['current_student_room'] != req['requested_room_id']:
            cursor.execute("""
                UPDATE rooms 
                SET occupied_count = occupied_count + 1,
                    status = CASE 
                        WHEN occupied_count + 1 >= capacity THEN 'full' 
                        ELSE 'available' 
                    END
                WHERE id = %s
            """, (req['requested_room_id'],))
            
            # Update student's room
            cursor.execute("""
                UPDATE students SET room_id = %s WHERE id = %s
            """, (req['requested_room_id'], req['student_id']))
            
            # Create new allocation
            cursor.execute("""
                INSERT INTO room_allocations 
                (student_id, room_id, allocation_date, status)
                VALUES (%s, %s, CURDATE(), 'active')
            """, (req['student_id'], req['requested_room_id']))
        
        # Update request status
        cursor.execute("""
            UPDATE room_change_requests 
            SET status = 'approved', approved_by = %s, approved_at = NOW()
            WHERE id = %s
        """, (approved_by, request_id))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'message': 'Room change approved'}), 200
        
    except Exception as e:
        connection.rollback() if connection else None
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/room-change-request/<int:request_id>/reject', methods=['POST'])
def reject_room_change(request_id):
    """Reject a room change request"""
    try:
        data = request.get_json()
        approved_by = data.get('approved_by')
        rejection_reason = data.get('rejection_reason')
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor()
        
        query = """
            UPDATE room_change_requests 
            SET status = 'rejected', approved_by = %s, approved_at = NOW(), rejection_reason = %s
            WHERE id = %s
        """
        cursor.execute(query, (approved_by, rejection_reason, request_id))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'message': 'Room change request rejected'}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ========================================
# ADMIN ENDPOINTS
# ========================================

@app.route('/api/admin/dashboard', methods=['GET'])
def get_admin_dashboard():
    """Get admin dashboard statistics"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        stats = {}
        
        # Total students
        cursor.execute("SELECT COUNT(*) as count FROM students WHERE registration_status = 'approved'")
        stats['total_students'] = cursor.fetchone()['count']
        
        # Pending outpasses
        cursor.execute("SELECT COUNT(*) as count FROM outpasses WHERE status = 'pending'")
        stats['pending_outpasses'] = cursor.fetchone()['count']
        
        # Active complaints
        cursor.execute("SELECT COUNT(*) as count FROM complaints WHERE status IN ('pending', 'assigned', 'in_progress')")
        stats['active_complaints'] = cursor.fetchone()['count']
        
        # Pending registrations
        cursor.execute("SELECT COUNT(*) as count FROM students WHERE registration_status = 'pending'")
        stats['pending_registrations'] = cursor.fetchone()['count']
        
        # Total rooms
        cursor.execute("SELECT COUNT(*) as count FROM rooms")
        stats['total_rooms'] = cursor.fetchone()['count']
        
        # Occupied rooms
        cursor.execute("SELECT COUNT(*) as count FROM room_allocations WHERE status = 'active'")
        stats['occupied_rooms'] = cursor.fetchone()['count']
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': stats}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


def _format_relative_time(activity_time):
    """Convert datetime to compact relative string for dashboard feeds."""
    if not activity_time:
        return 'Unknown'

    if isinstance(activity_time, str):
        return activity_time

    now = datetime.now()
    diff = now - activity_time
    seconds = int(diff.total_seconds())

    if seconds < 60:
        return 'Just now'
    if seconds < 3600:
        minutes = seconds // 60
        return f"{minutes} min{'s' if minutes != 1 else ''} ago"
    if seconds < 86400:
        hours = seconds // 3600
        return f"{hours} hour{'s' if hours != 1 else ''} ago"

    days = diff.days
    return f"{days} day{'s' if days != 1 else ''} ago"


@app.route('/api/admin/dashboard/recent-activities', methods=['GET'])
def get_admin_recent_activities():
    """Get recent admin activities from real operational tables."""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        activities = []

        cursor.execute("""
            SELECT c.id, u.name AS student_name, c.status, c.created_at AS activity_time
            FROM complaints c
            JOIN students s ON c.student_id = s.id
            JOIN users u ON s.user_id = u.id
            ORDER BY c.created_at DESC
            LIMIT 5
        """)
        for row in cursor.fetchall():
            status = (row.get('status') or 'pending').lower()
            action = 'Complaint submitted' if status in ['pending', 'assigned', 'in_progress', 'delayed'] else 'Complaint resolved'
            activities.append({
                'id': f"complaint_{row['id']}",
                'type': 'complaint',
                'action': f"{action} by {row.get('student_name', 'student')}",
                'time': _format_relative_time(row.get('activity_time')),
                'status': 'pending' if status in ['pending', 'assigned', 'in_progress', 'delayed'] else 'resolved',
                '_sort_time': row.get('activity_time')
            })

        cursor.execute("""
            SELECT s.id, u.name AS student_name, s.registration_status, u.created_at AS activity_time
            FROM students s
            JOIN users u ON s.user_id = u.id
            ORDER BY u.created_at DESC
            LIMIT 5
        """)
        for row in cursor.fetchall():
            reg_status = (row.get('registration_status') or 'pending').lower()
            action = 'Student registration approved' if reg_status == 'approved' else 'Student registration submitted'
            activities.append({
                'id': f"registration_{row['id']}",
                'type': 'registration',
                'action': f"{action}: {row.get('student_name', 'student')}",
                'time': _format_relative_time(row.get('activity_time')),
                'status': 'approved' if reg_status == 'approved' else 'pending',
                '_sort_time': row.get('activity_time')
            })

        cursor.execute("""
            SELECT o.id, u.name AS student_name, o.status, o.created_at AS activity_time
            FROM outpasses o
            JOIN students s ON o.student_id = s.id
            JOIN users u ON s.user_id = u.id
            ORDER BY o.created_at DESC
            LIMIT 5
        """)
        for row in cursor.fetchall():
            outpass_status = (row.get('status') or 'pending').lower()
            activities.append({
                'id': f"outpass_{row['id']}",
                'type': 'outpass',
                'action': f"Outpass request by {row.get('student_name', 'student')}",
                'time': _format_relative_time(row.get('activity_time')),
                'status': 'approved' if outpass_status in ['approved', 'approved_otp', 'exited', 'returned'] else 'pending',
                '_sort_time': row.get('activity_time')
            })

        activities.sort(key=lambda x: x.get('_sort_time') or datetime.min, reverse=True)
        activities = activities[:10]
        for row in activities:
            row.pop('_sort_time', None)

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': activities}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/dashboard/pending-approvals', methods=['GET'])
def get_admin_pending_approvals():
    """Get pending approval queue for admin dashboard from real data."""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        pending_items = []

        cursor.execute("""
            SELECT s.id, u.name, u.created_at AS created_time
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE s.registration_status = 'pending'
            ORDER BY u.created_at DESC
            LIMIT 5
        """)
        for row in cursor.fetchall():
            pending_items.append({
                'id': f"registration_{row['id']}",
                'type': 'Registration',
                'name': row.get('name') or 'Student',
                'date': row.get('created_time'),
                'priority': 'high',
                '_sort_time': row.get('created_time')
            })

        cursor.execute("""
            SELECT o.id, u.name, o.created_at AS created_time
            FROM outpasses o
            JOIN students s ON o.student_id = s.id
            JOIN users u ON s.user_id = u.id
            WHERE o.status IN ('pending', 'pending_otp')
            ORDER BY o.created_at DESC
            LIMIT 5
        """)
        for row in cursor.fetchall():
            pending_items.append({
                'id': f"outpass_{row['id']}",
                'type': 'Outpass',
                'name': row.get('name') or 'Student',
                'date': row.get('created_time'),
                'priority': 'medium',
                '_sort_time': row.get('created_time')
            })

        pending_items.sort(key=lambda x: x.get('_sort_time') or datetime.min, reverse=True)
        pending_items = pending_items[:10]
        for row in pending_items:
            row.pop('_sort_time', None)

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': [serialize_row(item) for item in pending_items]}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/reports/analytics', methods=['GET'])
def get_admin_reports_analytics():
    """Get comprehensive analytics data for admin reports"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        analytics = {}
        
        # Total students (approved)
        cursor.execute("SELECT COUNT(*) as count FROM students WHERE registration_status = 'approved'")
        analytics['total_students'] = cursor.fetchone()['count']
        
        # Total rooms
        cursor.execute("SELECT COUNT(*) as count FROM rooms")
        analytics['total_rooms'] = cursor.fetchone()['count']
        
        # Occupied and vacant rooms
        cursor.execute("SELECT CAST(SUM(occupied_count) AS UNSIGNED) as occupied FROM rooms")
        result = cursor.fetchone()
        analytics['occupied_rooms'] = int(result['occupied'] or 0)
        analytics['vacant_rooms'] = analytics['total_rooms'] - analytics['occupied_rooms']
        
        # Total complaints
        cursor.execute("SELECT COUNT(*) as count FROM complaints")
        analytics['total_complaints'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM complaints WHERE status = 'pending'")
        analytics['pending_complaints'] = cursor.fetchone()['count']

        # Active = assigned + in_progress + delayed (all still open/being worked on)
        cursor.execute("SELECT COUNT(*) as count FROM complaints WHERE status IN ('assigned', 'in_progress', 'delayed')")
        analytics['active_complaints'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM complaints WHERE status = 'delayed'")
        analytics['delayed_complaints'] = cursor.fetchone()['count']

        # Resolved complaints
        cursor.execute("SELECT COUNT(*) as count FROM complaints WHERE status IN ('resolved', 'closed')")
        analytics['resolved_complaints'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM complaints WHERE status = 'cancelled'")
        analytics['cancelled_complaints'] = cursor.fetchone()['count']
        
        # Total outpasses
        cursor.execute("SELECT COUNT(*) as count FROM outpasses")
        analytics['total_outpasses'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM outpasses WHERE status IN ('pending', 'pending_otp')")
        analytics['pending_outpasses'] = cursor.fetchone()['count']

        # Approved = currently approved (including otp-approved, exited/out, overdue)
        cursor.execute("SELECT COUNT(*) as count FROM outpasses WHERE status IN ('approved', 'approved_otp', 'exited', 'overdue')")
        analytics['active_outpasses'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM outpasses WHERE status = 'returned'")
        analytics['returned_outpasses'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM outpasses WHERE status = 'overdue'")
        analytics['overdue_outpasses'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM outpasses WHERE status = 'rejected'")
        analytics['rejected_outpasses'] = cursor.fetchone()['count']

        # Registration summary
        cursor.execute("SELECT COUNT(*) as count FROM students")
        analytics['total_registrations'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM students WHERE registration_status = 'pending'")
        analytics['pending_registrations'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM students WHERE registration_status = 'approved'")
        analytics['approved_registrations'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM students WHERE registration_status = 'rejected'")
        analytics['rejected_registrations'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM students WHERE registration_status = 'approved' AND fee_status = 'paid'")
        analytics['fees_paid_registrations'] = cursor.fetchone()['count']

        # Leave activity summary
        cursor.execute("SELECT COUNT(*) as count FROM leave_requests")
        analytics['total_leaves'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM leave_requests WHERE status = 'pending'")
        analytics['pending_leaves'] = cursor.fetchone()['count']

        # approved + active + completed are all leaves that were approved at some point
        cursor.execute("SELECT COUNT(*) as count FROM leave_requests WHERE status IN ('approved', 'active', 'completed')")
        analytics['approved_leaves'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM leave_requests WHERE status = 'active'")
        analytics['active_leaves'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM leave_requests WHERE status = 'completed'")
        analytics['completed_leaves'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM leave_requests WHERE status = 'rejected'")
        analytics['rejected_leaves'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM leave_requests WHERE status = 'cancelled'")
        analytics['cancelled_leaves'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM leave_requests WHERE status = 'expired'")
        analytics['expired_leaves'] = cursor.fetchone()['count']
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': analytics}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/reports/room-occupancy-trend', methods=['GET'])
def get_room_occupancy_trend():
    """Get year-wise room occupancy trend using year-end occupancy snapshot."""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        # Capacity (beds) based on current room capacities
        cursor.execute("SELECT COALESCE(SUM(capacity), 0) AS total_capacity FROM rooms")
        total_capacity = int((cursor.fetchone() or {}).get('total_capacity') or 0)

        # Build year list from allocation history; fallback to last 5 years including current year
        cursor.execute("SELECT MIN(YEAR(allocation_date)) AS min_year FROM room_allocations")
        min_year_result = cursor.fetchone() or {}
        current_year = datetime.now().year
        min_year = min_year_result.get('min_year')

        if min_year is None:
            start_year = current_year - 4
        else:
            start_year = max(int(min_year), current_year - 7)

        trend_data = []
        for year in range(start_year, current_year + 1):
            snapshot_date = f"{year}-12-31"
            cursor.execute(
                """
                SELECT COUNT(*) AS occupied
                FROM room_allocations ra
                WHERE ra.allocation_date <= %s
                  AND (ra.checkout_date IS NULL OR ra.checkout_date > %s)
                """,
                (snapshot_date, snapshot_date)
            )
            occupied = int((cursor.fetchone() or {}).get('occupied') or 0)
            occupancy = round((occupied / total_capacity) * 100, 2) if total_capacity > 0 else 0

            trend_data.append({
                'year': str(year),
                'occupancy': min(occupancy, 100),
                'occupied_beds': occupied,
                'total_capacity': total_capacity
            })
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': trend_data}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/reports/complaints-by-category', methods=['GET'])
def get_complaints_by_category():
    """Get complaints grouped by category"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT category, COUNT(*) as count
            FROM complaints
            GROUP BY category
            ORDER BY count DESC
        """
        cursor.execute(query)
        results = cursor.fetchall()
        
        # Assign colors to categories
        colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444']
        
        complaints_data = []
        for i, row in enumerate(results):
            complaints_data.append({
                'category': row['category'] or 'Other',
                'count': row['count'],
                'color': colors[i % len(colors)]
            })
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': complaints_data}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/reports/outpass-trend', methods=['GET'])
def get_outpass_trend():
    """Get outpass requests trend over last 6 months"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT 
                DATE_FORMAT(created_at, '%b') as month,
                COUNT(*) as count
            FROM outpasses
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b')
            ORDER BY DATE_FORMAT(created_at, '%Y-%m')
        """
        cursor.execute(query)
        results = cursor.fetchall()
        
        # If no data, return dummy data for visualization
        if not results:
            months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan']
            results = [{'month': month, 'count': 0} for month in months]
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': results}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/reports/leave-trend', methods=['GET'])
def get_leave_trend():
    """Get leave request trend over last 6 months"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                DATE_FORMAT(created_at, '%b') as month,
                COUNT(*) as count
            FROM leave_requests
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b')
            ORDER BY DATE_FORMAT(created_at, '%Y-%m')
        """
        cursor.execute(query)
        results = cursor.fetchall()

        if not results:
            months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan']
            results = [{'month': month, 'count': 0} for month in months]

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': results}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/hostel-blocks', methods=['GET'])
def get_hostel_blocks():
    """Get all hostel blocks with room count information"""
    try:
        requested_gender = (request.args.get('gender') or '').strip().lower()
        if requested_gender and requested_gender not in ['male', 'female']:
            return jsonify({'success': False, 'message': 'Invalid gender filter'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        if requested_gender:
            query = "SELECT * FROM blocks WHERE block_gender = %s ORDER BY block_name"
            cursor.execute(query, (requested_gender,))
        else:
            query = "SELECT * FROM blocks ORDER BY block_name"
            cursor.execute(query)
        blocks = cursor.fetchall()
        
        # Calculate room counts for each block
        for block in blocks:
            # Count total rooms in this block
            room_query = "SELECT COUNT(*) as total FROM rooms WHERE block_id = %s"
            cursor.execute(room_query, (block['id'],))
            room_result = cursor.fetchone()
            block['total_rooms'] = room_result['total'] if room_result else 0
            
            # Calculate rooms per floor: total_rooms / total_floors
            total_floors = block['total_floors'] or 1
            block['rooms_per_floor'] = (block['total_rooms'] // total_floors) if total_floors > 0 else 0
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': blocks}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/blocks', methods=['GET'])
def get_blocks():
    """Get public block list with optional registration metadata"""
    try:
        requested_gender = (request.args.get('gender') or '').strip().lower()
        if requested_gender and requested_gender not in ['male', 'female']:
            return jsonify({'success': False, 'message': 'Invalid gender filter'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        if requested_gender:
            query = "SELECT * FROM blocks WHERE block_gender = %s ORDER BY block_name"
            cursor.execute(query, (requested_gender,))
            blocks = cursor.fetchall()

            for block in blocks:
                room_query = "SELECT COUNT(*) as total FROM rooms WHERE block_id = %s"
                cursor.execute(room_query, (block['id'],))
                room_result = cursor.fetchone()
                block['total_rooms'] = room_result['total'] if room_result else 0

                total_floors = block.get('total_floors') or 1
                block['rooms_per_floor'] = (block['total_rooms'] // total_floors) if total_floors > 0 else 0

            cursor.close()
            connection.close()

            return jsonify({'success': True, 'data': blocks}), 200

        query = "SELECT id, block_name as name FROM blocks ORDER BY block_name"
        cursor.execute(query)
        blocks = cursor.fetchall()
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': blocks}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/hostel-blocks', methods=['POST'])
def create_hostel_block():
    """Create a new hostel block and its rooms"""
    try:
        default_amenities = 'WiFi, Study Table, Wardrobe, Ceiling Fan'
        data = request.get_json()
        block_name = (data.get('block_name') or '').strip()
        total_floors = data.get('total_floors')
        rooms_per_floor = data.get('rooms_per_floor', 4)
        block_gender = (data.get('block_gender') or '').strip().lower()

        if (
            not block_name or
            not total_floors or
            total_floors < 1 or
            rooms_per_floor < 1 or
            block_gender not in ['male', 'female']
        ):
            return jsonify({'success': False, 'message': 'Invalid block details'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        cursor.execute("SELECT id FROM blocks WHERE block_name = %s", (block_name,))
        existing = cursor.fetchone()
        if existing:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Block name already exists'}), 409

        insert_block_query = """
            INSERT INTO blocks (block_name, total_floors, block_gender)
            VALUES (%s, %s, %s)
        """
        cursor.execute(insert_block_query, (block_name, total_floors, block_gender))
        connection.commit()

        block_id = cursor.lastrowid

        room_count = 0
        for floor in range(0, int(total_floors) + 1):  # ground (0) + n floors
            for room_num in range(1, int(rooms_per_floor) + 1):
                room_number = f"{floor}{room_num:02d}"
                insert_room_query = """
                    INSERT INTO rooms (block_id, room_number, capacity, status, amenities)
                    VALUES (%s, %s, %s, 'available', %s)
                """
                cursor.execute(insert_room_query, (block_id, room_number, 4, default_amenities))
                room_count += 1

        connection.commit()
        cursor.close()
        connection.close()

        return jsonify({
            'success': True,
            'message': f'Block created with {room_count} rooms',
            'block_id': block_id
        }), 201

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/rooms/<int:block_id>', methods=['GET'])
def get_rooms_by_block(block_id):
    """Get rooms in a specific block"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = "SELECT * FROM rooms WHERE block_id = %s ORDER BY room_number"
        cursor.execute(query, (block_id,))
        rooms = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': rooms}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/rooms/all', methods=['GET'])
def get_all_rooms_with_blocks():
    """Get all rooms with their block information"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT 
                r.id, 
                r.room_number, 
                r.capacity, 
                r.occupied_count,
                r.status,
                r.room_type,
                r.floor,
                r.rent_per_month,
                r.amenities,
                b.id as block_id, 
                b.block_name, 
                b.total_floors
            FROM rooms r
            INNER JOIN blocks b ON r.block_id = b.id
            ORDER BY b.block_name, r.room_number
        """
        cursor.execute(query)
        rooms = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': rooms}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/rooms/<int:room_id>/students', methods=['GET'])
def get_room_students(room_id):
    """Get all students allocated to a room"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT s.id as student_id, u.name, s.roll_number, s.branch, s.year
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE s.room_id = %s
            ORDER BY u.name
        """
        cursor.execute(query, (room_id,))
        students = cursor.fetchall()

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': students}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/rooms/<int:room_id>/change-requests', methods=['GET'])
def get_room_change_requests_for_room(room_id):
    """Get room change requests for a specific room"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT rcr.id, rcr.status, rcr.preference_reason, rcr.full_reason,
                   rcr.created_at, u.name as student_name
            FROM room_change_requests rcr
            JOIN students s ON rcr.student_id = s.id
            JOIN users u ON s.user_id = u.id
            WHERE (rcr.current_room_id = %s OR rcr.requested_room_id = %s)
               AND rcr.status = 'pending'
            ORDER BY rcr.created_at DESC
        """
        cursor.execute(query, (room_id, room_id))
        requests = cursor.fetchall()

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': requests}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/hostel-blocks/<int:block_id>', methods=['PUT'])
def update_hostel_block(block_id):
    """Update hostel block details"""
    try:
        data = request.get_json()
        block_name = (data.get('block_name') or '').strip()
        total_floors = data.get('total_floors')
        description = data.get('description')
        block_gender = (data.get('block_gender') or '').strip().lower()
        
        if not block_name:
            return jsonify({'success': False, 'message': 'Block name is required'}), 400
        if block_gender not in ['male', 'female']:
            return jsonify({'success': False, 'message': 'Block gender is required'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if block exists
        cursor.execute("SELECT id FROM blocks WHERE id = %s", (block_id,))
        block = cursor.fetchone()
        
        if not block:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Block not found'}), 404
        
        # Update block
        update_query = """
            UPDATE blocks 
            SET block_name = %s, total_floors = %s, description = %s, block_gender = %s
            WHERE id = %s
        """
        cursor.execute(update_query, (block_name, total_floors, description, block_gender, block_id))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'message': 'Block updated successfully'}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/hostel-blocks/<int:block_id>', methods=['DELETE'])
def delete_hostel_block(block_id):
    """Delete a hostel block if it has no occupied rooms or assigned students"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        cursor.execute("SELECT id, block_name FROM blocks WHERE id = %s", (block_id,))
        block = cursor.fetchone()

        if not block:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Block not found'}), 404

        cursor.execute("SELECT COUNT(*) as count FROM rooms WHERE block_id = %s AND occupied_count > 0", (block_id,))
        occupied = cursor.fetchone()['count']

        cursor.execute("""
            SELECT COUNT(*) as count
            FROM students s
            JOIN rooms r ON s.room_id = r.id
            WHERE r.block_id = %s
        """, (block_id,))
        assigned_students = cursor.fetchone()['count']

        if occupied > 0 or assigned_students > 0:
            cursor.close()
            connection.close()
            return jsonify({
                'success': False,
                'message': 'Block has assigned students or occupied rooms. Move students before deleting.'
            }), 400

        cursor.execute("DELETE FROM rooms WHERE block_id = %s", (block_id,))
        cursor.execute("DELETE FROM blocks WHERE id = %s", (block_id,))
        connection.commit()

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'message': 'Block deleted successfully'}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/rooms/bulk-update', methods=['PUT'])
def update_rooms_in_block():
    """Update/create rooms in a block"""
    try:
        data = request.get_json()
        block_id = data.get('block_id')
        num_floors = data.get('num_floors')
        rooms_per_floor = data.get('rooms_per_floor', 4)  # Default 4 rooms per floor
        
        if not block_id or not num_floors:
            return jsonify({'success': False, 'message': 'Block ID and number of floors required'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if block exists
        cursor.execute("SELECT id FROM blocks WHERE id = %s", (block_id,))
        block = cursor.fetchone()
        
        if not block:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Block not found'}), 404

        # Safety guard: do not regenerate rooms if students are currently assigned in this block.
        # Deleting rooms would nullify students.room_id and remove room_allocations via FK cascade.
        cursor.execute(
            """
            SELECT COUNT(*) AS assigned_count
            FROM students s
            JOIN rooms r ON s.room_id = r.id
            WHERE r.block_id = %s
            """,
            (block_id,)
        )
        assigned_count = cursor.fetchone()['assigned_count']

        if assigned_count > 0:
            cursor.close()
            connection.close()
            return jsonify({
                'success': False,
                'message': 'Cannot regenerate rooms: students are already allocated in this block. Move students first.'
            }), 400
        
        # Delete existing rooms for this block
        cursor.execute("DELETE FROM rooms WHERE block_id = %s", (block_id,))
        
        # Create new rooms
        room_count = 0
        for floor in range(1, int(num_floors) + 1):
            for room_num in range(1, rooms_per_floor + 1):
                room_number = f"{floor}{room_num:02d}"
                capacity = 4  # Default capacity
                insert_query = """
                    INSERT INTO rooms (block_id, room_number, capacity, status)
                    VALUES (%s, %s, %s, 'available')
                """
                cursor.execute(insert_query, (block_id, room_number, capacity))
                room_count += 1
        
        connection.commit()
        
        # Update block total_floors
        cursor.execute("UPDATE blocks SET total_floors = %s WHERE id = %s", (num_floors, block_id))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True, 
            'message': f'Created {room_count} rooms successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/rooms/<int:room_id>', methods=['PUT'])
def update_room(room_id):
    """Update individual room details"""
    try:
        data = request.get_json()
        room_number = data.get('room_number')
        capacity = data.get('capacity')
        
        if not room_number:
            return jsonify({'success': False, 'message': 'Room number is required'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if room exists
        cursor.execute("SELECT id FROM rooms WHERE id = %s", (room_id,))
        room = cursor.fetchone()
        
        if not room:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Room not found'}), 404
        
        # Update room
        update_query = "UPDATE rooms SET room_number = %s, capacity = %s WHERE id = %s"
        cursor.execute(update_query, (room_number, capacity, room_id))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True, 
            'message': 'Room updated successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/rooms/<int:room_id>', methods=['DELETE'])
def delete_room(room_id):
    """Delete a room if it has no students allocated"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if room exists
        cursor.execute("SELECT id, room_number FROM rooms WHERE id = %s", (room_id,))
        room = cursor.fetchone()
        
        if not room:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Room not found'}), 404
        
        # Check if room has any students allocated
        cursor.execute("SELECT COUNT(*) as count FROM students WHERE room_id = %s", (room_id,))
        result = cursor.fetchone()
        
        if result['count'] > 0:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Cannot delete room with allocated students'}), 400
        
        # Delete the room
        cursor.execute("DELETE FROM rooms WHERE id = %s", (room_id,))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True, 
            'message': 'Room deleted successfully'
        }), 200
        
    except Exception as e:
        print(f"Error deleting room: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/rooms', methods=['POST'])
def create_room():
    """Create a new room in a block"""
    try:
        data = request.get_json()
        block_id = data.get('block_id')
        room_number = data.get('room_number')
        capacity = data.get('capacity', 4)
        status = data.get('status', 'available')
        
        if not block_id or not room_number:
            return jsonify({'success': False, 'message': 'Block ID and room number are required'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if block exists
        cursor.execute("SELECT id FROM blocks WHERE id = %s", (block_id,))
        block = cursor.fetchone()
        
        if not block:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Block not found'}), 404
        
        # Check if room number already exists in this block
        cursor.execute("SELECT id FROM rooms WHERE block_id = %s AND room_number = %s", (block_id, room_number))
        existing = cursor.fetchone()
        
        if existing:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Room number already exists in this block'}), 409
        
        # Create new room
        insert_query = """
            INSERT INTO rooms (block_id, room_number, capacity, status)
            VALUES (%s, %s, %s, %s)
        """
        cursor.execute(insert_query, (block_id, room_number, capacity, status))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'message': 'Room created successfully'
        }), 201
        
    except Exception as e:
        print(f"Error creating room: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    """Get all users with optional role filter"""
    try:
        role = request.args.get('role')  # Optional: student, warden, technician, security, admin
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        if role:
            query = """
                SELECT u.id, u.name, u.email, u.role, u.status, u.created_at, u.staff_id,
                    s.roll_number, s.college_name, s.branch, s.year, s.fee_status, s.registration_status,
                    s.parent_name, s.parent_email, s.parent_phone,
                    COALESCE(s.phone, w.phone, sp.phone, t.phone) AS phone,
                    s.room_id, r.room_number, b.id AS block_id, b.block_name,
                    COALESCE(b.block_name, w.hostel_block) AS block,
                    t.specialization AS specialization,
                    t.employee_id AS employee_id,
                    t.availability_status AS availability_status,
                    t.phone AS technician_phone,
                    COALESCE(tc.assigned_complaints, 0) AS assigned_complaints,
                    sp.employee_id AS security_employee_id,
                    sp.shift_timing, sp.gate_assigned, sp.phone AS security_phone
                FROM users u
                LEFT JOIN students s ON u.id = s.user_id
                LEFT JOIN wardens w ON u.id = w.user_id
                LEFT JOIN technicians t ON u.id = t.user_id
                LEFT JOIN (
                    SELECT assigned_technician_id, COUNT(*) AS assigned_complaints
                    FROM complaints
                    WHERE status IN ('assigned', 'in_progress')
                    GROUP BY assigned_technician_id
                ) tc ON tc.assigned_technician_id = u.id
                LEFT JOIN rooms r ON s.room_id = r.id
                LEFT JOIN blocks b ON r.block_id = b.id
                LEFT JOIN security_personnel sp ON u.id = sp.user_id
                WHERE u.role = %s
                ORDER BY u.created_at DESC
            """
            cursor.execute(query, (role,))
        else:
            query = """
                SELECT u.id, u.name, u.email, u.role, u.status, u.created_at, u.staff_id,
                    s.roll_number, s.college_name, s.branch, s.year, s.fee_status, s.registration_status,
                    s.parent_name, s.parent_email, s.parent_phone,
                    COALESCE(s.phone, w.phone, sp.phone, t.phone) AS phone,
                    s.room_id, r.room_number, b.id AS block_id, b.block_name,
                    COALESCE(b.block_name, w.hostel_block) AS block,
                    t.specialization AS specialization,
                    t.employee_id AS employee_id,
                    t.availability_status AS availability_status,
                    t.phone AS technician_phone,
                    COALESCE(tc.assigned_complaints, 0) AS assigned_complaints,
                    sp.employee_id AS security_employee_id,
                    sp.shift_timing, sp.gate_assigned, sp.phone AS security_phone
                FROM users u
                LEFT JOIN students s ON u.id = s.user_id
                LEFT JOIN wardens w ON u.id = w.user_id
                LEFT JOIN technicians t ON u.id = t.user_id
                LEFT JOIN (
                    SELECT assigned_technician_id, COUNT(*) AS assigned_complaints
                    FROM complaints
                    WHERE status IN ('assigned', 'in_progress')
                    GROUP BY assigned_technician_id
                ) tc ON tc.assigned_technician_id = u.id
                LEFT JOIN rooms r ON s.room_id = r.id
                LEFT JOIN blocks b ON r.block_id = b.id
                LEFT JOIN security_personnel sp ON u.id = sp.user_id
                ORDER BY u.created_at DESC
            """
            cursor.execute(query)
        
        users = cursor.fetchall()
        
        # Serialize datetime objects
        users = [serialize_row(row) for row in users]
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': users}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/user', methods=['POST'])
def create_user():
    """Create a new user (and student record if role is student)"""
    try:
        data = request.get_json()
        name = data.get('name')
        email = data.get('email')
        password = data.get('password', 'default123')  # Default password
        role = data.get('role')
        phone = data.get('phone')
        specialization = data.get('specialization') or data.get('category')
        employee_id = data.get('employee_id') or data.get('employeeId') or data.get('staffId')
        availability_status = data.get('availability_status') or 'available'
        generated_staff_id = None
        
        # Student-specific fields
        roll_number = data.get('roll_number')
        branch = data.get('branch')
        year = data.get('year')
        
        if not all([name, email, role]):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        if role not in ['student', 'warden', 'admin', 'technician', 'security']:
            return jsonify({'success': False, 'message': 'Invalid role'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if user already exists
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        existing = cursor.fetchone()
        if existing:
            return jsonify({'success': False, 'message': 'User with this email already exists'}), 409
        
        # Insert user
        hashed_password = generate_password_hash(password)
        insert_user_query = """
            INSERT INTO users (name, email, password, role, status)
            VALUES (%s, %s, %s, %s, 'active')
        """
        cursor.execute(insert_user_query, (name, email, hashed_password, role))
        connection.commit()
        
        user_id = cursor.lastrowid
        
        # Generate staff_id for staff roles and enforce non-null + uniqueness.
        if role in ['warden', 'technician', 'security']:
            generated_staff_id = ensure_role_staff_id(cursor, connection, user_id, role)
            if not generated_staff_id:
                return jsonify({'success': False, 'message': f'Failed to assign staff ID for {role}'}), 500
            connection.commit()
        
        # If role is student, create student record
        if role == 'student':
            if not roll_number:
                return jsonify({'success': False, 'message': 'Roll number required for student'}), 400
            
            insert_student_query = """
                INSERT INTO students 
                (user_id, roll_number, branch, year, phone, registration_status, fee_status)
                VALUES (%s, %s, %s, %s, %s, 'approved', 'pending')
            """
            cursor.execute(insert_student_query, (user_id, roll_number, branch, year, phone))
            connection.commit()
        elif role == 'warden':
            block = data.get('block')

            cursor.execute(
                """
                INSERT INTO wardens (user_id, employee_id, hostel_block, phone)
                VALUES (%s, %s, %s, %s)
                """,
                (user_id, generated_staff_id, block, phone)
            )
            connection.commit()
        elif role == 'technician':
            if not specialization:
                return jsonify({'success': False, 'message': 'Specialization required for technician'}), 400
            if not phone:
                return jsonify({'success': False, 'message': 'Phone number required for technician'}), 400

            technician_employee_id = employee_id or generated_staff_id
            if not technician_employee_id:
                return jsonify({'success': False, 'message': 'Failed to generate staff ID for technician'}), 500

            cursor.execute("SELECT id FROM technicians WHERE employee_id = %s", (technician_employee_id,))
            if cursor.fetchone():
                return jsonify({'success': False, 'message': 'Employee ID already exists'}), 409

            cursor.execute(
                """
                INSERT INTO technicians (user_id, employee_id, specialization, phone, availability_status)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (user_id, technician_employee_id, specialization, phone, availability_status)
            )
            connection.commit()
        elif role == 'security':
            shift = data.get('shift')
            gate = data.get('gate')
            security_employee_id = data.get('staffId') or data.get('employeeId') or generated_staff_id

            if not security_employee_id:
                return jsonify({'success': False, 'message': 'Failed to generate staff ID for security staff'}), 500

            if not phone:
                return jsonify({'success': False, 'message': 'Phone number required for security staff'}), 400

            insert_security_query = """
                INSERT INTO security_personnel
                (user_id, employee_id, shift_timing, gate_assigned, phone)
                VALUES (%s, %s, %s, %s, %s)
            """
            cursor.execute(insert_security_query, (user_id, security_employee_id, shift, gate, phone))
            connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True, 
            'id': user_id,
            'message': f'{role.capitalize()} created successfully'
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/user/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete a user and related records"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if user exists
        cursor.execute("SELECT id, role FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        
        # Delete user (CASCADE will handle related records)
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'message': 'User deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/user/<int:user_id>/status', methods=['PUT'])
def update_user_status(user_id):
    """Update user status (active/inactive)"""
    try:
        data = request.get_json()
        status = data.get('status')
        
        if status not in ['active', 'inactive']:
            return jsonify({'success': False, 'message': 'Invalid status'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor()
        
        cursor.execute("UPDATE users SET status = %s WHERE id = %s", (status, user_id))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'message': 'User status updated'}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/user/<int:user_id>/password', methods=['PUT'])
def change_user_password(user_id):
    """Change user password (admin only)"""
    try:
        data = request.get_json()
        new_password = data.get('password')
        
        if not new_password or len(new_password.strip()) == 0:
            return jsonify({'success': False, 'message': 'Password cannot be empty'}), 400
        
        if len(new_password) < 4:
            return jsonify({'success': False, 'message': 'Password must be at least 4 characters long'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if user exists and load identifiers used by login lockout tracking.
        cursor.execute(
            """
            SELECT
                u.id,
                u.name,
                u.email,
                u.staff_id,
                COALESCE(NULLIF(u.roll_number, ''), s.roll_number) AS roll_number
            FROM users u
            LEFT JOIN students s ON s.user_id = u.id
            WHERE u.id = %s
            """,
            (user_id,)
        )
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'User not found'}), 404

        # Enforce unique/non-null staff IDs for staff roles, including legacy rows.
        try:
            user['staff_id'] = ensure_role_staff_id(
                cursor,
                connection,
                user_id,
                user['role'],
                user.get('staff_id')
            )
        except ValueError as staff_error:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': str(staff_error)}), 409
        
        # Hash and update password
        hashed_password = generate_password_hash(new_password)
        cursor.execute("UPDATE users SET password = %s WHERE id = %s", (hashed_password, user_id))
        connection.commit()

        # Password reset should unblock immediate login attempts for this account.
        for identifier in [user.get('email'), user.get('roll_number'), user.get('staff_id')]:
            if identifier:
                clear_failed_login(str(identifier).strip().lower())
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True, 
            'message': f"Password changed successfully for {user['name']}"
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/user/<int:user_id>', methods=['PUT'])
def update_user_details(user_id):
    """Update user details (name, email, phone, and role-specific fields)"""
    try:
        data = request.get_json()
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if user exists and get role
        cursor.execute("SELECT id, name, role, staff_id FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'User not found'}), 404

        # Enforce unique/non-null staff IDs for staff roles, including legacy rows.
        if user['role'] in ('warden', 'technician', 'security'):
            try:
                user['staff_id'] = ensure_role_staff_id(
                    cursor,
                    connection,
                    user_id,
                    user['role'],
                    user.get('staff_id')
                )
            except ValueError as staff_error:
                cursor.close()
                connection.close()
                return jsonify({'success': False, 'message': str(staff_error)}), 409

        # Update users table
        name = data.get('name')
        email = data.get('email')
        phone = data.get('phone')
        
        if name or email:
            update_query = "UPDATE users SET "
            params = []
            if name:
                update_query += "name = %s, "
                params.append(name)
            if email:
                update_query += "email = %s, "
                params.append(email)
            
            update_query = update_query.rstrip(', ') + " WHERE id = %s"
            params.append(user_id)
            cursor.execute(update_query, params)
        
        # Update role-specific tables
        if user['role'] == 'student':
            # Update students table if needed
            college_name = data.get('collegeName')
            branch = data.get('branch')
            year = data.get('year')
            roll_number = data.get('rollNumber')
            room_id = data.get('roomId')  # Room ID for hostel assignment
            fee_status = data.get('feeStatus')  # Payment status update
            parent_name = data.get('parentName')
            parent_email = data.get('parentEmail')
            parent_phone = data.get('parentPhone')
            
            # Get existing student record with current room
            cursor.execute("SELECT id, room_id FROM students WHERE user_id = %s", (user_id,))
            student = cursor.fetchone()
            
            if student:
                old_room_id = student.get('room_id')
                
                # Handle room change if room_id is provided
                if room_id:
                    # If student already has a room, decrement old room's occupied_count
                    if old_room_id and old_room_id != int(room_id):
                        cursor.execute(
                            "SELECT occupied_count, capacity FROM rooms WHERE id = %s",
                            (old_room_id,)
                        )
                        old_room = cursor.fetchone()
                        if old_room:
                            new_old_occupied = max(0, old_room['occupied_count'] - 1)
                            cursor.execute(
                                "UPDATE rooms SET occupied_count = %s, status = 'available' WHERE id = %s",
                                (new_old_occupied, old_room_id)
                            )
                            # Deactivate old allocation
                            cursor.execute(
                                "UPDATE room_allocations SET status = 'transferred', checkout_date = CURDATE() WHERE student_id = %s AND room_id = %s AND status = 'active'",
                                (student['id'], old_room_id)
                            )
                    
                    # Increment new room's occupied_count (whether it's a new assignment or room change)
                    if not old_room_id or old_room_id != int(room_id):
                        cursor.execute(
                            "SELECT occupied_count, capacity FROM rooms WHERE id = %s",
                            (room_id,)
                        )
                        new_room = cursor.fetchone()
                        if new_room:
                            new_occupied = new_room['occupied_count'] + 1
                            new_status = 'full' if new_occupied >= new_room['capacity'] else 'available'
                            cursor.execute(
                                "UPDATE rooms SET occupied_count = %s, status = %s WHERE id = %s",
                                (new_occupied, new_status, room_id)
                            )
                            # Create new allocation record
                            cursor.execute("""
                                INSERT INTO room_allocations 
                                (student_id, room_id, allocation_date, status)
                                VALUES (%s, %s, CURDATE(), 'active')
                            """, (student['id'], room_id))
                
                # Update student record
                student_update = "UPDATE students SET "
                student_params = []
                
                if roll_number:
                    student_update += "roll_number = %s, "
                    student_params.append(roll_number)
                if college_name:
                    student_update += "college_name = %s, "
                    student_params.append(college_name)
                if branch:
                    student_update += "branch = %s, "
                    student_params.append(branch)
                if year:
                    student_update += "year = %s, "
                    student_params.append(year)
                if phone:
                    student_update += "phone = %s, "
                    student_params.append(phone)
                # Parent/Guardian contact details
                if parent_name is not None:
                    student_update += "parent_name = %s, "
                    student_params.append(parent_name)
                if parent_email is not None:
                    student_update += "parent_email = %s, "
                    student_params.append(parent_email)
                if parent_phone is not None:
                    student_update += "parent_phone = %s, "
                    student_params.append(parent_phone)
                if room_id:
                    student_update += "room_id = %s, "
                    student_params.append(room_id)
                if fee_status:
                    student_update += "fee_status = %s, "
                    student_params.append(fee_status)
                
                if student_params:
                    student_update = student_update.rstrip(', ') + " WHERE user_id = %s"
                    student_params.append(user_id)
                    cursor.execute(student_update, student_params)
        
        elif user['role'] == 'warden':
            # Update wardens table if needed
            block = data.get('block')
            
            # Get existing warden record
            cursor.execute("SELECT id FROM wardens WHERE user_id = %s", (user_id,))
            warden = cursor.fetchone()
            
            if warden:
                warden_update = "UPDATE wardens SET "
                warden_params = []
                
                if block:
                    warden_update += "hostel_block = %s, "
                    warden_params.append(block)
                if phone:
                    warden_update += "phone = %s, "
                    warden_params.append(phone)
                
                if warden_params:
                    warden_update = warden_update.rstrip(', ') + " WHERE user_id = %s"
                    warden_params.append(user_id)
                    cursor.execute(warden_update, warden_params)
            elif block or phone:
                cursor.execute(
                    """
                    INSERT INTO wardens (user_id, employee_id, hostel_block, phone)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (user_id, user['staff_id'], block, phone)
                )
        elif user['role'] == 'technician':
            specialization = data.get('specialization') or data.get('category')
            availability_status = data.get('availability_status')

            cursor.execute("SELECT id FROM technicians WHERE user_id = %s", (user_id,))
            technician = cursor.fetchone()

            if technician:
                technician_update = "UPDATE technicians SET "
                technician_params = []

                if specialization:
                    technician_update += "specialization = %s, "
                    technician_params.append(specialization)
                if phone:
                    technician_update += "phone = %s, "
                    technician_params.append(phone)
                if availability_status:
                    technician_update += "availability_status = %s, "
                    technician_params.append(availability_status)

                if technician_params:
                    technician_update = technician_update.rstrip(', ') + " WHERE user_id = %s"
                    technician_params.append(user_id)
                    cursor.execute(technician_update, technician_params)
            else:
                if phone:
                    technician_employee_id = user.get('staff_id') or data.get('employee_id') or data.get('employeeId') or data.get('staffId')
                    if not technician_employee_id:
                        cursor.close()
                        connection.close()
                        return jsonify({'success': False, 'message': 'Staff ID missing for technician'}), 400
                    cursor.execute(
                        """
                        INSERT INTO technicians (user_id, employee_id, specialization, phone, availability_status)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        (user_id, technician_employee_id, specialization, phone, availability_status or 'available')
                    )
        elif user['role'] == 'security':
            # Update security_personnel table if needed
            gate = data.get('gate')
            shift = data.get('shift')

            cursor.execute("SELECT id FROM security_personnel WHERE user_id = %s", (user_id,))
            security_row = cursor.fetchone()

            if security_row:
                security_update = "UPDATE security_personnel SET "
                security_params = []

                if shift:
                    security_update += "shift_timing = %s, "
                    security_params.append(shift)
                if gate:
                    security_update += "gate_assigned = %s, "
                    security_params.append(gate)
                if phone:
                    security_update += "phone = %s, "
                    security_params.append(phone)

                if security_params:
                    security_update = security_update.rstrip(', ') + " WHERE user_id = %s"
                    security_params.append(user_id)
                    cursor.execute(security_update, security_params)
            else:
                # Create security personnel record if missing
                if phone or gate or shift:
                    security_employee_id = user.get('staff_id') or data.get('staffId') or data.get('employeeId')
                    if not security_employee_id:
                        cursor.close()
                        connection.close()
                        return jsonify({'success': False, 'message': 'Staff ID missing for security staff'}), 400
                    cursor.execute(
                        """
                        INSERT INTO security_personnel (user_id, employee_id, shift_timing, gate_assigned, phone)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        (user_id, security_employee_id, shift, gate, phone)
                    )
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'message': f"Updated details for {user['name']}"
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500



@app.route('/api/upload/payment-proof', methods=['POST'])
def upload_payment_proof():
    """Upload payment proof document (receipt)"""
    try:
        # Check if file is present in request
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected'}), 400
        
        # Validate file type
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'message': f'File type not allowed. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'}), 400
        
        # Generate unique filename
        import secrets
        from werkzeug.utils import secure_filename
        
        filename = secure_filename(file.filename)
        unique_filename = f"{secrets.token_hex(8)}_{filename}"
        
        # Save file
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(filepath)
        
        # Return file path relative to uploads directory
        relative_path = f"/api/files/payment-proof/{unique_filename}"
        
        print(f"Payment proof uploaded: {relative_path}")
        
        return jsonify({
            'success': True,
            'message': 'File uploaded successfully',
            'file_path': relative_path,
            'filename': filename
        }), 200
        
    except Exception as e:
        print(f"Error uploading file: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/files/payment-proof/<filename>', methods=['GET'])
def download_payment_proof(filename):
    """Download payment proof document"""
    try:
        from flask import send_file
        from werkzeug.utils import secure_filename
        
        # Prevent directory traversal attacks
        filename = secure_filename(filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # Check if file exists
        if not os.path.exists(filepath):
            return jsonify({'success': False, 'message': 'File not found'}), 404
        
        return send_file(filepath, as_attachment=True)
        
    except Exception as e:
        print(f"Error downloading file: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/student/register', methods=['POST'])
def submit_student_registration():
    """Submit a new student registration"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['fullName', 'email', 'phone', 'password', 'rollNumber', 'collegeName', 'branch', 'year',
              'gender', 'parentName', 'parentPhone', 'parentEmail', 'hostelBlock']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'{field} is required'}), 400
        
        # Validate password length
        if len(data.get('password', '')) < 6:
            return jsonify({'success': False, 'message': 'Password must be at least 6 characters long'}), 400

        student_gender = (data.get('gender') or '').strip().lower()
        if student_gender not in ['male', 'female']:
            return jsonify({'success': False, 'message': 'Gender must be male or female'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)

        # Ensure preferred block belongs to the selected student gender
        cursor.execute(
            """
            SELECT id FROM blocks
            WHERE block_name = %s AND block_gender = %s
            """,
            (data['hostelBlock'], student_gender)
        )
        selected_block = cursor.fetchone()
        if not selected_block:
            cursor.close()
            connection.close()
            return jsonify({
                'success': False,
                'message': 'Selected hostel block is not available for the selected gender'
            }), 400
        
        # Check if roll number already exists
        cursor.execute("SELECT id FROM users WHERE roll_number = %s", (data['rollNumber'],))
        if cursor.fetchone():
            return jsonify({'success': False, 'message': 'Roll number already registered'}), 400
        
        # Check if email already exists
        cursor.execute("SELECT id FROM users WHERE email = %s", (data['email'],))
        if cursor.fetchone():
            return jsonify({'success': False, 'message': 'Email already registered'}), 400
        
        # Create user account with 'student' role and initial status 'inactive' (pending verification)
        hashed_password = generate_password_hash(data['password'])
        cursor.execute("""
            INSERT INTO users (name, email, roll_number, password, role, status)
            VALUES (%s, %s, %s, %s, 'student', 'inactive')
        """, (data['fullName'], data['email'], data['rollNumber'], hashed_password))
        
        user_id = cursor.lastrowid
        
        # Get payment proof URL if provided
        payment_proof_url = data.get('paymentProofUrl', None)
        # Fee status is always pending initially - warden decides during approval
        fee_status = 'pending'
        
        # Get room preferences
        preferred_block = data.get('hostelBlock', None)
        room_preference = data.get('roomPreference', None)
        floor_preference = data.get('floorPreference', None)
        
        # Create student record with pending registration status
        cursor.execute("""
                INSERT INTO students 
                (user_id, roll_number, college_name, branch, year, gender, phone, parent_name, parent_phone, parent_email,
                 registration_status, fee_status, payment_proof_url, preferred_block, floor_preference, room_preference)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s, %s, %s, %s, %s)
                    """, (user_id, data['rollNumber'], data['collegeName'], data['branch'], data['year'], student_gender, data['phone'],
                    data['parentName'], data['parentPhone'], data['parentEmail'], fee_status, payment_proof_url,
                    preferred_block, floor_preference, room_preference))
        
        student_id = cursor.lastrowid
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'message': 'Registration submitted successfully. Awaiting warden verification.',
            'student_id': student_id,
            'user_id': user_id
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/student/registration-status', methods=['GET'])
def get_student_registration_status():
    """Get registration status by roll number or email"""
    try:
        roll_number = request.args.get('roll_number')
        email = request.args.get('email')

        if not roll_number and not email:
            return jsonify({'success': False, 'message': 'roll_number or email is required'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        if roll_number:
            cursor.execute("""
                SELECT
                    u.name,
                    u.email,
                    s.roll_number,
                    s.registration_status,
                    s.fee_status,
                    s.created_at AS applied_date,
                    CASE
                        WHEN s.registration_status = 'approved' THEN s.updated_at
                        ELSE NULL
                    END AS approved_date
                FROM students s
                JOIN users u ON s.user_id = u.id
                WHERE s.roll_number = %s
                LIMIT 1
            """, (roll_number,))
        else:
            cursor.execute("""
                SELECT
                    u.name,
                    u.email,
                    s.roll_number,
                    s.registration_status,
                    s.fee_status,
                    s.created_at AS applied_date,
                    CASE
                        WHEN s.registration_status = 'approved' THEN s.updated_at
                        ELSE NULL
                    END AS approved_date
                FROM students s
                JOIN users u ON s.user_id = u.id
                WHERE u.email = %s
                LIMIT 1
            """, (email,))

        status = cursor.fetchone()
        cursor.close()
        connection.close()

        if not status:
            return jsonify({'success': False, 'message': 'Registration not found'}), 404

        status = serialize_row(status)
        return jsonify({'success': True, 'data': status}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/registrations/pending', methods=['GET'])
def get_pending_registrations():
    """Get all pending student registrations"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT 
                u.id as user_id,
                u.name,
                u.email,
                u.created_at as submitted_date,
                s.id as student_id,
                s.roll_number,
                s.branch,
                s.year,
                s.phone,
                s.parent_name,
                s.parent_phone,
                s.address,
                s.blood_group,
                s.emergency_contact,
                s.fee_status,
                s.registration_status,
                s.payment_proof_url
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE s.registration_status = 'pending'
            ORDER BY u.created_at DESC
        """
        cursor.execute(query)
        registrations = cursor.fetchall()
        
        # Serialize datetime objects
        registrations = [serialize_row(row) for row in registrations]
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': registrations}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/registrations/approved', methods=['GET'])
def get_approved_registrations():
    """Get all approved student registrations"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                u.id as user_id,
                u.name,
                u.email,
                u.created_at as submitted_date,
                s.id as student_id,
                s.roll_number,
                s.branch,
                s.year,
                s.phone,
                s.parent_name,
                s.parent_phone,
                s.address,
                s.blood_group,
                s.emergency_contact,
                s.fee_status,
                s.registration_status,
                s.payment_proof_url
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE s.registration_status = 'approved'
            ORDER BY u.created_at DESC
        """
        cursor.execute(query)
        registrations = cursor.fetchall()

        registrations = [serialize_row(row) for row in registrations]

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': registrations}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/registrations/rejected', methods=['GET'])
def get_rejected_registrations():
    """Get all rejected student registrations"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                u.id as user_id,
                u.name,
                u.email,
                u.created_at as submitted_date,
                s.id as student_id,
                s.roll_number,
                s.branch,
                s.year,
                s.phone,
                s.parent_name,
                s.parent_phone,
                s.address,
                s.blood_group,
                s.emergency_contact,
                s.fee_status,
                s.registration_status,
                s.payment_proof_url
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE s.registration_status = 'rejected'
            ORDER BY u.created_at DESC
        """
        cursor.execute(query)
        registrations = cursor.fetchall()

        registrations = [serialize_row(row) for row in registrations]

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': registrations}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/registrations/pending', methods=['GET'])
def get_warden_pending_registrations():
    """Get all pending student registrations (Warden view)"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT 
                u.id as user_id,
                u.name,
                u.email,
                u.created_at as submitted_date,
                s.id as student_id,
                s.roll_number,
                s.branch,
                s.year,
                s.phone,
                s.parent_name,
                s.parent_phone,
                s.address,
                s.blood_group,
                s.emergency_contact,
                s.fee_status,
                s.registration_status,
                s.payment_proof_url
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE s.registration_status = 'pending'
            ORDER BY u.created_at DESC
        """
        cursor.execute(query)
        registrations = cursor.fetchall()
        
        # Serialize datetime objects
        registrations = [serialize_row(row) for row in registrations]
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': registrations}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/registrations/approved', methods=['GET'])
def get_warden_approved_registrations():
    """Get all approved student registrations (Warden view)"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT 
                u.id as user_id,
                u.name,
                u.email,
                u.created_at as submitted_date,
                s.id as student_id,
                s.roll_number,
                s.branch,
                s.year,
                s.phone,
                s.parent_name,
                s.parent_phone,
                s.address,
                s.blood_group,
                s.emergency_contact,
                s.fee_status,
                s.registration_status,
                s.payment_proof_url
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE s.registration_status = 'approved'
            ORDER BY u.created_at DESC
        """
        cursor.execute(query)
        registrations = cursor.fetchall()
        
        # Serialize datetime objects
        registrations = [serialize_row(row) for row in registrations]
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': registrations}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/registrations/rejected', methods=['GET'])
def get_warden_rejected_registrations():
    """Get all rejected student registrations (Warden view)"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT 
                u.id as user_id,
                u.name,
                u.email,
                u.created_at as submitted_date,
                s.id as student_id,
                s.roll_number,
                s.branch,
                s.year,
                s.phone,
                s.parent_name,
                s.parent_phone,
                s.address,
                s.blood_group,
                s.emergency_contact,
                s.fee_status,
                s.registration_status,
                s.payment_proof_url
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE s.registration_status = 'rejected'
            ORDER BY u.created_at DESC
        """
        cursor.execute(query)
        registrations = cursor.fetchall()
        
        # Serialize datetime objects
        registrations = [serialize_row(row) for row in registrations]
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': registrations}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/registrations/<int:student_id>/approve', methods=['PUT'])
def approve_registration(student_id):
    """Approve a student registration and auto-allocate room based on preferences"""
    try:
        data = request.get_json() or {}
        fee_status = data.get('fee_status', 'pending')
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Check if student exists and fetch email + preferences
        cursor.execute("""
            SELECT s.id, s.user_id, s.preferred_block, s.room_preference, s.floor_preference, u.email, u.name 
            FROM students s 
            JOIN users u ON s.user_id = u.id 
            WHERE s.id = %s
        """, (student_id,))
        student = cursor.fetchone()
        
        if not student:
            return jsonify({'success': False, 'message': 'Student not found'}), 404
        
        # Helper function to map floor preference to floor number
        def get_floor_number(floor_preference):
            """Convert floor preference text to floor number (robust)"""
            if not floor_preference:
                return None
            floor_map = {
                'ground floor': 0,
                '0': 0,
                '1st floor': 1,
                'first floor': 1,
                '1': 1,
                '2nd floor': 2,
                'second floor': 2,
                '2': 2,
                '3rd floor': 3,
                'third floor': 3,
                '3': 3,
                '4th floor': 4,
                'fourth floor': 4,
                '4': 4,
                '5th floor': 5,
                'fifth floor': 5,
                '5': 5
            }
            key = str(floor_preference).strip().lower()
            return floor_map.get(key)
        
        # Helper function to allocate room
        def allocate_room(room_data, block_name=None):
            """Allocate a room to the student"""
            if not room_data:
                return None, ' No available rooms. Manual allocation required.'
            
            room_id = room_data['id']
            
            # Update student with room allocation
            cursor.execute(
                "UPDATE students SET room_id = %s WHERE id = %s",
                (room_id, student_id)
            )
            
            # Increment room occupied count
            new_occupied = room_data['occupied_count'] + 1
            cursor.execute(
                "UPDATE rooms SET occupied_count = %s WHERE id = %s",
                (new_occupied, room_id)
            )
            
            # Update room status if now full
            if new_occupied >= room_data['capacity']:
                cursor.execute(
                    "UPDATE rooms SET status = 'full' WHERE id = %s",
                    (room_id,)
                )
            
            # Create room allocation record
            cursor.execute("""
                INSERT INTO room_allocations 
                (student_id, room_id, allocation_date, status)
                VALUES (%s, %s, CURDATE(), 'active')
            """, (student_id, room_id))
            
            block_name = block_name or room_data.get('block_name', 'Unknown')
            message = f' Room {room_data["room_number"]} in {block_name} allocated.'
            return room_id, message
        
        # Auto-allocate room based on preferences
        allocated_room_id = None
        allocation_message = ''
        
        # Strategy 1: Try preferred block + floor
        if student.get('preferred_block') and student.get('floor_preference'):
            preferred_block = str(student['preferred_block']).strip().lower()
            floor_pref = student['floor_preference']
            floor_number = get_floor_number(floor_pref)
            print(f"[DEBUG] Preferred block: '{preferred_block}', Floor preference: '{floor_pref}', Floor number: {floor_number}")
            cursor.execute(
                "SELECT id, block_name FROM blocks WHERE LOWER(TRIM(block_name)) = %s",
                (preferred_block,)
            )
            block = cursor.fetchone()
            if block:
                print(f"[DEBUG] Block found: {block}")
                if floor_number is not None:
                    cursor.execute("""
                        SELECT r.id, r.room_number, r.capacity, r.occupied_count, b.block_name, r.floor
                        FROM rooms r
                        JOIN blocks b ON r.block_id = b.id
                        WHERE r.block_id = %s 
                          AND r.floor = %s
                          AND r.occupied_count < r.capacity 
                          AND r.status = 'available'
                        ORDER BY r.room_number
                        LIMIT 1
                    """, (block['id'], floor_number))
                    preferred_room = cursor.fetchone()
                    print(f"[DEBUG] Preferred room query result: {preferred_room}")
                    if preferred_room:
                        allocated_room_id, allocation_message = allocate_room(preferred_room, block['block_name'])
            else:
                print(f"[DEBUG] No block found for preferred_block: '{preferred_block}'")

        # Strategy 2: Serialized allocation - first available room in order
        if not allocated_room_id:
            cursor.execute("""
                SELECT r.id, r.room_number, r.capacity, r.occupied_count, r.floor, b.block_name
                FROM rooms r
                JOIN blocks b ON r.block_id = b.id
                WHERE r.occupied_count < r.capacity 
                  AND r.status = 'available'
                ORDER BY b.block_name, r.floor, r.room_number
                LIMIT 1
            """)
            serialized_room = cursor.fetchone()
            if serialized_room:
                allocated_room_id, msg = allocate_room(serialized_room)
                allocation_message = msg + ' (preferences unavailable, allocated serially)'
            else:
                allocation_message = ' No available rooms. Manual allocation required.'
        
        # Update registration status to approved and fee status
        cursor.execute(
            "UPDATE students SET registration_status = 'approved', fee_status = %s WHERE id = %s", 
            (fee_status, student_id)
        )
        
        # Activate the user account
        cursor.execute(
            "UPDATE users SET status = 'active' WHERE id = %s", 
            (student['user_id'],)
        )
        
        connection.commit()
        
        cursor.close()
        connection.close()
        
        # Send approval email
        send_approval_email(student['email'], student['name'])
        
        return jsonify({
            'success': True, 
            'message': 'Registration approved successfully.' + allocation_message,
            'room_allocated': allocated_room_id is not None
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/registrations/<int:student_id>/reject', methods=['PUT'])
def reject_registration(student_id):
    """Reject a student registration"""
    try:
        data = request.get_json()
        rejection_reason = data.get('rejection_reason', 'No reason provided')
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Check if student exists and fetch email
        cursor.execute("""
            SELECT s.id, s.user_id, u.email, u.name 
            FROM students s 
            JOIN users u ON s.user_id = u.id 
            WHERE s.id = %s
        """, (student_id,))
        student = cursor.fetchone()
        
        if not student:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Student not found'}), 404
        
        # Update registration status to rejected with reason
        cursor.execute("""
            UPDATE students 
            SET registration_status = 'rejected', address = %s 
            WHERE id = %s
        """, (f"Rejection Reason: {rejection_reason}", student_id))
        
        # Deactivate the user account
        cursor.execute(
            "UPDATE users SET status = 'inactive' WHERE id = %s", 
            (student['user_id'],)
        )
        
        connection.commit()
        
        cursor.close()
        connection.close()
        
        # Send rejection email
        send_rejection_email(student['email'], student['name'], rejection_reason)
        
        return jsonify({
            'success': True, 
            'message': 'Registration rejected successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ========================================
# TECHNICIAN ENDPOINTS
# ========================================

# ========================================
# WARDEN REGISTRATION APPROVAL/REJECTION ENDPOINTS
# ========================================

@app.route('/api/warden/registrations/<int:student_id>/approve', methods=['PUT'])
def warden_approve_registration(student_id):
    """Warden approves a student registration and auto-allocates room based on preferences"""
    try:
        data = request.get_json() or {}
        fee_status = data.get('fee_status', 'pending')
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        # Check if student exists and fetch email + preferences
        cursor.execute("""
            SELECT s.id, s.user_id, s.preferred_block, s.room_preference, s.floor_preference, u.email, u.name 
            FROM students s 
            JOIN users u ON s.user_id = u.id 
            WHERE s.id = %s
        """, (student_id,))
        student = cursor.fetchone()
        if not student:
            return jsonify({'success': False, 'message': 'Student not found'}), 404

        def get_floor_number(floor_preference):
            if not floor_preference:
                return None
            floor_map = {
                'ground floor': 0,
                '0': 0,
                '1st floor': 1,
                'first floor': 1,
                '1': 1,
                '2nd floor': 2,
                'second floor': 2,
                '2': 2,
                '3rd floor': 3,
                'third floor': 3,
                '3': 3,
                '4th floor': 4,
                'fourth floor': 4,
                '4': 4,
                '5th floor': 5,
                'fifth floor': 5,
                '5': 5
            }
            key = str(floor_preference).strip().lower()
            return floor_map.get(key)

        def allocate_room(room_data, block_name=None):
            if not room_data:
                return None, ' No available rooms. Manual allocation required.'
            room_id = room_data['id']
            cursor.execute(
                "UPDATE students SET room_id = %s WHERE id = %s",
                (room_id, student_id)
            )
            new_occupied = room_data['occupied_count'] + 1
            cursor.execute(
                "UPDATE rooms SET occupied_count = %s WHERE id = %s",
                (new_occupied, room_id)
            )
            if new_occupied >= room_data['capacity']:
                cursor.execute(
                    "UPDATE rooms SET status = 'full' WHERE id = %s",
                    (room_id,)
                )
            cursor.execute("""
                INSERT INTO room_allocations 
                (student_id, room_id, allocation_date, status)
                VALUES (%s, %s, CURDATE(), 'active')
            """, (student_id, room_id))
            block_name = block_name or room_data.get('block_name', 'Unknown')
            message = f' Room {room_data["room_number"]} in {block_name} allocated.'
            return room_id, message

        allocated_room_id = None
        allocation_message = ''
        if student.get('preferred_block') and student.get('floor_preference'):
            preferred_block = str(student['preferred_block']).strip().lower()
            floor_pref = student['floor_preference']
            floor_number = get_floor_number(floor_pref)
            print(f"[DEBUG] Preferred block: '{preferred_block}', Floor preference: '{floor_pref}', Floor number: {floor_number}")
            cursor.execute(
                "SELECT id, block_name FROM blocks WHERE LOWER(TRIM(block_name)) = %s",
                (preferred_block,)
            )
            block = cursor.fetchone()
            if block:
                print(f"[DEBUG] Block found: {block}")
                if floor_number is not None:
                    cursor.execute("""
                        SELECT r.id, r.room_number, r.capacity, r.occupied_count, b.block_name, r.floor
                        FROM rooms r
                        JOIN blocks b ON r.block_id = b.id
                        WHERE r.block_id = %s 
                          AND r.floor = %s
                          AND r.occupied_count < r.capacity 
                          AND r.status = 'available'
                        ORDER BY r.room_number
                        LIMIT 1
                    """, (block['id'], floor_number))
                    preferred_room = cursor.fetchone()
                    print(f"[DEBUG] Preferred room query result: {preferred_room}")
                    if preferred_room:
                        allocated_room_id, allocation_message = allocate_room(preferred_room, block['block_name'])
            else:
                print(f"[DEBUG] No block found for preferred_block: '{preferred_block}'")
        if not allocated_room_id:
            cursor.execute("""
                SELECT r.id, r.room_number, r.capacity, r.occupied_count, r.floor, b.block_name
                FROM rooms r
                JOIN blocks b ON r.block_id = b.id
                WHERE r.occupied_count < r.capacity 
                  AND r.status = 'available'
                ORDER BY b.block_name, r.floor, r.room_number
                LIMIT 1
            """)
            serialized_room = cursor.fetchone()
            if serialized_room:
                allocated_room_id, msg = allocate_room(serialized_room)
                allocation_message = msg + ' (preferences unavailable, allocated serially)'
            else:
                allocation_message = ' No available rooms. Manual allocation required.'
        cursor.execute(
            "UPDATE students SET registration_status = 'approved', fee_status = %s WHERE id = %s", 
            (fee_status, student_id)
        )
        cursor.execute(
            "UPDATE users SET status = 'active' WHERE id = %s", 
            (student['user_id'],)
        )
        connection.commit()
        cursor.close()
        connection.close()
        send_approval_email(student['email'], student['name'])
        return jsonify({
            'success': True, 
            'message': 'Registration approved successfully.' + allocation_message,
            'room_allocated': allocated_room_id is not None
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/warden/registrations/<int:student_id>/reject', methods=['PUT'])
def warden_reject_registration(student_id):
    """Warden rejects a student registration"""
    try:
        data = request.get_json()
        rejection_reason = data.get('rejection_reason', 'No reason provided')
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT s.id, s.user_id, u.email, u.name 
            FROM students s 
            JOIN users u ON s.user_id = u.id 
            WHERE s.id = %s
        """, (student_id,))
        student = cursor.fetchone()
        if not student:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Student not found'}), 404
        cursor.execute("""
            UPDATE students 
            SET registration_status = 'rejected', address = %s 
            WHERE id = %s
        """, (f"Rejection Reason: {rejection_reason}", student_id))
        cursor.execute(
            "UPDATE users SET status = 'inactive' WHERE id = %s", 
            (student['user_id'],)
        )
        connection.commit()
        cursor.close()
        connection.close()
        send_rejection_email(student['email'], student['name'], rejection_reason)
        return jsonify({
            'success': True, 
            'message': 'Registration rejected successfully'
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/technician/complaints/pending', methods=['GET'])
def get_pending_complaints():
    """Get pending complaints for technician"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT c.*, s.roll_number, u.name as student_name
            FROM complaints c
            JOIN students s ON c.student_id = s.id
            JOIN users u ON s.user_id = u.id
            WHERE c.status IN ('pending', 'assigned', 'in_progress', 'delayed')
            ORDER BY c.priority DESC, c.created_at ASC
        """
        cursor.execute(query)
        complaints = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': complaints}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/technician/complaint/<int:complaint_id>/assign', methods=['POST'])
def assign_complaint(complaint_id):
    """Assign complaint to technician"""
    try:
        data = request.get_json()
        technician_id = data.get('technician_id')
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor()
        
        query = """
            UPDATE complaints 
            SET status = 'assigned', assigned_technician_id = %s, assigned_at = NOW()
            WHERE id = %s
        """
        cursor.execute(query, (technician_id, complaint_id))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'message': 'Complaint assigned'}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/technician/complaint/<int:complaint_id>/resolve', methods=['POST'])
def resolve_complaint(complaint_id):
    """Mark complaint as resolved"""
    try:
        data = request.get_json()
        resolution_notes = data.get('resolution_notes')
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor()
        
        query = """
            UPDATE complaints 
            SET status = 'resolved', resolved_at = NOW(), resolution_notes = %s, last_technician_update_at = NOW()
            WHERE id = %s
        """
        cursor.execute(query, (resolution_notes, complaint_id))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'message': 'Complaint resolved'}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/technician/<int:user_id>/complaints', methods=['GET'])
def get_technician_complaints(user_id):
    """Get all complaints assigned to a technician"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Get technician ID from user_id
        cursor.execute("SELECT id FROM technicians WHERE user_id = %s", (user_id,))
        technician = cursor.fetchone()
        
        if not technician:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Technician not found'}), 404
        
        # Get all complaints assigned to this technician grouped by status
        query = """
            SELECT c.*, s.roll_number, u.name as student_name, r.room_number, r.block_id, b.block_name
            FROM complaints c
            JOIN students s ON c.student_id = s.id
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms r ON s.room_id = r.id
            LEFT JOIN blocks b ON r.block_id = b.id
            WHERE c.assigned_technician_id = %s
            ORDER BY c.priority DESC, c.created_at ASC
        """
        cursor.execute(query, (user_id,))
        complaints = cursor.fetchall()
        
        serialized_complaints = [serialize_row(complaint) for complaint in complaints]
        
        # Group by status
        grouped = {
            'assigned': [],
            'in_progress': [],
            'delayed': [],
            'resolved': [],
            'closed': []
        }
        
        for complaint in serialized_complaints:
            status = complaint.get('status', 'pending')
            if status in grouped:
                grouped[status].append(complaint)
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': grouped, 'all': serialized_complaints}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/technician/<int:complaint_id>/update-status', methods=['POST'])
def update_complaint_status(complaint_id):
    """Update complaint status and add resolution details"""
    try:
        data = request.get_json()
        new_status = data.get('status')  # assigned, in_progress, resolved, closed
        resolution_notes = data.get('resolution_notes', '')
        
        if not new_status or new_status not in ['assigned', 'in_progress', 'resolved', 'closed']:
            return jsonify({'success': False, 'message': 'Invalid status'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Check if complaint exists
        cursor.execute("SELECT id, status FROM complaints WHERE id = %s", (complaint_id,))
        complaint = cursor.fetchone()
        
        if not complaint:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Complaint not found'}), 404
        
        # Prepare update query based on status
        if new_status == 'resolved' or new_status == 'closed':
            query = """
                UPDATE complaints 
                SET status = %s, resolution_notes = %s, resolved_at = NOW(), last_technician_update_at = NOW()
                WHERE id = %s
            """
            cursor.execute(query, (new_status, resolution_notes, complaint_id))
        else:
            query = """
                UPDATE complaints 
                SET status = %s, last_technician_update_at = NOW()
                WHERE id = %s
            """
            cursor.execute(query, (new_status, complaint_id))
        
        # Add to complaint history
        cursor.execute("""
            INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by)
            VALUES (%s, %s, %s, NULL)
        """, (complaint_id, complaint['status'], new_status))
        
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'message': f'Complaint status updated to {new_status}'}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ========================================
# SECURITY ENDPOINTS
# ========================================

@app.route('/api/security/visitor/entry', methods=['POST'])
def create_visitor_entry():
    """Create a new visitor entry"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['visitor_name', 'phone', 'student_id', 'purpose', 'security_guard_id']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Get student details for logging
        cursor.execute("""
            SELECT u.name as student_name, s.roll_number, r.room_number
            FROM students s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms r ON s.room_id = r.id
            WHERE s.id = %s
        """, (data['student_id'],))
        student = cursor.fetchone()
        
        if not student:
            return jsonify({'success': False, 'message': 'Student not found'}), 404
        
        # Insert visitor entry
        query = """
            INSERT INTO visitors 
            (visitor_name, phone, id_type, id_number, student_id, purpose, 
             entry_time, status, security_guard_id)
            VALUES (%s, %s, %s, %s, %s, %s, NOW(), 'inside', %s)
        """
        cursor.execute(query, (
            data['visitor_name'],
            data['phone'],
            data.get('id_type', 'other'),
            data.get('id_number', 'N/A'),
            data['student_id'],
            data['purpose'],
            data['security_guard_id']
        ))
        connection.commit()
        visitor_id = cursor.lastrowid
        
        # Create security log
        create_security_log(
            activity_type='visitor',
            description=f"Visitor {data['visitor_name']} allowed entry. Visiting student: {student['student_name']} ({student['roll_number']}). Room: {student['room_number']}. Purpose: {data['purpose']}",
            related_visitor_id=visitor_id,
            related_student_id=data['student_id'],
            severity='low',
            location=f"Room {student['room_number']}",
            logged_by=data['security_guard_id'],
            action_taken="Visitor entry recorded"
        )
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'message': 'Visitor entry recorded', 'visitor_id': visitor_id}), 201
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/security/students', methods=['GET'])
def get_security_students():
    """Get active students for security visitor entry lookup."""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT s.id, u.name, s.roll_number, r.room_number
            FROM students s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms r ON s.room_id = r.id
            WHERE u.status = 'active'
            ORDER BY u.name ASC
        """
        cursor.execute(query)
        students = cursor.fetchall()

        cursor.close()
        connection.close()

        return jsonify({'success': True, 'data': students}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/security/visitors/active', methods=['GET'])
def get_active_visitors():
    """Get active visitors inside hostel"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT v.*, u.name as student_name, st.roll_number, r.room_number
            FROM visitors v
            JOIN students st ON v.student_id = st.id
            JOIN users u ON st.user_id = u.id
            LEFT JOIN rooms r ON st.room_id = r.id
            WHERE v.status = 'inside'
            ORDER BY v.entry_time DESC
        """
        cursor.execute(query)
        visitors = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': visitors}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/security/visitor/<int:visitor_id>/checkout', methods=['POST'])
def checkout_visitor(visitor_id):
    """Mark visitor as exited"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Get visitor details with student info
        cursor.execute("""
            SELECT v.*, u.name as student_name, s.roll_number, r.room_number
            FROM visitors v
            JOIN students s ON v.student_id = s.id
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms r ON s.room_id = r.id
            WHERE v.id = %s
        """, (visitor_id,))
        visitor = cursor.fetchone()
        
        if not visitor:
            return jsonify({'success': False, 'message': 'Visitor not found'}), 404
        
        query = """
            UPDATE visitors 
            SET status = 'exited', exit_time = NOW()
            WHERE id = %s
        """
        cursor.execute(query, (visitor_id,))
        connection.commit()
        
        room_number = visitor.get('room_number') or 'N/A'

        # Create security log
        create_security_log(
            activity_type='visitor',
            description=f"Visitor {visitor['visitor_name']} marked as exited. Visited student: {visitor['student_name']} ({visitor['roll_number']}). Room: {room_number}",
            related_visitor_id=visitor_id,
            related_student_id=visitor['student_id'],
            severity='low',
            location=f"Room {room_number}",
            logged_by=visitor.get('security_guard_id'),
            action_taken=f"Visitor exit recorded"
        )
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'message': 'Visitor checked out'}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/security/visitors/history', methods=['GET'])
def get_visitor_history():
    """Get visitor history (exited/overstayed visitors)"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT v.*, u.name as student_name, st.roll_number, r.room_number
            FROM visitors v
            JOIN students st ON v.student_id = st.id
            JOIN users u ON st.user_id = u.id
            LEFT JOIN rooms r ON st.room_id = r.id
            WHERE v.status IN ('exited', 'overstayed')
            ORDER BY v.exit_time DESC
            LIMIT 50
        """
        cursor.execute(query)
        visitors = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': visitors}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/security/logs', methods=['GET'])
def get_security_logs():
    """Get security activity logs with optional date filtering"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Get optional date filter from query params
        selected_date = request.args.get('date')
        
        if selected_date:
            # Filter by specific date
            query = """
                SELECT sl.*, u.name as logged_by_name
                FROM security_logs sl
                JOIN users u ON sl.logged_by = u.id
                WHERE DATE(sl.timestamp) = %s
                ORDER BY sl.timestamp DESC
                LIMIT 100
            """
            cursor.execute(query, (selected_date,))
        else:
            # Get all logs from today
            query = """
                SELECT sl.*, u.name as logged_by_name
                FROM security_logs sl
                JOIN users u ON sl.logged_by = u.id
                WHERE DATE(sl.timestamp) = CURDATE()
                ORDER BY sl.timestamp DESC
                LIMIT 100
            """
            cursor.execute(query)
        
        logs = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': logs or []}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ========================================
# SECURITY OUTPASS MANAGEMENT
# ========================================

@app.route('/api/security/outpasses/approved', methods=['GET'])
def get_approved_outpasses_for_security():
    """Get all approved outpasses for security monitoring"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT 
                o.*,
                u.name as student_name,
                s.roll_number,
                s.phone,
                s.year,
                s.branch,
                r.room_number,
                b.block_name,
                u2.name as approved_by_name
            FROM outpasses o
            JOIN students s ON o.student_id = s.id
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms r ON s.room_id = r.id
            LEFT JOIN blocks b ON r.block_id = b.id
            LEFT JOIN users u2 ON o.approved_by = u2.id
            WHERE o.status IN ('approved', 'exited', 'returned', 'overdue')
            ORDER BY 
                CASE o.status
                    WHEN 'exited' THEN 1
                    WHEN 'overdue' THEN 2
                    WHEN 'approved' THEN 3
                    WHEN 'returned' THEN 4
                END,
                o.out_date DESC,
                o.out_time DESC
        """
        cursor.execute(query)
        outpasses = cursor.fetchall()
        
        # Serialize and calculate overdue status
        result = []
        for outpass in outpasses:
            outpass_data = serialize_row(outpass)
            
            # Real-time monitor state preview
            if outpass['status'] in ['approved', 'exited', 'overdue']:
                expected_return = outpass['expected_return_time']
                if expected_return:
                    from datetime import datetime
                    now = datetime.now()
                    monitor_state, late_minutes = get_monitor_state(expected_return, now, outpass.get('out_date'))
                    outpass_data['late_minutes'] = late_minutes
                    outpass_data['monitor_state'] = monitor_state
                    outpass_data['is_late'] = late_minutes > 0
            
            result.append(outpass_data)
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': result}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/security/outpass/<int:outpass_id>/mark-exit', methods=['POST'])
def mark_outpass_exit(outpass_id):
    """Mark student as exited (OUT)"""
    try:
        data = request.get_json()
        security_user_id = data.get('security_user_id')
        notes = data.get('notes', '')
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Get outpass details with student info
        cursor.execute("""
            SELECT o.*, s.id as student_id, u.name as student_name, s.roll_number
            FROM outpasses o
            JOIN students s ON o.student_id = s.id
            JOIN users u ON s.user_id = u.id
            WHERE o.id = %s
        """, (outpass_id,))
        outpass = cursor.fetchone()
        
        if not outpass:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Outpass not found'}), 404
        
        if outpass['status'] not in ['approved', 'approved_otp']:
            # Track unauthorized exit attempts for Security Monitoring Agent.
            create_security_log(
                activity_type='incident',
                description=(
                    f"Unauthorized exit attempt: {outpass['student_name']} ({outpass['roll_number']}) "
                    f"tried to exit with outpass OP-{outpass_id} in status '{outpass['status']}'."
                ),
                related_student_id=outpass['student_id'],
                related_outpass_id=outpass_id,
                severity='high',
                location='Gate',
                logged_by=security_user_id,
                action_taken='Exit blocked by security. Pending/invalid approval status.',
                follow_up_required='yes'
            )
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Outpass must be approved to mark exit'}), 400
        
        # Update outpass status to 'exited'
        from datetime import datetime
        exit_time = datetime.now()
        
        query = """
            UPDATE outpasses 
            SET status = 'exited', 
                actual_exit_time = %s,
                exit_logged_by = %s,
                monitor_state = 'on_time',
                security_notes = %s
            WHERE id = %s
        """
        cursor.execute(query, (exit_time, security_user_id, notes, outpass_id))
        connection.commit()
        
        # Create security log
        create_security_log(
            activity_type='outpass',
            description=f"Student {outpass['student_name']} ({outpass['roll_number']}) marked as exited using outpass OP-{outpass_id}",
            related_student_id=outpass['student_id'],
            related_outpass_id=outpass_id,
            severity='low',
            location='Gate',
            logged_by=security_user_id,
            action_taken=f"Student exit recorded. Notes: {notes}" if notes else "Student exit recorded"
        )
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'message': 'Student marked as OUT'}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/security/outpass/<int:outpass_id>/mark-return', methods=['POST'])
def mark_outpass_return(outpass_id):
    """Mark student as returned (IN)"""
    try:
        data = request.get_json()
        security_user_id = data.get('security_user_id')
        notes = data.get('notes', '')
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Get outpass details with student info
        cursor.execute("""
            SELECT o.*, s.id as student_id, u.name as student_name, s.roll_number
            FROM outpasses o
            JOIN students s ON o.student_id = s.id
            JOIN users u ON s.user_id = u.id
            WHERE o.id = %s
        """, (outpass_id,))
        outpass = cursor.fetchone()
        
        if not outpass:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Outpass not found'}), 404
        
        if outpass['status'] not in ['exited', 'overdue', 'approved', 'approved_otp']:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Invalid outpass status for return'}), 400
        
        # Calculate if late
        from datetime import datetime
        return_time = datetime.now()
        expected_return = outpass['expected_return_time']
        
        is_overdue = False
        late_minutes = 0
        grace_period_applied = False
        final_status = 'returned'
        
        if expected_return and return_time > expected_return:
            late_minutes = int((return_time - expected_return).total_seconds() / 60)
            
            if late_minutes <= OUTPASS_GRACE_MINUTES:
                grace_period_applied = True
                final_status = 'returned'
            else:
                is_overdue = True
                # Student has returned physically, so keep status as returned
                # and track severe delay via is_overdue/monitor_state.
                final_status = 'returned'

        monitor_state = 'overdue' if is_overdue else ('grace_period' if grace_period_applied else 'on_time')

        metrics = get_student_outpass_metrics(cursor, outpass['student_id'], outpass_id)
        risk_level = classify_outpass_risk(metrics)
        
        # Update outpass
        query = """
            UPDATE outpasses 
            SET status = %s,
                actual_return_time = %s,
                return_logged_by = %s,
                monitor_state = %s,
                risk_level = %s,
                is_overdue = %s,
                late_minutes = %s,
                grace_period_applied = %s,
                security_notes = CONCAT_WS('; ', security_notes, %s)
            WHERE id = %s
        """
        cursor.execute(query, (
            final_status, return_time, security_user_id,
            monitor_state, risk_level,
            is_overdue, late_minutes, grace_period_applied, 
            notes, outpass_id
        ))
        connection.commit()
        
        # Create security log
        log_severity = 'critical' if is_overdue else ('medium' if grace_period_applied else 'low')
        late_duration_str = format_late_duration(late_minutes)
        create_security_log(
            activity_type='outpass',
            description=f"Student {outpass['student_name']} ({outpass['roll_number']}) marked as returned from outpass OP-{outpass_id}" + 
                       (f" ({late_duration_str} late)" if late_minutes > 0 else ""),
            related_student_id=outpass['student_id'],
            related_outpass_id=outpass_id,
            severity=log_severity,
            location='Gate',
            logged_by=security_user_id,
            action_taken=f"Student return recorded. Status: {final_status}. Late: {late_duration_str}. Notes: {notes}" if notes 
                        else f"Student return recorded. Status: {final_status}. Late: {late_duration_str}",
            follow_up_required='yes' if is_overdue else 'no'
        )
        
        # Notify warden for any late return.
        if late_minutes > 0:
            alert_msg = f"Student returned {late_duration_str} late (ID: {outpass_id})"
            alert_title = f"Late Return - {outpass['student_name']}"
            cursor.execute("""
                INSERT INTO notifications (user_id, title, message, notification_type, related_module, related_id)
                SELECT u.id, %s, %s, 'warning', 'outpass', %s
                FROM users u
                WHERE u.role = 'warden'
            """, (alert_title, alert_msg, outpass_id))
            connection.commit()

        if late_minutes > 0:
            create_security_agentic_alert(
                cursor,
                alert_type='late_return',
                severity='high' if is_overdue else 'medium',
                title='Late Return Detected',
                message=(
                    f"{outpass['student_name']} ({outpass['roll_number']}) returned {late_duration_str} after approved time "
                    f"for outpass OP-{outpass_id}."
                ),
                student_id=outpass['student_id'],
                related_outpass_id=outpass_id,
                detection_key=f"late_return_{outpass_id}",
                metadata={
                    'late_minutes': late_minutes,
                    'grace_period_applied': grace_period_applied,
                    'final_status': final_status
                }
            )
            connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True, 
            'message': 'Student marked as returned',
            'is_late': is_overdue or grace_period_applied,
            'late_minutes': late_minutes,
            'grace_period_applied': grace_period_applied,
            'final_status': final_status
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ========================================
# 🎯 SECURITY PARCEL MANAGEMENT ENDPOINTS
# ========================================

@app.route('/api/security/parcels', methods=['GET'])
def get_security_parcels():
    """Get all parcels for security office with optional roll number filter"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Get optional roll_number filter from query params
        roll_number = request.args.get('roll_number')
        
        if roll_number:
            # Query with flexible filter (roll number, student name, tracking number)
            query = """
                SELECT 
                    p.id,
                    p.tracking_number,
                    p.courier_name as courier,
                    p.sender_name,
                    p.sender_contact,
                    p.parcel_type,
                    p.received_date,
                    p.received_time,
                    p.status,
                    p.collection_date,
                    p.remarks,
                    s.roll_number,
                    u.name as student_name,
                    s.preferred_block,
                    s.room_preference,
                    r.room_number,
                    b.block_name,
                    COALESCE(r.room_number, 'Pending Assignment') as display_room,
                    COALESCE(b.block_name, s.preferred_block, 'Not Assigned') as display_block
                FROM parcels p
                JOIN students s ON p.student_id = s.id
                JOIN users u ON s.user_id = u.id
                LEFT JOIN room_allocations ra ON ra.student_id = s.id AND ra.status = 'active'
                LEFT JOIN rooms r ON r.id = COALESCE(s.room_id, ra.room_id)
                LEFT JOIN blocks b ON r.block_id = b.id
                WHERE s.roll_number LIKE %s
                   OR u.name LIKE %s
                   OR p.tracking_number LIKE %s
                ORDER BY p.received_date DESC, p.received_time DESC
            """
            search_value = f"%{roll_number}%"
            cursor.execute(query, (search_value, search_value, search_value))
        else:
            # Query all parcels
            query = """
                SELECT 
                    p.id,
                    p.tracking_number,
                    p.courier_name as courier,
                    p.sender_name,
                    p.sender_contact,
                    p.parcel_type,
                    p.received_date,
                    p.received_time,
                    p.status,
                    p.collection_date,
                    p.remarks,
                    s.roll_number,
                    u.name as student_name,
                    s.preferred_block,
                    s.room_preference,
                    r.room_number,
                    b.block_name,
                    COALESCE(r.room_number, 'Pending Assignment') as display_room,
                    COALESCE(b.block_name, s.preferred_block, 'Not Assigned') as display_block
                FROM parcels p
                JOIN students s ON p.student_id = s.id
                JOIN users u ON s.user_id = u.id
                LEFT JOIN room_allocations ra ON ra.student_id = s.id AND ra.status = 'active'
                LEFT JOIN rooms r ON r.id = COALESCE(s.room_id, ra.room_id)
                LEFT JOIN blocks b ON r.block_id = b.id
                ORDER BY p.received_date DESC, p.received_time DESC
                LIMIT 100
            """
            cursor.execute(query)
        
        parcels = cursor.fetchall()
        
        # Serialize the results (convert datetime objects)
        serialized_parcels = [serialize_row(p) for p in parcels]
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'data': serialized_parcels,
            'count': len(serialized_parcels)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/security/parcel/<int:parcel_id>/notify', methods=['POST'])
def notify_parcel_collection(parcel_id):
    """Mark a parcel as notified to student"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Get parcel details with student info
        cursor.execute("""
            SELECT p.*, s.id as student_id, u.name as student_name, s.roll_number
            FROM parcels p
            JOIN students s ON p.student_id = s.id
            JOIN users u ON s.user_id = u.id
            WHERE p.id = %s
        """, (parcel_id,))
        parcel = cursor.fetchone()
        
        if not parcel:
            return jsonify({'success': False, 'message': 'Parcel not found'}), 404
        
        # Update parcel status to notified
        cursor.execute("""
            UPDATE parcels 
            SET status = 'notified',
                updated_at = NOW()
            WHERE id = %s
        """, (parcel_id,))
        connection.commit()
        
        # Create security log
        create_security_log(
            activity_type='parcel',
            description=f"Parcel {parcel_id} received from {parcel['courier_name'] or 'Unknown Courier'} for student {parcel['student_name']} ({parcel['roll_number']}). Tracking: {parcel['tracking_number'] or 'N/A'}",
            related_student_id=parcel['student_id'],
            related_parcel_id=parcel_id,
            severity='low',
            location='Reception',
            action_taken=f"Parcel notified to student. Type: {parcel['parcel_type']}"
        )
        
        # Get student email to send notification
        cursor.execute("""
            SELECT u.email, u.name, s.roll_number
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = %s
        """, (parcel['student_id'],))
        
        student_info = cursor.fetchone()
        
        if student_info:
            # Send email notification
            try:
                subject = f"📦 Parcel Received - {student_info['name']}"
                
                # Create beautiful HTML email
                html_body = f"""
                <html>
                <head>
                    <style>
                        body {{
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            padding: 20px;
                            margin: 0;
                        }}
                        .container {{
                            max-width: 600px;
                            margin: 0 auto;
                            background: #ffffff;
                            border-radius: 12px;
                            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                            overflow: hidden;
                        }}
                        .header {{
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            padding: 30px 20px;
                            text-align: center;
                        }}
                        .header h1 {{
                            margin: 0;
                            font-size: 28px;
                            font-weight: 600;
                        }}
                        .header p {{
                            margin: 8px 0 0 0;
                            font-size: 14px;
                            opacity: 0.9;
                        }}
                        .content {{
                            padding: 30px 20px;
                        }}
                        .greeting {{
                            font-size: 16px;
                            color: #333;
                            margin-bottom: 20px;
                        }}
                        .alert-box {{
                            background: #fff3cd;
                            border-left: 4px solid #ffc107;
                            padding: 15px 20px;
                            margin: 20px 0;
                            border-radius: 6px;
                            font-size: 14px;
                            color: #856404;
                        }}
                        .details {{
                            background: #f8f9fa;
                            border: 1px solid #e9ecef;
                            border-radius: 8px;
                            padding: 20px;
                            margin: 20px 0;
                        }}
                        .detail-row {{
                            display: flex;
                            padding: 10px 0;
                            border-bottom: 1px solid #e9ecef;
                        }}
                        .detail-row:last-child {{
                            border-bottom: none;
                        }}
                        .detail-label {{
                            font-weight: 600;
                            color: #667eea;
                            width: 140px;
                            min-width: 140px;
                        }}
                        .detail-value {{
                            color: #555;
                            word-break: break-word;
                            flex: 1;
                        }}
                        .cta-button {{
                            display: inline-block;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            padding: 12px 30px;
                            text-decoration: none;
                            border-radius: 6px;
                            font-weight: 600;
                            margin-top: 20px;
                            text-align: center;
                        }}
                        .instructions {{
                            background: #d4edda;
                            border-left: 4px solid #28a745;
                            padding: 15px 20px;
                            margin: 20px 0;
                            border-radius: 6px;
                            font-size: 14px;
                            color: #155724;
                        }}
                        .footer {{
                            background: #f8f9fa;
                            padding: 20px;
                            text-align: center;
                            border-top: 1px solid #e9ecef;
                            font-size: 12px;
                            color: #6b7280;
                        }}
                        .footer-text {{
                            margin: 5px 0;
                        }}
                        .icon {{
                            font-size: 20px;
                            margin-right: 8px;
                        }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>📦 Parcel Received!</h1>
                            <p>Your package is ready for collection</p>
                        </div>
                        
                        <div class="content">
                            <div class="greeting">
                                Hello <strong>{student_info['name']}</strong>,
                            </div>
                            
                            <p>Great news! A parcel addressed to you has been received at the hostel reception and is ready for collection.</p>
                            
                            <div class="alert-box">
                                <strong>⏰ Important:</strong> Please collect your parcel during reception office hours. Items left uncollected for extended periods may be stored separately.
                            </div>
                            
                            <div class="details">
                                <div class="detail-row">
                                    <div class="detail-label">📮 Tracking Number:</div>
                                    <div class="detail-value"><strong>{parcel['tracking_number'] or 'N/A'}</strong></div>
                                </div>
                                <div class="detail-row">
                                    <div class="detail-label">🚚 Courier:</div>
                                    <div class="detail-value">{parcel['courier_name'] or 'Not specified'}</div>
                                </div>
                                <div class="detail-row">
                                    <div class="detail-label">👤 Sender:</div>
                                    <div class="detail-value">{parcel['sender_name'] or 'Not specified'}</div>
                                </div>
                                <div class="detail-row">
                                    <div class="detail-label">📦 Type:</div>
                                    <div class="detail-value">{parcel['parcel_type'] or 'Package'}</div>
                                </div>
                                <div class="detail-row">
                                    <div class="detail-label">📅 Received:</div>
                                    <div class="detail-value">{parcel['received_date']}</div>
                                </div>
                            </div>
                            
                            <div class="instructions">
                                <strong>✓ What to do next:</strong>
                                <ul style="margin: 8px 0; padding-left: 20px;">
                                    <li>Visit the hostel reception desk</li>
                                    <li>Provide your registration number or ID</li>
                                    <li>Collect your parcel and sign the receipt</li>
                                </ul>
                            </div>
                            
                            <p style="color: #666; font-size: 14px; margin-top: 20px;">
                                If you have any questions or didn't receive a parcel, please contact the hostel reception immediately.
                            </p>
                        </div>
                        
                        <div class="footer">
                            <div class="footer-text"><strong>HostelConnect Reception System</strong></div>
                            <div class="footer-text">Automated Parcel Notification Service</div>
                            <div class="footer-text" style="margin-top: 10px; color: #999;">
                                This is an automated message. Please do not reply to this email.
                            </div>
                        </div>
                    </div>
                </body>
                </html>
                """
                
                # Send via SMTP
                if USE_SMTP:
                    send_email_smtp(student_info['email'], subject, html_body)
                else:
                    send_email_gmail_api(student_info['email'], subject, html_body)
            except Exception as email_error:
                print(f"Error sending notification email: {str(email_error)}")
                # Don't fail the API call if email fails
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'message': 'Parcel marked as notified',
            'parcel_id': parcel_id
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/security/parcel/<int:parcel_id>/collect', methods=['POST'])
def collect_parcel(parcel_id):
    """Mark a parcel as collected by student"""
    try:
        data = request.get_json() or {}
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Get parcel details with student info
        cursor.execute("""
            SELECT p.*, s.id as student_id, u.name as student_name, s.roll_number
            FROM parcels p
            JOIN students s ON p.student_id = s.id
            JOIN users u ON s.user_id = u.id
            WHERE p.id = %s
        """, (parcel_id,))
        parcel = cursor.fetchone()
        
        if not parcel:
            return jsonify({'success': False, 'message': 'Parcel not found'}), 404
        
        # Update parcel status to collected
        cursor.execute("""
            UPDATE parcels 
            SET status = 'collected',
                collection_date = NOW(),
                collected_by = %s,
                updated_at = NOW()
            WHERE id = %s
        """, (data.get('collected_by', 'Security Staff'), parcel_id))
        connection.commit()
        
        # Create security log
        create_security_log(
            activity_type='parcel',
            description=f"Parcel {parcel_id} collected by student {parcel['student_name']} ({parcel['roll_number']}). Courier: {parcel['courier_name'] or 'Unknown'}",
            related_student_id=parcel['student_id'],
            related_parcel_id=parcel_id,
            severity='low',
            location='Reception',
            action_taken=f"Parcel collected by student. Status: collected"
        )
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'message': 'Parcel marked as collected',
            'parcel_id': parcel_id
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/security/parcel', methods=['POST'])
def add_parcel():
    """Add a new parcel received at security office"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['roll_number', 'courier_name', 'parcel_type']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Get student by roll number
        cursor.execute("""
            SELECT id, user_id FROM students WHERE roll_number = %s
        """, (data.get('roll_number'),))
        
        student = cursor.fetchone()
        
        if not student:
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'message': 'Student not found with this roll number'}), 404
        
        # Get security user ID if provided
        security_user_id = data.get('security_user_id')
        
        # Prepare tracking number - use None if empty (NULL in database, won't violate UNIQUE constraint)
        tracking_number = data.get('tracking_number') if data.get('tracking_number') else None
        
        # Insert new parcel
        cursor.execute("""
            INSERT INTO parcels 
            (student_id, tracking_number, courier_name, sender_name, sender_contact, 
             parcel_type, received_date, received_time, received_by, status, remarks)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'received', %s)
        """, (
            student['id'],
            tracking_number,
            data.get('courier_name'),
            data.get('sender_name') or '',
            data.get('sender_contact') or '',
            data.get('parcel_type'),
            data.get('received_date') or date.today(),
            data.get('received_time') or datetime.now().time(),
            security_user_id,
            data.get('remarks') or ''
        ))
        connection.commit()
        parcel_id = cursor.lastrowid
        
        # Get the newly created parcel with student info
        cursor.execute("""
            SELECT 
                p.id,
                p.tracking_number,
                p.courier_name as courier,
                p.sender_name,
                p.sender_contact,
                p.parcel_type,
                p.received_date,
                p.received_time,
                p.status,
                p.remarks,
                s.roll_number,
                u.name as student_name,
                r.room_number
            FROM parcels p
            JOIN students s ON p.student_id = s.id
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms r ON s.room_id = r.id
            WHERE p.id = %s
        """, (parcel_id,))
        
        new_parcel = cursor.fetchone()
        serialized_parcel = serialize_row(new_parcel)
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'message': 'Parcel added successfully',
            'parcel': serialized_parcel
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# Health check endpoint
@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'}), 200

# Debug endpoint to check student room assignment
@app.route('/api/debug/student/<int:student_id>', methods=['GET'])
def debug_student_room(student_id):
    """Debug endpoint to check student room assignment"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT s.id as student_id, s.user_id, s.room_id, u.name, u.email,
                   r.room_number, b.block_name
            FROM students s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rooms r ON s.room_id = r.id
            LEFT JOIN blocks b ON r.block_id = b.id
            WHERE s.id = %s
        """, (student_id,))
        student = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'data': student}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/rooms/recalculate-occupancy', methods=['POST'])
def recalculate_room_occupancy():
    """Recalculate occupied_count for all rooms based on actual student assignments"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # First, get actual counts for each room
        cursor.execute("""
            SELECT room_id, COUNT(*) as actual_count
            FROM students
            WHERE room_id IS NOT NULL
            GROUP BY room_id
        """)
        room_counts = cursor.fetchall()
        
        # Create a dict of room_id -> count
        count_map = {row['room_id']: row['actual_count'] for row in room_counts}
        
        # Get all rooms
        cursor.execute("SELECT id, capacity FROM rooms")
        all_rooms = cursor.fetchall()
        
        updated_count = 0
        
        # Update each room
        for room in all_rooms:
            actual_count = count_map.get(room['id'], 0)
            
            # Determine new status
            if actual_count == 0:
                new_status = 'available'
            elif actual_count >= room['capacity']:
                new_status = 'full'
            else:
                new_status = 'available'
            
            # Update the room
            cursor.execute("""
                UPDATE rooms 
                SET occupied_count = %s, status = %s
                WHERE id = %s
            """, (actual_count, new_status, room['id']))
            updated_count += 1
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True, 
            'message': f'Recalculated occupancy for {updated_count} rooms'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/rooms/verify-occupancy', methods=['GET'])
def verify_room_occupancy():
    """Verify room occupancy counts and return discrepancies"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        
        # Get actual counts for each room with students
        cursor.execute("""
            SELECT room_id, COUNT(*) as actual_count
            FROM students
            WHERE room_id IS NOT NULL
            GROUP BY room_id
        """)
        room_counts = cursor.fetchall()
        count_map = {row['room_id']: row['actual_count'] for row in room_counts}
        
        # Get all rooms
        cursor.execute("""
            SELECT r.id, r.room_number, b.block_name, r.occupied_count, r.capacity
            FROM rooms r
            JOIN blocks b ON r.block_id = b.id
        """)
        all_rooms = cursor.fetchall()
        
        discrepancies = []
        for room in all_rooms:
            actual_count = count_map.get(room['id'], 0)
            if room['occupied_count'] != actual_count:
                discrepancies.append({
                    'id': room['id'],
                    'room_number': room['room_number'],
                    'block_name': room['block_name'],
                    'stored_count': room['occupied_count'],
                    'actual_count': actual_count,
                    'capacity': room['capacity']
                })
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'discrepancies': discrepancies,
            'has_issues': len(discrepancies) > 0
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ========================================
# MESS MENU MANAGEMENT
# ========================================

@app.route('/api/mess/menu', methods=['GET'])
def get_mess_menu():
    """Get complete weekly mess menu"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Fetch all menu items
        cursor.execute("""
            SELECT day_of_week, meal_type, menu_items, special_notes
            FROM mess_menu
            ORDER BY 
                FIELD(day_of_week, 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
                FIELD(meal_type, 'breakfast', 'lunch', 'snacks', 'dinner')
        """)
        
        menu_items = cursor.fetchall()
        cursor.close()
        connection.close()
        
        # Organize data by day and meal type
        menu_dict = {}
        for item in menu_items:
            day = item['day_of_week'].capitalize()
            meal = item['meal_type']
            
            if day not in menu_dict:
                menu_dict[day] = {}
            
            # Store menu items as array (split by newline) for warden view
            # and as string (comma-separated) for student view
            menu_dict[day][meal] = {
                'items': item['menu_items'].split('\n') if item['menu_items'] else [],
                'text': item['menu_items'] or '',
                'notes': item['special_notes']
            }
        
        return jsonify({
            'success': True,
            'data': menu_dict
        }), 200
        
    except Exception as e:
        print(f"Error fetching mess menu: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/mess/menu', methods=['POST'])
def update_mess_menu():
    """Update mess menu for a specific day and meal"""
    try:
        data = request.get_json()
        day_of_week = data.get('day_of_week', '').lower()
        meal_type = data.get('meal_type', '').lower()
        menu_items = data.get('menu_items', [])
        
        if not day_of_week or not meal_type:
            return jsonify({'success': False, 'message': 'Day and meal type are required'}), 400
        
        # Convert array to newline-separated string
        menu_text = '\n'.join(menu_items) if isinstance(menu_items, list) else menu_items
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor()
        
        # Check if entry exists
        cursor.execute("""
            SELECT id FROM mess_menu 
            WHERE day_of_week = %s AND meal_type = %s
        """, (day_of_week, meal_type))
        
        existing = cursor.fetchone()
        
        if existing:
            # Update existing entry
            cursor.execute("""
                UPDATE mess_menu 
                SET menu_items = %s
                WHERE day_of_week = %s AND meal_type = %s
            """, (menu_text, day_of_week, meal_type))
        else:
            # Insert new entry
            cursor.execute("""
                INSERT INTO mess_menu (day_of_week, meal_type, menu_items)
                VALUES (%s, %s, %s)
            """, (day_of_week, meal_type, menu_text))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'message': 'Menu updated successfully'
        }), 200
        
    except Exception as e:
        print(f"Error updating mess menu: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


if __name__ == '__main__':
    print("=" * 50)
    print("HostelConnect Backend Server Starting...")
    print("=" * 50)
    print("API Base URL: http://localhost:5000")
    print("Login Endpoint: http://localhost:5000/api/login")
    print("Test Endpoint: http://localhost:5000/api/test")
    print("=" * 50)
    
    # Verify room occupancy on startup
    try:
        apply_sql_migrations()
        ensure_audit_log_table()
        ensure_outpass_monitoring_columns()
        ensure_holiday_mode_columns()
        ensure_complaint_monitoring_columns()
        ensure_leave_monitoring_columns()
        ensure_security_monitoring_columns()
        if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
            start_outpass_monitor_agent()
            start_complaint_monitor_agent()
            start_leave_monitor_agent()
            start_security_monitor_agent()

        connection = get_db_connection()
        if connection:
            cursor = connection.cursor(dictionary=True)
            
            # Get actual counts
            cursor.execute("""
                SELECT room_id, COUNT(*) as actual_count
                FROM students
                WHERE room_id IS NOT NULL
                GROUP BY room_id
            """)
            room_counts = cursor.fetchall()
            count_map = {row['room_id']: row['actual_count'] for row in room_counts}
            
            # Get all rooms and check for discrepancies
            cursor.execute("SELECT id, occupied_count FROM rooms")
            all_rooms = cursor.fetchall()
            
            discrepancy_count = 0
            for room in all_rooms:
                actual_count = count_map.get(room['id'], 0)
                if room['occupied_count'] != actual_count:
                    discrepancy_count += 1
            
            if discrepancy_count > 0:
                print(f"WARNING: {discrepancy_count} rooms have incorrect occupancy counts")
                print("Use POST /api/admin/rooms/recalculate-occupancy to fix")
            else:
                print("All room occupancy counts are correct")
            cursor.close()
            connection.close()
    except Exception as e:
        print(f"Could not verify room occupancy: {e}")
    
    print("=" * 50)
    app.run(debug=True, host='127.0.0.1', port=5000)
