from __future__ import annotations

import re
from typing import Any, Callable, TypeVar

from pydantic import BaseModel

from promptschema.schema import normalize_template_output
from promptschema.types import PromptResult

T = TypeVar("T", bound=BaseModel)

_KEBAB_RE = re.compile(r"^[a-z][a-z0-9]*(-[a-z0-9]+)*$")
_SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+$")
_MODEL_RE = re.compile(r"^[a-z]+/.+$")


def define_prompt(
    *,
    name: str,
    version: str,
    model: str,
) -> Callable[[type[T]], type[T]]:
    if not name or not _KEBAB_RE.match(name):
        raise ValueError(f"name must be kebab-case, got {name!r}")
    if not version or not _SEMVER_RE.match(version):
        raise ValueError(f"version must be valid semver, got {version!r}")
    if not model or not _MODEL_RE.match(model):
        raise ValueError(f"model must be 'provider/model' format, got {model!r}")

    def decorator(cls: type[T]) -> type[T]:
        if not issubclass(cls, BaseModel):
            raise TypeError(f"@define_prompt requires a Pydantic BaseModel subclass, got {cls.__name__}")

        if not hasattr(cls, "template") or not callable(getattr(cls, "template")):
            raise TypeError(f"@define_prompt requires a 'template(self) -> str' method on {cls.__name__}")

        cls.prompt_name = name  # type: ignore[attr-defined]
        cls.prompt_version = version  # type: ignore[attr-defined]
        cls.prompt_model = model  # type: ignore[attr-defined]

        original_template = cls.template  # type: ignore[attr-defined]

        def render(self: Any) -> str:
            raw = original_template(self)
            return normalize_template_output(raw)

        cls.render = render  # type: ignore[attr-defined]

        def run(self: Any, **kwargs: Any) -> PromptResult:
            from promptschema.runner import run_prompt_sync
            return run_prompt_sync(cls, self, **kwargs)

        async def arun(self: Any, **kwargs: Any) -> PromptResult:
            from promptschema.runner import run_prompt_async
            return await run_prompt_async(cls, self, **kwargs)

        cls.run = run  # type: ignore[attr-defined]
        cls.arun = arun  # type: ignore[attr-defined]

        return cls

    return decorator
