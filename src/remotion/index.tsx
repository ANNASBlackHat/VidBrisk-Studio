import React from "react";
import { registerRoot, Composition } from "remotion";
import { VideoComposition } from "../components/editor/VideoComposition";
import { EditorProjectState } from "../adapters/timelineToEditorState";
import "../app/globals.css";

const defaultSampleState: EditorProjectState = {
  jobId: "default",
  fps: 30,
  totalDuration: 24.8,
  width: 1920,
  height: 1080,
  orientation: "horizontal",
  tracks: [],
  selectedClipId: null,
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="VideoExport"
      component={VideoComposition as unknown as React.FC<Record<string, unknown>>}
      durationInFrames={30 * 25}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        projectState: defaultSampleState,
      }}
      calculateMetadata={({ props }) => {
        const state = (props as { projectState: EditorProjectState }).projectState;
        const fps = state?.fps || 30;
        const totalDuration = state?.totalDuration || 10;
        const width = state?.width || 1920;
        const height = state?.height || 1080;

        return {
          durationInFrames: Math.max(1, Math.round(totalDuration * fps)),
          fps,
          width,
          height,
        };
      }}
    />
  );
};

registerRoot(RemotionRoot);
