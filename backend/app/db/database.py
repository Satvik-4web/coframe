import os
import shutil
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

is_serverless = (
    bool(os.getenv("VERCEL"))
    or bool(os.getenv("VERCEL_ENV"))
    or bool(os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
    or bool(os.getenv("LAMBDA_TASK_ROOT"))
    or "/var/task" in os.path.abspath(__file__).replace("\\", "/")
    or not os.access(".", os.W_OK)
)

raw_db_url = os.getenv("DATABASE_URL", "")

if is_serverless and (not raw_db_url or "sqlite" in raw_db_url.lower()):
    tmp_db = "/tmp/coframe.db"
    if not os.path.exists(tmp_db):
        candidates = [
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../coframe.db")),
            os.path.abspath("coframe.db"),
            "/var/task/coframe.db",
        ]
        for candidate in candidates:
            if os.path.exists(candidate):
                try:
                    shutil.copyfile(candidate, tmp_db)
                    break
                except Exception:
                    pass
    DATABASE_URL = f"sqlite:///{tmp_db}"
elif raw_db_url:
    DATABASE_URL = raw_db_url
else:
    DATABASE_URL = "sqlite:///./coframe.db"

# For SQLite, enable check_same_thread=False
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
    future=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
