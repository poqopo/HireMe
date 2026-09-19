"""Bounded, commit-pinned GitHub repository reader."""

from __future__ import annotations

import base64
import json
import os
from concurrent.futures import ThreadPoolExecutor
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urlsplit
from urllib.request import Request, urlopen

from .analyzer import analyze_files, file_priority

MAX_FILE_BYTES = 256_000
MAX_TOTAL_BYTES = 2_000_000


class GitHubError(ValueError):
    pass


def parse_github_url(url: str) -> dict:
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or parsed.netloc.lower() != "github.com"
            or parsed.username or parsed.password):
        raise GitHubError("https://github.com/owner/repo 형식의 링크가 필요합니다.")
    parts = [unquote(part) for part in parsed.path.strip("/").split("/")]
    if len(parts) < 2 or any(not p or p in {".", ".."} or "\\" in p for p in parts):
        raise GitHubError("올바른 GitHub 저장소 링크가 필요합니다.")
    if any("/" in p for p in parts[:2]):
        raise GitHubError("저장소 이름에 경로 구분자를 사용할 수 없습니다.")
    if len(parts) > 2 and (parts[2] not in {"tree", "blob"} or len(parts) < 4):
        raise GitHubError("저장소, tree 폴더, blob 파일 링크만 지원합니다.")
    if not parts[1].removesuffix(".git"):
        raise GitHubError("저장소 이름이 비어 있습니다.")
    return {"owner": parts[0], "repo": parts[1].removesuffix(".git"),
            "kind": parts[2] if len(parts) > 2 else "repository", "tail": parts[3:]}


