# github_mcp

GitHub Agent의 내용을 **MCP Contents(Resources/Prompts)**와 **MCP Tools 정의**로 분리하는 HireMe의 첫 번째 모듈입니다. 저장소 코드를 실행하거나 임포트하지 않고 AST와 명시적 JSON 정의를 분석합니다. LLM/API 키 없이 사용할 수 있습니다.

## 실행

Python 3.11 이상과 [uv](https://docs.astral.sh/uv/)가 필요합니다.

```sh
cd github_mcp
uv sync --python 3.12
uv run github-mcp analyze https://github.com/OWNER/REPO \
  --agent-name paper_research \
  --output output/paper_research
```

저장소 루트, `tree/BRANCH/폴더`, `blob/BRANCH/파일` 링크를 지원합니다. `--ref TAG_OR_SHA`로 버전을 선택할 수 있습니다. 폴더/파일 링크에서는 링크의 ref와 일치해야 합니다. `/`가 포함된 브랜치도 지원합니다. 기본 브랜치에 해당하는 링크는 우선 기본 브랜치로 해석하며, 나머지는 가장 긴 유효 ref를 찾습니다. 겹치는 브랜치 이름이 있을 때 `--ref`로 명확히 지정하세요.

기본 분석 한도는 60개 파일, 파일당 256 KB, 총 2 MB입니다. `--max-files 120`으로 파일 수를 늘릴 수 있습니다(최대 200). 큰 저장소에서는 에이전트 폴더 링크를 지정하는 것이 좋습니다. `GITHUB_TOKEN` 환경변수는 선택 사항이며, GitHub API 요청 한도를 늘릴 때 사용할 수 있습니다.

## 결과

| 파일 | 내용 |
| --- | --- |
| `contents.json` | `resources`: 지침·스킬·참고 자료·프롬프트 본문, `prompts`: 재사용할 프롬프트 후보 |
| `tools.json` | 도구 이름·설명·입력 JSON Schema·소스 위치·Python 실행 바인딩 후보 |
| `manifest.json` | `serverName: paper_research_mcp`, 저장소·고정 커밋·프레임워크·환경변수 이름·분석 범위·검토 항목 |

`Contents`는 HireMe의 묶음 이름입니다. MCP 프로토콜에는 별도 Contents 목록이 없으며, 콘텐츠는 [Resources와 Prompts](https://py.sdk.modelcontextprotocol.io/v1/)에 대응합니다. `tools.json`은 MCP Tool 필드와 HireMe의 분석 메타데이터를 함께 가진 초안입니다. MCP로 내보낼 때는 `name`, `description`, `inputSchema`, 선택적 `outputSchema`를 사용하고 `binding`과 `source`는 HireMe 내부에 보관합니다.

분석 결과를 읽을 때:

- `manifest.coverage.complete`와 `skippedFiles`로 분석이 생략된 파일을 확인합니다. 이는 선택한 분석 대상 파일에 대한 범위이며, 저장소의 모든 파일/언어를 이해했다는 뜻은 아닙니다.
- `schemaStatus: draft`는 알려진 타입/명시적 정의에서 추출한 초안이고, `needs_review`는 알 수 없는 타입이나 동적 설정이 있다는 뜻입니다. 둘 다 실제 런타임 검증 전입니다.
- 모든 추출 도구는 `status: needs_adapter`입니다. 함수 발견만으로 실제 MCP 호출이 구현되지는 않습니다.
- `.mcp.json`의 외부 MCP 서버는 `mcpConnections`에 기록합니다. 연결 설정에는 도구 목록이 없으므로 `needs_tool_discovery`로 남깁니다.

## 현재 지원

- `AGENTS.md`, `SKILL.md`, 지침/프롬프트/Markdown/텍스트 참고 자료
- Python 문자열 `SYSTEM_PROMPT`, `*_PROMPT`, `*_INSTRUCTIONS`
- LangChain `@tool`, `@tool("이름")`, FastMCP `@mcp.tool()`와 비동기 함수
- 기본 Python 타입, 리스트/딕셔너리, Optional/Union/Literal, 단순 BaseModel/TypedDict 입력 초안
- MCP `inputSchema` 및 OpenAI function `parameters` 형식의 JSON 도구 정의
- Python `@mcp.prompt()`/`@mcp.resource()`의 소스와 프롬프트 인수 후보
- `langgraph.json`의 그래프 진입점, 의존성에 나타난 프레임워크, 환경변수 이름

동적 프롬프트/리소스는 소스 정의를 보존하며 렌더링하거나 실행하지 않습니다. YAML 기반 도구 정의, `StructuredTool.from_function`, `registerTool`, 동적으로 등록하는 도구, 커스텀 클래스 도구, 일반 함수의 역할 추론, JavaScript 도구 분석은 현재 지원하지 않습니다. Markdown 안의 사용 예제를 실제 도구라고 추정하지 않습니다. 환경변수 값은 수집하지 않지만, 저장소 문서나 명령행 인수에 직접 적힌 값까지 자동 비식별화하는 기능은 아닙니다.

## MCP 서버로 연결

```sh
cd github_mcp
uv run github-mcp-server
```

stdio MCP 서버는 `analyze_github_agent` Tool을 제공합니다.

```json
{
  "mcpServers": {
    "github_mcp": {
      "command": "uv",
      "args": [
        "--directory", "/ABSOLUTE/PATH/hireme/github_mcp",
        "run", "github-mcp-server"
      ]
    }
  }
}
```

호출 예:

```json
{
  "github_url": "https://github.com/OWNER/REPO/tree/main/agents/research",
  "agent_name": "paper_research",
  "max_files": 60
}
```

반환값은 `{ "manifest": {}, "contents": { "resources": [], "prompts": [] }, "tools": [] }`입니다. MCP 호출은 파일을 저장하지 않으며, CLI의 `--output`으로 같은 결과를 저장할 수 있습니다.

## HireMe 연결 지점

```python
from github_mcp import analyze_github

bundle = analyze_github(github_url, agent_name="paper_research")
server_name = bundle["manifest"]["serverName"]  # paper_research_mcp
contents = bundle["contents"]
tool_definitions = bundle["tools"]
```

다음 단계는 이 결과를 검토해 실행 Adapter를 만들고, Contents/Tools를 `serverName` 아래 HireMe MCP Server에 등록하는 것입니다. 현재 구현 범위는 분리와 등록용 초안 생성이며, HireMe 호스팅·코드 실행·자동 업로드는 포함하지 않습니다.

## 검증

실제 에이전트 예제로 GitHub API 읽기 경로까지 시뮬레이션하려면 프로젝트 루트에서:

```sh
uv run --project github_mcp github-mcp analyze-local agents/crypto_news_research \
  --github-url https://github.com/hireme-demo/crypto-news-research \
  --agent-name crypto_news_research \
  --output github_mcp/output/news_analysis
```

시뮬레이션 URL은 실제 게시된 저장소가 아닙니다. `source.simulated`와 `syntheticCommit`으로 구분하며, `snapshotDigest`는 읽은 로컬 파일들의 내용을 식별합니다. 이 모드는 repository/commit/tree/blob 응답을 로컬에서 제공하고 기존 `analyze_github`와 같은 분석 경로를 사용합니다. 로컬 입력은 최대 200개 분석 대상 파일, 파일당 256 KB, 총 2 MB입니다.

아래 테스트는 `github_mcp` 폴더에서 실행합니다.

두 에이전트의 연결 실행과 HTML 생성은 프로젝트 루트에서 실행합니다.

```sh
uv run --project github_mcp python github_mcp/scripts/run_demo.py \
  --mode demo --output github_mcp/output/crypto_research_interactive
```

기사 본문 수집 → 문단 근거와 연결된 인사이트 초안 → USD 시세 수집 → 인터랙티브 디자인 흐름입니다. 도구는 뉴스 4개·시각화 2개로 분리됩니다. `demo`는 가상 데이터이고, `--mode live`는 실제 RSS·공개 기사 본문·CoinGecko 데이터를 사용합니다. 본문 읽기 실패는 명시하고 인사이트를 만들지 않습니다. 주제별 규칙 초안이며 LLM 분석은 수행하지 않습니다. 자세한 설명은 [agents/README.md](../agents/README.md)를 참고하세요.

테스트 실행:

```sh
uv run python -m unittest discover -s tests -v
```
