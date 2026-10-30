#!/usr/bin/env python3
"""Package one clean, committed Pro source tree. Does not deploy or connect to a DB."""
from pathlib import Path, PurePosixPath
import argparse, hashlib, io, json, os, subprocess, tarfile

REPOSITORY = "https://github.com/hecvaz09/onerack-pro.git"

def git(repo, *args):
    return subprocess.check_output(["git", "-C", str(repo), *args])

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    if git(repo, "status", "--porcelain").strip():
        raise SystemExit("Refusing snapshot: commit the reviewed changes first.")
    origin = git(repo, "config", "--get", "remote.origin.url").decode().strip()
    if origin.removesuffix(".git") not in [REPOSITORY.removesuffix(".git"), "git@github.com:hecvaz09/onerack-pro"]:
        raise SystemExit("Refusing snapshot: origin is not the OneRack Pro repository.")
    commit = git(repo, "rev-parse", "HEAD").decode().strip()
    archive = git(repo, "archive", "--format=tar", commit)
    hashes = {}
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:") as source:
        for member in source.getmembers():
            name = PurePosixPath(member.name)
            if member.isdir():
                continue
            if not member.isfile() or name.is_absolute() or ".." in name.parts:
                raise SystemExit("Refusing unsafe archive entry.")
            if any(p in [".git", "node_modules", ".next", ".research-cache", "recovery"] for p in name.parts):
                raise SystemExit("Refusing generated/private archive input.")
            if any(p.startswith(".env") and p != ".env.example" for p in name.parts):
                raise SystemExit("Refusing environment credentials in archive.")
            if name.suffix.lower() in [".pem", ".key", ".pfx", ".p12", ".dump", ".db", ".sqlite"]:
                raise SystemExit("Refusing private key/database archive input.")
            hashes[str(name)] = hashlib.sha256(source.extractfile(member).read()).hexdigest()
    output = args.output.expanduser().resolve()
    if output == repo or output.is_relative_to(repo):
        raise SystemExit("Output must be outside the Git checkout.")
    if output.exists():
        raise SystemExit("Output already exists; preserve prior release artifacts.")
    os.umask(0o077)
    output.mkdir(parents=True, mode=0o700)
    path = output / ("onerack-pro-" + commit[:12] + ".tar")
    path.write_bytes(archive)
    manifest = {"repository": REPOSITORY, "commit": commit, "files": hashes,
                "archive": path.name, "archiveSha256": hashlib.sha256(archive).hexdigest(),
                "containsDatabaseBackup": False, "deployed": False}
    (output / "source-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"commit": commit, "files": len(hashes), "archiveSha256": manifest["archiveSha256"], "deployed": False}))

if __name__ == "__main__":
    main()
