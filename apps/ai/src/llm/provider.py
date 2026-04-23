"""LiteLLM wrapper — one surface for Gemini / Claude / OpenAI.

LiteLLM translates provider-specific APIs into an OpenAI-shaped interface.
Switching providers = changing the `model` string and the api_key.
"""

from __future__ import annotations

from collections.abc import Iterator

from litellm import completion

from src.config import DEFAULT_MODELS, settings

Message = dict[str, str]


PROVIDER_PREFIX: dict[str, str] = {
    "google": "gemini",
    "anthropic": "anthropic",
    "openai": "openai",
}


def _model_id(provider: str, model: str | None) -> str:
    name = model or DEFAULT_MODELS[provider]
    return f"{PROVIDER_PREFIX[provider]}/{name}"


def chat(
    messages: list[Message],
    provider: str,
    model: str | None = None,
    temperature: float = 0.7,
) -> str:
    response = completion(
        model=_model_id(provider, model),
        messages=messages,
        api_key=settings.api_key_for(provider),
        temperature=temperature,
    )
    return response.choices[0].message.content or ""


def stream_chat(
    messages: list[Message],
    provider: str,
    model: str | None = None,
    temperature: float = 0.7,
) -> Iterator[str]:
    """Yield token deltas one at a time — feed directly into st.write_stream."""
    response = completion(
        model=_model_id(provider, model),
        messages=messages,
        api_key=settings.api_key_for(provider),
        temperature=temperature,
        stream=True,
    )
    for chunk in response:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
