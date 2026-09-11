const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const packagesRoot = path.resolve(projectRoot, "../../packages");

const config = getDefaultConfig(projectRoot);

// The workspace's node_modules/@ocean/* symlinks resolve to a path with
// inconsistent casing (SISTEMAS/fluxo vs. the real SISTEMAS/Fluxo), which
// breaks Metro's case-sensitive watch-folder checks on Windows. Bypass the
// symlinks by pointing Metro straight at each package's real directory.
config.resolver.extraNodeModules = Object.fromEntries(
  fs
    .readdirSync(packagesRoot)
    .map((dir) => {
      const pkgJsonPath = path.join(packagesRoot, dir, "package.json");
      if (!fs.existsSync(pkgJsonPath)) return null;
      const { name } = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
      return [name, path.join(packagesRoot, dir)];
    })
    .filter(Boolean),
);

module.exports = config;
