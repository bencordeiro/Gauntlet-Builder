/**
 * Prompt-generation engine entry point.
 *
 * `generatePackage` is the only function the UI calls. It is pure and
 * deterministic apart from `generatedAt`, which callers can pin.
 */

import type { GauntletConfig, GeneratedOutput, GeneratedPackage } from '../model/types';
import { generateAllAgentInstructions, generateAgentInstruction } from './agentInstructions';
import { generateMasterPrompt } from './masterPrompt';
import { generateChecklist, generateRubric, generateSummary } from './rubric';
import { estimateTokens, slugify } from './text';
import { generateWorkflowJson, generateWorkflowYaml } from './workflowConfig';

export { generateMasterPrompt } from './masterPrompt';
export { generateAgentInstruction, generateAllAgentInstructions } from './agentInstructions';
export { generateRubric, generateSummary, generateChecklist } from './rubric';
export { generateWorkflowJson, generateWorkflowYaml, buildWorkflowDocument } from './workflowConfig';
export { derive, completionSentence } from './derive';
export { estimateTokens } from './text';

/**
 * Builds every output tab. Pass `generatedAt` to pin the timestamp when
 * comparing two runs for equality.
 */
export function generatePackage(config: GauntletConfig, generatedAt?: string): GeneratedPackage {
  const slug = slugify(config.intent.projectName, 'gauntlet');
  const masterPrompt = generateMasterPrompt(config);

  const outputs: GeneratedOutput[] = [
    {
      id: 'master-prompt',
      label: 'Master prompt',
      description: 'Paste this into your agent. It contains the whole workflow.',
      format: 'markdown',
      content: masterPrompt,
      filename: `${slug}-master-prompt.md`,
    },
    {
      id: 'agent-instructions',
      label: 'Agent instructions',
      description: 'A separate prompt per agent, for environments that run real sub-agents.',
      format: 'markdown',
      content: generateAllAgentInstructions(config),
      filename: `${slug}-agent-instructions.md`,
    },
    {
      id: 'rubric',
      label: 'Evaluation rubric',
      description: 'The scoring sheet reviewers judge against.',
      format: 'markdown',
      content: generateRubric(config),
      filename: `${slug}-rubric.md`,
    },
    {
      id: 'workflow-json',
      label: 'Workflow JSON',
      description: 'Machine-readable configuration for tooling.',
      format: 'json',
      content: generateWorkflowJson(config),
      filename: `${slug}-workflow.json`,
    },
    {
      id: 'workflow-yaml',
      label: 'Workflow YAML',
      description: 'The same configuration in YAML, for orchestration tools.',
      format: 'yaml',
      content: generateWorkflowYaml(config),
      filename: `${slug}-workflow.yaml`,
    },
    {
      id: 'summary',
      label: 'Plain-English summary',
      description: 'How this Gauntlet behaves, without the jargon.',
      format: 'markdown',
      content: generateSummary(config),
      filename: `${slug}-summary.md`,
    },
    {
      id: 'checklist',
      label: 'Execution checklist',
      description: 'Verify the AI actually followed the workflow.',
      format: 'markdown',
      content: generateChecklist(config),
      filename: `${slug}-checklist.md`,
    },
  ];

  return {
    outputs,
    masterPromptTokens: estimateTokens(masterPrompt),
    generatedAt: generatedAt ?? new Date().toISOString(),
  };
}

/** Per-agent prompts, for the download-all and copy-one controls. */
export function generateAgentOutputs(config: GauntletConfig): GeneratedOutput[] {
  return config.agents
    .filter((a) => a.enabled)
    .map((agent) => ({
      id: 'agent-instructions' as const,
      label: agent.name,
      description: `Standalone prompt for ${agent.name}.`,
      format: 'markdown' as const,
      content: generateAgentInstruction(config, agent),
      filename: `${slugify(config.intent.projectName, 'gauntlet')}-${slugify(agent.name, 'agent')}.md`,
    }));
}
