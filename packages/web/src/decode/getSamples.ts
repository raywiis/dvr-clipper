import { assert } from "../assert.ts";
import { streamAviSamples } from "./avi.ts";

export async function *streamSamples(
  file: File,
) {
  const head = new DataView(await file.slice(0, 12).arrayBuffer());
  assert(head.byteLength >= 12, "File too small to be a video");

  const tag = (offset: number) =>
    String.fromCharCode(
      head.getUint8(offset),
      head.getUint8(offset + 1),
      head.getUint8(offset + 2),
      head.getUint8(offset + 3),
    );

  if (tag(0) === "RIFF" && tag(8) === "AVI ") {
    const sampleStream = streamAviSamples(file);
    yield *sampleStream;
  } else {
    assert(
      ["ftyp", "moov", "mdat", "free", "wide", "skip"].includes(tag(4)),
      "Unrecognized container: expected an AVI or MOV/MP4 file",
    );
    const { streamMovSamples } = await import("./mov.ts");
    const sampleStream = streamMovSamples(file);
    yield *sampleStream;
  }
}
