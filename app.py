from flask import Flask, render_template, request
from flask import jsonify
from datetime import datetime
from utility import fetch_cost_center_details
from status import get_subscription_status, get_sql_connection, row_to_dict
from dotenv import load_dotenv
import pyodbc
import base64
import json
load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')

# =======================
# Helper Functions
# =======================
def get_logged_in_user():
    user_name = "Guest"
    email1 = email2 = None

    user_principal = request.headers.get("X-MS-CLIENT-PRINCIPAL")
    if user_principal:
        decoded = base64.b64decode(user_principal).decode("utf-8")
        claims = json.loads(decoded)
        for claim in claims.get("claims", []):
            if claim.get("typ") == "name":
                user_name = claim.get("val")
            elif claim.get("typ") == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress":
                email1 = claim.get("val")
            elif claim.get("typ") == "preferred_username":
                email2 = claim.get("val")

    # Return a flat list of emails (lowercased), ignoring None
    emails = [e.lower() for e in (email1, email2) if e]
    return user_name, emails

def get_subscriptions_by_email(table_name, user_emails, platform):
    # Extract and filter None values
    emails = [e.lower() for e in user_emails if e]  # remove None
    if not emails:
        return []  # no emails, return empty list

    conn = get_sql_connection()
    cursor = conn.cursor()

    # Build placeholders dynamically
    placeholders = ','.join('?' for _ in emails)
    query = f"""
        SELECT * 
        FROM [{table_name}]
        WHERE LOWER([IT Owner]) IN ({placeholders})
           OR LOWER([Cost Center Responsible]) IN ({placeholders})
    """
    # Repeat emails tuple for IT Owner + Cost Center
    params = tuple(emails) * 2
    cursor.execute(query, params)
    rows = cursor.fetchall()

    # Convert pyodbc rows → list of dicts
    columns = [col[0] for col in cursor.description]
    subscriptions = [dict(zip(columns, row)) for row in rows]

    # Normalization
    normalized = []
    for sub in subscriptions:
        if platform == 'AWS':
            sub['Subscription ID'] = sub.pop('Account ID', None)
            sub['Environment'] = sub.get('Type of Account', 'N/A')
        elif platform == 'GCP':
            sub['Subscription ID'] = sub.pop('Project ID', None)
            sub['Environment'] = sub.get('Type of Project', 'N/A')
            sub['Person-related'] = sub.get('Personal Related', 'N/A')
        else:  # Azure
            sub['Environment'] = sub.get('Type of Subscription', 'N/A')

        sub['platform'] = platform
        sub['Subscription Status'] = get_subscription_status(sub['Subscription ID'], platform)
        normalized.append(sub)

    cursor.close()
    conn.close()
    return normalized

def count_statuses(subscriptions):
    return {
        'total': len(subscriptions),
        'up_to_date': sum(1 for sub in subscriptions if sub.get('Subscription Status', '').lower() == 'up to date'),
        'overdue': sum(1 for sub in subscriptions if sub.get('Subscription Status', '').lower() == 'overdue'),
        'in_progress': sum(1 for sub in subscriptions if sub.get('Subscription Status', '').lower() == 'in-progress'),
        'check': sum(1 for sub in subscriptions if sub.get('Subscription Status', '').lower() == 'check'),
    }

# =======================
# Routes
# =======================

@app.route('/')
def home():
    user_name, user_email = get_logged_in_user()

    # Get subscriptions from all platforms
    azure_subs = get_subscriptions_by_email('azure_assets', user_email, 'Azure')
    aws_subs = get_subscriptions_by_email('aws_assets', user_email, 'AWS')
    gcp_subs = get_subscriptions_by_email('gcp_assets', user_email, 'GCP')

    # Status counts
    azure_counts = count_statuses(azure_subs)
    aws_counts = count_statuses(aws_subs)
    gcp_counts = count_statuses(gcp_subs)

    return render_template('index.html',
                           user_email=user_email,
                           user_name=user_name,
                           azure_subs=azure_subs,
                           aws_subs=aws_subs,
                           gcp_subs=gcp_subs,
                           azure_counts=azure_counts,
                           aws_counts=aws_counts,
                           gcp_counts=gcp_counts)

