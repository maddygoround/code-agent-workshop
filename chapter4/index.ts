import Anthropic from "@anthropic-ai/sdk";
import { Command } from "commander";
import * as readline from "readline/promises";
import { Agent } from "./agent";
import { ListFilesToolDefinition } from "./tools/list_files";
import { ReadFileToolDefinition } from "./tools/read_file";
import { logger } from "../logger";

async function main() {
    const program = new Command();
    program
        .option("-v, --verbose", "Enable verbose logging")
        .parse(process.argv);

    const options = program.opts();
    const verbose = !!options.verbose;

    if (verbose) {
        logger.level = "debug";
    }

    const client = new Anthropic();

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const getUserMessage = async (): Promise<string> => {
        const input = await rl.question("");
        if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
            throw new Error("EOF");
        }
        return input;
    };

    const tools = [ListFilesToolDefinition, ReadFileToolDefinition];

    const agent = new Agent(client, getUserMessage, tools, verbose);

    try {
        await agent.run();
    } catch (err) {
        logger.error(err);
    } finally {
        rl.close();
    }
}

main().catch((err) => {
    logger.error(err);
    process.exit(1);
});
