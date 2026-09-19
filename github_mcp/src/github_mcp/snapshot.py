"""Local fixture transport that emulates GitHub's read-only REST responses."""

from __future__ import annotations

import base64
import hashlib
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

from .analyzer import file_priority
from .github import MAX_FILE_BYTES, MAX_TOTAL_BYTES, GitHubClient, GitHubError, analyze_github, parse_github_url


class LocalSnapshotClient(GitHubClient):
    """Run the real importer against an immutable, explicitly simulated snapshot."""

    def __init__(self, directory: Path, github_url: str):
        parsed = parse_github_url(github_url)
        if parsed["kind"] != "repository":
            raise GitHubError("로컬 시뮬레이션의 github_url은 저장소 루트 링크여야 합니다.")
        self.directory = Path(directory).resolve()
        if not self.directory.is_dir():
            raise GitHubError(f"에이전트 폴더를 찾지 못했습니다: {directory}")
        self.repository = f"https://github.com/{parsed['owner']}/{parsed['repo']}"
        self.api_root = f"/repos/{quote(parsed['owner'], safe='')}/{quote(parsed['repo'], safe='')}"
        files = {}
        total = 0
        for path in sorted(self.directory.rglob("*")):
            if path.is_symlink() or not path.is_file():
                continue
            relative = path.relative_to(self.directory).as_posix()
            if file_priority(relative) >= 100:
                continue
            if not path.resolve().is_relative_to(self.directory):
                continue
            length = path.stat().st_size
            if length > MAX_FILE_BYTES or total + length > MAX_TOTAL_BYTES or len(files) >= 200:
                raise GitHubError("로컬 시뮬레이션은 최대 200개 파일, 파일당 256 KB, 총 2 MB를 지원합니다.")
            data = path.read_bytes()
            if len(data) > MAX_FILE_BYTES or total + len(data) > MAX_TOTAL_BYTES:
                raise GitHubError("로컬 파일이 분석 한도를 초과했습니다.")
            files[relative] = data
            total += len(data)
        if not files:
            raise GitHubError("분석 가능한 에이전트 파일이 없습니다.")
        digest = hashlib.sha256()
        self.blobs, entries = {}, []
        for relative, data in files.items():
            sha = hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()
            digest.update(relative.encode() + b"\0" + sha.encode() + b"\0")
            self.blobs[sha] = data
            entries.append({"path": relative, "type": "blob", "mode": "100644", "sha": sha, "size": len(data)})
        self.digest = digest.hexdigest()
        # This identifier is synthetic, not an actual remote Git commit.
        self.commit = hashlib.sha1(("hireme-local-snapshot:" + self.digest).encode()).hexdigest()
        self.tree_sha = hashlib.sha1(("hireme-local-tree:" + self.digest).encode()).hexdigest()
        self.entries = entries
        self.license = "MIT" if files.get("LICENSE", b"").startswith(b"MIT License") else None

    def get(self, path: str) -> dict:
        clean = urlsplit(path).path
        if clean == self.api_root:
            return {"html_url": self.repository, "default_branch": "main",
                    "license": {"spdx_id": self.license}}
        if clean in {self.api_root + "/commits/main", self.api_root + "/commits/" + self.commit}:
            return {"sha": self.commit, "commit": {"tree": {"sha": self.tree_sha}}}
        if clean == self.api_root + "/git/trees/" + self.tree_sha:
            return {"sha": self.tree_sha, "tree": self.entries, "truncated": False}
        prefix = self.api_root + "/git/blobs/"
        if clean.startswith(prefix):
            sha = unquote(clean[len(prefix):])
            if sha in self.blobs:
                return {"sha": sha, "encoding": "base64",
                        "content": base64.b64encode(self.blobs[sha]).decode("ascii")}
        error = GitHubError("로컬 GitHub 시뮬레이션에서 경로를 찾지 못했습니다.")
        error.status = 404
        raise error

    def resolve(self, parsed: dict, ref: str | None = None) -> dict:
        source = super().resolve(parsed, ref)
        source.update({"simulated": True, "syntheticCommit": True, "snapshotDigest": self.digest})
        return source


def analyze_local(directory: Path, github_url: str, agent_name: str | None = None,
                  max_files: int = 60) -> dict:
    client = LocalSnapshotClient(directory, github_url)
    return analyze_github(github_url, agent_name, max_files=max_files, client=client)
