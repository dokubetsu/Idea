import Link from "next/link";

export const metadata = {
  title: "Terms of Service - LeAd Platform",
  description: "Terms of service for the LeAd Platform, governing the usage of our legal services.",
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-serif font-bold mb-8 text-brand-blue-dark">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-6">Last updated: July 2026</p>
      
      <div className="prose prose-blue max-w-none space-y-6 text-gray-800">
        <p>
          Welcome to the LeAd Platform. By accessing or using our services, you agree to comply with and be bound by the following Terms of Service.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4 text-brand-blue-dark">1. Nature of Services</h2>
        <p>
          LeAd is a platform that facilitates matching between clients and independent legal practitioners. LeAd does not provide direct legal representation, legal advice, or advocate services. The legal professional matched with you is solely responsible for their legal counsel.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4 text-brand-blue-dark">2. Payments and Milestones</h2>
        <p>
          Payments for milestones, sessions, and disbursements are processed securely via our gateway. By initiating a payment, you agree to pay the specified amount, including standard taxes (18% GST). Payment disputes or refunds are subject to the terms agreed upon with your matched lawyer.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4 text-brand-blue-dark">3. User Responsibility</h2>
        <p>
          You agree to provide accurate, true, and complete information when booking consultations or uploading matter files. Any attempt to upload malicious documents, commit billing fraud, or tamper with the platform will result in immediate termination of your access.
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
