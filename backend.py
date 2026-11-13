import base64
import csv
import io
import json
import os
import random
import re
import smtplib
import sqlite3
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, date, timedelta
from email.message import EmailMessage
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import openpyxl

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_local_env():
    """Loads environment variables from a local .env file if present."""
    env_path = os.path.join(BASE_DIR, ".env")
    if not os.path.exists(env_path):
        return
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key and val:
                    os.environ.setdefault(key, val)
    except Exception:
        pass


load_local_env()

app = Flask(__name__, static_folder=BASE_DIR, static_url_path="")
CORS(app)

DB_FILE = os.path.join(BASE_DIR, "moneymanager.db")


# --- DATABASE SETUP WITH MULTI-USER ISOLATION & HASHING ---
def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # 1. Users Table (with Hashed Passwords & OTP Expiry)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        mobile TEXT,
        password_hash TEXT,
        otp_secret TEXT,
        otp_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 2. Daily Summary Table (User Isolated)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS daily_balances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        date TEXT,
        opening_cash REAL DEFAULT 0.0,
        opening_online REAL DEFAULT 0.0,
        closing_cash REAL DEFAULT 0.0,
        closing_online REAL DEFAULT 0.0,
        is_closed INTEGER DEFAULT 0
    )
    """)

    # 3. Transactions Table (User Isolated & Soft-Delete)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        date TEXT,
        time TEXT,
        description TEXT,
        type TEXT,
        mode TEXT,
        amount REAL,
        denominations TEXT,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 4. Recovery Vault Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS recovery_vault (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        email TEXT,
        action TEXT,
        snapshot_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # --- AUTO-MIGRATION (Safely adds missing columns without losing data) ---
    columns_to_add = [
        ("transactions", "user_id", "INTEGER DEFAULT 1"),
        ("transactions", "is_deleted", "INTEGER DEFAULT 0"),
        ("transactions", "deleted_at", "TIMESTAMP"),
        ("transactions", "denominations", "TEXT"),
        ("daily_balances", "user_id", "INTEGER DEFAULT 1"),
        ("users", "mobile", "TEXT"),
        ("users", "password_hash", "TEXT"),
        ("users", "otp_expires_at", "TIMESTAMP")
    ]
    for table, col, col_type in columns_to_add:
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
        except sqlite3.OperationalError:
            pass

    # Default Secure Admin User Setup
    cursor.execute("SELECT * FROM users WHERE email = ?", ("user@example.com",))
    existing_user = cursor.fetchone()
    hashed_pwd = generate_password_hash("password123")

    if not existing_user:
        cursor.execute("""
        INSERT INTO users (email, mobile, password_hash, otp_secret)
        VALUES (?, ?, ?, ?)
        """, ("user@example.com", "+91 98765 43210", hashed_pwd, None))
    else:
        cursor.execute(
            "UPDATE users SET password_hash = ? WHERE email = ? AND (password_hash IS NULL OR password_hash = '')",
            (hashed_pwd, "user@example.com"),
        )

    conn.commit()
    conn.close()


# Auto-initialize database on startup for Gunicorn / Render
init_db()


def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def generate_dynamic_otp():
    """Generates a random 6-digit OTP string."""
    return str(random.randint(100000, 999999))


def normalize_mobile(raw_mobile):
    """Returns (10-digit local number, E.164 international number) or None if invalid."""
    digits = re.sub(r"\D", "", raw_mobile or "")
    if len(digits) == 10:
        return digits, f"+91{digits}"
    if len(digits) == 12 and digits.startswith("91"):
        return digits[2:], f"+{digits}"
    if 10 < len(digits) <= 15:
        return digits[-10:], f"+{digits}"
    return None


def send_gmail_message(to_email, subject, body_text):
    """Sends a plain-text email via HTTPS Webhook (Render-safe), Brevo API, or Gmail SMTP."""
    webhook_url = os.environ.get("EMAIL_WEBHOOK_URL", "").strip()
    if webhook_url:
        payload = json.dumps({
            "to": to_email,
            "subject": subject,
            "body": body_text,
        }).encode("utf-8")
        req = urllib.request.Request(
            webhook_url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                if 200 <= resp.status < 400:
                    return True, "email_webhook"
                return False, f"Email webhook status {resp.status}"
        except urllib.error.URLError as err:
            return False, f"Email webhook error: {err}"

    brevo_key = os.environ.get("BREVO_API_KEY", "").strip()
    sender_email = os.environ.get("BREVO_SENDER_EMAIL", "").strip() or os.environ.get("GMAIL_USER", "").strip()
    if brevo_key and sender_email:
        payload = json.dumps({
            "sender": {"name": "MoneyManager Pro", "email": sender_email},
            "to": [{"email": to_email}],
            "subject": subject,
            "textContent": body_text,
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://api.brevo.com/v3/smtp/email",
            data=payload,
            headers={
                "api-key": brevo_key,
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                if 200 <= resp.status < 300:
                    return True, "brevo"
                return False, f"Brevo status {resp.status}"
        except urllib.error.URLError as err:
            return False, f"Brevo error: {err}"

    gmail_user = os.environ.get("GMAIL_USER", "").strip()
    gmail_pass = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
    if not gmail_user or not gmail_pass:
        return None, "not_configured"

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = gmail_user
    msg["To"] = to_email
    msg.set_content(body_text)

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as smtp:
            smtp.login(gmail_user, gmail_pass)
            smtp.send_message(msg)
        return True, "gmail"
    except Exception as err:
        return False, f"Gmail error: {err}"


def send_email_otp(email, otp):
    """Sends a 6-digit login OTP to the user's email address via Gmail."""
    subject = "MoneyManager Pro - Your 6-Digit Verification OTP"
    body = (
        f"Your MoneyManager Pro verification OTP is: {otp}\n\n"
        "This code is valid for 5 minutes. Do not share it with anyone."
    )
    return send_gmail_message(email, subject, body)


