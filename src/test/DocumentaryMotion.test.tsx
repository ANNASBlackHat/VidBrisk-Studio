// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  DocumentViewer,
  RatingCard,
  SourcingCard,
  MeasurementCompare,
  ReprintChain,
  VerdictTable,
  getMotionComponent,
  MOTION_COMPONENTS,
} from "../components/motion/registry";

let mockedFrame = 30;

vi.mock("remotion", () => {
  const AbsoluteFill = ({
    style,
    children,
  }: {
    style?: CSSProperties;
    children?: ReactNode;
  }) =>
    React.createElement(
      "div",
      { style, "data-testid": "absolute-fill" },
      children
    );
  const useVideoConfig = () => ({ fps: 30, durationInFrames: 150 });
  const useCurrentFrame = () => mockedFrame;
  const interpolate = (
    frame: number,
    input: number[],
    output: number[]
  ) => {
    return output[0];
  };
  const spring = () => 1;

  return {
    AbsoluteFill,
    useVideoConfig,
    useCurrentFrame,
    interpolate,
    spring,
  };
});

describe("Documentary Motion Components", () => {
  afterEach(() => {
    cleanup();
  });

  it("resolves all new documentary components from the registry", () => {
    expect(getMotionComponent("Archival/DocumentViewer")).toBe(DocumentViewer);
    expect(getMotionComponent("Evidence/RatingCard")).toBe(RatingCard);
    expect(getMotionComponent("Evidence/SourcingCard")).toBe(SourcingCard);
    expect(getMotionComponent("DataAnimations/MeasurementCompare")).toBe(MeasurementCompare);
    expect(getMotionComponent("Evidence/ReprintChain")).toBe(ReprintChain);
    expect(getMotionComponent("Evidence/VerdictTable")).toBe(VerdictTable);
  });

  it("renders DocumentViewer with title and highlighted text", () => {
    const { getAllByText, getByText } = render(
      <DocumentViewer
        title="HOMEWARD MAIL"
        subtext="29 JUNE 1874"
        highlightText="Sunk by a cuttlefish"
      />
    );
    expect(getAllByText("HOMEWARD MAIL").length).toBeGreaterThanOrEqual(1);
    expect(getByText('"Sunk by a cuttlefish"')).toBeDefined();
  });

  it("renders RatingCard with locked rating badge and test", () => {
    const { getByText } = render(
      <RatingCard
        rating="CONFIRMED"
        claim="Giant squid exists"
        test="Primary sources document it and do not contradict each other"
      />
    );
    expect(getByText("CONFIRMED")).toBeDefined();
    expect(getByText('"Giant squid exists"')).toBeDefined();
  });

  it("renders SourcingCard with all 4 tiers and marked non-independent tier", () => {
    const { getByText } = render(
      <SourcingCard
        tier={4}
        tierName="REPRINT"
        source="Sacramento Daily Union"
      />
    );
    expect(getByText("FOUR-TIER SOURCING HIERARCHY")).toBeDefined();
    expect(getByText("NOT INDEPENDENT")).toBeDefined();
    expect(getByText('"Sacramento Daily Union"')).toBeDefined();
  });

  it("renders MeasurementCompare with steps", () => {
    const { getByText } = render(
      <MeasurementCompare
        title="SPECIMEN SHRINKAGE OVER TIME"
        steps={[
          { label: "Water", value: "19 ft" },
          { label: "Preserved", value: "17 ft" },
          { label: "Desiccated", value: "13 ft 1 in" },
        ]}
      />
    );
    expect(getByText("19 ft")).toBeDefined();
    expect(getByText("17 ft")).toBeDefined();
    expect(getByText("13 ft 1 in")).toBeDefined();
  });

  it("renders ReprintChain with newspaper transmission nodes", () => {
    const { getByText } = render(
      <ReprintChain
        nodes={[
          { outlet: "Homeward Mail", date: "29 June 1874" },
          { outlet: "The Times", date: "4 July 1874" },
          { outlet: "News of the World", date: "5 July 1874" },
        ]}
      />
    );
    expect(getByText("Homeward Mail")).toBeDefined();
    expect(getByText("The Times")).toBeDefined();
    expect(getByText("News of the World")).toBeDefined();
  });

  it("renders VerdictTable with claim and color-coded rating badges", () => {
    const { getByText } = render(
      <VerdictTable
        claims={[
          { claim: "Giant squid exists", rating: "CONFIRMED" },
          { claim: "Schooner Pearl sunk by a squid", rating: "UNSUPPORTED" },
        ]}
      />
    );
    expect(getByText("Giant squid exists")).toBeDefined();
    expect(getByText("CONFIRMED")).toBeDefined();
    expect(getByText("Schooner Pearl sunk by a squid")).toBeDefined();
    expect(getByText("UNSUPPORTED")).toBeDefined();
  });
});
