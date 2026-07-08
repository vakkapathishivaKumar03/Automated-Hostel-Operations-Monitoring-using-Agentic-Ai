from app import app, generate_otp_code, hash_otp_code


def test_generate_otp_code_is_numeric_and_six_digits():
    otp = generate_otp_code()
    assert otp.isdigit()
    assert len(otp) == 6


def test_hash_otp_code_is_stable_and_not_plaintext():
    otp = "123456"
    otp_hash = hash_otp_code(otp)
    assert otp_hash != otp
    assert len(otp_hash) == 64
    assert otp_hash == hash_otp_code(otp)


def test_login_missing_credentials_uses_normalized_contract():
    client = app.test_client()
    response = client.post("/api/login", json={})
    assert response.status_code == 400

    payload = response.get_json()
    assert payload["success"] is False
    assert payload["error"]["code"] == "AUTH_MISSING_CREDENTIALS"
    assert payload["error"]["message"]
    assert payload["meta"]["request_id"]
    assert response.headers.get("X-Request-Id")
