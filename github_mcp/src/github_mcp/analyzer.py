"""Static agent analysis. All inferred contracts remain adapter drafts."""

from __future__ import annotations

import ast
import hashlib
import json
import re
from pathlib import PurePosixPath
from urllib.parse import quote

from jsonschema import Draft202012Validator, SchemaError

EXCLUDED = {".git", ".venv", "venv", "node_modules", "vendor", "dist", "build", "__pycache__"}
CONFIG_NAMES = {"pyproject.toml", "requirements.txt", "langgraph.json", "package.json",
                "agent.json", "manifest.json", "tools.json", ".mcp.json", "mcp.json", "mcp_config.json"}


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9_]+", "_", value.lower()).strip("_") or "agent"


def file_priority(path: str) -> int:
    p = PurePosixPath(path)
    if any(part in EXCLUDED for part in p.parts) or (p.name.startswith(".env") and p.name != ".env.example"):
        return 100
    name = p.name.lower()
    if name in {"agents.md", "agent.md", "skill.md", "instructions.md"}:
        return 0
    if name in CONFIG_NAMES or name == ".env.example":
        return 1
    if "templates" in p.parts and p.suffix.lower() == ".html":
        return 2
    if any(part.lower() in {"prompts", "instructions", "skills"} for part in p.parts):
        return 2 if p.suffix.lower() in {".md", ".txt", ".json", ".yaml", ".yml", ".j2", ".jinja2", ".py"} else 100
    if p.suffix == ".py":
        return 3 if not any(part in {"tests", "test", "examples"} for part in p.parts) else 6
    if name.startswith("readme") or name.startswith("license") or p.suffix.lower() in {".md", ".txt"}:
        return 4
    if p.suffix.lower() in {".json", ".yaml", ".yml", ".toml"}:
        return 5
    return 100


def literal(node, default=None):
    try:
        return ast.literal_eval(node)
    except (ValueError, TypeError, SyntaxError):
        return default


def type_schema(node, models: dict, seen: frozenset = frozenset()) -> tuple[dict, bool]:
    """Convert known type hints, leaving unknown types unconstrained and flagged."""
    if node is None:
        return {}, False
    if isinstance(node, ast.Constant):
        if node.value is None:
            return {"type": "null"}, True
        if isinstance(node.value, str):
            try:
                return type_schema(ast.parse(node.value, mode="eval").body, models, seen)
            except SyntaxError:
                return {}, False
    name = ast.unparse(node).split(".")[-1]
    primitive = {"str": "string", "int": "integer", "float": "number", "bool": "boolean",
                 "dict": "object", "Dict": "object", "list": "array", "List": "array",
                 "None": "null"}
    if name in primitive:
        return {"type": primitive[name]}, True
    if name == "Any":
        return {}, True
    if name in models and name not in seen:
        props, required, complete = {}, [], True
        for member in models[name].body:
            if isinstance(member, ast.AnnAssign) and isinstance(member.target, ast.Name):
                schema, known = type_schema(member.annotation, models, seen | {name})
                props[member.target.id] = schema
                if member.value is None:
                    required.append(member.target.id)
                else:
                    complete = False  # Pydantic Field/default semantics require runtime validation.
                complete &= known
        return {"type": "object", "properties": props, "required": required}, complete
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.BitOr):
        left, a = type_schema(node.left, models, seen)
        right, b = type_schema(node.right, models, seen)
        return {"anyOf": [left, right]}, a and b
    if isinstance(node, ast.Subscript):
        base = ast.unparse(node.value).split(".")[-1]
        args = list(node.slice.elts) if isinstance(node.slice, ast.Tuple) else [node.slice]
        if base == "Literal":
            sentinel = object()
            values = [literal(a, sentinel) for a in args]
            if sentinel not in values:
                return {"enum": values}, True
        if base in {"Optional", "Union"}:
            schemas = [type_schema(a, models, seen) for a in args]
            variants = [s for s, _ in schemas]
            if base == "Optional":
                variants.append({"type": "null"})
            return {"anyOf": variants}, all(ok for _, ok in schemas)
        if base == "Annotated":
            schema, _ = type_schema(args[0], models, seen)
            return schema, False  # Constraints carried in annotation metadata are not interpreted.
        if base in {"list", "List", "Sequence"}:
            schema, ok = type_schema(args[0], models, seen)
            return {"type": "array", "items": schema}, ok
        if base in {"dict", "Dict", "Mapping"} and len(args) == 2:
            schema, ok = type_schema(args[1], models, seen)
            return {"type": "object", "additionalProperties": schema}, ok and ast.unparse(args[0]) == "str"
    return {}, False


