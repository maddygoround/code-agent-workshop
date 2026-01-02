import Anthropic from "@anthropic-ai/sdk";
import { ToolDefinition } from "./types";
import { logger } from "../logger";

export class Agent {
    private client: Anthropic;
    private getUserMessage: () => Promise<string>;
    private verbose: boolean;
    private tools: ToolDefinition[];

    constructor(
        client: Anthropic,
        getUserMessage: () => Promise<string>,
        tools: ToolDefinition[],
        verbose?: boolean
    ) {
        this.client = client;
        this.getUserMessage = getUserMessage;
        this.tools = tools;
        this.verbose = !!verbose;
    }

    async run() {
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
                conversation.push({ role: "assistant", content: message.content });

                while (true) {
                    let hasToolUse = false;
                    let toolsResults: Anthropic.ContentBlockParam[] = [];

                    if (this.verbose) {
                        logger.debug({ conversationLength: conversation.length }, "Received response from Claude");
                    }

                    for (const block of message.content) {
                        if (block.type === "text") {
                            logger.info(`\x1b[92mClaude\x1b[0m: ${block.text}`);
                        } else if (block.type === "tool_use") {
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
                                is_error: !!toolErrorMsg,
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

    private async runInference(conversation: Anthropic.MessageParam[]) {
        const anthropicTools: Anthropic.ToolUnion[] = this.tools.map((tool) => tool.Param);

        if (this.verbose) {
            logger.debug("Making API call to Claude");
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
