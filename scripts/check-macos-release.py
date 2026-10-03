#!/usr/bin/env python3
"""Validate release layout, architecture, executable modes and split packages."""

import pathlib
import struct
import sys
import tarfile

output = pathlib.Path(sys.argv[1])
for arch, cpu_type in [("arm64", 0x0100000C), ("x64", 0x01000007)]:
    for variant, components in [
        ("", {"web", "daemon"}),
        ("_web_only", {"web"}),
        ("_daemon_only", {"daemon"}),
    ]:
        archive = output / f"mcsmanager_macos_{arch}{variant}_release.tar.gz"
        with tarfile.open(archive) as package:
            entries = {entry.name.rstrip("/"): entry for entry in package.getmembers()}
            assert not any("/data/" in name or "/node_modules/" in name for name in entries)
            for name in ["LICENSE", "CHANGELOG.md", "README.md", "INSTANCE_RESOURCE_METRICS.md", "runtime/LICENSE"]:
                assert f"mcsmanager/{name}" in entries, (archive, name)
            executables = ["runtime/bin/node"]
            for component in ["web", "daemon"]:
                assert (f"mcsmanager/{component}/app.js" in entries) == (component in components)
                assert (f"mcsmanager/start-{component}.sh" in entries) == (component in components)
                if component in components:
                    executables.append(f"start-{component}.sh")
            if "web" in components:
                assert "mcsmanager/web/public/index.html" in entries
            binaries = ["runtime/bin/node"]
            if "daemon" in components:
                binaries += [f"daemon/lib/{name}_darwin_{arch}" for name in ["pty", "file_zip", "7z"]]
                executables += binaries[1:]
                assert not any("_linux_" in name or "_win32_" in name for name in entries)
            for name in executables:
                assert entries[f"mcsmanager/{name}"].mode & 0o111, (archive, name)
            for name in binaries:
                binary = package.extractfile(f"mcsmanager/{name}")
                header = binary.read(8)
                magic, actual_cpu = struct.unpack("<II", header)
                fat_magic, count = struct.unpack(">II", header)
                if fat_magic in {0xCAFEBABE, 0xCAFEBABF}:
                    # 7-Zip ships a universal Mach-O binary containing both CPUs.
                    assert 0 < count <= 64, (archive, name, count)
                    stride = 20 if fat_magic == 0xCAFEBABE else 32
                    cpu_types = [struct.unpack(">I", binary.read(stride)[:4])[0] for _ in range(count)]
                    assert cpu_type in cpu_types, (archive, name, cpu_types)
                else:
                    assert magic == 0xFEEDFACF and actual_cpu == cpu_type, (archive, name, header)
        print(f"Verified {archive.name}")
