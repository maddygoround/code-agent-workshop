import z from "zod";
import * as fs from "fs";
import * as path from "path";
import { GenerateSchema, ToolDefinition } from "../types";
import { Ripgrep } from "../ripgrep";

const DESCRIPTION = fs.readFileSync(path.join(__dirname, "tool_description", "grep.txt"), "utf-8");
const MAX_LINE_LENGTH = 2000;

const GrepInputSchema = z.object({
    pattern: z.string().describe("The regex pattern to search for in file contents"),
    path: z.string().optional().describe("The directory to search in. Defaults to the current working directory."),
    include: z.string().optional().describe('File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")'),
});

const Grep = async (args: z.infer<typeof GrepInputSchema>): Promise<string> => {
    const { pattern, path: searchPathInput, include } = args;

    if (!pattern) {
        throw new Error("pattern is required");
    }

    const searchPath = searchPathInput ? path.resolve(process.cwd(), searchPathInput) : process.cwd();
    const rgPath = await Ripgrep.filepath();

    const rgArgs = ["-nH", "--field-match-separator=|", "--regexp", pattern];
    if (include) {
        rgArgs.push("--glob", include);
    }
    rgArgs.push(searchPath);

    const proc = Bun.spawn([rgPath, ...rgArgs], {
        stdout: "pipe",
        stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const errorOutput = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode === 1) {
        return "No matches found.";
    }

    if (exitCode !== 0) {
        throw new Error(`ripgrep failed: ${errorOutput}`);
    }

    // Handle both Unix (\n) and Windows (\r\n) line endings
    const lines = output.trim().split(/\r?\n/);
    const matches: { path: string; modTime: number; lineNum: number; lineText: string }[] = [];

    for (const line of lines) {
        if (!line) continue;

        const [filePath, lineNumStr, ...lineTextParts] = line.split("|");
        if (!filePath || !lineNumStr || lineTextParts.length === 0) continue;

        const lineNum = parseInt(lineNumStr, 10);
        const lineText = lineTextParts.join("|");

        const file = Bun.file(filePath);
        const stats = await file.stat().catch(() => null);
        if (!stats) continue;

        matches.push({
            path: filePath,
            modTime: stats.mtime.getTime(),
            lineNum,
            lineText,
        });
    }

    matches.sort((a, b) => b.modTime - a.modTime);

    const limit = 100;
    const truncated = matches.length > limit;
    const finalMatches = truncated ? matches.slice(0, limit) : matches;

    if (finalMatches.length === 0) {
        return "No matches found.";
    }

    const outputLines = [`Found ${finalMatches.length} matches` + (truncated ? " (truncated)" : "")];

    let currentFile = "";
    for (const match of finalMatches) {
        if (currentFile !== match.path) {
            if (currentFile !== "") {
                outputLines.push("");
            }
            currentFile = match.path;
            outputLines.push(`${match.path}:`);
        }
        const truncatedLineText =
            match.lineText.length > MAX_LINE_LENGTH ? match.lineText.substring(0, MAX_LINE_LENGTH) + "..." : match.lineText;
        outputLines.push(`  Line ${match.lineNum}: ${truncatedLineText}`);
    }

    if (truncated) {
        outputLines.push("");
        outputLines.push("(Results are truncated. Consider using a more specific path or pattern.)");
    }

    return outputLines.join("\n");
}

export const GrepToolDefinition: ToolDefinition = {
    Param: {
        name: "grep",
        description: DESCRIPTION,
        input_schema: GenerateSchema(GrepInputSchema)
    },
    Execute: Grep
}
