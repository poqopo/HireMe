from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .github import GitHubError, analyze_github
from .snapshot import analyze_local


def main():
    parser = argparse.ArgumentParser(description="GitHub Agent → MCP contents + tool definitions")
    subparsers = parser.add_subparsers(dest="command", required=True)
    analyze = subparsers.add_parser("analyze")
    analyze.add_argument("github_url")
    analyze.add_argument("--agent-name")
    analyze.add_argument("--ref")
    analyze.add_argument("--max-files", type=int, default=60)
    analyze.add_argument("--output", type=Path, help="Write manifest.json, contents.json, tools.json")
    local = subparsers.add_parser("analyze-local", help="Simulate a GitHub repository using local agent files")
    local.add_argument("local_path", type=Path)
    local.add_argument("--github-url", required=True, help="Simulated repository identity; no network requests")
    local.add_argument("--agent-name")
    local.add_argument("--max-files", type=int, default=60)
    local.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "analyze-local":
            result = analyze_local(args.local_path, args.github_url, args.agent_name, args.max_files)
        else:
            result = analyze_github(args.github_url, args.agent_name, args.ref, args.max_files)
        if args.output:
            args.output.mkdir(parents=True, exist_ok=True)
            for key, filename in [("manifest", "manifest.json"), ("contents", "contents.json"), ("tools", "tools.json")]:
                target = args.output / filename
                # Avoid silently replacing previously reviewed analysis artifacts.
                if target.exists():
                    raise GitHubError(f"결과 파일이 이미 존재합니다: {target}. 새 출력 폴더를 사용하세요.")
            for key, filename in [("manifest", "manifest.json"), ("contents", "contents.json"), ("tools", "tools.json")]:
                (args.output / filename).write_text(json.dumps(result[key], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(json.dumps({"output": str(args.output), "serverName": result["manifest"]["serverName"],
                              "summary": result["manifest"]["summary"]}, ensure_ascii=False, indent=2))
        else:
            print(json.dumps(result, ensure_ascii=False, indent=2))
    except (GitHubError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
