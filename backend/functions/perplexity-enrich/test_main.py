"""Tests for Perplexity enrichment Cloud Function."""
import json
import pytest
import responses
from unittest.mock import patch, MagicMock
from main import (
    cors_headers,
    handle_cors,
    get_perplexity_api_key,
    call_perplexity_api,
    perplexity_enrich,
    PERPLEXITY_API_URL,
)


@pytest.fixture
def mock_request():
    """Create a mock Flask Request object."""
    request = MagicMock()
    request.headers = {}
    request.method = "POST"
    return request


class TestGetPerplexityApiKey:
    """Tests for get_perplexity_api_key function."""

    def test_get_api_key_success(self):
        """Returns key when env var set."""
        with patch.dict("os.environ", {"PERPLEXITY_API_KEY": "test-key-123"}):
            result = get_perplexity_api_key()
            assert result == "test-key-123"

    def test_get_api_key_missing(self):
        """Raises ValueError when missing."""
        with patch.dict("os.environ", {}, clear=True):
            with pytest.raises(ValueError, match="PERPLEXITY_API_KEY must be set"):
                get_perplexity_api_key()


class TestCorsHeaders:
    """Tests for cors_headers function."""

    def test_cors_headers_with_origin(self, mock_request):
        """Returns origin from request."""
        mock_request.headers = {"Origin": "https://example.com"}
        result = cors_headers(mock_request)
        assert result["Access-Control-Allow-Origin"] == "https://example.com"
        assert result["Access-Control-Allow-Methods"] == "GET, POST, OPTIONS"
        assert result["Access-Control-Allow-Headers"] == "Content-Type, Authorization"

    def test_cors_headers_default(self, mock_request):
        """Returns * when no origin."""
        mock_request.headers = {}
        result = cors_headers(mock_request)
        assert result["Access-Control-Allow-Origin"] == "*"


class TestHandleCors:
    """Tests for handle_cors function."""

    def test_handle_cors_options(self, mock_request):
        """Returns 204 for OPTIONS."""
        mock_request.method = "OPTIONS"
        mock_request.headers = {"Origin": "https://example.com"}
        result = handle_cors(mock_request)
        assert result is not None
        body, status, headers = result
        assert body == ""
        assert status == 204
        assert headers["Access-Control-Allow-Origin"] == "https://example.com"

    def test_handle_cors_post(self, mock_request):
        """Returns None for POST."""
        mock_request.method = "POST"
        result = handle_cors(mock_request)
        assert result is None


class TestCallPerplexityApi:
    """Tests for call_perplexity_api function."""

    @responses.activate
    def test_call_api_with_affiliation(self):
        """Includes affiliation in prompt."""
        responses.add(
            responses.POST,
            PERPLEXITY_API_URL,
            json={
                "choices": [{
                    "message": {
                        "content": json.dumps({
                            "email": "test@uni.edu",
                            "lab": "AI Lab",
                            "institution": "University",
                            "found": True
                        })
                    }
                }]
            },
            status=200,
        )

        with patch.dict("os.environ", {"PERPLEXITY_API_KEY": "test-key"}):
            result = call_perplexity_api("John Smith", affiliation="MIT")

        assert result["email"] == "test@uni.edu"
        assert result["lab"] == "AI Lab"
        assert result["institution"] == "University"
        assert result["found"] is True

        # Verify affiliation was included in the request
        request_body = json.loads(responses.calls[0].request.body)
        user_message = request_body["messages"][1]["content"]
        assert "MIT" in user_message
        assert "affiliated with" in user_message

    @responses.activate
    def test_call_api_without_affiliation(self):
        """Works without affiliation."""
        responses.add(
            responses.POST,
            PERPLEXITY_API_URL,
            json={
                "choices": [{
                    "message": {
                        "content": json.dumps({
                            "email": "researcher@stanford.edu",
                            "lab": "ML Lab",
                            "institution": "Stanford University",
                            "found": True
                        })
                    }
                }]
            },
            status=200,
        )

        with patch.dict("os.environ", {"PERPLEXITY_API_KEY": "test-key"}):
            result = call_perplexity_api("Jane Doe")

        assert result["email"] == "researcher@stanford.edu"
        assert result["found"] is True

        # Verify affiliation was NOT in the request
        request_body = json.loads(responses.calls[0].request.body)
        user_message = request_body["messages"][1]["content"]
        assert "affiliated with" not in user_message

    @responses.activate
    def test_call_api_error_response(self):
        """Raises on non-200."""
        responses.add(
            responses.POST,
            PERPLEXITY_API_URL,
            json={"error": "Rate limit exceeded"},
            status=429,
        )

        with patch.dict("os.environ", {"PERPLEXITY_API_KEY": "test-key"}):
            with pytest.raises(Exception, match="Perplexity API error: 429"):
                call_perplexity_api("John Smith")

    @responses.activate
    def test_call_api_malformed_json(self):
        """Raises on bad JSON."""
        responses.add(
            responses.POST,
            PERPLEXITY_API_URL,
            json={
                "choices": [{
                    "message": {
                        "content": "not valid json {"
                    }
                }]
            },
            status=200,
        )

        with patch.dict("os.environ", {"PERPLEXITY_API_KEY": "test-key"}):
            with pytest.raises(json.JSONDecodeError):
                call_perplexity_api("John Smith")


