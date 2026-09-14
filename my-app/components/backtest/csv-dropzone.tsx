"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, FileText, CheckCircle, Zap, RefreshCw } from "lucide-react";

interface CsvDropzoneProps {
  onCsvLoaded: (text: string, filename: string) => void;
  loadedFilename: string | null;
  tradeCount?: number;
  isLoading?: boolean;
}

export default function CsvDropzone({
  onCsvLoaded,
  loadedFilename,
  tradeCount,
  isLoading,
}: CsvDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      alert("Please upload a .csv file exported from TradingView.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) onCsvLoaded(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const loadDemo = async () => {
    setLoadingDemo(true);
    try {
      const res = await fetch("/api/backtest/demo");
      if (!res.ok) throw new Error("Could not load demo CSV");
      const text = await res.text();
      onCsvLoaded(text, "Strategy.csv (TradingView BTC 15m)");
    } catch (err) {
      console.error(err);
      alert("Failed to load demo strategy. You can upload any TradingView CSV.");
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFile(e.target.files[0]);
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-xl border border-dashed p-6 sm:p-8 text-center transition-all duration-200 ${
          isDragging
            ? "border-emerald-500 bg-emerald-500/5"
            : loadedFilename
            ? "border-emerald-500/40 bg-[#0d131a]"
            : "border-neutral-800 bg-[#0c0d12] hover:border-neutral-700 hover:bg-[#10121a]"
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl border transition-colors ${
              loadedFilename
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-neutral-800 bg-neutral-900 text-neutral-400"
            }`}
          >
            {loadedFilename ? (
              <CheckCircle className="h-6 w-6 text-emerald-400" />
            ) : (
              <UploadCloud className="h-6 w-6" />
            )}
          </div>

          <div>
            {loadedFilename ? (
              <div>
                <p className="font-medium text-neutral-100 flex items-center justify-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-400" />
                  {loadedFilename}
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  {tradeCount !== undefined ? `${tradeCount.toLocaleString()} strategy signals loaded` : "Ready for backtest"} · Click to replace
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-neutral-200">
                  Drop your TradingView Strategy CSV here, or{" "}
                  <span className="text-emerald-400 underline underline-offset-4">browse</span>
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  Exports from Pine Script strategy tester (contains Trade #, Date, Signal, Price)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-neutral-400 px-1">
        <span>No CSV on hand? Test with live production data:</span>
        <button
          type="button"
          disabled={loadingDemo || isLoading}
          onClick={(e) => {
            e.stopPropagation();
            loadDemo();
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-medium text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50 cursor-pointer"
        >
          {loadingDemo ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Zap className="h-3.5 w-3.5 fill-emerald-400/30" />
          )}
          Load Demo Strategy (Strategy.csv)
        </button>
      </div>
    </div>
  );
}
