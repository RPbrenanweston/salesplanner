/**
 * @crumb
 * @id backend-index-orchestrator
 * @area OBS
 * @intent CLI entry point — orchestrate the full CodeSignal-20 discovery pipeline: load config → gate → discover → validate → enforce → generate report
 * @responsibilities Load or collect GatingConfig, load exclusion list, run hybrid discovery, validate candidates, enforce hallucination control, generate markdown report, save exclusions
 * @contracts main() → Promise<void>; calls loadConfig, collectGatingAnswers, runHybridDiscovery, validateCandidate, enforceHallucinationControl, generateReport, saveExclusions; writes report.md to disk
 * @in config.json (or interactive gating via stdin), exclusions.json, web discovery API, Supabase (optional via database.ts)
 * @out report.md written to disk; exclusions.json updated; console output with run statistics
 * @err Any unhandled promise rejection in the pipeline (caught at top level — logs error + exits with non-zero code); individual stage failures propagated up from discovery, validation, or report generation
 * @hazard Pipeline runs all stages sequentially without checkpointing — if enforcement or report generation fails after a successful costly web discovery run, the entire run must be repeated from scratch with no partial result recovery
 * @hazard Report is written to a hardcoded 'report.md' path — if multiple runs execute in the same directory concurrently (e.g. parallel CI jobs), report files will overwrite each other without warning
 * @shared-edges src/config.ts→CALLS loadConfig; src/gating.ts→CALLS collectGatingAnswers; src/hybrid-discovery.ts→CALLS runHybridDiscovery; src/validation.ts→CALLS validateCandidate; src/enforcement.ts→CALLS enforceHallucinationControl; src/report.ts→CALLS generateReport; src/exclusion.ts→CALLS load/saveExclusions; src/database.ts→CALLS initialize + upsertEngineers
 * @trail pipeline#1 | `node dist/index.js` → loadConfig → no config → collectGatingAnswers → config saved → runHybridDiscovery → validate → enforce → generateReport → report.md written → exclusions saved
 * @prompt Add pipeline checkpointing to resume from last successful stage. Parameterize output path via CLI arg. Add --dry-run flag to skip exclusion writes and report output.
 */
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
