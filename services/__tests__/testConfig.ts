import { ConfigService } from "../configService";
import { mergeConfig } from "../../src/configSchema";

/** Fake ConfigService for service tests — always returns defaults (without Notion). */
export const fakeConfig = { getConfig: async () => mergeConfig(undefined) } as unknown as ConfigService;
