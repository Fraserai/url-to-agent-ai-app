import type { PlanId, PlatformId } from "@/lib/types";
import pricingCatalog from "@/data/pricing-catalog.json";

export const BRAND_COLOURS = [
  "#1a6b4a",
  "#2563eb",
  "#E85D24",
  "#9333ea",
  "#dc2626",
  "#0891b2",
  "#d97706",
  "#1a1a1a"
] as const;

export const INDUSTRY_TAGS = [
  "Cafes",
  "Law Firms",
  "Tradies",
  "Real Estate",
  "Fitness",
  "Retail",
  "Clinics"
];

export const PLATFORMS: Array<{
  id: PlatformId;
  name: string;
  icon: string;
  color: string;
}> = [
  { id: "wordpress", name: "WordPress", icon: "W", color: "#21759b" },
  { id: "shopify", name: "Shopify", icon: "S", color: "#96bf48" },
  { id: "squarespace", name: "Squarespace", icon: "Sq", color: "#1a1a1a" },
  { id: "wix", name: "Wix", icon: "Wx", color: "#0c6efc" },
  { id: "other", name: "Other website", icon: "W", color: "#666666" }
];

export const PLANS = pricingCatalog as Array<{
  id: PlanId;
  name: string;
  tagline: string;
  setup: number;
  monthly: number;
  annual: number;
  features: string[];
  cta: string;
  popular: boolean;
}>;

export const COMPARISONS = [
  {
    label: "AI agency custom build",
    cost: "$8,000 – $25,000 setup",
    monthly: "$500 – $2,000/mo",
    time: "2 – 6 weeks"
  },
  {
    label: "Hire a developer",
    cost: "$5,000 – $15,000 setup",
    monthly: "$300 – $800/mo maintenance",
    time: "3 – 8 weeks"
  },
  {
    label: "Virtual receptionist",
    cost: "No setup",
    monthly: "$400 – $800/mo",
    time: "Ongoing"
  },
  {
    label: "AgentDrop",
    cost: "From $500 setup",
    monthly: "From $300/mo",
    time: "2 minutes",
    highlight: true
  }
];

export const FAQS = [
  {
    question: "Do I need any technical skills?",
    answer:
      "None at all. You paste your website URL and we handle everything, from building the agent to deploying it on your site."
  },
  {
    question: "What if the AI gets something wrong?",
    answer:
      "You can review and edit the business details anytime. The agent sticks to the information it has and avoids making things up."
  },
  {
    question: "Can I try it before I pay?",
    answer:
      "Yes. You can build and test the agent first, then choose a plan when you are ready to go live."
  },
  {
    question: "What happens if I cancel?",
    answer:
      "The widget can be removed from your website and the hosted agent goes offline. There are no lock-in contracts in this MVP flow."
  },
  {
    question: "What's the setup fee for?",
    answer:
      "It covers the website scan, custom prompt creation, and deployment setup. On annual billing, the setup fee is waived."
  },
  {
    question: "How is this different from a normal chatbot?",
    answer:
      "Normal chatbots usually need manual scripting. AgentDrop builds a business-aware agent automatically from your website and keeps the setup simple."
  }
];
