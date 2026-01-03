import { readFile } from "fs/promises";
import * as path from "path";
import { z } from 'zod';
import { GenerateSchema, ToolDefinition } from "../types";
import DESCRIPTION from "./tool_description/read_file.txt";

const ReadFileInputSchema = z.object({
    path: z.string().describe("Path to the file to read"),
});

const ReadFile = async (args: z.infer<typeof ReadFileInputSchema>): Promise<string> => {
    const filePath = path.resolve(process.cwd(), args.path);
    return await readFile(filePath, "utf-8");
}

export const ReadFileToolDefinition: ToolDefinition = {
    Param: {
        name: "read_file",
        description: DESCRIPTION,
        input_schema: GenerateSchema(ReadFileInputSchema)
    },
    Execute: ReadFile
}
