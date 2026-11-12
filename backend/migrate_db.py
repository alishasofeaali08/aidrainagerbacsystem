from sqlalchemy import inspect, text
from app.db import engine, Base
from app import models  # noqa: F401  (registers all models on Base.metadata)


def migrate():
    print(f"Connecting to {engine.url}")
    Base.metadata.create_all(engine)  # creates any missing tables
    insp = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            existing = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name in existing:
                    continue
                coltype = col.type.compile(engine.dialect)
                print(f"Adding {table.name}.{col.name} ({coltype})")
                conn.execute(text(f'ALTER TABLE {table.name} ADD COLUMN {col.name} {coltype}'))
    print("Migration complete.")


if __name__ == "__main__":
    migrate()
