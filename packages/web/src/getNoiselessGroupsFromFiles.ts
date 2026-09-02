import type { AppState } from "./appState";
import { assert } from "./assert";
import type { Sample } from "./decode/mjpeg";

export function getNoiselessGroupsFromFiles(appState: AppState, files: File[]) {
  const inputs = files.map((file) => {
    const samples = appState.fileSamples.get(file);
    const noise = appState.fileNoise.get(file);
    assert(samples, "Missing samples");
    assert(noise, "Missing video noise");
    return { file, samples, noise };
  });

  const noiseThreshold = 0.5;
  const clearFrameTimeThreshold = 20;

  type Section = Array<{ file: File; samples: Sample[] }>;
  type Groups = Array<Section>;
  const groups: Groups = [];
  let iteratorState:
    { recording: true; lastClearFrame: number } | { recording: false } = {
    recording: false,
  };

  const firstInput = inputs.at(0);
  assert(firstInput, "No first input");

  for (const input of inputs) {
    const noiseIterator = firstInput.noise[Symbol.iterator]();
    let noisePoint = noiseIterator.next();
    assert(!noisePoint.done, "No noise in the first iterator");

    if (iteratorState.recording) {
      const lastSection = groups.at(-1);
      assert(
        lastSection,
        "No last group when swapping file and still recording",
      );
      lastSection.push({ file: input.file, samples: [] });
    }

    for (const sample of input.samples) {
      if (!iteratorState.recording && noisePoint.value.score < noiseThreshold) {
        iteratorState = {
          recording: true,
          lastClearFrame: sample.time,
        };
        groups.push([{ file: input.file, samples: [] }]);
      }

      if (iteratorState.recording) {
        const latestGroup = groups.at(-1);
        assert(latestGroup, "No last group");
        const lastFileInGroup = latestGroup.at(-1);
        assert(lastFileInGroup, "No last file in group");
        lastFileInGroup.samples.push(sample);

        if (noisePoint.value.score < noiseThreshold) {
          iteratorState.lastClearFrame = sample.time;
        }

        const clearFrameDelta = sample.time - iteratorState.lastClearFrame;
        if (clearFrameDelta > clearFrameTimeThreshold) {
          iteratorState = { recording: false };
        }
      }

      if (noisePoint.value.time < sample.time) {
        noisePoint = noiseIterator.next();
      }
      assert(!noisePoint.done, "Abrupt noise end");
    }
  }

  return groups;
}
