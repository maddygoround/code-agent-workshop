import { readFile, writeFile, mkdir } from "fs/promises";
import * as path from "path";
import z from "zod";
import { GenerateSchema, ToolDefinition } from "../types";
import DESCRIPTION from "./tool_description/edit_file.txt";

const EditFileInputSchema = z.object({
    filePath: z.string().describe("Path to the file to edit"),
    oldString: z.string().describe("Text to search for - must match exactly and must only have one match. Empty value to append."),
    newString: z.string().describe("Text to replace oldString with"),
    replaceAll: z.boolean().optional().default(false).describe("Whether to replace all occurrences"),
});

const EditFile = async (args: z.infer<typeof EditFileInputSchema>): Promise<string> => {
    const { filePath, oldString, newString, replaceAll } = args;

    if (filePath === "" || oldString === newString) {
        throw new Error("Invalid input parameters: filePath must be specified and strings must be different.");
    }

    const absolutePath = path.resolve(process.cwd(), filePath);

    let content: string;
    try {
        content = await readFile(absolutePath, "utf-8");
    } catch (error: any) {
        if (error.code === "ENOENT" && oldString === "") {
            // Create new file
            const dir = path.dirname(absolutePath);
            await mkdir(dir, { recursive: true });
            await writeFile(absolutePath, newString, "utf-8");
            return `Successfully created file ${filePath}`;
        }
        throw error;
    }

    let newContent: string;
    if (oldString === "") {
        // Append
        newContent = content + newString;
    } else {
        if (replaceAll) {
            newContent = content.split(oldString).join(newString);
        } else {
            const occurrences = content.split(oldString).length - 1;
            if (occurrences === 0) {
                throw new Error("oldString not found in file");
            }
            if (occurrences > 1) {
                throw new Error(`oldString found ${occurrences} times in file, must be unique or use replaceAll`);
            }
            newContent = content.replace(oldString, newString);
        }
    }

    await writeFile(absolutePath, newContent, "utf-8");
    return "OK";
}

export const EditFileToolDefinition: ToolDefinition = {
    Param: {
        name: "edit_file",
        description: DESCRIPTION,
        input_schema: GenerateSchema(EditFileInputSchema)
    },
    Execute: EditFile
}
