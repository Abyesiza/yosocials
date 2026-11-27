import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError, UTFiles } from "uploadthing/server";
import { z } from "zod";
import { callApiWithSession } from "@/app/lib/server/api";
import { apiMessage } from "@/app/lib/server/oauth";

const f = createUploadthing();

// Limits mirror the API (common/storage/media-types.ts) and TikTok's: one video, or up to 35 photos.
const video = { maxFileSize: "512MB", maxFileCount: 1 } as const;
const image = { maxFileSize: "16MB", maxFileCount: 35 } as const;

export const uploadRouter = {
  postMedia: f({
    "video/mp4": video,
    "video/quicktime": video,
    "video/webm": video,
    "image/jpeg": image,
    "image/webp": image,
  })
    .input(z.object({ workspaceId: z.uuid() }))
    // The API decides: the user must be an editor of the workspace, and it names each file.
    .middleware(async ({ req, input, files }) => {
      const { upstream, signedOut } = await callApiWithSession(req, `workspaces/${input.workspaceId}/media/uploads`, {
        method: "POST",
        body: JSON.stringify({ files: files.map((file) => ({ contentType: file.type, size: file.size })) }),
      });
      if (signedOut) throw new UploadThingError("Your session has ended. Sign in again to upload.");
      if (!upstream?.ok) throw new UploadThingError(await apiMessage(upstream, "Uploading isn’t allowed here."));
      const { customIds } = (await upstream.json()) as { customIds: string[] };
      return { [UTFiles]: files.map((file, i) => ({ ...file, customId: customIds[i] })) };
    })
    .onUploadComplete(() => ({})),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
