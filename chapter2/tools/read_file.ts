import Anthropic from "@anthropic-ai/sdk";
import { Command } from "commander";
import { readFile } from "fs/promises";
import { createInterface } from "readline";
import { z } from 'zod';
import { logger } from "../../logger";

const program = new Command();

program
    .version("1.0.0")
    .description("A TypeScript CLI")
    .option("-v, --verbose", "verbose output")
    .action(async (options) => {
        const verbose = !!options.verbose;

        if (verbose) {
            logger.level = "debug";
            logger.info("verbose logging enabled");
        }

        const client = new Anthropic();
        if (verbose) {
            logger.debug("Anthropic client created");
        }

        const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false,
        });
        const lineIterator = rl[Symbol.asyncIterator]();

        const getUserMessage = async (): Promise<string> => {
            const result = await lineIterator.next();
            if (result.done) {
                throw new Error("EOF");
            }
            return result.value;
        };

        const tools = [ReadFileToolDefinition];
        const agent = new Agent(client, getUserMessage, verbose, tools);
        await agent.run();

        rl.close();
    });


const ReadFileInputSchema = z.object({
    path: z.string().describe("Path to the file to read"),
});

const ReadFile = async (args: z.infer<typeof ReadFileInputSchema>): Promise<string> => {
    logger.info({ path: args.path }, "Reading file");
    return await readFile(args.path, "utf-8");
}

const ReadFileToolDefinition: ToolDefinition = {
    Param: {
        name: "read_file",
        description: "Read the contents of a given relative file path.Use this when you want to see what's inside a file. Do not use this with directory names.",
        input_schema: GenerateSchema(ReadFileInputSchema)
    },
    Execute: ReadFile
}

interface ToolDefinition {
    Param: Anthropic.Tool
    Execute: (args: any) => Promise<string>
}



class Agent {
    private client: Anthropic;
    private getUserMessage: () => Promise<string>;
    private verbose: boolean;
    private tools: ToolDefinition[];

    constructor(
        client: Anthropic,
        getUserMessage: () => Promise<string>,
        verbose: boolean,
        tools: ToolDefinition[]
    ) {
        this.client = client;
        this.getUserMessage = getUserMessage;
        this.verbose = verbose;
        this.tools = tools;
    }

    async run() {
        // Correct type for conversation history
        const conversation: Anthropic.MessageParam[] = [];

        if (this.verbose) {
            logger.debug("Conversation started");
        }

        logger.info("Chat with Claude (use 'ctrl-c' to quit)");

        while (true) {
            process.stdout.write("\x1b[94mYou\x1b[0m: ");
            let userInput: string;
            try {
                userInput = await this.getUserMessage();
            } catch (err) {
                if (this.verbose) {
                    logger.debug("User input ended, breaking from chat loop");
                }
                break;
            }

            if (!userInput) {
                if (this.verbose) {
                    logger.debug("Skipping empty message");
                }
                continue;
            }

            if (this.verbose) {
                logger.debug({ userInput }, "User input received");
            }

            conversation.push({ role: "user", content: userInput });

            if (this.verbose) {
                logger.debug({ conversationLength: conversation.length }, "Sending message to Claude");
            }

            try {
                let message = await this.runInference(conversation);
                // The SDK returns the message object which fits the MessageParam structure's content 
                // but we need to ensure we push the correct format { role: "assistant", content: ... }
                conversation.push({ role: "assistant", content: message.content });
                while (true) {
                    let hasToolUse = false;
                    let toolsResults: Anthropic.ContentBlockParam[] = [];

                    if (this.verbose) {
                        logger.debug({ conversationLength: conversation.length }, "Received response from Claude");
                    }

                    for (const block of message.content) {
                        switch (block.type) {
                            case "text":
                                logger.info(`\x1b[92mClaude\x1b[0m: ${block.text}`);
                                break;
                            case "tool_use":
                                hasToolUse = true;
                                const toolToUse = block.name;
                                let toolResult: string | undefined;
                                let toolErrorMsg: string | undefined;
                                let toolFound: boolean = false;
                                for (const tool of this.tools) {
                                    if (tool.Param.name === toolToUse) {
                                        if (this.verbose) {
                                            logger.debug({ toolToUse }, "Using tool");
                                        }
                                        try {
                                            toolResult = await tool.Execute(block.input);
                                        } catch (err) {
                                            toolErrorMsg = err instanceof Error ? err.message : String(err);
                                            logger.error({ toolToUse, toolErrorMsg }, "Tool execution failed");
                                        }

                                        if (this.verbose && !toolErrorMsg) {
                                            logger.debug({ toolToUse, resultLength: toolResult?.length }, "Tool execution successful");
                                        }
                                        toolFound = true;
                                        break;
                                    }
                                }
                                if (!toolFound) {
                                    toolErrorMsg = `Tool not found: ${toolToUse}`;
                                    logger.error({ toolToUse }, "Tool not found");
                                }

                                toolsResults.push({
                                    type: "tool_result",
                                    tool_use_id: block.id,
                                    content: toolErrorMsg || toolResult,
                                    is_error: !!toolErrorMsg
                                });
                        }
                    }

                    if (!hasToolUse) {
                        break;
                    }

                    if (this.verbose) {
                        logger.debug({ toolResultCount: toolsResults.length }, "Sending tool results to Claude");
                    }

                    conversation.push({ role: "user", content: toolsResults });
                    message = await this.runInference(conversation);
                    conversation.push({ role: "assistant", content: message.content });
                }
            } catch (err) {
                if (this.verbose) {
                    logger.debug({ err }, "Error during inference");
                }
                logger.error(err);
                return;
            }
        }

        if (this.verbose) {
            logger.debug("Conversation ended");
        }
    }

    async runInference(conversation: Anthropic.MessageParam[]) {

        const anthropicTools: Anthropic.ToolUnion[] = this.tools.map(tool => tool.Param);

        if (this.verbose) {
            logger.debug("Making API call to Claude with model: claude-3-5-haiku-latest");
        }

        try {
            const message = await this.client.messages.create({
                model: "claude-3-5-haiku-latest",
                max_tokens: 1024,
                messages: conversation,
                tools: anthropicTools,
            });

            if (this.verbose) {
                logger.debug("API call successful, response received");
            }
            return message;
        } catch (err) {
            if (this.verbose) {
                logger.debug({ err }, "API call failed");
            }
            throw err;
        }
    }
}

function GenerateSchema(v: z.ZodType): Anthropic.Tool['input_schema'] {
    const schema = (v as any).toJSONSchema()
    return {
        type: "object",
        properties: schema.properties,
        required: schema.required,
    }
}

program.parse(process.argv);
