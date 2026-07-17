import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import { Command } from "commander";
import {
  getConfigPath,
  loadConfig,
  resolveCredentials,
  saveConfig,
} from "./config.js";
import { download, listRemote, ping } from "./ftp-client.js";
import { extractFtpUrl, parseFtpUrl } from "./url-parse.js";

export async function runCli(argv) {
  const program = new Command();

  program
    .name("ftp2claw")
    .alias("f2c")
    .description("FTP CLI for Jira issue log download (Agent-friendly)")
    .version("1.0.0");

  program
    .command("setup")
    .description("Save FTP credentials to ~/.config/ftp2claw/config.json")
    .option("--host <host>", "FTP host")
    .option("--user <user>", "FTP username")
    .option("--password <password>", "FTP password")
    .option("--port <port>", "FTP port", "21")
    .option("--secure", "Use explicit FTPS (default on)", true)
    .option("--insecure-tls", "Allow self-signed FTPS cert (default)", true)
    .option("--strict-tls", "Require trusted FTPS certificate", false)
    .action(async (opts) => {
      const cfg = await collectSetup(opts);
      const saved = saveConfig(cfg);
      console.log(chalk.green(`Saved config: ${getConfigPath()}`));
      console.log(
        `host=${saved.host} user=${saved.user} port=${saved.port} secure=${saved.secure}`,
      );
      try {
        const result = await ping(resolveCredentials({}));
        console.log(chalk.green(`Ping OK, pwd=${result.pwd}`));
      } catch (err) {
        console.error(chalk.yellow(`Config saved but ping failed: ${err.message}`));
        process.exitCode = 3;
      }
    });

  program
    .command("ping")
    .description("Test FTP connectivity with current credentials")
    .option("--host <host>", "Override host")
    .option("--user <user>", "Override user")
    .option("--password <password>", "Override password")
    .option("--port <port>", "Override port")
    .action(async (opts) => {
      const creds = resolveCredentials(opts);
      const result = await ping(creds);
      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command("ls")
    .description("List a remote FTP directory")
    .argument("[remotePath]", "Remote path", "/")
    .option("--host <host>", "Override host")
    .option("--user <user>", "Override user")
    .option("--password <password>", "Override password")
    .option("--port <port>", "Override port")
    .option("-j, --json", "JSON output", false)
    .action(async (remotePath, opts) => {
      const creds = resolveCredentials(opts);
      const list = await listRemote(creds, remotePath);
      if (opts.json) {
        console.log(JSON.stringify(list, null, 2));
        return;
      }
      for (const item of list) {
        const mark = item.type === "dir" ? "d" : item.type === "link" ? "l" : "-";
        const size = String(item.size ?? "").padStart(12);
        console.log(`${mark} ${size}  ${item.name}`);
      }
    });

  program
    .command("get")
    .description("Download a remote file or directory")
    .argument("<remotePath>", "Remote file or directory path")
    .option("-o, --output <dir>", "Local output directory", process.cwd())
    .option("--host <host>", "Override host")
    .option("--user <user>", "Override user")
    .option("--password <password>", "Override password")
    .option("--port <port>", "Override port")
    .action(async (remotePath, opts) => {
      const creds = resolveCredentials(opts);
      const result = await download(creds, remotePath, opts.output);
      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command("get-url")
    .description(
      "Download from a full FTP URL (e.g. ftp://ftpuser@10.83.3.36/2_DevicelockX/DLX-215)",
    )
    .argument("<ftpUrl>", "FTP URL from Jira description")
    .option("-o, --output <dir>", "Local output directory", process.cwd())
    .option("--password <password>", "Override password if URL has none")
    .action(async (ftpUrl, opts) => {
      const parsed = parseFtpUrl(ftpUrl);
      const creds = resolveCredentials({
        host: parsed.host,
        user: parsed.user,
        password: parsed.password || opts.password,
        port: parsed.port,
        // Jira links are usually ftp:// but this lab server requires FTPS.
        // Only force secure when URL is ftps://; otherwise use config/default (true).
        secure: parsed.secure ? true : undefined,
      });
      const result = await download(creds, parsed.remotePath, opts.output);
      console.log(
        JSON.stringify(
          {
            url: parsed.href,
            ...result,
          },
          null,
          2,
        ),
      );
    });

  program
    .command("extract-url")
    .description("Extract the first ftp:// URL from text (stdin or --text)")
    .option("-t, --text <text>", "Input text containing an FTP URL")
    .option("-f, --file <path>", "Read text from file")
    .action(async (opts) => {
      let text = opts.text || "";
      if (opts.file) {
        text = fs.readFileSync(path.resolve(opts.file), "utf8");
      } else if (!text && !process.stdin.isTTY) {
        text = await readStdin();
      }
      const url = extractFtpUrl(text);
      if (!url) {
        console.error("No ftp:// URL found");
        process.exitCode = 4;
        return;
      }
      console.log(url);
    });

  program
    .command("config-path")
    .description("Print config file path")
    .action(() => {
      console.log(getConfigPath());
      const cfg = loadConfig();
      if (Object.keys(cfg).length) {
        console.error(
          chalk.dim(
            `(configured host=${cfg.host || "-"} user=${cfg.user || "-"}; password hidden)`,
          ),
        );
      }
    });

  await program.parseAsync(argv);
}

async function collectSetup(opts) {
  const current = loadConfig();
  const needPrompt = !opts.host || !opts.user || !opts.password;

  if (!needPrompt) {
    return {
      host: opts.host,
      user: opts.user,
      password: opts.password,
      port: Number(opts.port || 21),
      secure: opts.secure !== false,
      tlsStrict: Boolean(opts.strictTls),
    };
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      "Non-interactive setup requires --host --user --password (and optional --port)",
    );
  }

  const rl = readline.createInterface({ input, output });
  try {
    const host =
      opts.host ||
      (await rl.question(`FTP host [${current.host || "10.83.3.36"}]: `)) ||
      current.host ||
      "10.83.3.36";
    const user =
      opts.user ||
      (await rl.question(`FTP user [${current.user || "ftpuser"}]: `)) ||
      current.user ||
      "ftpuser";
    const password =
      opts.password ||
      (await rl.question("FTP password: ")) ||
      current.password;
    if (!password) {
      throw new Error("Password is required");
    }
    const portRaw =
      opts.port ||
      (await rl.question(`FTP port [${current.port || 21}]: `)) ||
      current.port ||
      21;
    return {
      host: host.trim(),
      user: user.trim(),
      password: String(password),
      port: Number(portRaw),
      secure: opts.secure !== false,
      tlsStrict: Boolean(opts.strictTls || current.tlsStrict),
    };
  } finally {
    rl.close();
  }
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}