class TestPerplexityEnrich:
    """Tests for perplexity_enrich function."""

    def test_enrich_missing_body(self, mock_request):
        """Returns 400 when request body is missing."""
        mock_request.get_json.return_value = None
        mock_request.headers = {}

        body, status, headers = perplexity_enrich(mock_request)

        assert status == 400
        response_data = json.loads(body)
        assert response_data["error"] == "Request body required"

    def test_enrich_missing_name(self, mock_request):
        """Returns 400 when name is missing."""
        mock_request.get_json.return_value = {"affiliation": "MIT"}
        mock_request.headers = {}

        body, status, headers = perplexity_enrich(mock_request)

        assert status == 400
        response_data = json.loads(body)
        assert response_data["error"] == "Researcher name required"

    @responses.activate
    def test_enrich_success(self, mock_request):
        """Returns 200 with data on success."""
        responses.add(
            responses.POST,
            PERPLEXITY_API_URL,
            json={
                "choices": [{
                    "message": {
                        "content": json.dumps({
                            "email": "jsmith@mit.edu",
                            "lab": "AI Research Lab",
                            "institution": "Massachusetts Institute of Technology",
                            "found": True
                        })
                    }
                }]
            },
            status=200,
        )

        mock_request.get_json.return_value = {"name": "John Smith", "affiliation": "MIT"}
        mock_request.headers = {"Origin": "https://example.com"}

        with patch.dict("os.environ", {"PERPLEXITY_API_KEY": "test-key"}):
            body, status, headers = perplexity_enrich(mock_request)

        assert status == 200
        response_data = json.loads(body)
        assert response_data["success"] is True
        assert response_data["email"] == "jsmith@mit.edu"
        assert response_data["lab"] == "AI Research Lab"
        assert response_data["institution"] == "Massachusetts Institute of Technology"
        assert response_data["found"] is True
        assert headers["Access-Control-Allow-Origin"] == "https://example.com"

    @responses.activate
    def test_enrich_api_failure(self, mock_request):
        """Returns 500 on API failure."""
        responses.add(
            responses.POST,
            PERPLEXITY_API_URL,
            json={"error": "Internal server error"},
            status=500,
        )

        mock_request.get_json.return_value = {"name": "John Smith"}
        mock_request.headers = {}

        with patch.dict("os.environ", {"PERPLEXITY_API_KEY": "test-key"}):
            body, status, headers = perplexity_enrich(mock_request)

        assert status == 500
        response_data = json.loads(body)
        assert response_data["success"] is False
        assert "error" in response_data

    def test_enrich_cors_preflight(self, mock_request):
        """Returns 204 for OPTIONS request."""
        mock_request.method = "OPTIONS"
        mock_request.headers = {"Origin": "https://example.com"}

        body, status, headers = perplexity_enrich(mock_request)

        assert status == 204
        assert body == ""
        assert headers["Access-Control-Allow-Origin"] == "https://example.com"
