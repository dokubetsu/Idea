"use client";
import { useRouter } from "next/navigation";
import LegalNoticeWizard from "@/features/legal-notice/components/LegalNoticeWizard";

export default function UserLegalNoticePage() {
  const router = useRouter();
  return (
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold mb-3">Standalone Document Service</p>
        <h1 className="font-serif text-4xl font-bold mb-6">Legal Notice Generator</h1>
      </div>
      <LegalNoticeWizard onClose={() => router.push("/user/dashboard")} />
    </div>
  );
}