def function_schema(node, models: dict) -> tuple[dict, bool]:
    positional = node.args.posonlyargs + node.args.args
    defaults = [None] * (len(positional) - len(node.args.defaults)) + list(node.args.defaults)
    arguments = list(zip(positional, defaults)) + list(zip(node.args.kwonlyargs, node.args.kw_defaults))
    props, required = {}, []
    complete = not (node.args.vararg or node.args.kwarg or node.args.posonlyargs)
    for arg, default in arguments:
        if arg.arg in {"self", "cls"}:
            complete = False
            continue
        annotation = ast.unparse(arg.annotation) if arg.annotation else ""
        if annotation.split("[")[0].split(".")[-1] == "Context":
            continue  # FastMCP injects context; it is not a model input.
        schema, ok = type_schema(arg.annotation, models)
        complete &= ok
        if default is None:
            required.append(arg.arg)
        else:
            sentinel = object()
            value = literal(default, sentinel)
            if value is sentinel:
                complete = False
            else:
                try:
                    json.dumps(value, allow_nan=False)
                    schema["default"] = value
                except (ValueError, TypeError):
                    complete = False
        props[arg.arg] = schema
    return {"type": "object", "properties": props, "required": required}, bool(complete)


def analyze_files(files: dict[str, str], source: dict, agent_name: str | None = None,
                  coverage: dict | None = None, server_url: str | None = None) -> dict:
    """Analyze an in-memory snapshot; a stable API for the future HireMe importer."""
    agent_id = slug(agent_name or source.get("repo", "agent"))
    resources, prompts, tools, connections, review = [], [], [], [], []
    frameworks, entrypoints, secrets = set(), [], set()
    commit = source.get("commit", "unknown")
    repository = source.get("repository", "")
    scope = source.get("path", "")

    def provenance(path, line=None):
        result = {"path": path, "url": f"{repository}/blob/{quote(commit, safe='')}/{quote(path, safe='/')}"}
        if line is not None:
            result["line"] = line
            result["url"] += f"#L{line}"
        return result

    def resource(path, text, kind, line=None):
        key = path + (f":{line}" if line else "")
        uri = f"github-agent://{quote(source.get('owner', 'unknown'))}/{quote(source.get('repo', 'agent'))}/{commit}/{quote(path, safe='/')}"
        if line:
            uri += f"#L{line}"
        item = {"name": slug(key)[:90] + "_" + hashlib.sha256(key.encode()).hexdigest()[:8],
                          "uri": uri, "mimeType": "text/plain" if line else
                          ("text/markdown" if path.endswith(".md") else "text/html" if path.endswith(".html") else "text/plain"),
                "kind": kind, "text": text, "source": provenance(path, line)}
        resources.append(item)
        return item

    def add_tool(name, description, schema, path, line=None, binding=None, complete=True, output=None):
        if not isinstance(name, str) or not name or not isinstance(schema, dict) or schema.get("type") != "object":
            review.append({"path": path, "reason": "invalid_tool_definition"})
            return
        try:
            Draft202012Validator.check_schema(schema)
            if output is not None:
                if not isinstance(output, dict) or output.get("type") != "object":
                    raise ValueError("MCP output schema must be an object")
                Draft202012Validator.check_schema(output)
        except (SchemaError, ValueError):
            review.append({"path": path, "reason": "invalid_tool_schema"})
            return
        if description is not None and not isinstance(description, str):
            review.append({"path": path, "reason": "invalid_tool_description"})
            return
        tool = {"name": slug(name)[:100], "originalName": name, "description": description or name,
                "inputSchema": schema, "schemaStatus": "draft" if complete else "needs_review",
                "status": "needs_adapter", "source": provenance(path, line), "binding": binding or {"kind": "unresolved"}}
        if output is not None:
            tool["outputSchema"] = output
        tools.append(tool)

    for path, text in sorted(files.items()):
        if file_priority(path) >= 100:
            continue
        p = PurePosixPath(path)
        name = p.name.lower()
        secrets.update(re.findall(r'(?:getenv|environ\.get)\(\s*[\'"]([A-Z][A-Z0-9_]*)[\'"]', text))
        secrets.update(re.findall(r'environ\[\s*[\'"]([A-Z][A-Z0-9_]*)[\'"]\s*\]', text))
        if name == ".env.example":
            secrets.update(re.findall(r"^\s*([A-Z][A-Z0-9_]*)\s*=", text, re.M))
            continue  # Only names, never example credential values.
        if name in {"requirements.txt", "pyproject.toml"}:
            for framework in ("langchain", "langgraph", "crewai", "autogen", "fastmcp"):
                if framework in text.lower():
                    frameworks.add(framework)
        if p.suffix in {".md", ".txt", ".j2", ".jinja2", ".yaml", ".yml"} or (p.suffix == ".html" and "templates" in p.parts):
            kind = "instructions" if name in {"agents.md", "agent.md", "instructions.md"} else (
                "skill" if name == "skill.md" or "skills" in p.parts else (
                    "prompt" if "prompts" in p.parts or "prompt" in name else "reference"))
            resource(path, text, kind)
            if kind == "prompt":
                prompts.append({"name": slug(path), "source": provenance(path), "template": text,
                                "status": "needs_adapter"})
        if p.suffix == ".json":
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                review.append({"path": path, "reason": "invalid_json"})
                continue
            if isinstance(data, dict):
                servers = data.get("mcpServers", {})
                if isinstance(servers, dict):
                    for server_name, config in servers.items():
                        if not isinstance(config, dict):
                            review.append({"path": path, "reason": "invalid_mcp_connection"})
                            continue
                        env = config.get("env", {})
                        env_keys = sorted(env) if isinstance(env, dict) else []
                        secrets.update(env_keys)
                        connections.append({"name": server_name, "transport": "stdio" if "command" in config else "http",
                                            "command": config.get("command"), "args": config.get("args", []),
                                            "url": config.get("url"), "environmentKeys": env_keys,
                                            "source": provenance(path), "status": "needs_tool_discovery"})
                if name == "langgraph.json" and isinstance(data.get("graphs"), dict):
                    frameworks.add("langgraph")
                    entrypoints.extend({"name": key, "target": value, "source": provenance(path)}
                                       for key, value in data["graphs"].items())
                definitions = data.get("tools", [])
                if "name" in data and ("inputSchema" in data or "parameters" in data):
                    definitions = [data]
            elif isinstance(data, list):
                definitions = data
            else:
                definitions = []
            for definition in definitions if isinstance(definitions, list) else []:
                if not isinstance(definition, dict):
                    review.append({"path": path, "reason": "invalid_tool_definition"})
                    continue
                definition = definition.get("function", definition)
                if not isinstance(definition, dict):
                    continue
                if "name" in definition and ("inputSchema" in definition or "parameters" in definition):
                    add_tool(definition["name"], definition.get("description"),
                             definition.get("inputSchema", definition.get("parameters")), path,
                             binding=definition.get("binding"), output=definition.get("outputSchema"))
            if "prompts" in p.parts or "prompt" in name:
                resource(path, text, "prompt")
            elif any(part in {"data", "knowledge", "references"} for part in p.parts):
                resource(path, text, "reference")
        if p.suffix != ".py":
            continue
        try:
            tree = ast.parse(text)
        except SyntaxError:
            review.append({"path": path, "reason": "python_parse_error"})
            continue
        models = {n.name: n for n in tree.body if isinstance(n, ast.ClassDef)
                  and any(ast.unparse(b).split(".")[-1] in {"BaseModel", "TypedDict"} for b in n.bases)}
        parents = {child: parent for parent in ast.walk(tree) for child in ast.iter_child_nodes(parent)}
        module_path = path.removeprefix(scope + "/") if scope else path
        module = module_path.removesuffix(".py").replace("/", ".")
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                imported = node.module if isinstance(node, ast.ImportFrom) else " ".join(a.name for a in node.names)
                for framework in ("langchain", "langgraph", "crewai", "autogen", "fastmcp"):
                    if framework in (imported or ""):
                        frameworks.add(framework)
                if (imported or "").startswith("mcp.server."):
                    frameworks.add("mcp")
            if isinstance(node, (ast.Assign, ast.AnnAssign)):
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                for target in targets:
                    if isinstance(target, ast.Name) and any(key in target.id.upper() for key in ("PROMPT", "INSTRUCTION")):
                        value = literal(node.value)
                        if isinstance(value, str):
                            resource(path, value, "prompt", node.lineno)
                            prompts.append({"name": slug(path + "_" + target.id), "template": value,
                                            "source": provenance(path, node.lineno), "status": "needs_adapter"})
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for decorator in node.decorator_list:
                call = decorator if isinstance(decorator, ast.Call) else None
                target = call.func if call else decorator
                marker = ast.unparse(target).split(".")[-1]
                if marker not in {"tool", "prompt", "resource"}:
                    continue
                kwargs = {k.arg: k.value for k in call.keywords if k.arg} if call else {}
                declared_name = literal(kwargs.get("name"), node.name)
                if marker == "tool" and call and call.args:
                    declared_name = literal(call.args[0], declared_name)
                description = literal(kwargs.get("description"), ast.get_docstring(node) or node.name)
                schema, complete = function_schema(node, models)
                if "args_schema" in kwargs:
                    schema, complete = type_schema(kwargs["args_schema"], models)
                # Additional decorator behavior may change the signature or schema.
                if any(k not in {"name", "description", "title"} for k in kwargs):
                    complete = False
                binding = {"kind": "python_function", "module": module, "callable": node.name,
                           "async": isinstance(node, ast.AsyncFunctionDef)}
                ancestors, parent = [], parents.get(node)
                while parent is not None:
                    if isinstance(parent, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                        ancestors.append(parent)
                    parent = parents.get(parent)
                if ancestors:
                    binding["callable"] = ".".join([a.name for a in reversed(ancestors)] + [node.name])
                    binding["kind"] = "unresolved_python_member"
                    complete = False
                if "name" in kwargs and literal(kwargs["name"]) is None:
                    complete = False
                if marker == "tool":
                    add_tool(declared_name, description, schema, path, node.lineno, binding, complete)
                else:
                    snippet = ast.get_source_segment(text, node) or ""
                    item = resource(path, snippet, marker + "_definition", node.lineno)
                    item.update({"binding": binding, "decorator": ast.unparse(decorator), "status": "needs_adapter"})
                    if marker == "resource" and call and call.args:
                        item["originalUri"] = literal(call.args[0])
                    if marker == "prompt":
                        prompts.append({"name": slug(str(declared_name)), "description": description,
                                        "arguments": [{"name": key, "required": key in schema["required"]}
                                                      for key in schema["properties"]],
                                        "source": provenance(path, node.lineno), "binding": binding,
                                        "status": "needs_adapter"})
                    review.append({"path": path, "line": node.lineno, "reason": "dynamic_content_needs_adapter"})
                break

    # Multiple files can define the same tool. Preserve every candidate with a stable unique name.
    used = set()
    for tool in tools:
        base = tool["name"]
        if base in used:
            suffix = hashlib.sha256(json.dumps(tool["source"], sort_keys=True).encode()).hexdigest()[:8]
            tool["name"] = base + "_" + suffix
        candidate, count = tool["name"], 2
        while tool["name"] in used:
            tool["name"] = f"{candidate}_{count}"
            count += 1
        used.add(tool["name"])
        if tool["schemaStatus"] == "needs_review":
            review.append({**tool["source"], "reason": "input_schema_needs_review"})
    if not tools:
        review.append({"reason": "no_explicit_tools_found"})
    coverage = coverage or {"scannedFiles": len(files), "skippedFiles": [], "treeTruncated": False, "complete": True}
    if not coverage["complete"]:
        review.append({"reason": "partial_repository_analysis"})
    contents = {"resources": resources, "prompts": prompts}
    manifest = {"schemaVersion": "0.1", "agentName": agent_name or source.get("repo", "agent"),
                "agentId": agent_id, "serverName": f"{agent_id}_mcp", "source": source,
                "status": "analyzed", "runtime": {"frameworks": sorted(frameworks), "entrypoints": entrypoints},
                "requiredEnvironment": sorted(secrets), "mcpConnections": connections,
                "configurationFiles": [provenance(path) for path in sorted(files)
                                       if PurePosixPath(path).name.lower() in CONFIG_NAMES],
                "interface": {"contents": "contents.json", "tools": "tools.json"},
                "coverage": coverage, "review": review,
                "summary": {"resources": len(resources), "prompts": len(prompts), "tools": len(tools)}}
    if server_url:
        manifest["declaredServerUrl"] = server_url
    return {"manifest": manifest, "contents": contents, "tools": tools}
