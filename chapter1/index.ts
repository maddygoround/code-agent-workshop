import { Command } from "commander";
import { createInterface } from "readline";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../logger";

const program = new Command();

program
    .version("1.0.0")
    .description("A TypeScript CLI")
    .option("-v, --verbose", "verbose output")
    .action(async (options) => {
        const verbose = !!options.verbose;

        if (verbose) {
            logger.level = "debug";
            logger.debug("verbose logging enabled");
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

        const getUserMessage = async (): Promise<string | undefined> => {
            const result = await lineIterator.next();
            if (result.done) {
                return undefined;
            }
            return result.value;
        };

        const agent = new Agent(client, getUserMessage, verbose);
        await agent.run();

        rl.close();
    });

class Agent {
    private client: Anthropic;
    private getUserMessage: () => Promise<string | undefined>;
    private verbose: boolean;

    constructor(
        client: Anthropic,
        getUserMessage: () => Promise<string | undefined>,
        verbose: boolean
    ) {
        this.client = client;
        this.getUserMessage = getUserMessage;
        this.verbose = verbose;
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
            const userInput = await this.getUserMessage();
            if (userInput === undefined) {
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
                const message = await this.runInference(conversation);
                // The SDK returns the message object which fits the MessageParam structure's content 
                // but we need to ensure we push the correct format { role: "assistant", content: ... }
                conversation.push({ role: "assistant", content: message.content });

                if (this.verbose) {
                    logger.debug({ conversationLength: conversation.length }, "Received response from Claude");
                }

                for (const block of message.content) {
                    if (block.type === "text") {
                        logger.info(`\x1b[92mClaude\x1b[0m: ${block.text}`);
                    }
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
        if (this.verbose) {
            logger.debug("Making API call to Claude with model: claude-3-5-haiku-latest");
        }

        try {
            const message = await this.client.messages.create({
                model: "claude-3-5-haiku-latest",
                max_tokens: 1024,
                messages: conversation,
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

program.parse(process.argv);