class GitHubClient:
    def __init__(self, token: str | None = None):
        self.token = token if token is not None else os.getenv("GITHUB_TOKEN")

    def get(self, path: str) -> dict:
        headers = {"Accept": "application/vnd.github+json", "User-Agent": "HireMe-github-mcp",
                   "X-GitHub-Api-Version": "2022-11-28"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        try:
            with urlopen(Request("https://api.github.com" + path, headers=headers), timeout=20) as response:
                body = response.read(10_000_001)
                if len(body) > 10_000_000:
                    raise GitHubError("GitHub 응답이 허용 크기를 초과했습니다.")
                return json.loads(body)
        except HTTPError as exc:
            # Retain the status for ref resolution, never echo credentials or response bodies.
            error = GitHubError(f"GitHub API HTTP {exc.code}: 저장소/권한/요청 한도를 확인하세요.")
            error.status = exc.code
            raise error from None
        except (URLError, TimeoutError) as exc:
            raise GitHubError("GitHub API에 연결하지 못했습니다.") from exc

    def resolve(self, parsed: dict, ref: str | None = None) -> dict:
        root = f"/repos/{quote(parsed['owner'], safe='')}/{quote(parsed['repo'], safe='')}"
        metadata = self.get(root)
        scope = ""
        default = metadata["default_branch"]
        tail = "/".join(parsed["tail"])
        if parsed["tail"] and ref is None and (tail == default or tail.startswith(default + "/")):
            # Most shared links use the default branch. Avoid an API request for every path segment.
            ref = default
        if parsed["tail"] and ref is None:
            # Branch names can contain '/'. Resolve the longest existing ref prefix.
            for length in range(len(parsed["tail"]), 0, -1):
                candidate = "/".join(parsed["tail"][:length])
                try:
                    commit = self.get(root + "/commits/" + quote(candidate, safe=""))
                except GitHubError as exc:
                    if getattr(exc, "status", None) not in {404, 422}:
                        raise
                    continue
                ref = candidate
                scope = "/".join(parsed["tail"][length:])
                break
            else:
                raise GitHubError("링크에서 유효한 branch/tag/commit을 찾지 못했습니다.")
        else:
            ref = ref or metadata["default_branch"]
            if parsed["tail"]:
                tail = "/".join(parsed["tail"])
                if tail != ref and not tail.startswith(ref + "/"):
                    raise GitHubError("ref는 GitHub 링크의 branch/tag와 일치해야 합니다.")
                scope = tail[len(ref):].lstrip("/")
            commit = self.get(root + "/commits/" + quote(ref, safe=""))
        license_data = metadata.get("license") or {}
        return {"apiRoot": root, "repository": metadata["html_url"],
                "owner": parsed["owner"], "repo": parsed["repo"], "ref": ref,
                "commit": commit["sha"], "tree": commit["commit"]["tree"]["sha"],
                "path": scope, "kind": parsed["kind"],
                "license": license_data.get("spdx_id")}

    def files(self, source: dict, max_files: int) -> tuple[dict[str, str], dict]:
        root = source["apiRoot"]
        tree_sha = source["tree"]
        scope = source["path"]
        if source["kind"] == "blob":
            parent, _, filename = scope.rpartition("/")
        else:
            parent, filename = scope, None
        for segment in parent.split("/") if parent else []:
            tree = self.get(root + "/git/trees/" + tree_sha)
            entry = next((e for e in tree["tree"] if e["path"] == segment and e["type"] == "tree"), None)
            if not entry:
                raise GitHubError(f"폴더를 찾지 못했습니다: {scope}")
            tree_sha = entry["sha"]
        tree = self.get(root + "/git/trees/" + tree_sha + "?recursive=1")
        entries = [e for e in tree["tree"] if e["type"] == "blob" and e.get("mode") != "120000"
                   and (filename is None or e["path"] == filename)]
        if filename and not entries:
            raise GitHubError("링크에 해당하는 파일을 찾지 못했습니다.")
        selected, skipped = [], []
        size = 0
        for entry in sorted(entries, key=lambda e: (file_priority(e["path"]), e["path"])):
            path = "/".join(filter(None, [parent, entry["path"]]))
            if file_priority(entry["path"]) >= 100:
                continue
            length = entry.get("size", MAX_FILE_BYTES + 1)
            if length > MAX_FILE_BYTES or size + length > MAX_TOTAL_BYTES or len(selected) >= max_files:
                skipped.append({"path": path, "reason": "analysis_limit"})
                continue
            selected.append((path, entry))
            size += length

        def read(item):
            path, entry = item
            try:
                blob = self.get(root + "/git/blobs/" + entry["sha"])
                if blob.get("encoding") != "base64":
                    return path, None, "unsupported_encoding"
                data = base64.b64decode(blob["content"])
                if len(data) > MAX_FILE_BYTES:
                    return path, None, "analysis_limit"
                text = data.decode("utf-8")
                if "\x00" in text:
                    return path, None, "binary_file"
                return path, text, None
            except UnicodeDecodeError:
                return path, None, "non_utf8_file"
            except GitHubError as exc:
                return path, None, str(exc)

        files = {}
        with ThreadPoolExecutor(max_workers=4) as pool:
            for path, text, reason in pool.map(read, selected):
                if reason:
                    skipped.append({"path": path, "reason": reason})
                else:
                    files[path] = text
        return files, {"scannedFiles": len(files), "skippedFiles": skipped,
                       "treeTruncated": bool(tree.get("truncated")),
                       "complete": not skipped and not tree.get("truncated", False)}


def analyze_github(url: str, agent_name: str | None = None, ref: str | None = None,
                   max_files: int = 60, client: GitHubClient | None = None,
                   server_url: str | None = None) -> dict:
    if not 1 <= max_files <= 200:
        raise GitHubError("max_files는 1~200 사이여야 합니다.")
    parsed = parse_github_url(url)
    client = client or GitHubClient()
    source = client.resolve(parsed, ref)
    files, coverage = client.files(source, max_files)
    public_source = {k: v for k, v in source.items() if k not in {"apiRoot", "tree", "kind"}}
    return analyze_files(files, public_source, agent_name, coverage, server_url)
