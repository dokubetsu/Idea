"use client";

import { useState, useEffect, useRef } from "react";
import { Briefcase, X } from "lucide-react";
import { useCreateMatter } from "@/features/matters/hooks/useMatters";
import { Button, Input, Textarea, Select, Card } from "@/shared/components/ui";
import { MatterPriority } from "@/entities/types";

interface InviteClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InviteClientModal({ isOpen, onClose, onSuccess }: InviteClientModalProps) {
  const createMatter = useCreateMatter();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [newMatter, setNewMatter] = useState({
    title: "",
    client_email: "",
    client_phone: "",
    category: "cheque_bounce",
    priority: "medium" as MatterPriority,
    court_name: "",
    case_number: "",
    summary: ""
  });

  // Focus trap + Escape handler
  useEffect(() => {
    if (!isOpen) return;
    const el = dialogRef.current;
    if (!el) return;

    const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const getFocusable = () =>
      Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => !n.hasAttribute("disabled") && window.getComputedStyle(n).display !== "none"
      );

    // Focus first focusable element on open
    const first = getFocusable()[0];
    if (first) first.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstEl) { lastEl.focus(); e.preventDefault(); }
      } else {
        if (document.activeElement === lastEl) { firstEl.focus(); e.preventDefault(); }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleCreateMatter(e: React.FormEvent) {
    e.preventDefault();
    if (!newMatter.title || !newMatter.client_email) return;
    await createMatter.mutateAsync({
      title: newMatter.title,
      client_email: newMatter.client_email,
      client_phone: newMatter.client_phone || undefined,
      category: newMatter.category,
      priority: newMatter.priority,
      court_name: newMatter.court_name || undefined,
      case_number: newMatter.case_number || undefined,
      summary: newMatter.summary
    });
    setNewMatter({
      title: "",
      client_email: "",
      client_phone: "",
      category: "cheque_bounce",
      priority: "medium",
      court_name: "",
      case_number: "",
      summary: ""
    });
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
        className="w-full max-w-lg"
      >
      <Card className="p-6 relative animate-scale-up space-y-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-brand-blue-light/50 hover:text-brand-blue-dark"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex gap-3 items-center border-b border-brand-gold/12 pb-3">
          <Briefcase className="h-6 w-6 text-brand-gold" />
          <div>
            <h3 id="invite-modal-title" className="font-serif text-xl font-bold">Invite Client & Create Case</h3>
            <p className="text-xs text-brand-blue-light/55">Create a case timeline and invite the client via email.</p>
          </div>
        </div>

        <form onSubmit={handleCreateMatter} className="space-y-4">
          <Input
            label="Case Title / Matter Name"
            placeholder="e.g. Ramesh Sharma - Cheque Bounce Issue"
            value={newMatter.title}
            onChange={(e) => setNewMatter({ ...newMatter, title: e.target.value })}
            required
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              type="email"
              label="Client Email Address"
              placeholder="e.g. client@example.com"
              value={newMatter.client_email}
              onChange={(e) => setNewMatter({ ...newMatter, client_email: e.target.value })}
              required
            />
            <Input
              label="Client Phone / WhatsApp"
              placeholder="e.g. +91 98765 43210"
              value={newMatter.client_phone}
              onChange={(e) => setNewMatter({ ...newMatter, client_phone: e.target.value })}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Category"
              value={newMatter.category}
              onChange={(e) => setNewMatter({ ...newMatter, category: e.target.value })}
            >
              <option value="cheque_bounce">Cheque Bounce (Sec 138)</option>
              <option value="rera">RERA Dispute</option>
              <option value="consumer">Consumer Court Grievance</option>
              <option value="property">Property Partition / Possession</option>
              <option value="family">Family/Divorce Matter</option>
              <option value="criminal">Criminal Defense</option>
              <option value="other">Other Civil Dispute</option>
            </Select>
            <Select
              label="Priority"
              value={newMatter.priority}
              onChange={(e) => setNewMatter({ ...newMatter, priority: e.target.value as MatterPriority })}
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Court Name (Optional)"
              placeholder="e.g. Bombay High Court"
              value={newMatter.court_name}
              onChange={(e) => setNewMatter({ ...newMatter, court_name: e.target.value })}
            />
            <Input
              label="Case/CNR Number (Optional)"
              placeholder="e.g. CNR-MH-1092-2026"
              value={newMatter.case_number}
              onChange={(e) => setNewMatter({ ...newMatter, case_number: e.target.value })}
            />
          </div>

          <Textarea
            label="Case Description / Summary"
            placeholder="Details about the dispute, legal actions, and status..."
            value={newMatter.summary}
            onChange={(e) => setNewMatter({ ...newMatter, summary: e.target.value })}
          />

          <div className="flex gap-3 justify-end pt-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={createMatter.isPending}>
              {createMatter.isPending ? "Creating..." : "Create Case & Invite"}
            </Button>
          </div>
        </form>
      </Card>
      </div>
    </div>
  );
}
