"use client";

export interface DownloadResultStrings {
  saveButton?: string;
  resetButton?: string;
}

interface Props {
  fileUrl: string;
  fileName?: string;
  themeColor: string;
  darkMode?: boolean;
  onReset?: () => void;
  strings?: DownloadResultStrings;
  children?: React.ReactNode;
}

export function DownloadResult({
  fileUrl,
  fileName,
  themeColor,
  darkMode,
  onReset,
  strings,
  children,
}: Props) {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = fileUrl;
    if (fileName) link.download = fileName;
    link.rel = "noopener";
    link.click();
  };

  return (
    <div
      className="p-4 rounded-lg text-center space-y-3"
      style={{
        backgroundColor: darkMode ? "rgba(34,197,94,0.1)" : "#f0fdf4",
        border: `1px solid ${darkMode ? "rgba(34,197,94,0.3)" : "#bbf7d0"}`,
      }}
    >
      {children}
      <button
        type="button"
        onClick={handleDownload}
        className="text-white px-6 py-3 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
        style={{ backgroundColor: themeColor }}
      >
        {strings?.saveButton ?? "Save File"}
      </button>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="block mx-auto text-xs underline hover:opacity-70"
          style={{ color: darkMode ? "#86efac" : "#16a34a" }}
        >
          {strings?.resetButton ?? "Start over"}
        </button>
      )}
    </div>
  );
}
