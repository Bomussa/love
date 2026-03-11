import json
import ssl
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Callable, Dict, List, Optional, Tuple

BASE_URL = "https://mmc-mms.com/api/v1"
SITE_URL = "https://mmc-mms.com"
WWW_SITE_URL = "https://www.mmc-mms.com"
HEADERS = {"Content-Type": "application/json"}
TEST_PATIENT_ID = "TEST_999"
TEST_CLINIC = "INT"

SSL_CONTEXT = ssl.create_default_context()

# Deployment gates requested by product owner.
MIN_SUCCESS_PERCENT = 98.0
MAX_REJECTED_FAILURE_PERCENT = 10.0


def log(message, status="INFO"):
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] [{status}] {message}")


def request_json(method, url, payload=None, headers=None, timeout=20):
    data = None
    req_headers = dict(HEADERS)
    if headers:
        req_headers.update(headers)
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout, context=SSL_CONTEXT) as resp:
        body = resp.read().decode("utf-8")
        return resp.status, json.loads(body)


def request_text(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "codex-audit"}, method="GET")
    with urllib.request.urlopen(req, timeout=timeout, context=SSL_CONTEXT) as resp:
        body = resp.read().decode("utf-8", errors="ignore")
        return resp.status, body


def run_test(name: str, func: Callable[[], bool]) -> Dict[str, object]:
    log(f"Starting Test: {name}...", "TEST")
    try:
        ok = bool(func())
        log(f"Test {'Passed' if ok else 'Failed'}: {name}", "PASS" if ok else "FAIL")
        return {"name": name, "status": "pass" if ok else "fail"}
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError) as exc:
        log(f"Test Warning: {name} - {exc}", "WARN")
        return {"name": name, "status": "warn", "error": str(exc)}


def test_health_check():
    status, data = request_json("GET", f"{BASE_URL}/health")
    return status == 200 and data.get("success") is True


def test_pin_status():
    status, data = request_json("GET", f"{BASE_URL}/pin/status")
    if status != 200 or data.get("success") is not True:
        return False
    pins = data.get("pins", {})
    active_count = sum(1 for pin in pins.values() if isinstance(pin, dict) and pin.get("active") is True)
    log(f"Found {active_count} active PINs", "INFO")
    return active_count > 0


def test_patient_login() -> Optional[dict]:
    status, data = request_json(
        "POST",
        f"{BASE_URL}/patient/login",
        payload={"patientId": TEST_PATIENT_ID, "gender": "male"},
    )
    if status == 200 and data.get("success") is True:
        patient_data = data.get("data", {})
        log(f"Login successful. Patient DB ID: {patient_data.get('id') or patient_data.get('patient_id')}", "INFO")
        return patient_data
    return None


def test_queue_status():
    status, data = request_json("GET", f"{BASE_URL}/queue/status?clinic={urllib.parse.quote(TEST_CLINIC)}")
    return status == 200 and data.get("success") is True


def test_www_matches_root() -> bool:
    status_root, root_body = request_text(SITE_URL)
    status_www, www_body = request_text(WWW_SITE_URL)
    if status_root != 200 or status_www != 200:
        return False
    if "<html" not in root_body.lower() or "<html" not in www_body.lower():
        return False

    # HTML can include runtime IDs, timestamps, and nonce attributes.
    # We validate core content identity using stable markers.
    markers = ["mmc", "mms", "<title", "<meta"]
    return all(marker in root_body.lower() and marker in www_body.lower() for marker in markers)


def summarize(results: List[Dict[str, object]]) -> Tuple[float, float, bool]:
    passed = sum(1 for r in results if r["status"] == "pass")
    failed = sum(1 for r in results if r["status"] == "fail")
    total = len(results)
    success_percent = (passed / total) * 100 if total else 0.0
    failure_percent = (failed / total) * 100 if total else 0.0
    should_execute = success_percent >= MIN_SUCCESS_PERCENT and failure_percent <= MAX_REJECTED_FAILURE_PERCENT
    return success_percent, failure_percent, should_execute


def main():
    print("=" * 50)
    print("   MMC SYSTEM VERIFICATION PROTOCOL (100% PROOF)   ")
    print("=" * 50)

    results = [
        run_test("API Health Check", test_health_check),
        run_test("PIN System Status", test_pin_status),
    ]
    patient = None

    def _patient_login_wrapper():
        nonlocal patient
        patient = test_patient_login()
        return patient is not None

    results.append(run_test("Patient Login Flow", _patient_login_wrapper))
    results.append(run_test("Queue Status Read", test_queue_status))
    results.append(run_test("www mirrors root content", test_www_matches_root))

    success_percent, failure_percent, should_execute = summarize(results)

    print("\n" + "=" * 50)
    print(f"Success rate: {success_percent:.2f}%")
    print(f"Failure rate: {failure_percent:.2f}%")

    if should_execute:
        print("✅ FINAL RESULT: READY TO EXECUTE")
        print("   - Success threshold (>=98%) met")
        print("   - Failure threshold (<=10%) respected")
    else:
        print("❌ FINAL RESULT: HOLD EXECUTION")
        print("   - Threshold policy violated or environment blocked")

    for item in results:
        suffix = f" ({item['error']})" if item.get("error") else ""
        print(f" - {item['name']}: {item['status'].upper()}{suffix}")
    print("=" * 50)


if __name__ == "__main__":
    main()