@app.route('/components/metadata')
def metadata():
    platform = request.args.get('platform')
    user_name, user_emails = get_logged_in_user()  # <-- FIX: unpack correctly

    if not platform:
        azure_subs = get_subscriptions_by_email('azure_assets', user_emails, 'Azure')
        aws_subs = get_subscriptions_by_email('aws_assets', user_emails, 'AWS')
        gcp_subs = get_subscriptions_by_email('gcp_assets', user_emails, 'GCP')

        subscriptions = azure_subs + aws_subs + gcp_subs
        platform = "All Platforms"
    else:
        table_map = {
            'Azure': 'azure_assets',
            'AWS': 'aws_assets',
            'GCP': 'gcp_assets'
        }
        table = table_map.get(platform)
        if not table:
            return "Invalid platform", 400
        subscriptions = get_subscriptions_by_email(table, user_emails, platform)

    # Dynamic subscription status
    for sub in subscriptions:
        sub_id = sub['Subscription ID']
        sub_platform = sub['platform']
        sub['Subscription Status'] = get_subscription_status(sub_id, sub_platform)

    return render_template(
        'components/metaData.html',
        user_name=user_name,
        user_email=user_emails,
        platform=platform,
        subscriptions=subscriptions
    )

@app.route('/components/metadetails')
def meta_details():
    sub_id = request.args.get('id')
    platform = request.args.get('platform')

    if not sub_id or not platform:
        return "Missing required parameters", 400

    table_map = {
        'Azure': ('azure_assets', 'Subscription ID'),
        'AWS': ('aws_assets', 'Account ID'),
        'GCP': ('gcp_assets', 'Project ID')
    }

    if platform not in table_map:
        return "Invalid platform", 400

    table_name, id_column = table_map[platform]

    conn = get_sql_connection()
    cursor = conn.cursor()

    # --- Get proposed changes (if any)
    cursor.execute(
        "SELECT * FROM proposed_changes WHERE sub_id = ? AND platform = ?",
        (sub_id, platform)
    )
    proposed_row = cursor.fetchone()
    proposed_dict = row_to_dict(cursor, proposed_row)

    # --- Always fetch original row
    cursor.execute(f"SELECT * FROM {table_name} WHERE [{id_column}] = ?", (sub_id,))
    original_row = cursor.fetchone()
    original_dict = row_to_dict(cursor, original_row)
    conn.close()

    if not original_dict:
        return "Subscription not found", 404

    sub = {
        'Subscription ID': sub_id,
        'platform': platform
    }

    # ========= Non-editable fields =========
    name_field = {
        'Azure': 'Subscription Name',
        'AWS': 'Account Name',
        'GCP': 'Project Name'
    }.get(platform)

    sub['Subscription Name'] = original_dict.get(name_field, 'N/A')
    sub['Cost Center Name (Current)'] = original_dict.get('Cost Center Name', 'N/A')

    sub['Cost Center Responsible (Current)'] = str(
        int(original_dict.get('Cost Center Responsible', 0))
    ) if isinstance(original_dict.get('Cost Center Responsible'), float) and original_dict.get('Cost Center Responsible').is_integer() else str(original_dict.get('Cost Center Responsible', 'N/A'))

    sub['Cost Center Responsible WOM (Current)'] = str(
        int(original_dict.get('Cost Center Responsible WOM', 0))
    ) if isinstance(original_dict.get('Cost Center Responsible WOM'), float) and original_dict.get('Cost Center Responsible WOM').is_integer() else str(original_dict.get('Cost Center Responsible WOM', 'N/A'))

    sub['IT Owner WOM (Current)'] = str(
        int(original_dict.get('IT Owner WOM', 0))
    ) if isinstance(original_dict.get('IT Owner WOM'), float) and original_dict.get('IT Owner WOM').is_integer() else str(original_dict.get('IT Owner WOM', 'N/A'))

    sub['Last Review Date'] = original_dict.get('Last Review Date', 'N/A')

    # ========= Editable Fields (Proposed vs Current) =========
    editable_fields = {
        'I-SC': 'i_sc',
        'A-SC': 'a_sc',
        'C-SC': 'c_sc',
        'Organizational Unit': 'organizational_unit',
        'Type of Environment': 'environment',
        'Cost Center': 'cost_center',
        'IT Owner': 'it_owner',
        'Person-related': 'person_related'
    }

    db_field_map = {
        'i_sc': 'I-SC',
        'a_sc': 'A-SC',
        'c_sc': 'C-SC',
        'organizational_unit': 'Management Group (OE)',
        'environment': {
            'Azure': 'Type of Subscription',
            'AWS': 'Type of Account',
            'GCP': 'Type of Project'
        }[platform],
        'cost_center': 'Cost Center',
        'it_owner': 'IT Owner',
        'person_related': 'Personal Related' if platform == 'GCP' else 'Person-related'
    }

    for label, key in editable_fields.items():
        proposed_key = f"{key}_proposed"
        original_db_col = db_field_map[key]

        original_value = (original_dict.get(original_db_col) or '').strip()
        proposed_value = (proposed_dict.get(proposed_key) or '').strip() if proposed_dict.get(proposed_key) else ''

        # Save separately for editable field and readonly Current field
        sub[f'{label} (Current)'] = original_value
        sub[label] = proposed_value or original_value

    # ========== Manual proposed cost-center fields ==========
    cc_name_manual = (proposed_dict.get('cost_center_name_manual') or '').strip()
    cc_responsible_manual = (proposed_dict.get('cost_center_responsible_manual') or '').strip()
    cc_responsible_wom_manual = (proposed_dict.get('cost_center_responsible_wom_manual') or '').strip()

    # Right-hand (editable) fields prefer manual proposed values, otherwise original:
    sub['Cost Center Name'] = cc_name_manual or original_dict.get('Cost Center Name', '')
    sub['Cost Center Responsible'] = cc_responsible_manual or (original_dict.get('Cost Center Responsible') or '')
    sub['Cost Center Responsible WOM'] = cc_responsible_wom_manual or (original_dict.get('Cost Center Responsible WOM') or '')

    # Required for UI display (header)
    sub['Environment'] = sub.get('Type of Environment', 'N/A')

    return render_template('components/metadetails/metaDetails.html', subscription=sub)

