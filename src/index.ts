#!/usr/bin/env node

import { loadConfig } from './config.js';
import { collectGatingAnswers } from './gating.js';

async function main() {
  console.log('CodeSignal-20: Citation-first deep research agent\n');

  let config = loadConfig();

  if (!config) {
    console.log('No configuration found. Running gating questions...\n');
    config = await collectGatingAnswers();
  } else {
    console.log('✓ Configuration loaded from config.json');
    console.log('  Engineering focus:', config.engineeringFocus);
    console.log('  Languages:', config.languages.join(', '));
    console.log('  Depth expectation:', config.depthExpectation);
    console.log('  Evidence priorities:', config.evidencePriorities.join(', '));
    if (config.geography) {
      console.log('  Geography:', config.geography);
    }
    console.log();
  }

  console.log('Agent is ready to execute with validated configuration.');
  console.log('(Full implementation of discovery, validation, and reporting in future user stories)\n');
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
