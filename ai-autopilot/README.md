# AI Autopilot System

This directory contains the core components for the AI Autopilot system, designed to automate and streamline various development and operational tasks.

## Components:

- `SYSTEM_PROMPT.md`: The principal engineer system prompt, defining rules, routing logic, and validation criteria for the AI.
- `presets.json`: Configuration file containing predefined modes and settings for the AI Autopilot, such as DEBUG, BUILD, DEPLOY, API_TEST, and PERFORMANCE.

## Usage:

The AI Autopilot system is integrated with the project's `package.json` scripts for validation and routing. Refer to the `scripts/` directory for the associated JavaScript files that handle the classification of requests, loading of presets, and output generation.

## Validation:

Validation of the AI Autopilot configuration is enforced through GitHub Actions (`.github/workflows/autopilot-guard.yml`) to ensure consistency and prevent errors on push and pull requests.
