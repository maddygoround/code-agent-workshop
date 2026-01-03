import Anthropic from "@anthropic-ai/sdk";
import z from "zod";

export interface ToolDefinition {
    Param: Anthropic.Tool;
    Execute: (args: any) => Promise<string>;
}

export function GenerateSchema<T extends z.ZodType>(v: T): Anthropic.Tool['input_schema'] {
    const schema = v.toJSONSchema()
    return {
        type: "object",
        properties: schema.properties,
    }
}