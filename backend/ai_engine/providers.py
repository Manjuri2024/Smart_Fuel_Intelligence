"""LLM providers. Add another provider by subclassing LLMProvider and returning it from get_provider()."""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional

import requests

from backend import config


class AIProviderError(Exception):
    """Raised when the AI provider cannot produce an answer."""


class LLMProvider(ABC):
    name = "base"

    @abstractmethod
    def generate(self, system_prompt: str, messages: List[Dict[str, str]]) -> str:
        """messages: [{"role": "user"|"assistant", "content": "..."}] ending with the user message."""


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    def generate(self, system_prompt: str, messages: List[Dict[str, str]]) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        body = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "model" if m["role"] == "assistant" else "user",
                          "parts": [{"text": m["content"]}]} for m in messages],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 800},
        }
        try:
            response = requests.post(url, json=body, timeout=30,
                                     headers={"x-goog-api-key": self.api_key, "Content-Type": "application/json"})
        except requests.RequestException as exc:
            raise AIProviderError("Could not reach the Gemini API. Check your internet connection.") from exc
        if response.status_code != 200:
            raise AIProviderError(f"Gemini API returned an error (HTTP {response.status_code}). "
                                  "Check GEMINI_API_KEY and GEMINI_MODEL in backend/.env.")
        try:
            return response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        except (KeyError, IndexError, ValueError) as exc:
            raise AIProviderError("Gemini returned an empty or blocked response. Try rephrasing the question.") from exc


def get_provider() -> Optional[LLMProvider]:
    """Return the configured provider, or None when no API key is set."""
    if config.GEMINI_API_KEY:
        return GeminiProvider(config.GEMINI_API_KEY, config.GEMINI_MODEL)
    return None
