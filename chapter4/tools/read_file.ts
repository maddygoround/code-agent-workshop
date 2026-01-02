import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "fs/promises";
import * as path from "path";
import { z } from 'zod';
import { ToolDefinition } from "../types";

const ReadFileInputSchema = z.object({
    path: z.string().describe("Path to the file to read"),
});

const ReadFile = async (args: z.infer<typeof ReadFileInputSchema>): Promise<string> => {
    const filePath = path.resolve(process.cwd(), args.path);
    return await readFile(filePath, "utf-8");
}

function GenerateSchema<T extends z.ZodType>(v: T): Anthropic.Tool['input_schema'] {
    const schema = v.toJSONSchema()
    return {
        type: "object",
        properties: schema.properties,
    }
}

export const ReadFileToolDefinition: ToolDefinition = {
    Param: {
        name: "read_file",
        description: "Read the contents of a given relative file path. Use this when you want to see what's inside a file. Do not use this with directory names.",
        input_schema: GenerateSchema(ReadFileInputSchema)
    },
    Execute: ReadFile
}
