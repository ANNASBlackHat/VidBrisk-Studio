"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Tag,
  Plus,
  Link2,
  Check,
  AlertCircle,
  ExternalLink,
  Search,
  X,
  Play,
  Clock,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { Entity, Shot } from "@/lib/types";

export function FootageEntitiesModal({ onClose }: { onClose: () => void }) {
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("ship");
  const [newAliases, setNewAliases] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [linkingShotId, setLinkingShotId] = useState<string | null>(null);

  const { data: entities, isLoading, mutate } = useSWR(
    "footage-entities",
    () => api.getFootageEntities(),
    { revalidateOnFocus: false }
  );

  const { data: suggestions, isLoading: isSuggLoading, mutate: mutateSugg } = useSWR(
    selectedEntity ? ["entity-suggestions", selectedEntity.id] : null,
    () => api.getEntitySuggestions(selectedEntity!.id, 12),
    { revalidateOnFocus: false }
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const aliasesList = newAliases
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      const created = await api.createFootageEntity({
        name: newName.trim(),
        entity_type: newType,
        aliases: aliasesList,
        notes: newNotes.trim() || undefined,
      });

      await mutate();
      setSelectedEntity(created);
      setIsCreating(false);
      setNewName("");
      setNewAliases("");
      setNewNotes("");
    } catch (err) {
      console.error("Failed to create entity:", err);
    }
  };

  const handleLinkShot = async (shotId: string) => {
    if (!selectedEntity) return;
    try {
      setLinkingShotId(shotId);
      await api.linkShotEntity(shotId, selectedEntity.id);
      await mutate();
      await mutateSugg();
    } catch (err) {
      console.error("Failed to link shot:", err);
    } finally {
      setLinkingShotId(null);
    }
  };

  const entityList = entities || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-4xl max-h-[85vh] bg-slate-950 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Named Subjects (Controlled Vocabulary)</h2>
              <p className="text-xs text-slate-400">Link footage to historical ships, marine creatures, and entities</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* Left: Entities List */}
          <div className="p-4 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Subject Entities ({entityList.length})</span>
                <button
                  onClick={() => setIsCreating(!isCreating)}
                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New
                </button>
              </div>

              {/* Create Entity Form */}
              {isCreating && (
                <form onSubmit={handleCreateSubmit} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2.5 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Subject Name</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Schooner Pearl"
                      className="w-full bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Type</label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 px-2 py-1.5 rounded text-slate-300 focus:outline-none"
                    >
                      <option value="ship">Ship / Vessel</option>
                      <option value="animal">Animal / Creature</option>
                      <option value="location">Location / Wreck Site</option>
                      <option value="concept">Concept / Topic</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Aliases (comma separated)</label>
                    <input
                      type="text"
                      value={newAliases}
                      onChange={(e) => setNewAliases(e.target.value)}
                      placeholder="Pearl, The Pearl 1874"
                      className="w-full bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded text-white focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="px-2.5 py-1 text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium"
                    >
                      Save Entity
                    </button>
                  </div>
                </form>
              )}

              {/* List */}
              <div className="space-y-1.5">
                {entityList.map((ent) => (
                  <button
                    key={ent.id}
                    onClick={() => setSelectedEntity(ent)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${
                      selectedEntity?.id === ent.id
                        ? "bg-indigo-600/10 border-indigo-500/50 text-white"
                        : "bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{ent.name}</span>
                      <span className="text-[10px] uppercase font-bold text-slate-500">{ent.entity_type}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center justify-between">
                      <span>{ent.linked_shots_count} shots linked</span>
                      {ent.aliases.length > 0 && (
                        <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
                          aka {ent.aliases.join(", ")}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right 2 Columns: Selected Entity Details & Suggested Shots */}
          <div className="p-5 md:col-span-2 overflow-y-auto space-y-4">
            {selectedEntity ? (
              <div className="space-y-5">
                {/* Entity Details Header */}
                <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      {selectedEntity.name}
                      <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono capitalize">
                        {selectedEntity.entity_type}
                      </span>
                    </h3>
                    <span className="text-xs text-slate-400">
                      <strong>{selectedEntity.linked_shots_count}</strong> shots linked
                    </span>
                  </div>

                  {selectedEntity.aliases.length > 0 && (
                    <div className="text-xs text-slate-400">
                      <strong className="text-slate-500">Aliases: </strong>
                      {selectedEntity.aliases.join(", ")}
                    </div>
                  )}

                  {selectedEntity.notes && (
                    <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      {selectedEntity.notes}
                    </p>
                  )}
                </div>

                {/* Suggested Footage Matches */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      Suggested Matching Footage
                    </span>
                    <span className="text-slate-500">Proposed by semantic entity resolver</span>
                  </div>

                  {isSuggLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-pulse">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-32 bg-slate-900 rounded-xl border border-slate-800" />
                      ))}
                    </div>
                  ) : (suggestions || []).length === 0 ? (
                    <div className="p-8 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                      No unlinked suggestions found matching "{selectedEntity.name}".
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {(suggestions || []).map((shot) => (
                        <div
                          key={shot.id}
                          className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-2.5 flex flex-col justify-between text-xs space-y-2 hover:border-slate-700 transition-colors"
                        >
                          <div className="relative aspect-video w-full bg-slate-950 rounded-lg overflow-hidden">
                            {shot.thumbnail_url ? (
                              <img src={shot.thumbnail_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-600 text-[10px]">
                                No preview
                              </div>
                            )}
                            <span className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[9px] text-slate-300 font-mono">
                              {shot.duration_sec.toFixed(1)}s
                            </span>
                          </div>

                          <div>
                            <span className="capitalize text-[10px] font-medium text-slate-400 block">
                              {shot.provider}
                            </span>
                            <p className="text-[11px] text-slate-200 line-clamp-1 font-medium">
                              {shot.item_metadata?.title ? String(shot.item_metadata.title) : (shot.caption || shot.id.slice(0, 8))}
                            </p>
                          </div>

                          <button
                            onClick={() => handleLinkShot(shot.id)}
                            disabled={linkingShotId === shot.id}
                            className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                          >
                            <Link2 className="w-3 h-3" />
                            {linkingShotId === shot.id ? "Linking..." : "Confirm Link"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 text-xs">
                <Tag className="w-8 h-8 opacity-40 mb-2" />
                Select an entity from the list to view linked shots and suggestions.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
