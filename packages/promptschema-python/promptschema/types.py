from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PromptUsage:
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost: float


@dataclass(frozen=True)
class PromptResult:
    text: str
    usage: PromptUsage
    model: str
    version: str
    latency_ms: float
