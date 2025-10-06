from datetime import datetime
import pyodbc
from dotenv import load_dotenv
import os

# ---------- LOAD ENV ----------
load_dotenv()  # Reads .env file in project root

server = os.getenv("DB_SERVER")
database = os.getenv("DB_DATABASE")
username = os.getenv("DB_USERNAME")
password = os.getenv("DB_PASSWORD")
driver = "{ODBC Driver 18 for SQL Server}"

# ---------- HELPER FUNCTION TO GET CONNECTION ----------
def get_sql_connection():
    conn = pyodbc.connect(
        f"DRIVER={driver};SERVER={server};DATABASE={database};UID={username};PWD={password};"
        "Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
    )
    return conn

# ---------- MAIN FUNCTION ----------
def get_subscription_status(sub_id, platform):
    """
    Determine subscription status based on approvals and proposed changes.
    Skips overdue for now.
    """
    conn = get_sql_connection()
    cursor = conn.cursor()

    try:
        # 1️⃣ Check for pending cost center approvals → "Check"
        cursor.execute(
            "SELECT 1 FROM cost_center_approvals WHERE subscription_id=? AND platform=? AND status='Pending'",
            (sub_id, platform)
        )
        if cursor.fetchone():
            return "Check"

        # 2️⃣ If proposed changes exist without pending approval → "In-Progress"
        cursor.execute(
            "SELECT 1 FROM proposed_changes WHERE sub_id=? AND platform=?",
            (sub_id, platform)
        )
        if cursor.fetchone():
            return "In-Progress"

        # 3️⃣ Default → "Up to date"
        return "Up to date"

    finally:
        conn.close()

def row_to_dict(cursor, row):
    """
    Convert a pyodbc.Row (or None) into a dictionary mapping column names to values.
    If row is None, return {}.
    """
    if not row:
        return {}
    columns = [col[0] for col in cursor.description]
    return dict(zip(columns, row))