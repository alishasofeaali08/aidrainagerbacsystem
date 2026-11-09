from sqlalchemy import create_engine, text
from app.config import settings

def migrate():
    engine = create_engine(settings.database_url)
    with engine.connect() as conn:
        print("Checking for ai_cameras table...")
        # Since we use metadata.create_all, usually it works, but if the file exists it might skip it.
        # But AICamera is a new table, so create_all should handle it if we run it.
        # However, to be safe for existing DB:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ai_cameras (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(120) NOT NULL,
                latitude FLOAT NOT NULL,
                longitude FLOAT NOT NULL,
                status VARCHAR(20) DEFAULT 'green',
                last_update DATETIME
            )
        """))
        conn.commit()
        print("Migration complete.")

if __name__ == "__main__":
    migrate()
