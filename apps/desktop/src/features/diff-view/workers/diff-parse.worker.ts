/// <reference lib="webworker" />

import { parseDiffFromFile, parsePatchFiles } from "@pierre/diffs";

type DiffFile = {
  name: string;
  contents: string;
  cacheKey?: string;
};

type ParseRequestMessage =
  | {
      type: "parse";
      requestId: number;
      oldFile: DiffFile;
      newFile: DiffFile;
    }
  | {
      type: "parse-patch";
      requestId: number;
      patchText: string;
    };

type ParseResponseMessage =
  | {
      type: "parsed";
      requestId: number;
      data: ReturnType<typeof parseDiffFromFile>;
    }
  | {
      type: "parsed-patch";
      requestId: number;
      data: ReturnType<typeof parsePatchFiles>;
    }
  | {
      type: "error" | "error-patch";
      requestId: number;
      message: string;
    };

self.addEventListener("message", (event: MessageEvent<ParseRequestMessage>) => {
  const message = event.data;

  if (message.type === "parse") {
    try {
      const data = parseDiffFromFile(message.oldFile, message.newFile);
      const response: ParseResponseMessage = {
        type: "parsed",
        requestId: message.requestId,
        data,
      };
      // eslint-disable-next-line unicorn/require-post-message-target-origin -- WorkerGlobalScope.postMessage does not accept targetOrigin
      self.postMessage(response);
    } catch (error) {
      const response: ParseResponseMessage = {
        type: "error",
        requestId: message.requestId,
        message: error instanceof Error ? error.message : String(error),
      };
      // eslint-disable-next-line unicorn/require-post-message-target-origin -- WorkerGlobalScope.postMessage does not accept targetOrigin
      self.postMessage(response);
    }
    return;
  }

  if (message.type === "parse-patch") {
    try {
      const data = parsePatchFiles(message.patchText);
      const response: ParseResponseMessage = {
        type: "parsed-patch",
        requestId: message.requestId,
        data,
      };
      // eslint-disable-next-line unicorn/require-post-message-target-origin -- WorkerGlobalScope.postMessage does not accept targetOrigin
      self.postMessage(response);
    } catch (error) {
      const response: ParseResponseMessage = {
        type: "error-patch",
        requestId: message.requestId,
        message: error instanceof Error ? error.message : String(error),
      };
      // eslint-disable-next-line unicorn/require-post-message-target-origin -- WorkerGlobalScope.postMessage does not accept targetOrigin
      self.postMessage(response);
    }
    return;
  }
});