@app.route('/get_it_owner_details', methods=['POST'])
def get_it_owner_details():
    data = request.json
    it_owner_email = data.get('it_owner_email')

    conn = get_sql_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT [IT Owner WOM]
        FROM it_owner_reference
        WHERE [IT Owner] = ?
    """, (it_owner_email,))

    row = cursor.fetchone()
    cursor.close()
    conn.close()

    it_owner_wom = row[0] if row else ''
    return jsonify({'it_owner_wom': it_owner_wom})

@app.route('/get_cost_center_details', methods=['POST'])
def get_cost_center_details():
    data = request.json
    cost_center_code = data.get('cost_center_code')
    
    if not cost_center_code:
        return jsonify({'error': 'No cost center provided'}), 400

    # Call Bosch API
    cc_data = fetch_cost_center_details(cost_center_code)
    if not cc_data:
        return jsonify({'error': 'Cost center not found'}), 404

    # Build response
    result = {
        'cost_center_name': f"{cc_data.get('Name4', '')} {cc_data.get('Name3', '')} ({cc_data.get('Department')})",
        'cost_center_responsible': cc_data.get('Responsible').lower() + "@bosch.com",
        'cost_center_responsible_wom': cc_data.get('ResponsibleOrgOffice')
    }
    return jsonify(result)

@app.route('/components/help')
def help_support():
    return render_template('components/helpSupport.html')

@app.route('/admin')
def admin_page():
    return render_template('Admin/admin.html')

@app.route('/review')
def review_page():
    # Get all possible emails from Entra ID (lowercased list)
    _, user_emails = get_logged_in_user()

    if not user_emails:
        return render_template('Admin/reviewApproval.html', user_email=None, approvals=[])

    conn = get_sql_connection()
    cursor = conn.cursor()

    # Build dynamic placeholders (?, ?, ? ...)
    placeholders = ','.join('?' for _ in user_emails)
    query = f"""
        SELECT * 
        FROM cost_center_approvals
        WHERE LOWER(new_cost_center_responsible) IN ({placeholders})
        ORDER BY last_review_date DESC
    """
    cursor.execute(query, tuple(user_emails))
    rows = cursor.fetchall()

    approvals = []
    columns = [col[0] for col in cursor.description]
    for row in rows:
        row_dict = dict(zip(columns, row))
        approvals.append({
            'Platform': row_dict.get('platform', ''),
            'ID': row_dict.get('subscription_id', ''),
            'Name': row_dict.get('name', ''),
            'Management Group (OE)': row_dict.get('management_group', ''),
            'Old Cost Center': row_dict.get('old_cost_center', ''),
            'Old Cost Center Responsible': row_dict.get('old_cost_center_responsible', ''),
            'New Cost Center': row_dict.get('new_cost_center', ''),
            'New Cost Center Responsible': row_dict.get('new_cost_center_responsible', ''),
            'IT Owner': row_dict.get('it_owner', ''),
            'Last review date': row_dict.get('last_review_date', ''),
            'Status': row_dict.get('status', '')
        })

    conn.close()

    return render_template(
        'Admin/reviewApproval.html',
        user_email=', '.join(user_emails),  # show all possible emails for clarity
        approvals=approvals
    )

@app.route('/notification')
def trigger_notification():
    return render_template('Admin/notification.html')

@app.route('/save_proposed_changes', methods=['POST'])
def save_proposed_changes():
    data = request.get_json()

    if not data or 'subscription_id' not in data or 'platform' not in data:
        return jsonify({"error": "Missing required fields"}), 400

    sub_id = data['subscription_id']
    platform = data['platform']

    # Map platform to ID column & table
    id_column_map = {'Azure': 'Subscription ID', 'AWS': 'Account ID', 'GCP': 'Project ID'}
    table_map = {'Azure': 'azure_assets', 'AWS': 'aws_assets', 'GCP': 'gcp_assets'}

    column_name = id_column_map.get(platform)
    table_name = table_map.get(platform)
    if not column_name:
        return jsonify({"error": "Invalid platform"}), 400

    conn = get_sql_connection()
    cursor = conn.cursor()

    # Fetch original subscription
    cursor.execute(f"SELECT * FROM {table_name} WHERE [{column_name}] = ?", (sub_id,))
    original_row = cursor.fetchone()
    original_dict = row_to_dict(cursor, original_row)

    if not original_dict:
        conn.close()
        return jsonify({"error": "Subscription not found"}), 404

    # Field mapping
    field_mapping = {
        'I-SC': 'I-SC',
        'A-SC': 'A-SC',
        'C-SC': 'C-SC',
        'Organizational Unit': 'Management Group (OE)',
        'Type of Environment': {
            'Azure': 'Type of Subscription',
            'AWS': 'Type of Account',
            'GCP': 'Type of Project'
        }.get(platform, ''),
        'Cost Center': 'Cost Center',
        'IT Owner': 'IT Owner',
        'Person-related': 'Person-related' if platform != 'GCP' else 'Personal Related'
    }

    proposed = {'sub_id': sub_id, 'platform': platform}

    for label, db_field in field_mapping.items():
        if not db_field:
            continue

        matched_key = next((k for k in original_dict if k.strip().lower() == db_field.strip().lower()), None)
        original_value = (original_dict.get(matched_key) or '').strip() if matched_key else ''
        new_value = (data.get(label) or '').strip()
        if new_value in ['"', "'"]:
            new_value = ''

        # Fix SC suffix issue
        if platform in ['Azure', 'GCP'] and label in ['I-SC', 'A-SC', 'C-SC'] and new_value:
            if new_value.startswith("SC"):
                suffix = new_value[2:]
                new_value = f"{label}{suffix}"

        proposed[f'{label}_original'] = original_value
        proposed[f'{label}_proposed'] = new_value

    # Manual fields
    proposed['cost_center_name_manual'] = (data.get('cc_name') or '').strip()
    proposed['cost_center_responsible_manual'] = (data.get('cc_responsible') or '').strip()
    proposed['cost_center_responsible_wom_manual'] = (data.get('cc_responsible_wom') or '').strip()

    # ====================== UPSERT LOGIC FOR SQL SERVER ======================
    # SQL Server uses MERGE for upsert
    merge_query = f"""
        MERGE proposed_changes AS target
        USING (SELECT ? AS sub_id, ? AS platform) AS source
        ON target.sub_id = source.sub_id AND target.platform = source.platform
        WHEN MATCHED THEN 
            UPDATE SET 
                i_sc_original = ?, i_sc_proposed = ?,
                a_sc_original = ?, a_sc_proposed = ?,
                c_sc_original = ?, c_sc_proposed = ?,
                organizational_unit_original = ?, organizational_unit_proposed = ?,
                environment_original = ?, environment_proposed = ?,
                cost_center_original = ?, cost_center_proposed = ?,
                it_owner_original = ?, it_owner_proposed = ?,
                person_related_original = ?, person_related_proposed = ?,
                cost_center_name_manual = ?, 
                cost_center_responsible_manual = ?, 
                cost_center_responsible_wom_manual = ?
        WHEN NOT MATCHED THEN
            INSERT (sub_id, platform,
                    i_sc_original, i_sc_proposed,
                    a_sc_original, a_sc_proposed,
                    c_sc_original, c_sc_proposed,
                    organizational_unit_original, organizational_unit_proposed,
                    environment_original, environment_proposed,
                    cost_center_original, cost_center_proposed,
                    it_owner_original, it_owner_proposed,
                    person_related_original, person_related_proposed,
                    cost_center_name_manual,
                    cost_center_responsible_manual,
                    cost_center_responsible_wom_manual)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """

    params = [
        proposed['sub_id'], proposed['platform'],
        proposed.get('I-SC_original'), proposed.get('I-SC_proposed'),
        proposed.get('A-SC_original'), proposed.get('A-SC_proposed'),
        proposed.get('C-SC_original'), proposed.get('C-SC_proposed'),
        proposed.get('Organizational Unit_original'), proposed.get('Organizational Unit_proposed'),
        proposed.get('Type of Environment_original'), proposed.get('Type of Environment_proposed'),
        proposed.get('Cost Center_original'), proposed.get('Cost Center_proposed'),
        proposed.get('IT Owner_original'), proposed.get('IT Owner_proposed'),
        proposed.get('Person-related_original'), proposed.get('Person-related_proposed'),
        proposed['cost_center_name_manual'], proposed['cost_center_responsible_manual'], proposed['cost_center_responsible_wom_manual'],
        # For INSERT
        proposed['sub_id'], proposed['platform'],
        proposed.get('I-SC_original'), proposed.get('I-SC_proposed'),
        proposed.get('A-SC_original'), proposed.get('A-SC_proposed'),
        proposed.get('C-SC_original'), proposed.get('C-SC_proposed'),
        proposed.get('Organizational Unit_original'), proposed.get('Organizational Unit_proposed'),
        proposed.get('Type of Environment_original'), proposed.get('Type of Environment_proposed'),
        proposed.get('Cost Center_original'), proposed.get('Cost Center_proposed'),
        proposed.get('IT Owner_original'), proposed.get('IT Owner_proposed'),
        proposed.get('Person-related_original'), proposed.get('Person-related_proposed'),
        proposed['cost_center_name_manual'], proposed['cost_center_responsible_manual'], proposed['cost_center_responsible_wom_manual']
    ]

    cursor.execute(merge_query, params)
    conn.commit()
    conn.close()

    return jsonify({"message": "Changes saved successfully"}), 200

@app.route('/submit_proposed_changes', methods=['POST'])
def submit_proposed_changes():
    data = request.get_json()
    sub_id = data.get('subscription_id')
    platform = data.get('platform')

    if not sub_id or not platform:
        return jsonify({'error': 'Missing subscription ID or platform'}), 400

    table_map = {
        'Azure': ('azure_assets', 'Subscription ID'),
        'AWS': ('aws_assets', 'Account ID'),
        'GCP': ('gcp_assets', 'Project ID')
    }
    if platform not in table_map:
        return jsonify({'error': 'Invalid platform'}), 400

    table_name, id_column = table_map[platform]

    conn = None
    try:
        # 1. Establish Azure SQL Connection using your utility
        conn = get_sql_connection()
        cursor = conn.cursor()

        # Fetch original row
        # NOTE: Using square brackets [] for column names is required for columns with spaces
        cursor.execute(f"SELECT * FROM {table_name} WHERE [{id_column}] = ?", (sub_id,))
        original_pyodbc_row = cursor.fetchone()

        if not original_pyodbc_row:
            return jsonify({'error': 'Subscription not found'}), 404

        # Convert the pyodbc row to a dictionary using your utility function: row_to_dict(cursor, row)
        original = row_to_dict(cursor, original_pyodbc_row)

        old_it_owner = (original.get('IT Owner') or '').strip()

        # Load any proposed row (saved earlier via /save_proposed_changes)
        cursor.execute("SELECT * FROM proposed_changes WHERE sub_id = ? AND platform = ?", (sub_id, platform))
        proposed_pyodbc_row = cursor.fetchone()

        # Convert the proposed row to a dictionary
        proposed_row = row_to_dict(cursor, proposed_pyodbc_row)

        update_values = {}
        source = 'proposed_changes' if proposed_row else 'request_data'

        # Map of proposed_changes -> platform table columns
        mapping = {
            'i_sc_proposed': 'I-SC',
            'a_sc_proposed': 'A-SC',
            'c_sc_proposed': 'C-SC',
            'organizational_unit_proposed': 'Management Group (OE)',
            'environment_proposed': {
                'Azure': 'Type of Subscription',
                'AWS': 'Type of Account',
                'GCP': 'Type of Project'
            }[platform],
            'person_related_proposed': 'Personal Related' if platform == 'GCP' else 'Person-related',
            'it_owner_proposed': 'IT Owner'
        }

        it_owner_updated = False
        cost_center_changed = False
        new_it_owner = None
        new_cost_center = None
        new_cost_center_responsible = None
        new_cost_center_responsible_wom = None
        new_cost_center_name = None

        # Collect updated values from proposed_changes
        if proposed_row:
            proposed = proposed_row
            for key, db_col in mapping.items():
                val = (proposed.get(key) or '').strip()
                if val and val not in ['"', "'"]:
                    # Normalize SC labels for Azure/GCP
                    if platform in ['Azure', 'GCP']:
                        if key.startswith('i_sc') and not val.startswith('I-'):
                            val = f"I-{val}"
                        elif key.startswith('a_sc') and not val.startswith('A-'):
                            val = f"A-{val}"
                        elif key.startswith('c_sc') and not val.startswith('C-'):
                            val = f"C-{val}"
                    update_values[db_col] = val
                    if db_col == 'IT Owner' and val != old_it_owner:
                        it_owner_updated = True
                        new_it_owner = val

            # Cost Center change → fetch details via API (fetch_cost_center_details is external)
            cost_center_new = (proposed.get('cost_center_proposed') or '').strip()

            if cost_center_new and cost_center_new not in ['"', "'"] and cost_center_new != (original.get('Cost Center') or '').strip():
                cost_center_changed = True
                new_cost_center = cost_center_new

            cc_data = fetch_cost_center_details(cost_center_new)
            if cc_data:
                if cc_data.get("Responsible"):
                    new_cost_center_responsible = f"{cc_data['Responsible'].lower()}@bosch.com"
                new_cost_center_responsible_wom = cc_data.get("cost_center_responsible_wom")
                # Build Cost Center Name from API parts
                name4 = cc_data.get("Name4", "").strip()
                name3 = cc_data.get("Name3", "").strip()
                department = cc_data.get("Department", "").strip()
                new_cost_center_name = f"{name4} {name3}".strip()
                if department:
                    new_cost_center_name = f"{new_cost_center_name} ({department})"
                update_values['Cost Center'] = cost_center_new
                update_values['Cost Center Responsible'] = new_cost_center_responsible
                update_values['Cost Center Responsible WOM'] = new_cost_center_responsible_wom
                update_values['Cost Center Name'] = new_cost_center_name
            else:
                # Fallback to manual fields if available
                manual_responsible = (proposed.get('cost_center_responsible_manual') or '').strip()
                manual_wom = (proposed.get('cost_center_responsible_wom_manual') or '').strip()
                manual_name = (proposed.get('cost_center_name_manual') or '').strip()

                if manual_responsible and manual_wom:
                    new_cost_center_responsible = manual_responsible
                    new_cost_center_responsible_wom = manual_wom
                    new_cost_center_name = manual_name

                    update_values['Cost Center'] = cost_center_new
                    update_values['Cost Center Responsible'] = new_cost_center_responsible
                    update_values['Cost Center Responsible WOM'] = new_cost_center_responsible_wom
                    update_values['Cost Center Name'] = new_cost_center_name

        # If IT Owner changed, try to enrich WOM
        if it_owner_updated and new_it_owner:
            cursor.execute("""
                SELECT [IT Owner WOM]
                FROM it_owner_reference
                WHERE [IT Owner] = ?
            """, (new_it_owner,))
            result = cursor.fetchone() # result is a tuple (value,)
            if result:
                update_values['IT Owner WOM'] = result[0]

        # Remove cost center fields from update_values (approval gate)
        for k in ['Cost Center', 'Cost Center Responsible', 'Cost Center Responsible WOM', 'Cost Center Name']:
            update_values.pop(k, None)

        # Update other editable fields directly on the main table
        if update_values:
            # Build SET clause with parameterized column names (using [])
            set_clause = ", ".join([f"[{col}] = ?" for col in update_values])
            values = list(update_values.values()) + [sub_id]
            cursor.execute(f"""
                UPDATE {table_name}
                SET {set_clause}
                WHERE [{id_column}] = ?
            """, values)

        # Always update Last Review Date
        today_str = datetime.today().strftime('%Y-%m-%d')
        cursor.execute(f"UPDATE {table_name} SET [Last Review Date] = ? WHERE [{id_column}] = ?", (today_str, sub_id))

        # Snapshot for email/details (reflects updated non-gated fields)
        snapshot = original.copy()
        snapshot.update(update_values)

        # Upsert into cost_center_approvals when CC changed
        if cost_center_changed and new_cost_center and new_cost_center_responsible:
            # Check for existing pending record
            cursor.execute("""
                SELECT id FROM cost_center_approvals
                WHERE subscription_id = ? AND status = 'Pending'
            """, (sub_id,))
            existing_pyodbc_row = cursor.fetchone()
            existing_id = existing_pyodbc_row[0] if existing_pyodbc_row else None

            # Normalize subscription/account/project name
            subscription_name_field = {
                'Azure': 'Subscription Name',
                'AWS': 'Account Name',
                'GCP': 'Project Name'
            }[platform]
            subscription_name = original.get(subscription_name_field, sub_id)

            if existing_id:
                # UPDATE logic
                cursor.execute("""
                    UPDATE cost_center_approvals
                    SET platform = ?, name = ?, management_group = ?,
                        old_cost_center = ?, old_cost_center_responsible = ?,
                        new_cost_center = ?, new_cost_center_responsible = ?, new_cost_center_name = ?,
                        it_owner = ?, last_review_date = ?
                    WHERE id = ?
                """, (
                    platform,
                    subscription_name,
                    snapshot.get('Management Group (OE)'),
                    original.get('Cost Center'),
                    original.get('Cost Center Responsible'),
                    new_cost_center,
                    new_cost_center_responsible,
                    new_cost_center_name,
                    snapshot.get('IT Owner'),
                    today_str,
                    existing_id
                ))
            else:
                # INSERT logic
                cursor.execute("""
                    INSERT INTO cost_center_approvals (
                        platform, subscription_id, name, management_group,
                        old_cost_center, old_cost_center_responsible,
                        new_cost_center, new_cost_center_responsible, new_cost_center_name,
                        it_owner, last_review_date, status
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    platform,
                    sub_id,
                    subscription_name,
                    snapshot.get('Management Group (OE)'),
                    original.get('Cost Center'),
                    original.get('Cost Center Responsible'),
                    new_cost_center,
                    new_cost_center_responsible,
                    new_cost_center_name,
                    snapshot.get('IT Owner'),
                    today_str,
                    'Pending'
                ))

        # Only clear proposed_changes if CC didn't change
        if not cost_center_changed:
            cursor.execute("DELETE FROM proposed_changes WHERE sub_id = ? AND platform = ?", (sub_id, platform))

        # Commit all changes to Azure SQL Server
        conn.commit()

        # Pull final row for email/snapshot
        cursor.execute(f"SELECT * FROM {table_name} WHERE [{id_column}] = ?", (sub_id,))
        final_pyodbc_row = cursor.fetchone()

        # Convert the final pyodbc row to a dictionary
        final_row = row_to_dict(cursor, final_pyodbc_row)

        # # --- Email drafts (using win32com and pythoncom) ---
        # # NOTE: This section remains unchanged as it doesn't involve the database.

        # # IT Owner change draft
        # if it_owner_updated and new_it_owner:
        #     pythoncom.CoInitialize()
        #     try:
        #         subscription_name_field = {
        #             'Azure': 'Subscription Name',
        #             'AWS': 'Account Name',
        #             'GCP': 'Project Name'
        #         }[platform]
        #         name_value = original.get(subscription_name_field, sub_id)
        #         cost_center_resp_email = original.get('Cost Center Responsible', '')

        #         details_html = "<table border='1' style='border-collapse: collapse;'>"
        #         for k, v in final_row.items():
        #             if isinstance(v, float) and v.is_integer():
        #                 v = int(v)
        #             details_html += f"<tr><td><b>{k}</b></td><td>{v}</td></tr>"
        #         details_html += "</table>"

        #         outlook = win32.Dispatch('Outlook.Application')
        #         mail = outlook.CreateItem(0)

        #         for account in outlook.Session.Accounts:
        #             if account.SmtpAddress.lower() == "shashank.joshi@in.bosch.com":
        #                 mail.SendUsingAccount = account
        #                 break

        #         mail.To = new_it_owner
        #         mail.CC = ";".join(filter(None, [old_it_owner, cost_center_resp_email]))
        #         mail.Subject = f"You have been assigned as IT Owner for {name_value}"
        #         mail.HTMLBody = f"""
        #             <p>Hello,</p>
        #             <p>You have been designated as the new IT Owner for the following subscription:</p>
        #             {details_html}
        #             <p>Please take note of your responsibilities.</p>
        #             <p>Regards,<br>SSP Portal</p>``
        #         """
        #         mail.Save()  # draft
        #     finally:
        #         pythoncom.CoUninitialize()

        # # Cost Center approval draft
        # if cost_center_changed and new_cost_center_responsible:
        #     pythoncom.CoInitialize()
        #     try:
        #         subscription_name_field = {
        #             'Azure': 'Subscription Name',
        #             'AWS': 'Account Name',
        #             'GCP': 'Project Name'
        #         }[platform]
        #         name_value = final_row.get(subscription_name_field, sub_id)

        #         details_html = "<table border='1' style='border-collapse: collapse;'>"
        #         for k, v in final_row.items():
        #             if isinstance(v, float) and v.is_integer():
        #                 v = int(v)
        #             details_html += f"<tr><td><b>{k}</b></td><td>{v}</td></tr>"
        #         details_html += f"<tr><td><b>New Cost Center</b></td><td>{new_cost_center}</td></tr>"
        #         details_html += f"<tr><td><b>New Cost Center Name</b></td><td>{new_cost_center_name or '—'}</td></tr>"
        #         details_html += f"<tr><td><b>New Cost Center Responsible</b></td><td>{new_cost_center_responsible}</td></tr>"
        #         details_html += "</table>"

        #         outlook = win32.Dispatch('Outlook.Application')
        #         mail = outlook.CreateItem(0)

        #         for account in outlook.Session.Accounts:
        #             if account.SmtpAddress.lower() == "shashank.joshi@in.bosch.com":
        #                 mail.SendUsingAccount = account
        #                 break

        #         mail.To = new_cost_center_responsible
        #         mail.CC = ";".join(filter(None, [
        #             original.get('Cost Center Responsible', ''),
        #             original.get('IT Owner', '')
        #         ]))
        #         mail.Subject = f"Approval required: Cost Center change for {name_value}"
        #         mail.HTMLBody = f"""
        #             <p>Hello,</p>
        #             <p>You have been assigned to review a Cost Center change request for the following subscription:</p>
        #             {details_html}
        #             <p>Please go to the dashboard to approve or reject this request.</p>
        #             <p>Regards,<br>SSP Portal</p>
        #         """
        #         mail.Save()  # draft
        #     finally:
        #         pythoncom.CoUninitialize()

        return jsonify({'message': f"Submitted successfully using {source}"}), 200

    except pyodbc.Error as ex:
        # Log the error for debugging
        print(f"Azure SQL Error: {ex}")
        return jsonify({'error': f"Database error occurred: {ex}"}), 500

    finally:
        # Ensure the connection is always closed
        if conn:
            conn.close()
