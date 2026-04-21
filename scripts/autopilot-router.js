
const fs = require('fs');
const path = require('path');

const SYSTEM_PROMPT_PATH = path.join(__dirname, '../ai-autopilot/SYSTEM_PROMPT.md');
const PRESETS_PATH = path.join(__dirname, '../ai-autopilot/presets.json');

function classifyRequest(request) {
  request = request.toLowerCase();
  if (request.includes('bug') || request.includes('error') || request.includes('debug')) {
    return 'DEBUG';
  } else if (request.includes('build') || request.includes('compile') || request.includes('package')) {
    return 'BUILD';
  } else if (request.includes('deploy') || request.includes('environment') || request.includes('pipeline')) {
    return 'DEPLOY';
  } else if (request.includes('api') || request.includes('endpoint') || request.includes('schema') || request.includes('test')) {
    return 'API_TEST';
  } else if (request.includes('performance') || request.includes('optimize') || request.includes('bottleneck')) {
    return 'PERFORMANCE';
  } else {
    return 'ASSIST';
  }
}

function loadPresets() {
  try {
    const presetsContent = fs.readFileSync(PRESETS_PATH, 'utf8');
    return JSON.parse(presetsContent);
  } catch (error) {
    console.error(`Error loading presets: ${error.message}`);
    return {};
  }
}

function generateMarkdownBundle(mode, request, presets) {
  let markdown = `# AI Autopilot Execution Report\n\n`;
  markdown += `## Request:\n\n> ${request}\n\n`;
  markdown += `## Classified Mode: ${mode}\n\n`;

  if (presets[mode]) {
    markdown += `### Mode Description:\n\n${presets[mode].description}\n\n`;
    markdown += `### Parameters:\n\n`;
    for (const [key, value] of Object.entries(presets[mode].parameters)) {
      markdown += `- **${key}**: ${JSON.stringify(value)}\n`;
    }
    markdown += `\n`;
  } else if (mode === 'ASSIST') {
    markdown += `### Mode Description:\n\nCould not classify the request into a specific operational mode. Providing general assistance.\n\n`;
  }

  markdown += `## System Prompt:\n\n`;
  try {
    const systemPromptContent = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8');
    markdown += `\`\`\`markdown\n${systemPromptContent}\n\`\`\`\n`;
  } catch (error) {
    markdown += `Error loading system prompt: ${error.message}\n`;
  }

  return markdown;
}

async function main() {
  const args = process.argv.slice(2);
  const request = args[0];
  const includeMarkdown = args.includes('--md');

  if (!request) {
    console.error('Usage: node autopilot-router.js "<your request>" [--md]');
    process.exit(1);
  }

  const presets = loadPresets();
  const mode = classifyRequest(request);

  const output = {
    mode: mode,
    parameters: presets[mode] ? presets[mode].parameters : {}
  };

  console.log(JSON.stringify(output, null, 2));

  if (includeMarkdown) {
    const markdownBundle = generateMarkdownBundle(mode, request, presets);
    console.log('\n--- Markdown Bundle ---\n');
    console.log(markdownBundle);
  }
}

main();
