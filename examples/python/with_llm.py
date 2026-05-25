"""
Example — actually call an LLM via the built-in adapter.

Requires:
    export OPENAI_API_KEY=sk-...

Run:
    python examples/python/with_llm.py
"""

import asyncio
from pydantic import BaseModel

from promptschema import define_prompt


@define_prompt(name="translator", version="1.0.0", model="openai/gpt-4o-mini")
class TranslatePrompt(BaseModel):
    text: str
    target_lang: str

    def template(self) -> str:
        return f"""
            Translate the following text to {self.target_lang}.
            Respond with the translation only, no explanations.

            Text: {self.text}
        """


async def main() -> None:
    prompt = TranslatePrompt(text="Hello, how are you?", target_lang="Spanish")
    result = await prompt.arun(temperature=0.3, max_tokens=100)

    print("Translation:", result.text)
    print("Tokens used:", result.usage.total_tokens)
    print(f"Estimated cost: ${result.usage.estimated_cost:.6f}")


asyncio.run(main())
