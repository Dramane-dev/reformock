import * as upload from "../../utils/upload.ts";
import { depositFlow } from "./deposit.ts";
import { searchFlows } from "./search.ts";
import { downloadFlow } from "./download.ts";

import type { FastifyInstance } from "fastify";

export function registerFlowRoutes(app: FastifyInstance): void {
  app.register(
    async (flows) => {
      flows.post("", { preHandler: upload.single("file") }, depositFlow);
      flows.post("/search", searchFlows);
      flows.get("/:flowId", downloadFlow);
    },
    { prefix: "/flows" },
  );
}
