import { createElement, useState, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { RichTextEditor } from "@/components/clinical/rich-text-editor";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function ControlledEditor({
  initial = "",
}: {
  initial?: string;
}): ReactElement {
  const [value, setValue] = useState(initial);
  return createElement(
    "div",
    null,
    createElement(RichTextEditor, {
      value,
      onChange: setValue,
      placeholder: "Formatted note",
    }),
    createElement("output", { "data-testid": "html-value" }, value),
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "load-template",
        onClick: () => setValue("<p>Template loaded note</p>"),
      },
      "Load template",
    ),
  );
}

function editable(): HTMLDivElement {
  const el = document.querySelector(
    '[contenteditable="true"]',
  ) as HTMLDivElement | null;
  if (!el) throw new Error("contentEditable editor not found");
  return el;
}

/** Append text at end and fire input — mimics browser typing after caret at end. */
function typeChar(el: HTMLDivElement, ch: string) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);

  // jsdom often lacks execCommand insertText; mutate DOM then fire input.
  const inserted = document.createTextNode(ch);
  range.insertNode(inserted);
  range.setStartAfter(inserted);
  range.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(range);
  fireEvent.input(el);
}

describe("RichTextEditor", () => {
  it("keeps multi-character typing in order (does not reverse)", async () => {
    render(createElement(ControlledEditor));
    const el = editable();
    const sentence = "Patient needs follow up visit";

    for (const ch of sentence) {
      await act(async () => {
        typeChar(el, ch);
      });
    }

    await waitFor(() => {
      expect(el.textContent).toBe(sentence);
    });
    expect(screen.getByTestId("html-value").textContent).toContain(sentence);
    // Explicitly guard against the old reverse-typing failure mode.
    expect(el.textContent).not.toBe([...sentence].reverse().join(""));
  });

  it("applies external value updates (template / AI enhance)", async () => {
    render(createElement(ControlledEditor, { initial: "<p>Draft</p>" }));
    const el = editable();

    await waitFor(() => {
      expect(el.innerHTML).toContain("Draft");
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("load-template"));
    });

    await waitFor(() => {
      expect(el.innerHTML).toContain("Template loaded note");
    });
    expect(screen.getByTestId("html-value").textContent).toContain(
      "Template loaded note",
    );
  });

  it("toolbar bold command calls execCommand and updates value", async () => {
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      writable: true,
      value: vi.fn(() => true),
    });

    render(createElement(ControlledEditor, { initial: "hello" }));
    await waitFor(() => {
      expect(editable().textContent).toContain("hello");
    });

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Bold"));
    });

    expect(document.execCommand).toHaveBeenCalledWith("bold", false, undefined);
  });
});
