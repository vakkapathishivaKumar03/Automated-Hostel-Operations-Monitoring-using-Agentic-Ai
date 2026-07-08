"""
Holiday mode migration helper.

The holiday mode/OTP schema is now consolidated into database_schema.sql.
This script verifies that required columns/tables exist.
"""

import mysql.connector
import sys
import os

# Database configuration
DB_CONFIG = {
    'host': os.getenv('MYSQL_HOST', 'localhost'),
    'user': os.getenv('MYSQL_USER', 'root'),
    'password': os.getenv('MYSQL_PASSWORD', os.getenv('DB_PASSWORD', '')),
    'database': os.getenv('MYSQL_DB', os.getenv('DB_NAME', 'hostelconnect_db'))
}

def apply_migration():
    """Verify holiday mode schema objects exist."""
    try:
        print("Connecting to database...")
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)

        cursor.execute("SHOW COLUMNS FROM outpasses")
        outpass_columns = {row['Field'] for row in cursor.fetchall()}

        required_columns = {
            'approval_method', 'otp_code', 'otp_sent_at', 'otp_verified_at',
            'otp_attempts', 'holiday_mode_request'
        }
        missing_columns = sorted(required_columns - outpass_columns)

        cursor.execute("SHOW TABLES LIKE 'system_settings'")
        has_system_settings = cursor.fetchone() is not None

        if missing_columns or not has_system_settings:
            print("\n❌ Schema verification failed.")
            if missing_columns:
                print("Missing outpasses columns:", ", ".join(missing_columns))
            if not has_system_settings:
                print("Missing table: system_settings")
            print("Run setup_database.py to apply consolidated schema.")
            sys.exit(1)
        
        cursor.close()
        connection.close()
        
        print("\n" + "="*50)
        print("✅ Holiday mode schema is already present.")
        print("="*50)
        
    except mysql.connector.Error as e:
        print(f"\n❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    print("="*50)
    print("Holiday Mode & OTP Migration")
    print("="*50)
    apply_migration()
