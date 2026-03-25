#!/usr/bin/env node
// @crumb backend-index-orchestrator
// OBS | config_loading | exclusion_list_loading | hybrid_discovery | candidate_validation | hallucination_enforcement | report_generation | exclusion_saving
// why: CLI entry point — orchestrate the full CodeSignal-20 discovery pipeline: load config, gate, discover, validate, enforce, generate report
// in:config.json (or interactive gating via stdin), exclusions.json, web discovery API, Supabase (optional) out:report.md written to disk; exclusions.json updated; console output with run statistics err:Unhandled promise rejection caught at top level; individual stage failures propagated
// hazard: Pipeline runs all stages sequentially without checkpointing — failed late stages require full re-run
// hazard: Report written to hardcoded 'report.md' path — concurrent runs overwrite each other
// edge:src/config.ts -> CALLS
// edge:src/gating.ts -> CALLS
// edge:src/hybrid-discovery.ts -> CALLS
// edge:src/validation.ts -> CALLS
// edge:src/enforcement.ts -> CALLS
// edge:src/report.ts -> CALLS
// edge:src/exclusion.ts -> CALLS
// edge:src/database.ts -> CALLS
// edge:pipeline#1 -> STEP_IN
// prompt: Add pipeline checkpointing to resume from last successful stage. Parameterize output path via CLI arg. Add --dry-run flag to skip exclusion writes and report output.

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
