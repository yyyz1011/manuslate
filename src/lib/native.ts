import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export interface NativeMarkdownFile {
  path: string;
  name: string;
  content: string;
  modifiedAt: number;
  relativePath?: string;
  categoryName?: string;
}

export interface NativeFileSnapshot {
  content: string;
  modifiedAt: number;
}

export interface NativeWriteResult {
  path: string;
  name: string;
  modifiedAt: number;
}

const markdownFilters = [{ name: "Markdown", extensions: ["md", "markdown", "mdown", "txt"] }];

export function isDesktopApp(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export function pathName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

export async function chooseNativeMarkdownFiles(): Promise<NativeMarkdownFile[]> {
  const selected = await open({ multiple: true, directory: false, filters: markdownFilters, title: "打开 Markdown" });
  if (!selected) return [];
  const paths = Array.isArray(selected) ? selected : [selected];
  return invoke<NativeMarkdownFile[]>("read_markdown_files", { paths });
}

export async function chooseNativeMarkdownDirectory(): Promise<NativeMarkdownFile[]> {
  const selected = await open({ multiple: false, directory: true, title: "导入 Markdown 文件夹" });
  if (!selected || Array.isArray(selected)) return [];
  return invoke<NativeMarkdownFile[]>("scan_markdown_directory", { root: selected });
}

export async function chooseNativeDirectory(title: string): Promise<string | null> {
  const selected = await open({ multiple: false, directory: true, title });
  return typeof selected === "string" ? selected : null;
}

export async function chooseNativeSavePath(defaultPath: string): Promise<string | null> {
  return save({ defaultPath, filters: markdownFilters, title: "保存 Markdown" });
}

export async function uniqueNativeMarkdownPath(directory: string, suggestedName: string): Promise<string> {
  return invoke<string>("unique_markdown_path", { directory, suggestedName });
}

export async function writeNativeMarkdown(path: string, content: string): Promise<NativeWriteResult> {
  return invoke<NativeWriteResult>("write_markdown_file", { path, content });
}

export async function readNativeSnapshot(path: string): Promise<NativeFileSnapshot> {
  return invoke<NativeFileSnapshot>("read_file_snapshot", { path });
}

export async function writeNativeImage(directory: string, fileName: string, bytes: Uint8Array): Promise<string> {
  return invoke<string>("write_image_file", { directory, fileName, bytes: Array.from(bytes) });
}
