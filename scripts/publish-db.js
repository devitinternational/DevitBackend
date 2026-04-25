#!/usr/bin/env node

const { execSync } = require("child_process");
const { copyFileSync, mkdirSync } = require("fs");
const { resolve } = require("path");

const ROOT = resolve(__dirname, "..");
const PKG_DIR = resolve(ROOT, "packages", "db");
const SCHEMA_SRC = resolve(ROOT, "prisma", "schema.prisma");
const SCHEMA_DEST = resolve(PKG_DIR, "prisma", "schema.prisma");
const NPMRC_SRC = resolve(ROOT, ".npmrc");
const NPMRC_DEST = resolve(PKG_DIR, ".npmrc");

// 1. Copy schema and .npmrc from Backend root → packages/db
console.log("📋 Copying files to packages/db...");
mkdirSync(resolve(PKG_DIR, "prisma"), { recursive: true });
copyFileSync(SCHEMA_SRC, SCHEMA_DEST);
copyFileSync(NPMRC_SRC, NPMRC_DEST);

// 2. Install dependencies
console.log("📦 Installing dependencies...");
execSync("npm install", { cwd: PKG_DIR, stdio: "inherit" });

// 3. Build (prisma generate + tsc compile)
console.log("🔨 Building package...");
execSync("npx prisma generate --schema=./prisma/schema.prisma", { cwd: PKG_DIR, stdio: "inherit" });
execSync("npx tsc", { cwd: PKG_DIR, stdio: "inherit" });

// 4. Publish to GitHub Packages
console.log("🚀 Publishing to GitHub Packages...");
execSync("npm publish", { cwd: PKG_DIR, stdio: "inherit" });

console.log("✅ @devitinternational/db published successfully!");
