import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Credits",
  description: "Your Interviews Agent credit balance.",
};

export default function CreditsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
