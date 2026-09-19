"""GitHub agent analysis without importing or executing repository code."""

from .analyzer import analyze_files
from .github import analyze_github

__all__ = ["analyze_files", "analyze_github"]