@app.route('/handle_approval', methods=['POST'])
def handle_approval():
    data = request.get_json()
    sub_id = data.get('subscription_id')
    platform = data.get('platform')
    action = data.get('action')  # 'approve' or 'reject'

    if not sub_id or not platform or action not in ['approve', 'reject']:
        return jsonify({'error': 'Invalid request'}), 400

    table_map = {
        'Azure': ('azure_assets', 'Subscription ID'),
        'AWS': ('aws_assets', 'Account ID'),
        'GCP': ('gcp_assets', 'Project ID')
    }

    if platform not in table_map:
        return jsonify({'error': 'Invalid platform'}), 400

    table_name, id_column = table_map[platform]

    conn = get_sql_connection()
    cursor = conn.cursor()

    # Fetch pending cost center approval
    cursor.execute("""
        SELECT new_cost_center, new_cost_center_responsible, new_cost_center_name
        FROM cost_center_approvals
        WHERE subscription_id = ? AND platform = ? AND status = 'Pending'
    """, (sub_id, platform))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({'error': 'No pending request found'}), 404

    new_cc, new_cc_responsible, new_cc_name = row

    # Fetch WOM from proposed_changes (already saved during submit/save)
    cursor.execute("""
        SELECT cost_center_responsible_wom_manual
        FROM proposed_changes
        WHERE sub_id = ? AND platform = ?
    """, (sub_id, platform))
    wom_row = cursor.fetchone()
    new_cc_wom = wom_row[0] if wom_row else None

    today_str = datetime.today().strftime('%Y-%m-%d')

    # If approved → update main table
    if action == 'approve':
        cursor.execute(f"""
            UPDATE {table_name}
            SET [Cost Center] = ?, 
                [Cost Center Responsible] = ?, 
                [Cost Center Responsible WOM] = ?,
                [Cost Center Name] = ?,  
                [Last Review Date] = ?
            WHERE [{id_column}] = ?
        """, (new_cc, new_cc_responsible, new_cc_wom, new_cc_name, today_str, sub_id))
    # Update approval status
    final_status = 'Approved' if action == 'approve' else 'Rejected'
    cursor.execute("""
        UPDATE cost_center_approvals
        SET status = ?, last_review_date = ?
        WHERE subscription_id = ? AND platform = ? AND status = 'Pending'
    """, (final_status, today_str, sub_id, platform))

    # Remove any saved proposed changes now that the approval decision is made
    cursor.execute("""
        DELETE FROM proposed_changes WHERE sub_id = ? AND platform = ?
    """, (sub_id, platform))

    conn.commit()
    conn.close()

    return jsonify({'message': f"Request {action}ed successfully."}), 200

if __name__ == '__main__':
    app.run(debug=True)
