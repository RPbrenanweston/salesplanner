import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { saveConfig } from './config.js';
export async function collectGatingAnswers() {
    const rl = readline.createInterface({ input, output });
    try {
        console.log('\n=== CodeSignal-20 Gating Questions ===\n');
        console.log('All questions are mandatory. The agent will not run without complete answers.\n');
        const engineeringFocus = await rl.question('1. Target engineering focus (e.g., Backend, Frontend, Full-stack, DevOps): ');
        if (!engineeringFocus.trim()) {
            throw new Error('Engineering focus is required');
        }
        const languagesRaw = await rl.question('2. Required languages (comma-separated, max 3): ');
        const languages = languagesRaw.split(',').map(l => l.trim()).filter(l => l.length > 0);
        if (languages.length === 0) {
            throw new Error('At least one language is required');
        }
        if (languages.length > 3) {
            throw new Error('Maximum 3 languages allowed');
        }
        const depthExpectation = await rl.question('3. Minimum depth expectation (e.g., distributed systems, performance optimization): ');
        if (!depthExpectation.trim()) {
            throw new Error('Depth expectation is required');
        }
        console.log('\n4. Evidence priorities (choose 2-3):');
        console.log('   a) GitHub repos');
        console.log('   b) OSS contributions');
        console.log('   c) Tech blogs');
        console.log('   d) Conference talks');
        console.log('   e) Stack Overflow depth');
        const evidenceRaw = await rl.question('   Enter choices (comma-separated, e.g., a,c,d): ');
        const evidenceChoices = evidenceRaw.split(',').map(c => c.trim().toLowerCase());
        const evidenceMap = {
            'a': 'GitHub repos',
            'b': 'OSS contributions',
            'c': 'Tech blogs',
            'd': 'Conference talks',
            'e': 'Stack Overflow depth'
        };
        const evidencePriorities = evidenceChoices
            .map(c => evidenceMap[c])
            .filter((e) => e !== undefined);
        if (evidencePriorities.length < 2 || evidencePriorities.length > 3) {
            throw new Error('Must choose 2-3 evidence priorities');
        }
        const geography = await rl.question('5. Geography constraints (optional, press Enter to skip): ');
        const config = {
            engineeringFocus: engineeringFocus.trim(),
            languages,
            depthExpectation: depthExpectation.trim(),
            evidencePriorities,
            geography: geography.trim()
        };
        saveConfig(config);
        console.log('\n✓ Configuration saved to config.json\n');
        return config;
    }
    finally {
        rl.close();
    }
}
//# sourceMappingURL=gating.js.map