import React from "react";
import { Sparkles, Compass, Rocket, Film } from "lucide-react";

export interface Preset {
  id: string;
  title: string;
  category: string;
  icon: "rocket" | "compass" | "film" | "sparkles";
  script: string;
}

export const PRESET_SCRIPTS: Preset[] = [
  {
    id: "apollo-11",
    title: "Apollo 11 Moon Landing",
    category: "History / Science",
    icon: "rocket",
    script: `[VISUAL: Saturn V launch rocket taking off with plumes of fire]
In July 1969, three astronauts embarked on humanity's most daring voyage to the Moon.

[VISUAL: Neil Armstrong descending lunar module ladder onto moon surface]
Neil Armstrong stepped onto the lunar surface, declaring one small step for man, one giant leap for mankind.

[GRAPHIC: Stat card showing $25 Billion project cost]
The entire Apollo project cost over 25 billion dollars, representing four percent of the federal budget.

[VISUAL: Earth seen from lunar orbit glowing in the void]
Yet its true value was not measured in dollars, but in proving that the impossible was within reach.`,
  },
  {
    id: "deep-ocean",
    title: "The Mariana Trench",
    category: "Nature / Exploration",
    icon: "compass",
    script: `[VISUAL: Deep ocean submarine descending into dark abyss]
Nearly eleven thousand meters beneath the Pacific lies Challenger Deep, the deepest point on Earth.

[VISUAL: Bioluminescent jellyfish drifting in black waters]
In total darkness and crushing pressure, alien-like creatures survive with mesmerizing bioluminescence.

[GRAPHIC: Stat card showing 1,000 atmospheres of pressure]
The water pressure exceeds one thousand atmospheres, equivalent to fifty jumbo jets resting on a human.

[VISUAL: Vast underwater mountain range and hydrothermal vents]
We know more about the surface of Mars than we do about the mysteries hidden in our own ocean depths.`,
  },
  {
    id: "ai-revolution",
    title: "The Rise of Artificial Intelligence",
    category: "Technology",
    icon: "sparkles",
    script: `[VISUAL: Glowing neural network connections and data streams]
In just a few short years, artificial intelligence has evolved from simple algorithms to powerful reasoning systems.

[VISUAL: High-tech robotic arm assembling complex electronics]
Machines can now generate art, write code, and discover life-saving medical treatments in record time.

[GRAPHIC: Stat card showing 100 Trillion computations per second]
Modern neural processors perform over one hundred trillion calculations every single second.

[VISUAL: Futuristic cityscape with autonomous transport]
As this technology advances, the boundary between human imagination and machine capability is disappearing.`,
  },
];

interface PresetSelectorProps {
  onSelect: (script: string) => void;
}

export function PresetSelector({ onSelect }: PresetSelectorProps) {
  const getIcon = (icon: Preset["icon"]) => {
    switch (icon) {
      case "rocket":
        return <Rocket className="w-4 h-4 text-amber-400" />;
      case "compass":
        return <Compass className="w-4 h-4 text-cyan-400" />;
      case "sparkles":
        return <Sparkles className="w-4 h-4 text-purple-400" />;
      default:
        return <Film className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
        <span>Try a sample script preset:</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {PRESET_SCRIPTS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset.script)}
            className="flex flex-col items-start p-3 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-850 transition-all text-left group"
          >
            <div className="flex items-center gap-2 mb-1 w-full">
              <div className="p-1 rounded bg-slate-800 group-hover:bg-slate-750">
                {getIcon(preset.icon)}
              </div>
              <span className="text-xs font-semibold text-slate-200 group-hover:text-blue-300 truncate">
                {preset.title}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 line-clamp-2">
              {preset.script.split("\n")[1] || preset.script.slice(0, 70)}...
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
