import mysql.connector
import sys
import os

# Database configuration
db_config = {
    'host': os.getenv('MYSQL_HOST', 'localhost'),
    'user': os.getenv('MYSQL_USER', 'root'),
    'password': os.getenv('MYSQL_PASSWORD', os.getenv('DB_PASSWORD', '')),
    'database': os.getenv('MYSQL_DB', os.getenv('DB_NAME', 'hostelconnect_db'))
}

def run_migration():
    try:
        # Read the SQL file
        with open('apply_outpass_tracking.sql', 'r') as f:
            sql_statements = f.read()
        
        # Connect to database
        print("Connecting to database...")
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # Split by semicolon and execute each statement
        statements = [s.strip() for s in sql_statements.split(';') if s.strip()]
        
        print(f"Executing {len(statements)} SQL statements...")
        
        for i, statement in enumerate(statements, 1):
            if statement.strip():
                print(f"  [{i}/{len(statements)}] Executing: {statement[:50]}...")
                try:
                    cursor.execute(statement)
                    print(f"  ✓ Success")
                except mysql.connector.Error as e:
                    print(f"  ✗ Error: {e}")
                    # Ignore duplicate column/key errors as columns may already exist
                    if "Duplicate column name" not in str(e) and "Duplicate key name" not in str(e):
                        raise
                    print("    (Skipping - already exists)")
        
        conn.commit()
        print("\n✓ Migration completed successfully!")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    run_migration()
