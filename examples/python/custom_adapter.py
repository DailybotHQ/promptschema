"""
Example — register a custom LLM adapter.

Run:
    python examples/python/custom_adapter.py
"""

import asyncio
from pydantic import BaseModel

from promptschema import define_prompt
from promptschema.adapters import register_adapter


async def echo_call(
    *,
    model: str,
    prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> dict:
    return {
        "text": f"[ECHO] {prompt}",
        "prompt_tokens": len(prompt),
        "completion_tokens": len(prompt),
        "total_tokens": len(prompt) * 2,
        "estimated_cost": 0.0,
    }


register_adapter("echo", echo_call)


@define_prompt(name="echo-test", version="1.0.0", model="echo/v1")
class EchoPrompt(BaseModel):
    message: str

    def template(self) -> str:
        return f"Say: {self.message}"


async def main() -> None:
    prompt = EchoPrompt(message="hello world")
    result = await prompt.arun()
    print("Response:", result.text)


asyncio.run(main())
