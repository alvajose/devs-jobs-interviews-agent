import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in or create a free Interviews Agent account to generate personalized interview prep roadmaps.",
  alternates: { canonical: "/login" },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
