"""
test_llm_client.py — Unit tests for OllamaLLMClient.
"""
from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

import httpx
from backend.services.llm_client import OllamaLLMClient


class TestOllamaLLMClient(unittest.TestCase):

    @patch("httpx.post")
    def test_complete_success(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"response": "Patient has elevated ALT."}
        mock_post.return_value = mock_resp

        client = OllamaLLMClient(base_url="http://localhost:11434", model="biomistral")
        result = client.complete("Summarize lab", "ALT 120 U/L")

        self.assertEqual(result, "Patient has elevated ALT.")
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(kwargs["json"]["model"], "biomistral")

    @patch("httpx.post")
    def test_complete_primary_fails_fallback_succeeds(self, mock_post):
        mock_resp_fail = MagicMock()
        mock_resp_fail.status_code = 500
        mock_resp_fail.text = "Internal error"

        mock_resp_ok = MagicMock()
        mock_resp_ok.status_code = 200
        mock_resp_ok.json.return_value = {"response": "Fallback summary."}

        mock_post.side_effect = [mock_resp_fail, mock_resp_ok]

        client = OllamaLLMClient(base_url="http://localhost:11434", model="biomistral", fallback_model="llama3.2:3b")
        result = client.complete("Summarize lab", "AST 90 U/L")

        self.assertEqual(result, "Fallback summary.")
        self.assertEqual(mock_post.call_count, 2)

    @patch("httpx.post")
    def test_complete_connect_error_raises_runtime_error(self, mock_post):
        mock_post.side_effect = httpx.ConnectError("Connection refused")

        client = OllamaLLMClient(base_url="http://localhost:11434", model="biomistral", fallback_model="")
        with self.assertRaises(RuntimeError):
            client.complete("Summarize lab", "ALT 120 U/L")


if __name__ == "__main__":
    unittest.main()
