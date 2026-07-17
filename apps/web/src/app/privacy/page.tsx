import Link from "next/link";

export const metadata = {
  title: "Privacy Policy - LeAd Platform",
  description: "Privacy policy for the LeAd Platform, ensuring safety and compliance.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-serif font-bold mb-8 text-brand-blue-dark">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-6">Last updated: July 2026</p>
      
      <div className="prose prose-blue max-w-none space-y-6 text-gray-800">
        <p>
          At LeAd, we prioritize the protection and privacy of your personal, legal, and financial data. This Privacy Policy details how we collect, use, and secure your information.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4 text-brand-blue-dark">1. Data We Collect</h2>
        <p>
          We collect personal identification details (name, email, phone), legal case metadata (matter descriptions, timelines, files), and billing details (GSTIN, place of supply) necessary to match you with legal professionals and process payments.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4 text-brand-blue-dark">2. Storage and Security</h2>
        <p>
          All legal documents are securely stored in private cloud storage buckets with strict Row-Level Security (RLS). Access to sensitive case files is restricted to authorized legal professionals and the case owner.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4 text-brand-blue-dark">3. Data Sharing</h2>
        <p>
          We do not sell, trade, or share your personal data with third parties except as required to fulfill legal services (e.g. sharing details with your matched lawyer) or to process financial transactions via our secure payment gateway partner, Razorpay.
        </p>
      </div>
      
      <div className="mt-12 pt-6 border-t border-gray-200">
        <Link href="/" className="text-blue-600 hover:underline">
          Return to Home
        </Link>
      </div>
    </div>
  );
}
