#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { htmlToPdfTool, htmlCheckTool } from "/Users/rafe/other/lobs/agentic/packages/tools/dist/html-to-pdf.js";

const [, , mode = "pdf", paramsPath] = process.argv;

if (!paramsPath) {
  console.error("usage: render.mjs <pdf|check> <params.json>");
  process.exit(2);
}

const params = JSON.parse(await readFile(paramsPath, "utf8"));
const tool = mode === "check" ? htmlCheckTool : htmlToPdfTool;
const out = await tool.run(params, { cwd: process.cwd() });
console.log(typeof out === "string" ? out : JSON.stringify(out, null, 2));
process.exit(0);
