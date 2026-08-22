import { existsSync, renameSync, rmdirSync } from "node:fs";
import { join } from "node:path";

const repositoryName = "SDOH-Park-Usage-Equity";
const outputDirectory = join(process.cwd(), "dist", "client");
const nestedDirectory = join(outputDirectory, repositoryName);
const nestedNextDirectory = join(nestedDirectory, "_next");
const rootNextDirectory = join(outputDirectory, "_next");

if (!existsSync(join(outputDirectory, "index.html"))) {
  throw new Error("GitHub Pages export is missing dist/client/index.html");
}

if (!existsSync(join(outputDirectory, ".nojekyll"))) {
  throw new Error("GitHub Pages export is missing dist/client/.nojekyll");
}

if (!existsSync(nestedNextDirectory)) {
  throw new Error(`vinext output is missing ${repositoryName}/_next`);
}

if (existsSync(rootNextDirectory)) {
  throw new Error("Refusing to overwrite an existing dist/client/_next directory");
}

// GitHub Pages mounts the uploaded artifact at /<repository>/, so framework
// assets must live at the artifact root even though their public URLs include
// the repository base path.
renameSync(nestedNextDirectory, rootNextDirectory);
rmdirSync(nestedDirectory);

console.log("Prepared dist/client for GitHub Pages.");
