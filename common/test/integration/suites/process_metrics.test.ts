import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  world,
  saveState,
  requestPanel,
  ensureUser,
  ensureOwner,
  createStream,
  waitFor
} from "../lib";

const query = () => ({ daemonId: world.daemonId, uuid: world.instance.uuid! });
const owner = () => ({ cookie: world.u1.cookie!, token: world.u1.token! });
async function detail() {
  return (await requestPanel({ method: "GET", path: "/instance", ...owner(), query: query() }))
    .data;
}
async function operation(name: string) {
  const result = await requestPanel({
    method: "GET",
    path: `/protected_instance/${name}`,
    ...owner(),
    query: query()
  });
  expect(result.httpStatus).toBe(200);
}

describe("ordinary instance resource metrics over authenticated terminal streams", () => {
  it("samples CPU and memory including a real child process", async () => {
    world.u1.uuid = await ensureUser("u1", world.key);
    const cwd = path.join(world.workDir, "resource-fixture");
    fs.mkdirSync(cwd);
    // Keep the child allocation resident and busy while the parent remains idle.
    fs.writeFileSync(
      path.join(cwd, "metrics.cjs"),
      `
      const { spawn } = require('child_process');
      const child = spawn(process.execPath, ['-e', \`
        global.allocation = Buffer.alloc(96 * 1024 * 1024, 1);
        setInterval(() => { const until = Date.now() + 100; while (Date.now() < until) {} }, 200);
      \`], { stdio: 'ignore' });
      process.stdin.resume();
      process.stdin.on('data', () => { child.kill(); process.exit(); });
      process.on('exit', () => child.kill());
    `
    );
    const result = await requestPanel({
      method: "POST",
      path: "/instance",
      key: world.key,
      query: { daemonId: world.daemonId },
      body: {
        nickname: "resource-metrics",
        startCommand: `${process.execPath} metrics.cjs`,
        stopCommand: "exit",
        cwd,
        ie: "utf-8",
        oe: "utf-8"
      }
    });
    expect(result.httpStatus).toBe(200);
    world.instance.uuid = result.data.instanceUuid;
    saveState();
    await ensureOwner("u1", world.key);
    await operation("open");
    const channel = await requestPanel({
      method: "POST",
      path: "/protected_instance/stream_channel",
      ...owner(),
      query: query()
    });
    expect(channel.httpStatus).toBe(200);
    const stream = createStream(channel.data.addr, channel.data.prefix, channel.data.password);
    let info: any;
    stream.socket.on("stream/detail", (packet: any) => {
      info = packet.data?.info;
    });
    try {
      expect(await stream.ready).toBe(true);
      await waitFor(
        async () => {
          stream.socket.emit("stream/detail", {});
          return (
            Number.isFinite(info?.cpuUsage) &&
            info.cpuUsage > 0 &&
            info.memoryUsage > 96 * 1024 * 1024
          );
        },
        { timeout: 25000, interval: 1000, msg: "terminal child CPU and resident memory metrics" }
      );
      expect(info.cpuUsage).toBeGreaterThan(0);
      expect(info.memoryUsage).toBeGreaterThan(96 * 1024 * 1024);
      for (const field of ["rxRate", "txRate"]) {
        if (info[field] != null)
          expect(Number.isFinite(info[field]) && info[field] >= 0).toBe(true);
      }
    } finally {
      stream.disconnect();
    }
  });

  it("clears metrics after stop and samples again after restart", async () => {
    await operation("stop");
    await waitFor(async () => (await detail()).status === 0, {
      timeout: 20000,
      msg: "instance stopped"
    });
    expect((await detail()).info?.cpuUsage).toBeUndefined();
    expect((await detail()).info?.memoryUsage).toBeUndefined();
    await operation("open");
    await waitFor(async () => (await detail()).info?.memoryUsage > 96 * 1024 * 1024, {
      timeout: 25000,
      interval: 1000,
      msg: "metrics after restart"
    });
    await operation("stop");
    await waitFor(async () => (await detail()).status === 0, {
      timeout: 20000,
      msg: "fixture cleanup"
    });
  });
});
