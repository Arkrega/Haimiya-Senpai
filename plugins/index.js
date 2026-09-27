import chalk from "chalk";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const plugins = new Map();
const pluginTracker = new Map();

const log = {
  success: chalk.green("OK"),
  error: chalk.red("ERR"),
  info: chalk.blue("INFO"),
};

let error = false;

function getAllPlugins(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllPlugins(fullPath, arrayOfFiles);
    } else {
      if (file.endsWith(".plugin.js")) {
        arrayOfFiles.push(fullPath);
      }
    }
  });
  return arrayOfFiles;
}

async function loadPlugin(filePath) {
  const relativePath = path.relative(__dirname, filePath).replace(/\\/g, "/");
  const fileUrl = `${pathToFileURL(filePath).href}?t=${Date.now()}`;

  try {
    const start = performance.now();
    const module = await import(fileUrl);
    const plugin = module.default;

    if (plugin && plugin.command) {
      const commands = Array.isArray(plugin.command)
        ? plugin.command
        : [plugin.command];

      if (pluginTracker.has(relativePath)) {
        const oldCommands = pluginTracker.get(relativePath);
        oldCommands.forEach((cmd) => plugins.delete(cmd.toLowerCase()));
      }

      commands.forEach((cmd) => {
        plugins.set(cmd.toLowerCase(), plugin);
      });

      pluginTracker.set(relativePath, commands);

      const ms = (performance.now() - start).toFixed(0);
      console.log(
        log.success,
        `Berhasil memuat: ${plugin.name || relativePath} (${ms}ms)`
      );
    }
  } catch (err) {
    console.error(
      log.error,
      `Gagal memuat ${relativePath}:`,
      chalk.yellow(err.message)
    );
    error = true;
  }
}

export async function loadPlugins() {
  const allFiles = getAllPlugins(__dirname);
  await Promise.all(allFiles.map(loadPlugin));
  if (!error) console.clear();
}

const watchTimers = new Map();

function watchPluginsDir() {
  try {
    fs.watch(__dirname, { persistent: true, recursive: true }, (eventType, filename) => {
      if (filename && filename.endsWith(".plugin.js")) {
        const relativePath = filename.replace(/\\/g, "/");
        const absolutePath = path.join(__dirname, relativePath);

        if (watchTimers.has(relativePath)) clearTimeout(watchTimers.get(relativePath));

        watchTimers.set(
          relativePath,
          setTimeout(async () => {
            if (!fs.existsSync(absolutePath)) {
              if (pluginTracker.has(relativePath)) {
                const cmds = pluginTracker.get(relativePath);
                cmds.forEach((cmd) => plugins.delete(cmd.toLowerCase()));
                pluginTracker.delete(relativePath);
                console.log(
                  log.info,
                  `Plugin dihapus dari memory: ${relativePath}`
                );
              }
              return;
            }

            console.log(
              log.info,
              `Perubahan terdeteksi pada ${chalk.yellow(relativePath)}, memuat ulang...`
            );
            await loadPlugin(absolutePath);
          }, 100)
        );
      }
    });
  } catch (err) {
    console.warn(chalk.yellow("Gagal memulai file watcher:"), err.message);
  }
}

watchPluginsDir();

export { plugins, pluginTracker };