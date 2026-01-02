# Chapter 3: Refinement & Modularity

As the number of tools grew, the monolithic structure of the agent became difficult to maintain. This chapter focuses on **Refactoring for Modularity**.

## The Goal
The objective was to decouple the agent's core "reasoning engine" (the loop and API interaction) from the specific capabilities (the tools) it possesses.

## Architectural Shift
We introduced an abstracted `Agent` class. This allows us to instantiate multiple agents with different sets of tools or logging configurations without duplicating code.

- **[index.ts](file:///Users/m.rathod/Documents/Projects/code-agent-ts/chapter3/index.ts)**: Demonstrates the "monolithic-agent" pattern but with cleaner internal logic and centralized logging.

### Integrated Logging
This chapter integrates the shared `logger.ts` utility. The `Agent` class now utilizes `logger.debug` for internal state transitions and `logger.info` for user-facing feedback, controllable via the `--verbose` flag.

### Recursive Discovery: The `list_files` Tool
To demonstrate the power of more complex tools, we implemented `list_files`. Unlike a simple read command, this tool explores the project structure recursively.

**Key Features:**
- **Filtering**: Automatically ignores noise like `.git` and `node_modules`.
- **Traversal**: Uses asynchronous directory walking.
- **Shared Logger**: Tools now leverage the shared logging infrastructure for consistent output.

## Why Refactor?
- **Testability**: Individual tools can be tested in isolation.
- **Scalability**: Adding tools doesn't require touching the agent's core loop.
- **Reusability**: The `Agent` class is now a primitive that can be used across different implementation scripts.

### Flow Diagram
```mermaid
graph TD
    User([User]) -- "Prompt" --> Runner[index.ts Runner]
    Runner -- "Init" --> AgentClass[Agent class]
    AgentClass -- "Log" --> Logger[Shared Logger]
    Runner -- "Register" --> Tools[Tool Modules]
    AgentClass -- "Loop" --> AgentClass
    AgentClass -- "Request" --> API[Anthropic API]
    AgentClass -- "Dispatch" --> Tools
    Tools -- "Log" --> Logger
    Tools -- "Result" --> AgentClass
    AgentClass -- "Display" --> User
```

## How to Run
```bash
bun run chapter3/index.ts --verbose
```
