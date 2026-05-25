"""Generate JSON Schema from a Python prompt definition and write to stdout."""
import json
import sys
from typing import Literal

from pydantic import BaseModel

from promptschema import define_prompt
from promptschema.schema import schema_to_json_schema


@define_prompt(name="order-assistant", version="1.0.0", model="openai/gpt-4o")
class OrderPrompt(BaseModel):
    order: str
    lang: Literal["es", "en"]
    total: float
    discount: bool = False

    def template(self) -> str:
        return f"Order: {self.order}, Lang: {self.lang}, Total: {self.total}"


schema = schema_to_json_schema(OrderPrompt)

json.dump(schema, sys.stdout, sort_keys=True, indent=2)
print()
