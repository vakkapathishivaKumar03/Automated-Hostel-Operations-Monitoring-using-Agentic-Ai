"""
Complete Database Setup
Runs consolidated main schema
"""

import mysql.connector
import sys
import os

def execute_sql_file(cursor, conn, filename, description):
    """Execute a SQL file with proper error handling"""
    print(f"\n{'='*60}")
    print(f"📄 {description}")
    print(f"{'='*60}\n")
    
    if not os.path.exists(filename):
        print(f"❌ File not found: {filename}")
        return False
    
    with open(filename, 'r', encoding='utf-8') as f:
        sql_script = f.read()
    
    # Parse statements
    statements = []
    current_statement = []
    
    for line in sql_script.split('\n'):
        # Remove inline comments
        if '--' in line:
            line = line.split('--')[0]
        line = line.strip()
        
        if not line:
            continue
            
        current_statement.append(line)
        
        if line.endswith(';'):
            stmt = ' '.join(current_statement).rstrip(';')
            if stmt and not stmt.upper().startswith(('CREATE OR REPLACE VIEW', 'DROP VIEW')):
                statements.append(stmt)
            current_statement = []
    
    print(f"Found {len(statements)} SQL statements\n")
    
    success_count = 0
    skip_count = 0
    
    for i, statement in enumerate(statements, 1):
        try:
            preview = statement[:60].replace('\n', ' ') + '...'
            print(f"  [{i}/{len(statements)}] {preview}", end='')
            
            cursor.execute(statement)
            conn.commit()
            print(" ✓")
            success_count += 1
            
        except mysql.connector.Error as e:
            if 'already exists' in str(e) or 'Duplicate' in str(e):
                print(" (exists)")
                skip_count += 1
            else:
                print(f"\n    ❌ Error: {e}")
                return False
    
    print(f"\n✅ Completed: {success_count} executed, {skip_count} skipped")
    return True

def main():
    db_config = {
        'host': os.getenv('MYSQL_HOST', 'localhost'),
        'user': os.getenv('MYSQL_USER', 'root'),
        'password': os.getenv('MYSQL_PASSWORD', os.getenv('DB_PASSWORD', '')),
        'database': os.getenv('MYSQL_DB', os.getenv('DB_NAME', 'hostelconnect_db'))
    }
    
    print("="*60)
    print("   HOSTELCONNECT DATABASE SETUP")
    print("   Main Schema")
    print("="*60)
    
    try:
        print(f"\n🔌 Connecting to database: {db_config['database']}...")
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        print("✅ Connected\n")
        
        # Step 1: Execute main schema
        if not execute_sql_file(cursor, conn, 'database_schema.sql', 
                                 'STEP 1: Main Database Schema'):
            return False

        # All migration end-state is consolidated into database_schema.sql.
        
        # Verify setup
        print(f"\n{'='*60}")
        print("📊 FINAL VERIFICATION")
        print(f"{'='*60}\n")
        
        cursor.execute("SHOW TABLES")
        all_tables = [t[0] for t in cursor.fetchall()]
        
        print(f"Total tables: {len(all_tables)}\n")
        
        # Check for key tables
        key_tables = [
            'students', 'users', 'wardens', 'technicians', 'outpasses', 'leave_applications',
            'complaints'
        ]
        
        print("Key tables status:")
        for table in key_tables:
            status = "✓" if table in all_tables else "✗"
            print(f"  {status} {table}")
        
        cursor.close()
        conn.close()
        
        print(f"\n{'='*60}")
        print("🎉 DATABASE SETUP COMPLETE!")
        print(f"{'='*60}")
        print("\nNext steps:")
        print("1. Start backend: python app.py")
        print("2. Start frontend: npm run dev")
        
        return True
        
    except mysql.connector.Error as e:
        print(f"\n❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
