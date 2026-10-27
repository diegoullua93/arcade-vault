// Hook PostToolUse (Edit|Write): pasa por Prettier los archivos React (.tsx, .jsx) y Markdown (.md),
// y además por ESLint --fix los React. Los errores de lint que no se puedan arreglar se devuelven
// a Claude por stderr (exit 2) para que los corrija.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const REACT = new Set([".tsx", ".jsx"]);
const MARKDOWN = new Set([".md"]);
const IGNORED_DIRS = ["node_modules", ".next", ".claude"];

let input = "";
for await (const chunk of process.stdin) input += chunk;

let file;
try {
  const payload = JSON.parse(input);
  file = payload.tool_response?.filePath ?? payload.tool_input?.file_path;
} catch {
  process.exit(0);
}
if (typeof file !== "string") process.exit(0);

const root = path.resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
const abs = path.resolve(file);
const rel = path.relative(root, abs);
const ext = path.extname(abs).toLowerCase();

const insideProject = rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
const ignored = rel.split(path.sep).some((part) => IGNORED_DIRS.includes(part));
const supported = REACT.has(ext) || MARKDOWN.has(ext);
if (!insideProject || ignored || !supported || !existsSync(abs)) process.exit(0);

// Un solo string con la ruta entre comillas: sirve en cmd y en bash, y admite espacios en la ruta.
const run = (cmd) => spawnSync(`npx --no-install ${cmd}`, { cwd: root, shell: true, encoding: "utf8" });
const quoted = JSON.stringify(abs);

const prettier = run(`prettier --write ${quoted}`);
if (prettier.status !== 0) {
  console.error(`Prettier falló en ${rel}:\n${prettier.stderr || prettier.stdout}`);
  process.exit(2);
}

if (REACT.has(ext)) {
  const eslint = run(`eslint --fix ${quoted}`);
  if (eslint.status !== 0) {
    console.error(`ESLint encontró errores sin arreglar en ${rel}:\n${eslint.stdout || eslint.stderr}`);
    process.exit(2);
  }
}
