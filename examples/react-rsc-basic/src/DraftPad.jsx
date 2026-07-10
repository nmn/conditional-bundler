"use client";

import React, { useId, useState } from "react";

const maxLength = 80;

export function DraftPad() {
  const fieldId = useId();
  const [draft, setDraft] = useState("");

  return (
    <section className="client-panel draft-pad">
      <label className="label" htmlFor={fieldId}>
        Local draft
      </label>
      <textarea
        id={fieldId}
        maxLength={maxLength}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Write without a server round trip"
        rows={3}
        value={draft}
      />
      <output htmlFor={fieldId}>
        {draft.length}/{maxLength}
      </output>
    </section>
  );
}
