"use client";

import { useState } from "react";

export default function GameBoard() {
  const [players, setPlayers] = useState([]);
  const [logs, setLogs] = useState([]);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white p-4">
      <h2 className="text-2xl font-bold text-red-500 mb-4">Werewolf Game</h2>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {/* placeholders for players */}
      </div>

      <div className="flex-1 bg-slate-800 rounded p-4 overflow-y-auto">
        <h3 className="font-semibold text-gray-400 mb-2">Game Master Log</h3>
        {/* placeholders for GM logs */}
      </div>
    </div>
  );
}