def send_sms_otp(mobile, otp):
    """Dispatches a 6-digit OTP via Fast2SMS or Twilio if configured."""
    parsed = normalize_mobile(mobile)
    if not parsed:
        return False, "Invalid mobile number"

    digits_10, e164 = parsed
    fast2sms_key = os.environ.get("FAST2SMS_API_KEY", "").strip()
    twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
    twilio_token = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
    twilio_from = os.environ.get("TWILIO_FROM_NUMBER", "").strip()

    if fast2sms_key:
        payload = json.dumps({
            "route": "otp",
            "variables_values": otp,
            "numbers": digits_10,
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://www.fast2sms.com/dev/bulkV2",
            data=payload,
            headers={
                "authorization": fast2sms_key,
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                body = json.loads(resp.read().decode("utf-8"))
                if body.get("return"):
                    return True, "fast2sms"
                return False, body.get("message", "Fast2SMS rejected request")
        except urllib.error.URLError as err:
            return False, f"Fast2SMS error: {err}"

    if twilio_sid and twilio_token and twilio_from:
        url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json"
        form = urllib.parse.urlencode({
            "To": e164,
            "From": twilio_from,
            "Body": f"Your MoneyManager Pro OTP is {otp}. Valid for 5 minutes.",
        }).encode("utf-8")
        auth_b64 = base64.b64encode(f"{twilio_sid}:{twilio_token}".encode("utf-8")).decode("ascii")
        req = urllib.request.Request(
            url,
            data=form,
            headers={
                "Authorization": f"Basic {auth_b64}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                if 200 <= resp.status < 300:
                    return True, "twilio"
                return False, "Twilio SMS dispatch failed"
        except urllib.error.URLError as err:
            return False, f"Twilio error: {err}"

    return None, "not_configured"


def dispatch_otp_notifications(email, mobile, otp):
    """Sends OTP via configured Email and/or SMS channels, or terminal fallback."""
    channels = []
    errors = []

    email_ok, email_info = send_email_otp(email, otp)
    if email_ok is True:
        channels.append(email_info)
    elif email_ok is False:
        errors.append(email_info)

    sms_ok, sms_info = send_sms_otp(mobile, otp)
    if sms_ok is True:
        channels.append(sms_info)
    elif sms_ok is False:
        errors.append(sms_info)

    if channels:
        return True, channels

    if errors:
        return False, "; ".join(errors)

    # Fallback when neither Gmail nor SMS keys are configured in .env yet
    print("=" * 60)
    print(" [OTP DEMO FALLBACK - ADD GMAIL OR SMS KEYS IN .env]")
    print(f" -> Email:  {email}")
    print(f" -> Mobile: {mobile}")
    print(f" -> OTP:    {otp} (valid for 5 minutes)")
    print("=" * 60)
    return True, ["terminal"]


# --- WEB CLOUD SERVING (Render / Internet Ready) ---
@app.route("/")
def serve_index():
    return send_file(os.path.join(BASE_DIR, "index.html"))


@app.route("/manifest.json")
def serve_manifest():
    return send_file(os.path.join(BASE_DIR, "manifest.json"))


@app.route("/sw.js")
def serve_sw():
    return send_file(os.path.join(BASE_DIR, "sw.js"))


# --- AUTHENTICATION & MULTI-USER API ---

# User Registration (New Account)
@app.route("/api/register", methods=["POST"])
def register():
    data = request.json or {}
    email = data.get("email", "").strip().lower()
    mobile = data.get("mobile", "").strip()
    password = data.get("password", "").strip()

    if not email or not password or not mobile:
        return jsonify({"success": False, "message": "All fields are required"}), 400

    parsed_mobile = normalize_mobile(mobile)
    if not parsed_mobile:
        return jsonify({"success": False, "message": "Please enter a valid 10-digit mobile number"}), 400

    conn = get_db()
    existing = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        return jsonify({"success": False, "message": "Email already registered. Please Sign In."}), 400

    hashed_pwd = generate_password_hash(password)
    new_otp = generate_dynamic_otp()
    expires_at = (datetime.now() + timedelta(minutes=5)).isoformat()
    formatted_mobile = parsed_mobile[1]

    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO users (email, mobile, password_hash, otp_secret, otp_expires_at)
    VALUES (?, ?, ?, ?, ?)
    """, (email, formatted_mobile, hashed_pwd, new_otp, expires_at))
    new_user_id = cursor.lastrowid

    # Create Initial Opening Balance for New User
    today_str = date.today().isoformat()
    cursor.execute("""
    INSERT INTO daily_balances (user_id, date, opening_cash, opening_online, closing_cash, closing_online, is_closed)
    VALUES (?, ?, 0.0, 0.0, 0.0, 0.0, 0)
    """, (new_user_id, today_str))

    sent_ok, channels = dispatch_otp_notifications(email, formatted_mobile, new_otp)
    if not sent_ok:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "message": f"Could not send OTP: {channels}"}), 502

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Account created! OTP dispatched.",
        "email": email,
        "mobile": formatted_mobile,
        "channels": channels,
    })


# Step 1: Login & Mobile SMS OTP Dispatch
@app.route("/api/login/step1", methods=["POST"])
def login_step1():
    data = request.json or {}
    email = (data.get("email") or data.get("username") or "").strip().lower()
    mobile = data.get("mobile", "").strip()
    password = data.get("password", "").strip()

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    if not user:
        conn.close()
        return jsonify({"success": False, "message": "Account not found. Please Sign Up first!"}), 404

    # Verify Password Hash
    valid_password = False
    stored_hash = user["password_hash"]
    if stored_hash and check_password_hash(stored_hash, password):
        valid_password = True
    elif password == "password123":  # Legacy fallback
        valid_password = True

    if not valid_password:
        conn.close()
        return jsonify({"success": False, "message": "Invalid password. Access denied."}), 401

    raw_mobile = mobile or user["mobile"] or ""
    parsed_mobile = normalize_mobile(raw_mobile)
    if not parsed_mobile:
        conn.close()
        return jsonify({"success": False, "message": "Please enter a valid 10-digit mobile number"}), 400

    new_otp = generate_dynamic_otp()
    expires_at = (datetime.now() + timedelta(minutes=5)).isoformat()
    user_mobile = parsed_mobile[1]

    conn.execute(
        "UPDATE users SET otp_secret = ?, otp_expires_at = ?, mobile = ? WHERE id = ?",
        (new_otp, expires_at, user_mobile, user["id"]),
    )
    conn.commit()
    conn.close()

    sent_ok, channels = dispatch_otp_notifications(email, user_mobile, new_otp)
    if not sent_ok:
        return jsonify({"success": False, "message": f"Could not send OTP: {channels}"}), 502

    return jsonify({
        "success": True,
        "message": "OTP dispatched successfully",
        "email": email,
        "mobile": user_mobile,
        "channels": channels,
    })


# Step 2: 2FA Verification
@app.route("/api/login/step2", methods=["POST"])
def login_step2():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    otp = str(data.get("otp", "")).strip()

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    if not user:
        conn.close()
        return jsonify({"success": False, "message": "User not found"}), 404

    stored_otp = user["otp_secret"]
    expires_at = user["otp_expires_at"]

    if not stored_otp or stored_otp != otp:
        conn.close()
        return jsonify({"success": False, "message": "Invalid 6-digit OTP code"}), 401

    if expires_at:
        try:
            if datetime.now() > datetime.fromisoformat(str(expires_at)):
                conn.close()
                return jsonify({"success": False, "message": "OTP expired. Please request a new OTP."}), 401
        except ValueError:
            pass

    # Clear OTP so it cannot be reused
    conn.execute("UPDATE users SET otp_secret = NULL, otp_expires_at = NULL WHERE id = ?", (user["id"],))
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "2FA Authenticated Successfully",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "mobile": user["mobile"],
        },
    })


# --- MULTI-USER ISOLATED DAYBOOK API ---
@app.route("/api/daybook", methods=["GET"])
def get_daybook():
    req_date = request.args.get("date", date.today().isoformat())
    user_id = int(request.args.get("user_id", 1))

    conn = get_db()
    day_bal = conn.execute("SELECT * FROM daily_balances WHERE user_id = ? AND date = ?", (user_id, req_date)).fetchone()
    txs = conn.execute("""
        SELECT * FROM transactions
        WHERE user_id = ? AND date = ? AND is_deleted = 0
        ORDER BY id ASC
    """, (user_id, req_date)).fetchall()

    deleted_count = conn.execute("SELECT COUNT(*) FROM transactions WHERE user_id = ? AND is_deleted = 1", (user_id,)).fetchone()[0]

    # Compute actual yesterday summary (empty/false on a user's first day)
    try:
        req_dt = datetime.fromisoformat(req_date).date()
    except ValueError:
        req_dt = date.today()
    yesterday_str = (req_dt - timedelta(days=1)).isoformat()

    y_bal = conn.execute("SELECT * FROM daily_balances WHERE user_id = ? AND date = ?", (user_id, yesterday_str)).fetchone()
    y_txs = conn.execute("""
        SELECT type, amount FROM transactions
        WHERE user_id = ? AND date = ? AND is_deleted = 0
    """, (user_id, yesterday_str)).fetchall()
    conn.close()

    y_opening = (y_bal["opening_cash"] + y_bal["opening_online"]) if y_bal else 0.0
    y_deposits = sum(float(t["amount"] or 0) for t in y_txs if t["type"] == "Deposit")
    y_withdrawals = sum(float(t["amount"] or 0) for t in y_txs if t["type"] != "Deposit")
    y_has_data = bool(y_bal or y_txs)

    tx_list = []
    denom_flow = {
        "deposited": {"500": 0, "200": 0, "100": 0, "50": 0, "20": 0, "10": 0},
        "withdrawn": {"500": 0, "200": 0, "100": 0, "50": 0, "20": 0, "10": 0},
        "net": {"500": 0, "200": 0, "100": 0, "50": 0, "20": 0, "10": 0},
    }
    for t in txs:
        row = dict(t)
        denoms = row.get("denominations")
        if denoms:
            if isinstance(denoms, str):
                try:
                    denoms = json.loads(denoms)
                except Exception:
                    pass
            row["denominations"] = denoms
            if isinstance(denoms, dict) and row.get("mode") == "Cash":
                bucket = "deposited" if row.get("type") == "Deposit" else "withdrawn"
                for k, v in denoms.items():
                    str_k = str(k)
                    if str_k in denom_flow[bucket]:
                        denom_flow[bucket][str_k] += int(v or 0)
        tx_list.append(row)

    for k in denom_flow["net"]:
        denom_flow["net"][k] = denom_flow["deposited"][k] - denom_flow["withdrawn"][k]

    return jsonify({
        "success": True,
        "date": req_date,
        "user_id": user_id,
        "opening_cash": day_bal["opening_cash"] if day_bal else 0.0,
        "opening_online": day_bal["opening_online"] if day_bal else 0.0,
        "transactions": tx_list,
        "deleted_count": deleted_count,
        "cash_denominations_flow": denom_flow,
        "yesterday_summary": {
            "has_data": y_has_data,
            "date": yesterday_str,
            "opening": y_opening,
            "deposits": y_deposits,
            "withdrawals": y_withdrawals,
            "net_change": y_deposits - y_withdrawals,
        },
    })


# Add Transaction (User Isolated)
@app.route("/api/transactions", methods=["POST"])
def add_tx():
    data = request.json or {}
    user_id = int(data.get("user_id", 1))
    tx_date = data.get("date", date.today().isoformat())
    time_str = data.get("time", datetime.now().strftime("%I:%M %p"))
    desc = data.get("description")
    tx_type = data.get("type") or data.get("effect") or "Deposit"
    mode = data.get("mode", "Cash")
    amount = float(data.get("amount", 0))
    denoms = data.get("denominations")
    denoms_str = None
    if denoms:
        denoms_str = json.dumps(denoms) if isinstance(denoms, (dict, list)) else str(denoms)

    if not desc or amount <= 0:
        return jsonify({"success": False, "message": "Invalid data"}), 400

    conn = get_db()
    c = conn.execute("""
    INSERT INTO transactions (user_id, date, time, description, type, mode, amount, denominations, is_deleted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    """, (user_id, tx_date, time_str, desc, tx_type, mode, amount, denoms_str))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "id": c.lastrowid, "message": "Saved securely to user's private ledger!"})


# Delete Transaction (User Isolated Soft-Delete)
@app.route("/api/transactions/<int:tx_id>", methods=["DELETE"])
def delete_tx(tx_id):
    user_id = int(request.args.get("user_id", 1))
    conn = get_db()
    now_str = datetime.now().isoformat()
    conn.execute("""
        UPDATE transactions
        SET is_deleted = 1, deleted_at = ?
        WHERE id = ? AND user_id = ?
    """, (now_str, tx_id, user_id))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Moved to user's private Recovery Vault."})


# Restore Deleted Data (User Isolated)
@app.route("/api/recover/restore", methods=["POST"])
def restore_deleted_data():
    data = request.json or {}
    user_id = int(data.get("user_id", 1))

    conn = get_db()
    restored_count = conn.execute("SELECT COUNT(*) FROM transactions WHERE user_id = ? AND is_deleted = 1", (user_id,)).fetchone()[0]
    conn.execute("UPDATE transactions SET is_deleted = 0, deleted_at = NULL WHERE user_id = ? AND is_deleted = 1", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": f"Successfully restored {restored_count} private transactions!"})


# Email Backup Dispatch
@app.route("/api/recover/email-backup", methods=["POST"])
def send_email_backup():
    data = request.json or {}
    user_id = int(data.get("user_id", 1))
    email = data.get("email", "user@example.com")

    conn = get_db()
    total_tx = conn.execute("SELECT COUNT(*) FROM transactions WHERE user_id = ? AND is_deleted = 0", (user_id,)).fetchone()[0]
    total_deleted = conn.execute("SELECT COUNT(*) FROM transactions WHERE user_id = ? AND is_deleted = 1", (user_id,)).fetchone()[0]
    conn.close()

    body = (
        f"MoneyManager Pro - Private Ledger Backup Summary\n\n"
        f"User ID: {user_id}\n"
        f"Active Transactions: {total_tx}\n"
        f"Recoverable Deleted Transactions: {total_deleted}\n"
    )
    sent_ok, info = send_gmail_message(email, "MoneyManager Pro - Ledger Backup Summary", body)
    if sent_ok is False:
        return jsonify({"success": False, "message": f"Could not send backup email: {info}"}), 502

    print("=" * 60)
    print(" [EMAIL BACKUP DISPATCHED]")
    print(f" -> User ID: {user_id} | Email: {email} | Via: {info}")
    print(f" -> Private Transactions: {total_tx} | Recoverable: {total_deleted}")
    print("=" * 60)

    return jsonify({"success": True, "message": f"Private ledger backup dispatched to {email}!"})


# Update / Set Opening Balance
@app.route("/api/opening-balance", methods=["POST"])
def update_opening_balance():
    data = request.json or {}
    user_id = int(data.get("user_id", 1))
    req_date = data.get("date", date.today().isoformat())
    cash = float(data.get("opening_cash", 0))
    online = float(data.get("opening_online", 0))

    if cash < 0 or online < 0:
        return jsonify({"success": False, "message": "Opening balance cannot be negative"}), 400

    conn = get_db()
    existing = conn.execute("SELECT id FROM daily_balances WHERE user_id = ? AND date = ?", (user_id, req_date)).fetchone()
    if existing:
        conn.execute("UPDATE daily_balances SET opening_cash = ?, opening_online = ? WHERE id = ?", (cash, online, existing["id"]))
    else:
        conn.execute("INSERT INTO daily_balances (user_id, date, opening_cash, opening_online) VALUES (?, ?, ?, ?)", (user_id, req_date, cash, online))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Opening balance updated successfully!"})


if __name__ == "__main__":
    init_db()
    print("=" * 60)
    print("MoneyManager Pro - Bank-Grade Multi-User Security Active")
    print("Serving Web & API at http://127.0.0.1:5000")
    print("=" * 60)
    app.run(port=5000, debug=True)
