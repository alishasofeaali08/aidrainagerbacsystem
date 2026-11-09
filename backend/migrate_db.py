
import os
from sqlalchemy import create_engine, text
from app.config import settings

def migrate():
    print(f"Connecting to {settings.database_url}")
    engine = create_engine(settings.database_url)
    with engine.connect() as conn:
        try:
            # Check if column exists
            result = conn.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result.fetchall()]
            
            if 'department_office' not in columns:
                print("Adding department_office column to users table...")
                conn.execute(text("ALTER TABLE users ADD COLUMN department_office VARCHAR(255)"))
                conn.commit()
                print("Column added successfully.")
            else:
                print("department_office column already exists.")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    # Ensure we are in the backend directory or point to the right path
    migrate()
