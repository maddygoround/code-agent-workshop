import Anthropic from "@anthropic-ai/sdk";

export interface ToolDefinition {
    Param: Anthropic.Tool;
    Execute: (args: any) => Promise<string>;
}
