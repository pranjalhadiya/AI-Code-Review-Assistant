import os
from unittest.mock import patch, MagicMock  # patch: temporarily replaces things. MagicMock: a flexible stand-in object.

from google.genai import errors
from app.config import settings
from app.services.ai_service import run_ai_review, AIServiceError

with open("test_tiny.py", "w") as f:  # A tiny throwaway file for the service to "review".
    f.write("print('hi')\n")

GOOD = MagicMock(text='{"quality_score": 80, "summary": "ok", "findings": []}')  # A valid fake AI answer.


def make_error(code):
    # Builds an SDK-style API error with the given HTTP status code.
    cls = errors.ServerError if code >= 500 else errors.ClientError
    return cls(code, {"error": {"message": "test"}}, None)


def run_case(label, outcomes, primary="model-a", fallback="model-b"):
    # 'outcomes' is what successive Gemini calls do: an Exception instance is RAISED, anything else is RETURNED.
    with patch.object(settings, "GEMINI_API_KEY", "fake-key"), \
         patch.object(settings, "GEMINI_MODEL", primary), \
         patch.object(settings, "GEMINI_FALLBACK_MODEL", fallback), \
         patch("app.services.ai_service.genai.Client") as FakeClient:
        fake_generate = FakeClient.return_value.models.generate_content
        fake_generate.side_effect = outcomes
        try:
            result = run_ai_review("test_tiny.py")
            outcome = f"OK (score {result.quality_score})"
        except AIServiceError as e:
            outcome = f"AIServiceError: {e}"
        models = [c.kwargs["model"] for c in fake_generate.call_args_list]  # Which models were actually called, in order.
        print(f"{label}\n    models tried: {models}\n    result: {outcome}")


run_case("1. Main model OK", [GOOD])
run_case("2. Main 503, fallback OK", [make_error(503), GOOD])
run_case("3. Main 429, fallback OK", [make_error(429), GOOD])
run_case("4. Both 503", [make_error(503), make_error(503)])
run_case("5. Main 400 (no fallback)", [make_error(400)])
run_case("6. Main 404 (no fallback)", [make_error(404)])
run_case("7. Fallback not configured", [make_error(503)], fallback="")
run_case("8. Fallback same as main", [make_error(503)], fallback="model-a")
run_case("9. Fallback returns bad JSON", [make_error(503), MagicMock(text="nope")])
run_case("10. Fallback rejects request (400)", [make_error(503), make_error(400)])

os.remove("test_tiny.py")  # Clean up the throwaway file.