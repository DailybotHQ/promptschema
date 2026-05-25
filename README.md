# promptschema

**Typed, versioned prompts for LLMs.**
Stop hardcoding AI prompts as strings. Define them as contracts.

```bash
npm install promptschema          # TypeScript / JavaScript
pip install promptschema          # Python
```

<!-- TODO: Add demo GIF here -->

---

## The problem

Every LLM project ends up with code like this:

```ts
// ❌ What most codebases look like today
const prompt = `You are an e-commerce assistant.
Order: ${order}
Language: ${lang}
${total > 100 ? "Offer 10% discount." : ""}
`
const result = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: prompt }]
})
```

No types. No validation. No version history.
If `lang` is missing, it silently breaks at runtime.
Nobody knows what version of this prompt is in production.

---

## The solution

```ts
// ✅ With promptschema (TypeScript)
import { definePrompt, z } from 'promptschema'

const orderPrompt = definePrompt({
  name:    'order-assistant',
  version: '1.0.0',
  model:   'openai/gpt-4o',
  input: z.object({
    order: z.string(),
    lang:  z.enum(['es', 'en']),
    total: z.number().positive(),
  }),
  template: (i) => `
    You are an e-commerce assistant.
    Order: ${i.order}, Language: ${i.lang}
    ${i.total > 100 ? 'Offer 10% discount.' : ''}
  `
})

const result = await orderPrompt.run({ order: 'Dress #204', lang: 'en', total: 149 })
```

```python
# ✅ With promptschema (Python)
from promptschema import define_prompt
from pydantic import BaseModel
from typing import Literal

@define_prompt(name='order-assistant', version='1.0.0', model='openai/gpt-4o')
class OrderPrompt(BaseModel):
    order: str
    lang:  Literal['es', 'en']
    total: float

    def template(self) -> str:
        discount = 'Offer 10% discount.' if self.total > 100 else ''
        return f"""
            You are an e-commerce assistant.
            Order: {self.order}, Language: {self.lang}
            {discount}
        """

result = await OrderPrompt(order='Dress #204', lang='en', total=149).arun()
```

Type-safe. Validated at build time. Version tracked.

---

## Load from registry

Define prompts in one language, load them in another — from the same registry:

```ts
// TypeScript — load a prompt defined anywhere (TS or Python)
import { loadFromRegistry } from 'promptschema'

const prompt = loadFromRegistry('order-assistant')
// prompt.name    → 'order-assistant'
// prompt.version → '2.0.0'
// prompt.model   → 'openai/gpt-4o'

const validated = prompt.validate({ order: 'Dress #204', lang: 'en', total: 149 })
const result = await prompt.run({ order: 'Dress #204', lang: 'en', total: 149 })
```

```python
# Python — same registry, same prompt, same validation
from promptschema import load_from_registry

OrderPrompt = load_from_registry("order-assistant")
instance = OrderPrompt(order="Dress #204", lang="en", total=149)
result = await instance.arun()
```

The registry stores JSON Schema, so both languages reconstruct identical validation from a single source of truth.

---

## Install

```bash
# TypeScript / JavaScript
npm install promptschema

# Python
pip install promptschema[openai]       # OpenAI
pip install promptschema[anthropic]    # Anthropic
pip install promptschema[all]          # All providers
```

Requires Node >= 18 or Python >= 3.10.

---

## Features

- 🔒 **Type-safe** — Zod (TS) and Pydantic (Python) schemas for every prompt input
- 🔖 **Versioned** — semantic versioning with automatic change detection
- 🔍 **Diffable** — readable diffs between prompt versions
- ⚡ **Any model** — OpenAI, Anthropic, Gemini, Ollama, or your own adapter
- 🌍 **Dual** — identical API in TypeScript and Python, shared registry
- 🔄 **Cross-language** — define in TS, load in Python (or vice versa) via `loadFromRegistry`
- 🪶 **Lightweight** — zero runtime dependencies beyond Zod/Pydantic

---

## CLI

```bash
npx promptschema init                          # Create registry
npx promptschema status                        # Show sync state
npx promptschema bump order-assistant          # Bump version
npx promptschema diff order-assistant 1.0.0 2.0.0  # Show diff
npx promptschema validate                      # CI gate (exit 1 if unsynced)
npx promptschema list                          # List all prompts
npx promptschema history order-assistant       # Version timeline
```

The same commands work with Python: `promptschema status`, `promptschema bump`, etc.

---

## Why promptschema?

|  | Raw strings | LangChain | promptschema |
|---|---|---|---|
| Type-safe inputs | ❌ | ⚠️ partial | ✅ |
| Build-time validation | ❌ | ❌ | ✅ |
| Semantic versioning | ❌ | ❌ | ✅ |
| Prompt diff (readable) | ❌ | ❌ | ✅ |
| Works with any model | ✅ | ✅ | ✅ |
| TypeScript + Python | ✅ | ✅ | ✅ |
| Zero vendor lock-in | ✅ | ⚠️ partial | ✅ |
| Bundle size | 0kb | ~2MB | ~12kb |

---

## Custom adapters

Register your own LLM provider in a few lines:

```ts
import { registerAdapter } from 'promptschema'

registerAdapter('my-provider', {
  name: 'my-provider',
  async call({ model, prompt, temperature, maxTokens }) {
    const response = await myLLMClient.generate({ model, prompt })
    return {
      text: response.text,
      promptTokens: response.usage.input,
      completionTokens: response.usage.output,
      totalTokens: response.usage.total,
      estimatedCost: 0,
    }
  },
})
```

---

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

```bash
git clone https://github.com/tuusuario/promptschema
cd promptschema
pnpm install
pnpm test
```

---

## License

[MIT](LICENSE)
