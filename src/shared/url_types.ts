import { stripLeadingSlash } from "@/shared/util/helpers";
import { valueLiteral } from "@/shared/util/type_helpers";
import type { ZodType } from "zod";
import { z } from "zod";

interface CloudBucket {
  cdnDomain?: string;
}

export const allCloudBuckets = valueLiteral<CloudBucket>()({
  "biomes-social": {
    cdnDomain: "social.biomes.gg",
  },
  // Legacy
  "zones-social": {
    cdnDomain: "social.biomes.gg",
  },
  "biomes-static": {
    // GLITCH_REMOVE_STATIC_BIOMES_GG_V193: do not serve this bucket through
    // the legacy static CDN. Local/Glitch runtimes use /buckets/...;
    // non-local cloud callers fall back to the bucket URL below.
    cdnDomain: undefined,
  },
  // Where we store user-filed bug report attachment data.
  "report-attachments": { cdnDomain: undefined },
  // Where we store world backups
  "biomes-backup": { cdnDomain: undefined },
  // Where Bikkie binary data is stored.
  "biomes-bikkie": { cdnDomain: undefined },
});

export function useLocalDisk() {
  // GLITCH_PROD_LOCAL_PARITY_V1: any local-asset/GCP-disabled runtime uses local public buckets.
  return (
    process.env.LOCAL_GCS === "1" ||
    process.env.GCS_LOCAL_DISK === "1" ||
    process.env.GLITCH_LOCAL_ASSETS === "1" ||
    process.env.NEXT_PUBLIC_GLITCH_LOCAL_ASSETS === "1" ||
    process.env.GLITCH_DISABLE_GCP === "1"
  );
}

export function bucketURL(bucket: string, path: string, useCDN = true) {
  if (useLocalDisk()) {
    return `/buckets/${bucket}/${stripLeadingSlash(path)}`;
  }
  const maybeVal = allCloudBuckets[bucket as CloudBucketKey];
  if (maybeVal?.cdnDomain && useCDN) {
    return `https://${maybeVal.cdnDomain}/${stripLeadingSlash(path)}`;
  }
  return `https://storage.cloud.google.com/${bucket}/${stripLeadingSlash(
    path
  )}`;
}

export function localPath(bucket: CloudBucketKey, path: string) {
  return `./public${bucketURL(bucket, path)}`;
}

type ValidCloudBucketKey = keyof typeof allCloudBuckets;

export const zCloudBucketKey = z.enum([
  "biomes-backup",
  "biomes-social",
  "biomes-static",
  "report-attachments",
  "biomes-bikkie",
  "zones-social",
] as [ValidCloudBucketKey, ...ValidCloudBucketKey[]]);

export type CloudBucketKey = z.infer<typeof zCloudBucketKey>;

function imageBundleType<TPayload extends ZodType>(payload: TPayload) {
  return z.object({
    webp_320w: payload.optional(),
    webp_640w: payload.optional(),
    webp_1280w: payload.optional(),
    png_1280w: payload.optional(),
    webp_original: payload.optional(),
  });
}

export const zImageBufferBundle = imageBundleType(z.instanceof(Buffer));
export const zImageCloudBundle = imageBundleType(z.string());
export const zBucketedImageCloudBundle = zImageCloudBundle.extend({
  bucket: zCloudBucketKey,
});

export type ImageBufferBundle = z.infer<typeof zImageBufferBundle>;
export type ImageCloudBundle = z.infer<typeof zImageCloudBundle>;
export type BucketedImageCloudBundle = z.infer<
  typeof zBucketedImageCloudBundle
>;

export const zImageUrls = zImageCloudBundle.extend({
  fallback: z.optional(z.string()),
});

export type ImageUrls = z.infer<typeof zImageUrls>;
