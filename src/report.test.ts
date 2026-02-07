/**
 * Tests for Research Report Generator (US-006)
 *
 * Validates:
 * - Report includes metadata (agent name, execution date, config details)
 * - Report includes methodology section with validation rules
 * - Each profile has summary, verified evidence with links, synthesis
 * - Report caps at 20 profiles maximum
 * - Report includes complete source URL list at end
 * - Report includes research limitations section
 * - Report outputs as structured markdown file on disk
 */

import { describe, it, expect } from '@jest/globals';
import {
  createReportMetadata,
  generateMarkdownReport,
  capProfiles,
  writeReportToDisk,
  generateResearchReport,
  type ReportMetadata,
  type ResearchReport
} from './report.js';
import { GatingConfig, ValidatedProfile, Citation } from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Report Generator - US-006', () => {
  const sampleConfig: GatingConfig = {
    engineeringFocus: 'Backend Systems',
    languages: ['Go', 'Rust'],
    depthExpectation: 'Distributed systems and performance',
    evidencePriorities: ['GitHub repos', 'Tech blogs'],
    geography: 'Europe'
  };

  const sampleCitations: Citation[] = [
    {
      signal: 'code',
      url: 'https://github.com/testuser/awesome-project',
      description: 'Distributed key-value store implementation'
    },
    {
      signal: 'depth',
      url: 'https://github.com/testuser/awesome-project/pull/42',
      description: 'Performance optimization reducing latency by 40%'
    },
    {
      signal: 'thinking',
      url: 'https://testuser.dev/blog/consensus-algorithms',
      description: 'Technical deep-dive on Raft consensus'
    }
  ];

  const sampleProfile: ValidatedProfile = {
    name: 'Test Engineer',
    handle: 'testuser',
    primaryUrl: 'https://github.com/testuser',
    languages: ['Go', 'Rust'],
    engineeringFocus: 'Distributed Systems',
    geography: 'Berlin, Germany',
    signals: {
      code: true,
      depth: true,
      sustained: false,
      thinking: true,
      peer: false
    },
    citations: sampleCitations
  };

  describe('Acceptance Criterion 1: Report includes metadata', () => {
    it('should create report metadata with agent name and execution date', () => {
      const metadata = createReportMetadata(sampleConfig, 50, 15);

      expect(metadata.agentName).toBe('CodeSignal-20 Citation-First Research Agent');
      expect(metadata.executionDate).toBeInstanceOf(Date);
      expect(metadata.roleFocus).toBe('Backend Systems');
      expect(metadata.languages).toEqual(['Go', 'Rust']);
      expect(metadata.evidencePriorities).toEqual(['GitHub repos', 'Tech blogs']);
      expect(metadata.geography).toBe('Europe');
      expect(metadata.profilesReviewed).toBe(50);
      expect(metadata.profilesReturned).toBe(15);
    });

    it('should handle optional geography in metadata', () => {
      const configWithoutGeo = { ...sampleConfig, geography: '' };
      const metadata = createReportMetadata(configWithoutGeo, 10, 5);

      expect(metadata.geography).toBeUndefined();
    });
  });

  describe('Acceptance Criterion 2: Report includes methodology section', () => {
    it('should include five signal framework description', () => {
      const report: ResearchReport = {
        metadata: createReportMetadata(sampleConfig, 10, 5),
        profiles: [sampleProfile],
        generatedAt: new Date()
      };

      const markdown = generateMarkdownReport(report);

      expect(markdown).toContain('## Methodology');
      expect(markdown).toContain('Five Signal Framework');
      expect(markdown).toContain('Code Signal');
      expect(markdown).toContain('Depth Signal');
      expect(markdown).toContain('Sustained Activity');
      expect(markdown).toContain('Thinking Signal');
      expect(markdown).toContain('Peer Recognition');
    });

    it('should include inclusion criteria and quality gates', () => {
      const report: ResearchReport = {
        metadata: createReportMetadata(sampleConfig, 10, 5),
        profiles: [],
        generatedAt: new Date()
      };

      const markdown = generateMarkdownReport(report);

      expect(markdown).toContain('Inclusion Criteria');
      expect(markdown).toContain('3 or more signals must be present');
      expect(markdown).toContain('Citation requirement');
      expect(markdown).toContain('Quality Gates');
      expect(markdown).toContain('Hallucination Control');
    });

    it('should state that job titles are NOT used as evidence', () => {
      const report: ResearchReport = {
        metadata: createReportMetadata(sampleConfig, 10, 5),
        profiles: [],
        generatedAt: new Date()
      };

      const markdown = generateMarkdownReport(report);

      expect(markdown).toContain('Job titles are NOT used as evidence');
    });
  });

  describe('Acceptance Criterion 3: Each profile has summary, verified evidence, synthesis', () => {
    it('should render profile with name, handle, and primary languages', () => {
      const report: ResearchReport = {
        metadata: createReportMetadata(sampleConfig, 10, 1),
        profiles: [sampleProfile],
        generatedAt: new Date()
      };

      const markdown = generateMarkdownReport(report);

      expect(markdown).toContain('Test Engineer (@testuser)');
      expect(markdown).toContain('**Primary Languages**: Go, Rust');
      expect(markdown).toContain('**Engineering Focus**: Distributed Systems');
      expect(markdown).toContain('**Geography**: Berlin, Germany');
    });

    it('should list verified evidence with citation links', () => {
      const report: ResearchReport = {
        metadata: createReportMetadata(sampleConfig, 10, 1),
        profiles: [sampleProfile],
        generatedAt: new Date()
      };

      const markdown = generateMarkdownReport(report);

      expect(markdown).toContain('**Verified Evidence**:');
      expect(markdown).toContain('Distributed key-value store implementation');
      expect(markdown).toContain('[source](https://github.com/testuser/awesome-project)');
      expect(markdown).toContain('Performance optimization reducing latency by 40%');
      expect(markdown).toContain('Technical deep-dive on Raft consensus');
    });

    it('should include synthesis section based on signals', () => {
      const report: ResearchReport = {
        metadata: createReportMetadata(sampleConfig, 10, 1),
        profiles: [sampleProfile],
        generatedAt: new Date()
      };

      const markdown = generateMarkdownReport(report);

      expect(markdown).toContain('**Synthesis**:');
      expect(markdown).toContain('This profile demonstrates 3 of 5 validation signals');
      expect(markdown).toContain('Code contributions');
      expect(markdown).toContain('Technical depth');
    });

    it('should include primary URL at end of profile section', () => {
      const report: ResearchReport = {
        metadata: createReportMetadata(sampleConfig, 10, 1),
        profiles: [sampleProfile],
        generatedAt: new Date()
      };

      const markdown = generateMarkdownReport(report);

      expect(markdown).toContain('**Primary URL**: https://github.com/testuser');
    });

    it('should handle profiles without handle or geography', () => {
      const minimalProfile: ValidatedProfile = {
        name: 'Minimal Engineer',
        primaryUrl: 'https://github.com/minimal',
        languages: ['TypeScript'],
        engineeringFocus: 'Frontend',
        signals: {
          code: true,
          depth: true,
          sustained: true,
          thinking: false,
          peer: false
        },
        citations: [
          {
            signal: 'code',
            url: 'https://github.com/minimal/project',
            description: 'React component library'
          }
        ]
      };

      // Use config without geography to verify profile section doesn't show it
      const configWithoutGeo: GatingConfig = {
        engineeringFocus: 'Frontend',
        languages: ['TypeScript'],
        depthExpectation: 'UI frameworks',
        evidencePriorities: ['GitHub repos', 'Tech blogs'],
        geography: ''
      };

      const report: ResearchReport = {
        metadata: createReportMetadata(configWithoutGeo, 5, 1),
        profiles: [minimalProfile],
        generatedAt: new Date()
      };

      const markdown = generateMarkdownReport(report);

      expect(markdown).toContain('Minimal Engineer');
      expect(markdown).not.toContain('(@');

      // Check the profile section specifically (not metadata)
      const profilesSection = markdown.split('## Validated Profiles')[1].split('## Sources')[0];
      expect(profilesSection).not.toContain('**Geography**:');
    });
  });

  describe('Acceptance Criterion 4: Report caps at 20 profiles maximum', () => {
    it('should cap profiles at exactly 20', () => {
      const manyProfiles: ValidatedProfile[] = Array.from({ length: 30 }, (_, i) => ({
        name: `Engineer ${i + 1}`,
        primaryUrl: `https://github.com/engineer${i + 1}`,
        languages: ['Go'],
        engineeringFocus: 'Backend',
        signals: {
          code: true,
          depth: true,
          sustained: true,
          thinking: false,
          peer: false
        },
        citations: [
          {
            signal: 'code',
            url: `https://github.com/engineer${i + 1}/project`,
            description: 'Sample project'
          }
        ]
      }));

      const capped = capProfiles(manyProfiles);

      expect(capped).toHaveLength(20);
      expect(capped[0].name).toBe('Engineer 1');
      expect(capped[19].name).toBe('Engineer 20');
    });

    it('should not modify profiles array when fewer than 20', () => {
      const fewProfiles: ValidatedProfile[] = Array.from({ length: 5 }, (_, i) => ({
        name: `Engineer ${i + 1}`,
        primaryUrl: `https://github.com/engineer${i + 1}`,
        languages: ['Rust'],
        engineeringFocus: 'Systems',
        signals: {
          code: true,
          depth: true,
          sustained: true,
          thinking: false,
          peer: false
        },
        citations: [
          {
            signal: 'code',
            url: `https://github.com/engineer${i + 1}/project`,
            description: 'Sample project'
          }
        ]
      }));

      const capped = capProfiles(fewProfiles);

      expect(capped).toHaveLength(5);
      expect(capped).toEqual(fewProfiles);
    });

    it('should include capped profile count in metadata', () => {
      const manyProfiles: ValidatedProfile[] = Array.from({ length: 25 }, (_, i) => ({
        name: `Engineer ${i + 1}`,
        primaryUrl: `https://github.com/engineer${i + 1}`,
        languages: ['Python'],
        engineeringFocus: 'ML',
        signals: {
          code: true,
          depth: true,
          sustained: true,
          thinking: false,
          peer: false
        },
        citations: [
          {
            signal: 'code',
            url: `https://github.com/engineer${i + 1}/project`,
            description: 'Sample project'
          }
        ]
      }));

      const capped = capProfiles(manyProfiles);
      const metadata = createReportMetadata(sampleConfig, 25, capped.length);

      expect(metadata.profilesReturned).toBe(20);
      expect(metadata.profilesReviewed).toBe(25);
    });
  });

  describe('Acceptance Criterion 5: Report includes complete source URL list', () => {
    it('should list all unique URLs from profiles and citations', () => {
      const profiles: ValidatedProfile[] = [
        {
          name: 'Engineer A',
          primaryUrl: 'https://github.com/engineera',
          languages: ['Go'],
          engineeringFocus: 'Backend',
          signals: { code: true, depth: true, sustained: false, thinking: false, peer: false },
          citations: [
            {
              signal: 'code',
              url: 'https://github.com/engineera/project1',
              description: 'Project 1'
            },
            {
              signal: 'depth',
              url: 'https://github.com/engineera/project1/pull/5',
              description: 'PR 5'
            }
          ]
        },
        {
          name: 'Engineer B',
          primaryUrl: 'https://github.com/engineerb',
          languages: ['Rust'],
          engineeringFocus: 'Systems',
          signals: { code: true, depth: false, sustained: false, thinking: true, peer: false },
          citations: [
            {
              signal: 'code',
              url: 'https://github.com/engineerb/project2',
              description: 'Project 2'
            },
            {
              signal: 'thinking',
              url: 'https://engineerb.dev/blog/post',
              description: 'Blog post'
            }
          ]
        }
      ];

      const report: ResearchReport = {
        metadata: createReportMetadata(sampleConfig, 10, 2),
        profiles,
        generatedAt: new Date()
      };

      const markdown = generateMarkdownReport(report);

      expect(markdown).toContain('## Sources');
      expect(markdown).toContain('https://github.com/engineera');
      expect(markdown).toContain('https://github.com/engineera/project1');
      expect(markdown).toContain('https://github.com/engineera/project1/pull/5');
      expect(markdown).toContain('https://github.com/engineerb');
      expect(markdown).toContain('https://github.com/engineerb/project2');
      expect(markdown).toContain('https://engineerb.dev/blog/post');
      expect(markdown).toMatch(/This report references \*\*6 unique sources\*\*/);
    });

    it('should deduplicate URLs in source list', () => {
      const profiles: ValidatedProfile[] = [
        {
          name: 'Engineer A',
          primaryUrl: 'https://github.com/engineera',
          languages: ['Go'],
          engineeringFocus: 'Backend',
          signals: { code: true, depth: true, sustained: false, thinking: false, peer: false },
          citations: [
            {
              signal: 'code',
              url: 'https://github.com/engineera/project1',
              description: 'Project 1'
            },
            {
              signal: 'depth',
              url: 'https://github.com/engineera/project1', // Duplicate
              description: 'Same project, depth signal'
            }
          ]
        }
      ];

      const report: ResearchReport = {
        metadata: createReportMetadata(sampleConfig, 5, 1),
        profiles,
        generatedAt: new Date()
      };

      const markdown = generateMarkdownReport(report);

      const urlMatches = markdown.match(/https:\/\/github\.com\/engineera\/project1/g);
      expect(urlMatches).not.toBeNull();

      // Should appear once in profile citations and once in sources list
      const sourcesSection = markdown.split('## Sources')[1];
      const sourceUrlMatches = sourcesSection.match(/https:\/\/github\.com\/engineera\/project1/g);
      expect(sourceUrlMatches).toHaveLength(1); // Only once in sources list
    });

    it('should handle report with no profiles gracefully', () => {
      const report: ResearchReport = {
        metadata: createReportMetadata(sampleConfig, 10, 0),
        profiles: [],
        generatedAt: new Date()
      };

      const markdown = generateMarkdownReport(report);

      expect(markdown).toContain('## Sources');
      expect(markdown).toContain('*No sources available.*');
    });
  });

  describe('Acceptance Criterion 6: Report includes research limitations section', () => {
    it('should include research limitations heading', () => {
      const report: ResearchReport = {
        metadata: createReportMetadata(sampleConfig, 10, 5),
        profiles: [],
        generatedAt: new Date()
      };

      const markdown = generateMarkdownReport(report);

      expect(markdown).toContain('## Research Limitations');
    });

    it('should list at least 5 specific limitations', () => {
      const report: ResearchReport = {
        metadata: createReportMetadata(sampleConfig, 10, 5),
        profiles: [],
        generatedAt: new Date()
      };

      const markdown = generateMarkdownReport(report);

      expect(markdown).toContain('Public Artefacts Only');
      expect(markdown).toContain('Language Bias');
      expect(markdown).toContain('Recency Bias');
      expect(markdown).toContain('Platform Dependency');
      expect(markdown).toContain('Citation Availability');
    });

    it('should include recommendation for human review', () => {
      const report: ResearchReport = {
        metadata: createReportMetadata(sampleConfig, 10, 5),
        profiles: [],
        generatedAt: new Date()
      };

      const markdown = generateMarkdownReport(report);

      expect(markdown).toContain('Recommendation');
      expect(markdown).toContain('research input');
      expect(markdown).toContain('human review');
    });
  });

  describe('Acceptance Criterion 7: Report outputs as structured markdown file on disk', () => {
    it('should write markdown report to disk', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'report-test-'));
      const outputPath = path.join(tempDir, 'test-report.md');

      const markdown = '# Test Report\n\nContent here.';

      await writeReportToDisk(markdown, outputPath);

      const fileContent = await fs.readFile(outputPath, 'utf-8');
      expect(fileContent).toBe(markdown);

      // Cleanup
      await fs.rm(tempDir, { recursive: true });
    });

    it('should create output directory if it does not exist', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'report-test-'));
      const nestedPath = path.join(tempDir, 'nested', 'dir', 'report.md');

      const markdown = '# Nested Report';

      await writeReportToDisk(markdown, nestedPath);

      const fileContent = await fs.readFile(nestedPath, 'utf-8');
      expect(fileContent).toBe(markdown);

      // Cleanup
      await fs.rm(tempDir, { recursive: true });
    });

    it('should generate complete report and write to disk', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'report-test-'));
      const outputPath = path.join(tempDir, 'research-report.md');

      const profiles = [sampleProfile];

      const report = await generateResearchReport(
        sampleConfig,
        profiles,
        10,
        outputPath
      );

      expect(report.profiles).toHaveLength(1);
      expect(report.metadata.profilesReturned).toBe(1);

      const fileContent = await fs.readFile(outputPath, 'utf-8');
      expect(fileContent).toContain('# Software Engineering Research Report');
      expect(fileContent).toContain('Test Engineer');
      expect(fileContent).toContain('## Sources');

      // Cleanup
      await fs.rm(tempDir, { recursive: true });
    });
  });

  describe('Acceptance Criterion 8: Typecheck passes with zero errors', () => {
    it('should compile TypeScript without errors', () => {
      // This test validates that types are correct at compile time
      // If TypeScript compilation succeeds, this test passes

      const metadata: ReportMetadata = createReportMetadata(sampleConfig, 50, 15);
      const report: ResearchReport = {
        metadata,
        profiles: [sampleProfile],
        generatedAt: new Date()
      };

      expect(metadata.agentName).toBeDefined();
      expect(report.profiles).toBeInstanceOf(Array);
    });
  });

  describe('Additional Quality Checks', () => {
    it('should include critical disclaimer at top of report', () => {
      const report: ResearchReport = {
        metadata: createReportMetadata(sampleConfig, 10, 5),
        profiles: [],
        generatedAt: new Date()
      };

      const markdown = generateMarkdownReport(report);

      expect(markdown).toContain('⚠️ CRITICAL: This is research input requiring human review');
      expect(markdown).toContain('This is not an evaluation or ranking');
    });

    it('should format profile numbers as ordered list', () => {
      const profiles: ValidatedProfile[] = Array.from({ length: 3 }, (_, i) => ({
        name: `Engineer ${i + 1}`,
        primaryUrl: `https://github.com/engineer${i + 1}`,
        languages: ['Go'],
        engineeringFocus: 'Backend',
        signals: { code: true, depth: true, sustained: true, thinking: false, peer: false },
        citations: [
          {
            signal: 'code',
            url: `https://github.com/engineer${i + 1}/project`,
            description: 'Project'
          }
        ]
      }));

      const report: ResearchReport = {
        metadata: createReportMetadata(sampleConfig, 10, 3),
        profiles,
        generatedAt: new Date()
      };

      const markdown = generateMarkdownReport(report);

      expect(markdown).toContain('### 1. Engineer 1');
      expect(markdown).toContain('### 2. Engineer 2');
      expect(markdown).toContain('### 3. Engineer 3');
    });

    it('should separate profiles with horizontal rules', () => {
      const profiles: ValidatedProfile[] = Array.from({ length: 2 }, (_, i) => ({
        name: `Engineer ${i + 1}`,
        primaryUrl: `https://github.com/engineer${i + 1}`,
        languages: ['Rust'],
        engineeringFocus: 'Systems',
        signals: { code: true, depth: true, sustained: true, thinking: false, peer: false },
        citations: [
          {
            signal: 'code',
            url: `https://github.com/engineer${i + 1}/project`,
            description: 'Project'
          }
        ]
      }));

      const report: ResearchReport = {
        metadata: createReportMetadata(sampleConfig, 10, 2),
        profiles,
        generatedAt: new Date()
      };

      const markdown = generateMarkdownReport(report);

      const hrCount = (markdown.match(/^---$/gm) || []).length;
      expect(hrCount).toBeGreaterThanOrEqual(2); // At least one per profile
    });
  });
});
