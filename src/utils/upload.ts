import type { FastifyRequest } from "fastify";

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

declare module "fastify" {
  interface FastifyRequest {
    uploadedFile?: UploadedFile;
    uploadedFiles?: UploadedFile[];
  }
}

async function collectParts(
  req: FastifyRequest,
): Promise<{ body: Record<string, unknown>; files: UploadedFile[] }> {
  const body: Record<string, unknown> = {};
  const files: UploadedFile[] = [];
  for await (const part of req.parts()) {
    if (part.type === "file") {
      const buffer = await part.toBuffer();
      files.push({
        fieldname: part.fieldname,
        originalname: part.filename,
        mimetype: part.mimetype || "application/octet-stream",
        buffer,
      });
    } else {
      body[part.fieldname] = part.value;
    }
  }
  return { body, files };
}

export function single(fieldName: string) {
  return async function uploadSingle(req: FastifyRequest): Promise<void> {
    const { body, files } = await collectParts(req);
    req.body = body;
    req.uploadedFiles = files;
    req.uploadedFile = files.find((f) => f.fieldname === fieldName) ?? files[0];
  };
}

export function array(fieldName: string, maxCount: number) {
  return async function uploadArray(req: FastifyRequest): Promise<void> {
    const { body, files } = await collectParts(req);
    req.body = body;
    req.uploadedFiles = files.filter((f) => f.fieldname === fieldName).slice(0, maxCount);
  };
}
