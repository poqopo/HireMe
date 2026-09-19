"""OpenAI Responses API adapter for the generated text in every Agent step."""

from __future__ import annotations

import json
import os
from typing import Any

from openai import AsyncOpenAI


class ModelUnavailableError(RuntimeError):
    """The runtime cannot obtain a usable model response."""


async def generate_agent_response(
    *,
    agent_name: str,
    agent_role: str,
    task: str,
    tool: dict[str, Any],
    prompt: dict[str, Any],
    upstream: dict[str, Any] | None,
    tool_result: dict[str, Any] | None,
) -> str:
    """Generate one stage's answer while keeping API credentials on the server."""
    if not os.getenv("OPENAI_API_KEY"):
        raise ModelUnavailableError("OPENAI_API_KEY가 설정되지 않았습니다.")

    prompt_text = prompt.get("template") or prompt.get("description") or prompt["name"]
    instructions = f"""당신은 HireMe 워크플로의 '{agent_name}' Agent입니다.
역할: {agent_role}
선택된 MCP 도구: {tool['name']} — {tool.get('description', '')}
선택된 프롬프트: {prompt['name']}
프롬프트 지침: {prompt_text}

사용자 요청과 이전 결과, 도구 실행 결과를 바탕으로 현재 단계의 결과만 한국어로 작성하세요.
제공되지 않은 사실을 근거처럼 만들지 말고 정보가 부족하면 필요한 정보와 한계를 명시하세요.
도구 실행 결과가 없으면 도구를 실행했다고 주장하지 마세요."""
    input_text = "\n\n".join((
        f"사용자 요청:\n{task}",
        f"이전 단계 출력:\n{json.dumps(upstream, ensure_ascii=False) if upstream else '없음'}",
        f"MCP 도구 실행 결과:\n{json.dumps(tool_result, ensure_ascii=False) if tool_result else '없음'}",
    ))
    try:
        response = await AsyncOpenAI().responses.create(
            model=os.getenv("HIREME_OPENAI_MODEL", "gpt-5"),
            instructions=instructions,
            input=input_text,
            max_output_tokens=1200,
            store=False,
        )
    except Exception as exc:
        raise ModelUnavailableError("OpenAI 모델 호출에 실패했습니다. API 키, 모델 접근 권한, 결제 상태를 확인하세요.") from exc
    if not response.output_text.strip():
        raise ModelUnavailableError("OpenAI 모델이 텍스트 출력을 반환하지 않았습니다.")
    return response.output_text.strip()
