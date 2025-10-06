import os
import requests
import xml.etree.ElementTree as ET
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Load environment variables from .env file (optional in local dev)
from dotenv import load_dotenv
load_dotenv()

# --------------------------
# Configuration
# --------------------------
API_KEY = os.getenv("API_KEY")

# Pick up proxy from environment variables (works in Azure Web App)
PROXY_URL_HTTP = os.getenv("HTTP_PROXY")  # e.g., "http://10.4.103.69:8080"
PROXY_URL_HTTPS = os.getenv("HTTPS_PROXY")
proxies = {
    "http": PROXY_URL_HTTP,
    "https": PROXY_URL_HTTPS
} if PROXY_URL_HTTP and PROXY_URL_HTTPS else None


# --------------------------
# Fetch Cost Center Details
# --------------------------
def fetch_cost_center_details(user_input):
    """
    Given a user input string for Cost Center, normalize it by padding zeros
    and fetch the full 10-digit cost center info from Bosch internal API.
    Returns a dictionary with Responsible info if found, else None.
    """
    normalized_input = user_input.upper()

    while len(normalized_input) <= 10:
        url = (
            "https://ews-esz-emea.api.bosch.com/information-and-data/master/controlling/"
            f"costcenter/v2/CostCenterEntitySet?$filter=CostCenter eq '{normalized_input}'"
        )

        headers = {
            "KeyId": API_KEY,
            "Accept": "application/atom+xml"
        }

        try:
            response = requests.get(
                url,
                headers=headers,
                verify=False,   # Bosch internal API over HTTPS
                proxies=proxies  # Use proxy if set
            )
            response.raise_for_status()
        except requests.RequestException as e:
            print(f"❌ API error for {normalized_input}: {e}")
            return None

        # Namespaces for XML parsing
        ns = {
            "atom": "http://www.w3.org/2005/Atom",
            "d": "http://schemas.microsoft.com/ado/2007/08/dataservices",
            "m": "http://schemas.microsoft.com/ado/2007/08/dataservices/metadata"
        }

        root = ET.fromstring(response.text)
        required_fields = ["CostCenter", "Name3", "Name4", "Responsible", "Department", "ResponsibleOrgOffice"]

        result = []
        for entry in root.findall("atom:entry", ns):
            props = entry.find("atom:content/m:properties", ns)
            if props is not None:
                record = {child.tag.split("}")[-1]: child.text for child in props if child.tag.split("}")[-1] in required_fields}
                result.append(record)

        if result:
            return result[0]  # Found valid cost center

        # Pad with leading zero and retry
        normalized_input = '0' + normalized_input

    # No valid cost center found
    return None


# --------------------------
# Optional Test Run
# --------------------------
# if __name__ == "__main__":
#     user_input = "65f650"
#     data = fetch_cost_center_details(user_input)
#     if data:
#         print(f"✅ Valid Cost Center found: {data['CostCenter']}")
#         print(f"Responsible: {data['Name4']} {data['Name3']} ({data['Department']}) ({data['Responsible']}) WOM: {data['ResponsibleOrgOffice']}")
#     else:
#         print("❌ No valid cost center found.")
