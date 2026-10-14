"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import type { AgentWorkspace, AgentWorkspaceOverrides } from "@/packages/shared/src/types/agentWorkspace";

type EditBusinessModalProps = {
  workspace: AgentWorkspace;
  onClose: () => void;
  onSave: (patch: AgentWorkspaceOverrides) => Promise<void>;
};

export function EditBusinessModal({ workspace, onClose, onSave }: EditBusinessModalProps) {
  const [form, setForm] = useState({
    business_name: workspace.business_name,
    summary: workspace.summary,
    services: workspace.services,
    phone: workspace.phone ?? "",
    email: workspace.email ?? "",
    hours: workspace.hours ?? "",
    welcome_message: workspace.welcome_message,
    agent_instructions: workspace.agent_instructions
  });
  const [newService, setNewService] = useState("");
  const [saving, setSaving] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    await onSave({
      business_name: form.business_name,
      summary: form.summary,
      services: form.services,
      phone: form.phone || null,
      email: form.email || null,
      hours: form.hours || null,
      welcome_message: form.welcome_message,
      agent_instructions: form.agent_instructions
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/45 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="min-h-full bg-white sm:min-h-0 sm:w-full sm:max-w-[520px] sm:rounded-[20px] sm:shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
        <div className="sticky top-0 flex items-center justify-between bg-white px-5 pb-1 pt-5">
          <h2 className="text-lg font-bold">Refine the agent workspace</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[22px] leading-none text-black/30"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <Field label="Business name">
            <input
              value={form.business_name}
              onChange={(event) => update("business_name", event.target.value)}
              className="w-full rounded-[10px] border border-black/10 px-3.5 py-2.5 outline-none"
            />
          </Field>

          <Field label="Summary">
            <textarea
              value={form.summary}
              onChange={(event) => update("summary", event.target.value)}
              rows={4}
              className="w-full rounded-[10px] border border-black/10 px-3.5 py-2.5 outline-none"
            />
          </Field>

          <Field label="Services">
            <div className="mb-2 flex flex-wrap gap-2">
              {form.services.map((service) => (
                <span
                  key={service}
                  className="inline-flex items-center gap-1 rounded-full border border-brand/15 bg-brand/5 px-2.5 py-1 text-xs font-medium text-brand"
                >
                  {service}
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        "services",
                        form.services.filter((item) => item !== service)
                      )
                    }
                    className="text-sm leading-none"
                    aria-label={`Remove ${service}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newService}
                onChange={(event) => setNewService(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (!newService.trim()) return;
                    update("services", [...form.services, newService.trim()]);
                    setNewService("");
                  }
                }}
                placeholder="Add a service..."
                className="flex-1 rounded-[10px] border border-black/10 px-3.5 py-2.5 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newService.trim()) return;
                  update("services", [...form.services, newService.trim()]);
                  setNewService("");
                }}
                className="rounded-[10px] border border-brand/15 bg-brand/5 px-4 py-2 text-sm font-semibold text-brand"
              >
                Add
              </button>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                className="w-full rounded-[10px] border border-black/10 px-3.5 py-2.5 outline-none"
              />
            </Field>

            <Field label="Email">
              <input
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                className="w-full rounded-[10px] border border-black/10 px-3.5 py-2.5 outline-none"
              />
            </Field>
          </div>

          <Field label="Hours">
            <input
              value={form.hours}
              onChange={(event) => update("hours", event.target.value)}
              className="w-full rounded-[10px] border border-black/10 px-3.5 py-2.5 outline-none"
            />
          </Field>

          <Field label="Welcome message">
            <textarea
              value={form.welcome_message}
              onChange={(event) => update("welcome_message", event.target.value)}
              rows={3}
              className="w-full rounded-[10px] border border-black/10 px-3.5 py-2.5 outline-none"
            />
          </Field>

          <Field label="Agent instructions">
            <textarea
              value={form.agent_instructions}
              onChange={(event) => update("agent_instructions", event.target.value)}
              rows={3}
              placeholder="Example: Be concise, friendly, and say clearly when the website does not confirm something."
              className="w-full rounded-[10px] border border-black/10 px-3.5 py-2.5 outline-none"
            />
          </Field>
        </div>

        <div className="sticky bottom-0 flex gap-2 bg-white px-5 pb-5 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="flex-1 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-black/8 bg-black/[0.04] px-5 py-3 text-sm font-semibold text-black/55"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-black/35">
        {label}
      </div>
      {children}
    </label>
  );
}
