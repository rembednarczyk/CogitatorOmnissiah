import { ConfigService } from "../configService";
import { mergeConfig } from "../../src/configSchema";

/** Fake ConfigService dla testów serwisów — zawsze zwraca defaulty (bez Notion). */
export const fakeConfig = { getConfig: async () => mergeConfig(undefined) } as unknown as ConfigService;
