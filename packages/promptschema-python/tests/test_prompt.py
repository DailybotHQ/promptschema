import pytest
from typing import Literal
from pydantic import BaseModel
from promptschema import define_prompt


def test_basic_decorator():
    @define_prompt(name="test-prompt", version="1.0.0", model="openai/gpt-4o")
    class MyPrompt(BaseModel):
        name: str
        lang: Literal["es", "en"] = "en"

        def template(self) -> str:
            return f"Hello, {self.name}! Language: {self.lang}"

    assert MyPrompt.prompt_name == "test-prompt"
    assert MyPrompt.prompt_version == "1.0.0"
    assert MyPrompt.prompt_model == "openai/gpt-4o"


def test_validation_on_instantiation():
    @define_prompt(name="val-prompt", version="1.0.0", model="openai/gpt-4o")
    class ValPrompt(BaseModel):
        count: int

        def template(self) -> str:
            return f"Count: {self.count}"

    p = ValPrompt(count=42)
    assert p.count == 42

    with pytest.raises(Exception):
        ValPrompt(count="not-a-number")  # type: ignore


def test_render():
    @define_prompt(name="render-prompt", version="1.0.0", model="openai/gpt-4o")
    class RenderPrompt(BaseModel):
        item: str

        def template(self) -> str:
            return f"""
                You are a helpful assistant.
                Item: {self.item}
            """

    p = RenderPrompt(item="shoes")
    rendered = p.render()
    assert "You are a helpful assistant." in rendered
    assert "Item: shoes" in rendered
    assert not rendered.startswith("\n")
    assert not rendered.endswith("\n")


def test_invalid_name():
    with pytest.raises(ValueError, match="kebab-case"):

        @define_prompt(name="BadName", version="1.0.0", model="openai/gpt-4o")
        class Bad(BaseModel):
            x: str

            def template(self) -> str:
                return ""


def test_invalid_version():
    with pytest.raises(ValueError, match="semver"):

        @define_prompt(name="ok-name", version="v1", model="openai/gpt-4o")
        class Bad(BaseModel):
            x: str

            def template(self) -> str:
                return ""


def test_invalid_model():
    with pytest.raises(ValueError, match="provider/model"):

        @define_prompt(name="ok-name", version="1.0.0", model="gpt4o")
        class Bad(BaseModel):
            x: str

            def template(self) -> str:
                return ""


def test_missing_template():
    with pytest.raises(TypeError, match="template"):

        @define_prompt(name="ok-name", version="1.0.0", model="openai/gpt-4o")
        class Bad(BaseModel):
            x: str


def test_not_basemodel():
    with pytest.raises(TypeError, match="BaseModel"):

        @define_prompt(name="ok-name", version="1.0.0", model="openai/gpt-4o")
        class Bad:
            def template(self) -> str:
                return ""
