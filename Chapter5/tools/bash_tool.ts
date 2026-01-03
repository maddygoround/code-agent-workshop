import { exec } from "child_process";
import { promisify } from "util";
import z from "zod";
import { GenerateSchema, ToolDefinition } from "../types";
import DESCRPITION from "./tool_description/bash.txt";
const execAsync = promisify(exec);


const BashInputSchema = z.object({
    command: z.string().describe("Command to run"),
});


const Bash = async (args: z.infer<typeof BashInputSchema>): Promise<string> => {
    try {
        const { stdout, stderr } = await execAsync(args.command);
        return stdout.trim();
    } catch (error: any) {
        const output = (error.stdout || "") + (error.stderr || "");
        return `Command failed with error: ${error.message}\nOutput: ${output}`.trim();
    }
}

export const BashToolDefinition: ToolDefinition = {
    Param: {
        name: "bash",
        description: DESCRPITION,
        input_schema: GenerateSchema(BashInputSchema)
    },
    Execute: Bash
}
