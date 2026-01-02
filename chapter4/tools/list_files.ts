import Anthropic from "@anthropic-ai/sdk";
import { readdir } from "fs/promises";
import * as path from "path";
import { z } from 'zod';
import { ToolDefinition } from "../types";

const ListFilesInputSchema = z.object({
    path: z.string().describe("Path to the directory to list"),
});

async function listFilesRecursive(dir: string, baseDir: string = ""): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    let files: string[] = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.join(baseDir, entry.name);

        if (entry.isDirectory()) {
            if (entry.name === ".git" || entry.name === "node_modules") {
                continue;
            }
            const subFiles = await listFilesRecursive(fullPath, relativePath);
            files = files.concat(subFiles);
        } else {
            files.push(relativePath);
        }
    }
    return files;
}

const ListFiles = async (args: z.infer<typeof ListFilesInputSchema>): Promise<string> => {
    const dirPath = path.resolve(process.cwd(), args.path);
    const files = await listFilesRecursive(dirPath);
    return files.join("\n");
}

function GenerateSchema<T extends z.ZodType>(v: T): Anthropic.Tool['input_schema'] {
    const schema = v.toJSONSchema()
    return {
        type: "object",
        properties: schema.properties,
    }
}

export const ListFilesToolDefinition: ToolDefinition = {
    Param: {
        name: "list_files",
        description: "List the contents of a given relative directory path. Use this when you want to see what's inside a directory. Do not use this with file names.",
        input_schema: GenerateSchema(ListFilesInputSchema)
    },
    Execute: ListFiles
}
