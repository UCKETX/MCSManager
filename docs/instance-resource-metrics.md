# Instance resource metrics

The terminal displays instance CPU, resident memory, upload/download speed and observed traffic totals while the instance is running. Samples refresh every four seconds. Ordinary processes include the main process and its current descendants, so a shell or MCDR launcher includes its game server. CPU uses 100% per logical core; memory is the sum of process RSS, not host memory usage. Shared resident pages can be counted by multiple processes.

Docker instances retain the existing container statistics collector. Ordinary Linux processes use `ps` and `pidusage` for CPU/memory, and an optional NetHogs collector for network traffic. The daemon runs one shared NetHogs process with fixed arguments, without a shell, and only publishes counters belonging to each instance's process tree. It releases the collector when the last monitored process instance stops. No host-level network counters are substituted.

## Linux network prerequisite

Install a NetHogs release supporting `-C` (TCP and UDP capture), for example through the distribution package manager:

```sh
sudo apt install nethogs
nethogs -h
```

The daemon account must have packet capture and process attribution permissions. NetHogs documents the required capabilities in its [official README](https://github.com/raboof/nethogs#running-without-root). MCSManager does not invoke sudo, alter capabilities, or install system tools automatically. If the tool is missing, too old, or lacks permissions, CPU and memory remain available and network values display a dash with an explanatory tooltip. Collector failures log once and retry after one minute.

Network totals begin at the first sample of each run. Packet attribution and periodic process discovery can miss short-lived children and traffic before monitoring starts. NetHogs uses active non-loopback interfaces by default. Unknown/unattributed packets are excluded. macOS uses the built-in `nettop` process counters; Windows ordinary-process network statistics are unavailable. Container statistics depend on the Docker network mode.

The collector rejects overlapping samples, bounds command output and process-tree size, and discards responses from stopped/restarted instances. It reuses the existing authenticated instance detail/terminal channels.
