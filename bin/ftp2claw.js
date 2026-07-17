#!/usr/bin/env node
import { runCli } from "../src/cli.js";

runCli(process.argv).catch((err) => {
  const message = err?.message || String(err);
  console.error(message);
  process.exit(err?.exitCode || 1);
});
