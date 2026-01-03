import { readdir } from "fs/promises";
import * as path from "path";
import { z } from 'zod';
import { ToolDefinition, GenerateSchema } from "../types";
import DESCRIPTION from "./tool_description/list_files.txt";

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

export const ListFilesToolDefinition: ToolDefinition = {
    Param: {
        name: "list_files",
        description: DESCRIPTION,
        input_schema: GenerateSchema(ListFilesInputSchema)
    },
    Execute: ListFiles
}
