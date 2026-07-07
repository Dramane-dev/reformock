import * as upload from "../../utils/upload.ts";
import { config } from "../../config.ts";
import { adminSearchFlows } from "./search.ts";
import { adminInjectFlows } from "./inject.ts";
import { getLifecycleStatuses } from "./lifecycle-statuses.ts";
import { forceFlowStatus } from "./status.ts";
import { adminGenerate } from "./generate.ts";
import { adminReset } from "./reset.ts";

import type { FastifyInstance } from "fastify";

export function registerAdminRoutes(app: FastifyInstance): void {
  app.register(
    async (admin) => {
      admin.post("/flows/search", adminSearchFlows);
      admin.post(
        "/inject",
        { preHandler: upload.array("files", config.server.maxUploadFiles) },
        adminInjectFlows,
      );
      admin.get("/lifecycle-statuses", getLifecycleStatuses);
      admin.post("/flows/:flowId/status", forceFlowStatus);
      admin.post("/generate", adminGenerate);
      admin.post("/reset", adminReset);
    },
    { prefix: "/admin" },
  );
}
