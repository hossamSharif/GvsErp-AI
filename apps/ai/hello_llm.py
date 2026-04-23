"""Phase 0 smoke test — first Gemini call via LiteLLM.

Run with:
    uv run python hello_llm.py
"""

import os

from dotenv import load_dotenv
from litellm import completion

load_dotenv()

response = completion(
    model="gemini/gemini-2.5-flash-lite",
    messages=[
        {
            "role": "user",
            "content": "In one sentence, introduce yourself and say you are ready to help build an AI companion for an ERP.",
        }
    ],
    api_key=os.environ["GOOGLE_API_KEY"],
)

print(response.choices[0].message.content)
