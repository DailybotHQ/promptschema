"""
Basic example — define a typed prompt and render it.

Run:
    python examples/python/basic.py
"""

from pydantic import BaseModel, field_validator
from typing import Literal

from promptschema import define_prompt


@define_prompt(name="greeting", version="1.0.0", model="openai/gpt-4o")
class GreetingPrompt(BaseModel):
    name: str
    tone: Literal["formal", "casual"]

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be empty")
        return v

    def template(self) -> str:
        return f"""
            You are a friendly assistant.
            Greet the user "{self.name}" in a {self.tone} tone.
            Keep it under 2 sentences.
        """


# Render returns the interpolated prompt string (no LLM call)
prompt = GreetingPrompt(name="Oscar", tone="casual")
rendered = prompt.render()
print("Rendered prompt:\n", rendered)

# Validation happens automatically via Pydantic
try:
    GreetingPrompt(name="", tone="casual")
except Exception as err:
    print("\nValidation error (expected):", err)
