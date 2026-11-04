"""Parent-side Realm AI source staging. Never run inside the offline engine worker."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess

REPOSITORY = 'https://github.com/timmytwopointoh/New-game-.git'
PINS = {
    'baseline-v0412': 'bd28ffed188ebf2115b64817a5e61f019b4787f0',
    'diagnostics-v0419': '384199be7c6b9a1b00acbff857eb5718ef69a31f',
}
MARKER = '.realm-ai-staging.json'
PATTERNS = ('/AGENTS.md', '/ecosystem/', '/docs/VQ_CROSS_REPO_HANDOFF.md',
            '/realm-ai-phone-build/realm-ai-live-v021-overlay/',
            '/realm-ai-phone-build/fix_bedrock_12660_schema.py')


def inspect_tools():
    names = ('git', 'node', 'npm', 'java', 'javac', 'gradle', 'adb', 'emulator')
    return {'on_path': {n: bool(shutil.which(n)) for n in names},
            'sdk_environment_configured': any(bool(os.environ.get(n)) for n in ('ANDROID_HOME', 'ANDROID_SDK_ROOT')),
            'off_path_tools': 'not searched', 'signer': 'unverified',
            'phone_access': 'not requested', 'dependencies_staged': False}


def checked_git(directory, *args):
    environment = dict(os.environ, GIT_TERMINAL_PROMPT='0')
    result = subprocess.run(['git', '-C', str(directory), *args], env=environment,
                            text=True, capture_output=True, timeout=300)
    if result.returncode:
        # Keep Git's potentially credential-bearing error details local.
        raise RuntimeError('Git operation failed: ' + args[0] + '; inspect the local Git setup. No credentials were logged.')
    return result.stdout.strip()


def validate_root(root):
    original = Path(root).expanduser().absolute()
    if original.is_symlink():
        raise RuntimeError('Use a dedicated real directory, not a symlink.')
    root = original.resolve()
    if root == Path(root.anchor) or root == Path.home().resolve():
        raise RuntimeError('Use a dedicated empty Realm AI directory, not a drive or home root.')
    for parent in (root, *root.parents):
        if (parent / '.git').exists():
            raise RuntimeError('Keep Realm AI staging outside all existing Git checkouts, including the engine.')
    marker = root / MARKER
    if root.exists() and any(root.iterdir()):
        if not marker.is_file():
            raise RuntimeError('Existing nonempty directory is not a managed Realm AI staging workspace.')
        if marker.stat().st_size > 4096:
            raise RuntimeError('Invalid workspace marker.')
        saved = json.loads(marker.read_text(encoding='utf-8'))
        if saved != {'schema': 1, 'repository': REPOSITORY, 'pins': PINS}:
            raise RuntimeError('Workspace marker does not match the pinned Realm sources; nothing was changed.')
        if any(p.name not in {*PINS, MARKER} for p in root.iterdir()):
            raise RuntimeError('Workspace contains files outside the managed staging set; nothing was changed.')
    return root


def stage_sources(root):
    root = validate_root(root)
    if not shutil.which('git'):
        raise RuntimeError('Parent-side Git must already be available; this helper does not install it.')
    root.mkdir(parents=True, exist_ok=True)
    (root / MARKER).write_text(json.dumps({'schema': 1, 'repository': REPOSITORY, 'pins': PINS}, indent=2), encoding='utf-8')
    staged = {}
    for label, revision in PINS.items():
        directory = root / label
        if directory.is_symlink():
            raise RuntimeError('Managed checkout must not be a symlink.')
        if directory.exists() and not (directory / '.git').is_dir():
            raise RuntimeError('Existing checkout directory is not a managed Git repository.')
        directory.mkdir(exist_ok=True)
        if not (directory / '.git').is_dir():
            checked_git(directory, 'init')
            checked_git(directory, 'remote', 'add', 'origin', REPOSITORY)
        if checked_git(directory, 'remote', 'get-url', 'origin') != REPOSITORY:
            raise RuntimeError('Unexpected source remote; no fetch or overwrite attempted.')
        if checked_git(directory, 'status', '--porcelain'):
            raise RuntimeError('Local edits detected; no reset, cleanup or overwrite attempted.')
        info = subprocess.run(['git', '-C', str(directory), 'rev-parse', '--verify', 'HEAD'], text=True, capture_output=True)
        if info.returncode == 0:
            if info.stdout.strip() != revision:
                raise RuntimeError('Existing checkout is at a different revision; no reset attempted.')
        else:
            checked_git(directory, 'config', 'core.sparseCheckout', 'true')
            (directory / '.git' / 'info' / 'sparse-checkout').write_text('\n'.join(PATTERNS) + '\n', encoding='utf-8')
            checked_git(directory, 'fetch', '--depth=1', '--filter=blob:none', 'origin', revision)
            checked_git(directory, 'checkout', '--detach', revision)
        if checked_git(directory, 'rev-parse', 'HEAD') != revision:
            raise RuntimeError('Pinned commit verification failed.')
        if not (directory / 'realm-ai-phone-build' / 'realm-ai-live-v021-overlay' / 'bedrock-agent' / 'package-lock.json').is_file():
            raise RuntimeError('Pinned Realm source tree is incomplete.')
        staged[label] = revision
    return {'source_staged': staged, 'tooling': inspect_tools(),
            'next': 'Parent must stage pinned dependencies/native runtime and existing SDK/signing selectors, then bind a Realm-only worker/verifier. No app was built, installed or joined.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', required=True, type=Path, help='Dedicated owner-approved empty directory OUTSIDE the engine checkout')
    parser.add_argument('--stage-source', action='store_true', help='Explicitly fetch the two pinned app source trees; otherwise inspect only')
    args = parser.parse_args()
    try:
        root = validate_root(args.workspace)
        result = stage_sources(root) if args.stage_source else {'mode': 'inspect-only', 'tooling': inspect_tools(), 'pins': PINS, 'writes': False}
        print(json.dumps(result, indent=2))
        return 0
    except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
        print(json.dumps({'status': 'blocked', 'reason': str(error)}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
