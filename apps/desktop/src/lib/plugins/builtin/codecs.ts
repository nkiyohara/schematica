import {
  parseData,
  stringifyData,
  updateDataText,
  type CommentPreservation,
  type DataFormat,
} from "@schematica/core";
import type { ConfigCodec } from "../types";

export function createConfigCodecs(): ConfigCodec[] {
  return [
    codec("core.codec.yaml", "YAML", "yaml", ["yaml", "yml"], "best-effort"),
    codec("core.codec.json", "JSON", "json", ["json"], "off"),
    codec("core.codec.toml", "TOML", "toml", ["toml"], "best-effort"),
  ];
}

export function codecForFormat(
  codecs: readonly ConfigCodec[],
  format: DataFormat,
): ConfigCodec | undefined {
  return codecs.find((codec) => codec.format === format);
}

function codec(
  id: string,
  title: string,
  format: DataFormat,
  extensions: string[],
  defaultCommentPreservation: CommentPreservation,
): ConfigCodec {
  return {
    id,
    title,
    format,
    extensions,
    parse: (text) => parseData(text, { format }),
    stringify: (value) => stringifyData(value, { format }),
    updateText: (text, path, value, options) =>
      updateDataText(text, path, value, {
        format,
        preserveComments: options?.preserveComments ?? defaultCommentPreservation,
      }),
    preservesComments: defaultCommentPreservation !== "off",
  };
}
