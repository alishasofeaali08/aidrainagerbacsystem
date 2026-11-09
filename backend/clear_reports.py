import os
import shutil
from sqlalchemy import delete
from app.db import SessionLocal
from app.models import Report, WorkOrder, Comment

def clear_reports():
    db = SessionLocal()
    try:
        # Delete dependent records first to avoid foreign key issues
        print("Clearing Work Orders...")
        db.execute(delete(WorkOrder))
        
        print("Clearing Comments...")
        db.execute(delete(Comment))
        
        print("Clearing Reports...")
        db.execute(delete(Report))
        
        db.commit()
        print("Database reports cleared successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error clearing database: {e}")
    finally:
        db.close()

def clear_uploads():
    upload_dir = "uploads"
    if os.path.exists(upload_dir):
        print(f"Clearing files in {upload_dir}...")
        for filename in os.listdir(upload_dir):
            file_path = os.path.join(upload_dir, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            except Exception as e:
                print(f"Failed to delete {file_path}. Reason: {e}")
        print("Uploads directory cleared.")
    else:
        print(f"Upload directory {upload_dir} does not exist.")

if __name__ == "__main__":
    clear_reports()
    clear_uploads()
