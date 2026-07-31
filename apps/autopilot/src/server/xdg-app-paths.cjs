// @ts-nocheck -- CommonJS compatibility shim for an upstream build-time helper.
"use strict";

const os = require("os");
const path = require("path");

function createPaths(options = {}) {
  if (typeof options !== "object") options = { name: options };
  const name = options.name || "node";
  const isolated = options.isolated ?? true;
  const suffix = options.suffix || "";
  const appName = `${name}${suffix}`;

  const resolvePath = (base, requested) =>
    path.join(base, (requested?.isolated ?? isolated) ? appName : "");
  const api = (nextOptions) => createPaths(nextOptions);
  api.$name = () => appName;
  api.$isolated = () => isolated;
  api.cache = (requested) =>
    resolvePath(
      process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"),
      requested,
    );
  api.config = (requested) =>
    resolvePath(
      process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
      requested,
    );
  api.data = (requested) =>
    resolvePath(
      process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"),
      requested,
    );
  api.state = (requested) =>
    resolvePath(
      process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state"),
      requested,
    );
  api.runtime = (requested) =>
    process.env.XDG_RUNTIME_DIR
      ? resolvePath(process.env.XDG_RUNTIME_DIR, requested)
      : undefined;
  api.configDirs = (requested) => [api.config(requested)];
  api.dataDirs = (requested) => [api.data(requested)];
  return api;
}

module.exports = createPaths();
