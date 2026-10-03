# MCSManager for macOS

Choose `arm64` for Apple Silicon or `x64` for an Intel Mac. Each architecture has a full package, a web-only package and a daemon-only package. The packages include the matching Node.js 20 runtime and macOS native tools. No separate Node.js or npm installation is required.

Extract the archive, open Terminal in the `mcsmanager` directory, then start the daemon:

```sh
./start-daemon.sh
```

In another Terminal window, start the web panel:

```sh
./start-web.sh
```

Open <http://localhost:23333>. The daemon listens on port 24444 by default. Stop each service with Ctrl+C. A web-only package needs a separately running daemon; a daemon-only package needs a panel connected to it.

The launchers resolve their own directory, including paths with spaces, and use the packaged Node.js runtime. Accounts, node connections and instance data are stored under `web/data/` and `daemon/data/`. Back up both directories before upgrading and preserve their paired connection credentials.

macOS ordinary-process network metrics use the built-in `nettop`. See `INSTANCE_RESOURCE_METRICS.md` for sampling details and `CHANGELOG.md` for the application release notes.
