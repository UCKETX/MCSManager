# Production Build and Deployment

This document has been consolidated into an **in-repo Agent Skill** (it travels with the repository and is shared by all AI tools that support the standard). The **single source of truth** is:

→ [`.agents/skills/mcsmanager-build/SKILL.md`](../.agents/skills/mcsmanager-build/SKILL.md)

It covers: a walkthrough of the `build.bat` / `build.sh` pipeline (`BUNDLE=1`), artifact layout, `daemon/lib` external binaries, build/deploy/run commands, paired data migration, the sensitive-file list, the post-deploy verification checklist, and the FAQ.

When you say keywords such as "Build / Compile / Package / Deploy to Production / Build", AI tools that support Agent Skills (including opencode, Claude Code, etc.) will automatically invoke the `mcsmanager-build` skill; you can also read the file above directly. opencode auto-discovers `.agents/skills/` along the project (no extra configuration needed).

## macOS release packages

The Release Build workflow adds six macOS archives after the Linux/Windows build completes: full, web-only and daemon-only packages for both `arm64` (Apple Silicon) and `x64` (Intel). Each includes the appropriate Node.js 20 runtime, launchers and macOS native tools. The JavaScript and frontend assets are reused from the **same release's** full Linux archive.

To add Mac packages to an existing release, run `.github/workflows/release.yml` with `workflow_dispatch` and set `release_tag` to that release's tag. This path uploads only the Mac assets and does not rebuild Linux/Windows packages. The target release must already contain `mcsmanager_linux_release.tar.gz`.

`scripts/package-macos-release.sh <linux-release.tar.gz> <output-directory>` assembles the packages; `python3 scripts/check-macos-release.py <output-directory>` checks all six archives. Node.js downloads are verified against its official SHA-256 list. The Intel Zip-Tools artifact is renamed from `file_zip_darwin_amd64` to the `file_zip_darwin_x64` filename expected by the daemon.

After extraction, run `./start-daemon.sh` and `./start-web.sh` in separate terminals. The scripts use the embedded runtime and select their own working directories. See `prod-scripts/macos/README.md` for usage and upgrade notes.
