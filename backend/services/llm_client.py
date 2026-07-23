"""
llm_client.py — Ollama LLM Client for MedVault agentic pipeline.

Satisfies the ``llm_client.complete(prompt, input) -> str`` contract expected by
DiagnosisAgent and SummaryAgent.
"""
from __future__ import annotations

import httpx
from loguru import logger


class OllamaLLMClient:
    """
    Thin wrapper over Ollama REST API exposing complete(prompt, input) -> str.
    Includes fallback model support and timeout handling.
    """

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "biomistral",
        fallback_model: str = "llama3.2:3b",
        timeout: int = 120,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.fallback_model = fallback_model
        self.timeout = timeout

    def complete(self, prompt: str, input_text: str = "", input: str = "", **kwargs) -> str:
        """Combine prompt and input_text and send to Ollama /api/generate."""
        inp = input_text or input or ""
        full_prompt = f"{prompt}\n\nINPUT DATA:\n{inp}" if inp else prompt
        return self._call(self.model, full_prompt)


    def _call(self, model_name: str, prompt: str) -> str:
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": model_name,
            "prompt": prompt,
            "stream": False,
            "keep_alive": 0,
        }
        try:
            logger.info(f"[OllamaLLMClient] Requesting completion from model '{model_name}'...")
            resp = httpx.post(url, json=payload, timeout=self.timeout)
            if resp.status_code != 200:
                logger.warning(f"[OllamaLLMClient] Model '{model_name}' returned status {resp.status_code}: {resp.text[:200]}")
                if self.fallback_model and model_name != self.fallback_model:
                    logger.info(f"[OllamaLLMClient] Retrying with fallback model '{self.fallback_model}'...")
                    return self._call(self.fallback_model, prompt)
                raise RuntimeError(f"Ollama error {resp.status_code}: {resp.text[:200]}")

            data = resp.json()
            response_text = data.get("response", "")
            if not response_text:
                raise RuntimeError("Ollama returned empty response.")
            return response_text
        except (httpx.NetworkError, httpx.TimeoutException) as err:
            logger.warning(f"[OllamaLLMClient] Connection/Timeout error calling '{model_name}': {err}")
            if self.fallback_model and model_name != self.fallback_model:
                logger.info(f"[OllamaLLMClient] Retrying with fallback model '{self.fallback_model}'...")
                return self._call(self.fallback_model, prompt)
            raise RuntimeError(f"Ollama client failed: {err}") from err

