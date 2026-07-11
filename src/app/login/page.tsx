import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoginForm } from "./login-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "-ml-2 mb-2 text-muted-foreground",
          })}
        >
          <ArrowLeft />
          Home
        </Link>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginForm error={error} message={message} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
