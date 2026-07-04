---
name: mastra-integration
description: Mastra AI framework integration guide for building TypeScript agents with skills, workflows, and memory
---

## What I do
- Help integrate Mastra AI framework into TypeScript projects
- Guide on creating agents with `createSkill()` and `Agent` classes
- Provide best practices for skills, workflows, and memory configuration
- Assist with Mastra's model router and provider setup

## When to use me
Use this skill when:
- Building AI agents with Mastra framework
- Creating reusable skills for Mastra agents
- Setting up workflows and memory systems
- Configuring model providers (OpenAI, Anthropic, Google)

## Core Concepts

### Creating Skills
```typescript
import { createSkill } from '@mastra/core/skills'

const mySkill = createSkill({
  name: 'skill-name',
  description: 'What this skill does',
  instructions: `Detailed instructions for the agent...`,
  references: {
    'doc.md': '# Reference content...',
  },
})
```

### Creating Agents
```typescript
import { Agent } from '@mastra/core/agent'
import { mySkill } from './skills/my-skill'

export const agent = new Agent({
  id: 'agent-id',
  name: 'Agent Name',
  instructions: 'Agent behavior instructions...',
  model: 'openai/gpt-5.5',  // provider/model format
  skills: [mySkill],
})
```

### Model Router Format
Use `provider/model` format (not `provider:model`):
- `openai/gpt-5.5`
- `anthropic/claude-sonnet-4-6`
- `google/gemini-2.5-flash`

### Environment Variables
- OpenAI: `OPENAI_API_KEY`
- Anthropic: `ANTHROPIC_API_KEY`
- Google: `GOOGLE_API_KEY`

### Project Structure
```
src/
├── mastra/
│   ├── index.ts          # Mastra entry point
│   ├── agents/
│   │   └── my-agent.ts
│   ├── skills/
│   │   └── my-skill.ts
│   └── tools/
│       └── my-tool.ts
```

### Entry Point
```typescript
import { Mastra } from '@mastra/core'
import { myAgent } from './agents/my-agent'

export const mastra = new Mastra({
  agents: { myAgent },
})
```

### Dynamic Skills
```typescript
export const agent = new Agent({
  id: 'dynamic-agent',
  model: 'openai/gpt-5.5',
  skills: ({ requestContext }) => {
    const role = requestContext.get('userRole')
    if (role === 'developer') return [devSkill]
    return [supportSkill]
  },
})
```

### Programmatic Access
```typescript
const skill = await agent.getSkill('skill-name')
const allSkills = await agent.listSkills()
```

## References
- [Mastra Skills Docs](https://mastra.ai/docs/agents/skills)
- [createSkill API](https://mastra.ai/reference/agents/createSkill)
- [Mastra Models](https://mastra.ai/models)
