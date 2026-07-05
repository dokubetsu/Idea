"use client";
import { useState } from "react";
import { CreditCard, CheckCircle2, TrendingUp, AlertCircle, Loader2 } from "lucide-react";
import { useMatter, matterKeys } from "../hooks/useMatters";
import { Button, Badge, Card, useToast } from "@/shared/components/ui";
import { apiClient } from "@/shared/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";

export function MilestoneBillingCard({ matterId, isLawyer }: { matterId: string; isLawyer?: boolean }) {
  const { data: matter } = useMatter(matterId);
  const qc = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const toast = useToast();

  const milestones = matter?.milestones || [];
  const billableMilestones = milestones.filter(m => m.amount_inr && m.amount_inr > 0);

  if (billableMilestones.length === 0) {
    return null;
  }

  const handlePay = async (milestoneId: string) => {
    // Mock payment gateway flow
    setProcessingId(milestoneId);
    const randomSuffix = Math.random().toString(36).substring(2, 11);
    const paymentId = "pay_" + randomSuffix;
    
    setTimeout(async () => {
      try {
        await apiClient.patch(`/matters/${matterId}/milestones/${milestoneId}`, {
          payment_gateway_ref: paymentId
        });
        qc.invalidateQueries({ queryKey: matterKeys.detail(matterId) });
        toast.success("Payment initiated! Awaiting gateway confirmation.");
      } catch (e: any) {
        toast.error("Payment failed: " + e.message);
      } finally {
        setProcessingId(null);
      }
    }, 1500);
  };

  const totalBilled = billableMilestones.reduce((acc, m) => acc + (m.amount_inr || 0), 0);
  const totalPaid = billableMilestones.filter(m => m.is_paid).reduce((acc, m) => acc + (m.amount_inr || 0), 0);
  const totalDue = totalBilled - totalPaid;

  return (
    <Card className="overflow-hidden border-brand-gold/20 shadow-md">
      {/* Demo Warning Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2 flex items-center gap-2 text-amber-500 text-xs font-semibold">
        <AlertCircle className="h-4 w-4" />
        <span>DEMO MODE — NOT REAL PAYMENTS</span>
      </div>

      <div className="flex items-center justify-between border-b border-brand-gold/8 bg-brand-gold/5 px-5 py-4">
        <div>
          <h3 className="font-serif text-xl font-bold flex items-center gap-2 text-brand-blue-dark">
            <CreditCard className="h-5 w-5 text-brand-gold" /> Milestone Billing
          </h3>
          <p className="mt-1 text-xs text-brand-blue-light/60">Track and pay for case milestones.</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-blue-light/50">Total Due</p>
          <p className="font-serif text-2xl font-bold text-brand-gold">₹{totalDue.toLocaleString("en-IN")}</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {billableMilestones.map(m => (
          <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-brand-gold/15 rounded-xl bg-base-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-brand-blue-dark">{m.title}</span>
                {m.status === "completed" && <Badge tone="teal" className="text-[9px]">Completed</Badge>}
                {m.status === "current" && <Badge tone="gold" className="text-[9px]">In Progress</Badge>}
              </div>
              <p className="text-xs font-medium text-brand-blue-light/70">
                Amount: <span className="text-brand-blue-dark font-bold">₹{m.amount_inr?.toLocaleString("en-IN")}</span>
              </p>
            </div>
            
            <div className="flex items-center gap-3 self-end sm:self-center">
              {m.is_paid ? (
                <div className="flex items-center gap-1.5 text-brand-teal text-sm font-bold bg-brand-teal/10 px-3 py-1.5 rounded-lg border border-brand-teal/20">
                  <CheckCircle2 className="h-4 w-4" /> Paid
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-brand-gold text-sm font-bold">
                    <AlertCircle className="h-4 w-4" /> Pending
                  </div>
                  {!isLawyer && (
                    <Button 
                      size="sm" 
                      variant="primary"
                      onClick={() => handlePay(m.id)}
                      disabled={processingId === m.id || m.status === 'pending'}
                      className="ml-2"
                    >
                      {processingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay Now"}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
