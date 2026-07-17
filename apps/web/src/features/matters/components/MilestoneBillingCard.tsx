"use client";
import { useState } from "react";
import { CreditCard, CheckCircle2, TrendingUp, AlertCircle, Loader2 } from "lucide-react";
import { useMatter, matterKeys } from "../hooks/useMatters";
import { Button, Badge, Card, useToast } from "@/shared/components/ui";
import { apiClient } from "@/shared/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { useFeatures } from "@/shared/hooks/useFeatures";

export function MilestoneBillingCard({ matterId, isLawyer }: { matterId: string; isLawyer?: boolean }) {
  const { data: matter } = useMatter(matterId);
  const qc = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const toast = useToast();

  const { features } = useFeatures();

  if (!features || !features.billing) {
    return null;
  }

  const milestones = matter?.milestones || [];
  const billableMilestones = milestones.filter(m => m.amount_inr && m.amount_inr > 0);

  if (billableMilestones.length === 0) {
    return null;
  }

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePay = async (milestoneId: string) => {
    setProcessingId(milestoneId);
    try {
      // 1. Create order on server
      const orderData = await apiClient.post<any>(
        `/matters/${matterId}/milestones/${milestoneId}/razorpay-order`,
        {}
      );

      if (orderData.mock) {
        // Simulated checkout for mock credentials
        toast.info("Simulating mock payment gateway...");
        setTimeout(async () => {
          try {
            const mockPaymentId = "pay_mock_" + Math.random().toString(36).substring(2, 11);
            const mockSignature = "mock_sig_" + Math.random().toString(36).substring(2, 11);
            
            await apiClient.post(
              `/matters/${matterId}/milestones/${milestoneId}/verify-payment`,
              {
                razorpay_payment_id: mockPaymentId,
                razorpay_order_id: orderData.order_id,
                razorpay_signature: mockSignature
              }
            );
            qc.invalidateQueries({ queryKey: matterKeys.detail(matterId) });
            toast.success("Mock payment completed and verified!");
          } catch (err: any) {
            toast.error("Mock verification failed: " + err.message);
          } finally {
            setProcessingId(null);
          }
        }, 1000);
        return;
      }

      // 2. Load Razorpay script for production
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        toast.error("Failed to load Razorpay SDK. Please check your internet connection.");
        setProcessingId(null);
        return;
      }

      // 3. Open Razorpay Checkout modal
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "LeAd Platform",
        description: "Milestone Case Payment",
        order_id: orderData.order_id,
        handler: async (response: any) => {
          try {
            setProcessingId(milestoneId);
            await apiClient.post(
              `/matters/${matterId}/milestones/${milestoneId}/verify-payment`,
              {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              }
            );
            qc.invalidateQueries({ queryKey: matterKeys.detail(matterId) });
            toast.success("Payment successful and verified!");
          } catch (err: any) {
            toast.error("Payment verification failed: " + err.message);
          } finally {
            setProcessingId(null);
          }
        },
        modal: {
          ondismiss: () => {
            setProcessingId(null);
          }
        },
        theme: {
          color: "#1E3A8A"
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (e: any) {
      toast.error("Order creation failed: " + e.message);
      setProcessingId(null);
    }
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
