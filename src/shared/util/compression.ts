export async function gzip(data: Buffer | Uint8Array): Promise<Buffer> {
  const blob = new Blob([data as unknown as BlobPart], {
    type: "application/octet-stream",
  });
  const compressed = blob
    .stream()
    .pipeThrough(
      new CompressionStream("gzip") as unknown as ReadableWritablePair<
        Uint8Array,
        Uint8Array
      >
    );
  return Buffer.from(await new Response(compressed).arrayBuffer());
}

export async function gunzip(data: Buffer | Uint8Array): Promise<Buffer> {
  const blob = new Blob([data as unknown as BlobPart], {
    type: "application/octet-stream",
  });
  const decompressed = blob
    .stream()
    .pipeThrough(
      new DecompressionStream("gzip") as unknown as ReadableWritablePair<
        Uint8Array,
        Uint8Array
      >
    );
  return Buffer.from(await new Response(decompressed).arrayBuffer());
}
