process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise rejection:', err);
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

const fs = require("fs");
const path = require("path");

const AI_AUTOPILOT_DIR = path.join(__dirname, "../ai-autopilot");
const README_PATH = path.join(AI_AUTOPILOT_DIR, "README.md");
const SYSTEM_PROMPT_PATH = path.join(AI_AUTOPILOT_DIR, "SYSTEM_PROMPT.md");
const PRESETS_PATH = path.join(AI_AUTOPILOT_DIR, "presets.json");

const SCRIPTS_DIR = path.join(__dirname, "../scripts");
const AUTOPILOT_ROUTER_PATH = path.join(SCRIPTS_DIR, "autopilot-router.js");
const VALIDATE_AUTOPILOT_PATH = path.join(SCRIPTS_DIR, "validate-autopilot.js");

const GITHUB_WORKFLOWS_DIR = path.join(__dirname, "../.github/workflows");
const AUTOPILOT_GUARD_PATH = path.join(GITHUB_WORKFLOWS_DIR, "autopilot-guard.yml");

const REQUIRED_MODES = ["DEBUG", "BUILD", "DEPLOY", "API_TEST", "PERFORMANCE"];
const REQUIRED_PROMPT_SECTIONS = [
  "## Rules of Engagement:",
  "## Routing Logic:",
  "## Validation Criteria:"
];

function validateStructure() {
  console.log("Validating directory structure and files...");
  const requiredFiles = [
    README_PATH,
    SYSTEM_PROMPT_PATH,
    PRESETS_PATH,
    AUTOPILOT_ROUTER_PATH,
    VALIDATE_AUTOPILOT_PATH,
    AUTOPILOT_GUARD_PATH,
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Missing required file: ${file}`);
    }
  }
  console.log("Directory structure and files are valid.");
}

function validateModes() {
  console.log("Validating presets.json modes...");
  try {
    const presetsContent = fs.readFileSync(PRESETS_PATH, "utf8");
    const presets = JSON.parse(presetsContent);

    for (const mode of REQUIRED_MODES) {
      if (!presets[mode]) {
        throw new Error(`Missing required mode in presets.json: ${mode}`);
      }
    }
    console.log("All required modes are present in presets.json.");
  } catch (error) {
    throw new Error(`Error validating presets.json: ${error.message}`);
  }
}

function validatePromptSections() {
  console.log("Validating SYSTEM_PROMPT.md sections...");
  try {
    const systemPromptContent = fs.readFileSync(SYSTEM_PROMPT_PATH, "utf8");

    for (const section of REQUIRED_PROMPT_SECTIONS) {
      if (!systemPromptContent.includes(section)) {
        throw new Error(`Missing required section in SYSTEM_PROMPT.md: ${section}`);
      }
    }
    console.log("All required sections are present in SYSTEM_PROMPT.md.");
  } catch (error) {
    throw new Error(`Error validating SYSTEM_PROMPT.md: ${error.message}`);
  }
}

function main() {
  try {
    validateStructure();
    validateModes();
    validatePromptSections();
    console.log("AI autopilot configuration valid.");
  } catch (error) {
    console.error(`Validation failed: ${error.message}`);
    process.exit(1);
  }
}

main();
